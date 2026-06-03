const db = require('../config/database');

exports.getAllPurchases = async (req, res) => {
    try {
        const query = `
            SELECT 
                p."PurchaseID", p."InvoiceNo", p."PurchaseDate", p."VendorID",
                v."VendorName", p."TotalAmount", p."PaidAmount",
                p."BalanceAmount", p."PaymentStatus", p."Description"
            FROM "Purchases" p
            LEFT JOIN "Vendors" v ON p."VendorID" = v."VendorID"
            WHERE p."IsActive" = true
            ORDER BY p."PurchaseDate" DESC
        `;
        const result = await db.executeQuery(query);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPurchaseById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.executeQuery(
            `SELECT * FROM "Purchases" WHERE "PurchaseID" = @Id`, { Id: id }
        );
        if (!result || result.length === 0) return res.status(404).json({ success: false, message: "Purchase not found" });
        res.json({ success: true, data: result[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createPurchase = async (req, res) => {
    try {
        const { VendorID, PurchaseDate, Description, TotalAmount, PaidAmount, Items } = req.body;

        if (!VendorID || !Items || Items.length === 0) {
            return res.status(400).json({ success: false, message: "Vendor and Items are required" });
        }

        const InvoiceNo = `INV-P-${Date.now()}`;
        const Paid = Number(PaidAmount) || 0;
        const Total = Number(TotalAmount) || 0;
        const Balance = Total - Paid;
        const PaymentStatus = Balance <= 0 ? 'Paid' : (Paid > 0 ? 'Partial' : 'Pending');

        // PostgreSQL: OUTPUT INSERTED -> RETURNING
        const masterResult = await db.executeQuery(`
            INSERT INTO "Purchases" ("InvoiceNo", "VendorID", "PurchaseDate", "Description", "TotalAmount", "PaidAmount", "BalanceAmount", "PaymentStatus")
            VALUES (@InvoiceNo, @VendorID, @PurchaseDate, @Description, @TotalAmount, @PaidAmount, @BalanceAmount, @PaymentStatus)
            RETURNING "PurchaseID"
        `, {
            InvoiceNo,
            VendorID: Number(VendorID),
            PurchaseDate: PurchaseDate || new Date(),
            Description: Description || '',
            TotalAmount: Total,
            PaidAmount: Paid,
            BalanceAmount: Balance,
            PaymentStatus
        });

        const newPurchaseID = masterResult[0].PurchaseID;

        for (const item of Items) {
            const Qty = Number(item.Quantity);
            const Rate = Number(item.Rate);
            const ProductID = Number(item.ProductID);

            await db.executeQuery(`
                INSERT INTO "PurchaseItems" ("PurchaseID", "ProductID", "Quantity", "Rate", "Amount")
                VALUES (@PurchaseID, @ProductID, @Quantity, @Rate, @Amount)
            `, { PurchaseID: newPurchaseID, ProductID, Quantity: Qty, Rate, Amount: Qty * Rate });

            try {
                const checkStock = await db.executeQuery(
                    `SELECT "StockID" FROM "Stock" WHERE "ProductID" = @Pid`, { Pid: ProductID }
                );
                if (checkStock && checkStock.length > 0) {
                    await db.executeQuery(`
                        UPDATE "Stock" SET "CurrentQuantity" = "CurrentQuantity" + @Qty, "LastUpdated" = NOW()
                        WHERE "ProductID" = @ProductID
                    `, { Qty, ProductID });
                } else {
                    await db.executeQuery(`
                        INSERT INTO "Stock" ("ProductID", "CurrentQuantity", "LastUpdated")
                        VALUES (@ProductID, @Qty, NOW())
                    `, { ProductID, Qty });
                }

                await db.executeQuery(`
                    INSERT INTO "StockMovement" ("ProductID", "MovementType", "Quantity", "ReferenceID", "ReferenceType", "Remarks", "CreatedAt")
                    VALUES (@ProductID, 'Purchase', @Qty, @RefID, 'Purchase', @Remarks, NOW())
                `, { ProductID, Qty, RefID: newPurchaseID, Remarks: `Purchase: ${InvoiceNo}` });
            } catch (stockError) {
                console.error("Stock Update Failed for ProductID " + ProductID, stockError);
            }
        }

        try {
            await db.executeQuery(`
                INSERT INTO "Ledger" ("VendorID", "TransactionDate", "TransactionType", "Remarks", "ReferenceID", "InvoiceNo", "Debit", "CreatedAt")
                VALUES (@VendorID, @PurchaseDate, 'Purchase', @Remarks, @RefID, @InvoiceNo, @Amount, NOW())
            `, {
                VendorID: Number(VendorID),
                PurchaseDate: PurchaseDate || new Date(),
                Remarks: `Purchase: ${InvoiceNo}`,
                RefID: newPurchaseID,
                InvoiceNo,
                Amount: Total
            });

            if (Paid > 0) {
                await db.executeQuery(`
                    INSERT INTO "Ledger" ("VendorID", "TransactionDate", "TransactionType", "Remarks", "ReferenceID", "InvoiceNo", "Credit", "CreatedAt")
                    VALUES (@VendorID, @PurchaseDate, 'Payment', @Remarks, @RefID, @InvoiceNo, @Amount, NOW())
                `, {
                    VendorID: Number(VendorID),
                    PurchaseDate: PurchaseDate || new Date(),
                    Remarks: `Payment Made: ${InvoiceNo}`,
                    RefID: newPurchaseID,
                    InvoiceNo,
                    Amount: Paid
                });
            }
        } catch (ledgerError) {
            console.error("Ledger Failed (non-blocking):", ledgerError);
        }

        res.status(201).json({ success: true, message: "Purchase created", PurchaseID: newPurchaseID, InvoiceNo });
    } catch (error) {
        console.error("Full Error creating Purchase:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addPayment = async (req, res) => {
    res.status(501).json({ message: "Add Payment coming soon" });
};

exports.returnPurchase = async (req, res) => {
    try {
        const { PurchaseID, ReturnDate, Reason } = req.body;
        if (!PurchaseID) return res.status(400).json({ success: false, message: "PurchaseID required" });

        const purchaseRes = await db.executeQuery(
            `SELECT * FROM "Purchases" WHERE "PurchaseID" = @Id`, { Id: Number(PurchaseID) }
        );
        if (!purchaseRes || purchaseRes.length === 0) return res.status(404).json({ success: false, message: "Purchase not found" });
        const purchase = purchaseRes[0];

        if (purchase.IsActive === false || purchase.IsActive === 0) {
            return res.status(400).json({ success: false, message: "Purchase already returned" });
        }

        const items = await db.executeQuery(
            `SELECT * FROM "PurchaseItems" WHERE "PurchaseID" = @Id`, { Id: Number(PurchaseID) }
        );

        for (const item of items) {
            await db.executeQuery(`
                UPDATE "Stock" SET "CurrentQuantity" = "CurrentQuantity" - @Qty, "LastUpdated" = NOW()
                WHERE "ProductID" = @ProductID
            `, { Qty: Number(item.Quantity), ProductID: Number(item.ProductID) });

            await db.executeQuery(`
                INSERT INTO "StockMovement" ("ProductID", "MovementType", "Quantity", "ReferenceID", "ReferenceType", "Remarks", "CreatedAt")
                VALUES (@ProductID, 'Return', @Qty, @RefID, 'Purchase', @Remarks, NOW())
            `, {
                ProductID: Number(item.ProductID),
                Qty: Number(item.Quantity),
                RefID: Number(PurchaseID),
                Remarks: Reason || `Purchase Return: ${purchase.InvoiceNo}`
            });
        }

        await db.executeQuery(
            `UPDATE "Purchases" SET "IsActive" = false WHERE "PurchaseID" = @Id`, { Id: Number(PurchaseID) }
        );

        try {
            await db.executeQuery(`
                INSERT INTO "Ledger" ("VendorID", "TransactionDate", "TransactionType", "Remarks", "ReferenceID", "InvoiceNo", "Credit", "CreatedAt")
                VALUES (@VendorID, @Date, 'Purchase', @Remarks, @RefID, @InvoiceNo, @Amount, NOW())
            `, {
                VendorID: Number(purchase.VendorID),
                Date: ReturnDate || new Date(),
                Remarks: `Purchase Return: ${purchase.InvoiceNo}`,
                RefID: Number(PurchaseID),
                InvoiceNo: purchase.InvoiceNo,
                Amount: Number(purchase.TotalAmount)
            });
        } catch (ledgerErr) {
            console.error("Ledger failed (non-blocking):", ledgerErr.message);
        }

        res.json({ success: true, message: "Purchase returned and stock deducted" });
    } catch (error) {
        console.error("Return Purchase Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
const db = require('../config/database');

exports.getAllSales = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT 
                s."SaleID", s."InvoiceNo", s."SaleDate", s."CustomerID",
                v."VendorName" AS "CustomerName", v."City",
                s."TotalAmount", s."ReceivedAmount" AS "PaidAmount",
                s."BalanceAmount", s."PaymentStatus", s."Description"
            FROM "Sales" s
            LEFT JOIN "Vendors" v ON s."CustomerID" = v."VendorID"
            WHERE s."IsActive" = true
            ORDER BY s."SaleDate" DESC
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error in Sales Controller:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSaleById = async (req, res) => {
    try {
        const saleResult = await db.executeQuery(
            `SELECT s.*, v."VendorName" AS "CustomerName", v."City" AS "CustomerCity", v."Phone" AS "CustomerPhone"
             FROM "Sales" s
             LEFT JOIN "Vendors" v ON s."CustomerID" = v."VendorID"
             WHERE s."SaleID" = @Id`,
            { Id: req.params.id }
        );
        if (!saleResult || saleResult.length === 0)
            return res.status(404).json({ success: false, message: "Sale not found" });

        const itemsResult = await db.executeQuery(
            `SELECT si."SaleItemID", si."ProductID", si."Quantity", si."Rate", si."Amount",
                    p."ProductName"
             FROM "SaleItems" si
             LEFT JOIN "Products" p ON si."ProductID" = p."ProductID"
             WHERE si."SaleID" = @Id`,
            { Id: req.params.id }
        );

        const sale = saleResult[0];
        sale.Items = itemsResult;

        res.json({ success: true, data: sale });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create a new Sale (with Stock Validation)
exports.createSale = async (req, res) => {
    try {
        const { CustomerID, SaleDate, Description, TotalAmount, ReceivedAmount, Items } = req.body;

        if (!CustomerID || !Items || Items.length === 0)
            return res.status(400).json({ success: false, message: "Customer and Items are required" });

        // ✅ STEP 1: Stock Validation - har item ka stock check karo BEFORE insert
        for (const item of Items) {
            const ProductID = Number(item.ProductID);
            const Qty = Number(item.Quantity);

            const stockRes = await db.executeQuery(
                `SELECT s."CurrentQuantity", p."ProductName" 
                 FROM "Stock" s 
                 JOIN "Products" p ON s."ProductID" = p."ProductID"
                 WHERE s."ProductID" = @ProductID`,
                { ProductID }
            );

            const available = stockRes.length > 0 ? Number(stockRes[0].CurrentQuantity) : 0;
            const productName = stockRes.length > 0 ? stockRes[0].ProductName : `Product #${ProductID}`;

            if (available <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: `"${productName}" is Out of Stock!` 
                });
            }

            if (available < Qty) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient stock for "${productName}". Available: ${available}, Requested: ${Qty}` 
                });
            }
        }

        const InvoiceNo = `INV-S-${Date.now()}`;
        const Paid = Number(ReceivedAmount) || 0;
        const Total = Number(TotalAmount) || 0;
        const Balance = Total - Paid;
        const PaymentStatus = Balance <= 0 ? 'Paid' : (Paid > 0 ? 'Partial' : 'Pending');

        const masterResult = await db.executeQuery(`
            INSERT INTO "Sales" ("InvoiceNo", "CustomerID", "SaleDate", "Description", "TotalAmount", "ReceivedAmount", "BalanceAmount", "PaymentStatus")
            VALUES (@InvoiceNo, @CustomerID, @SaleDate, @Description, @TotalAmount, @ReceivedAmount, @BalanceAmount, @PaymentStatus)
            RETURNING "SaleID"
        `, {
            InvoiceNo,
            CustomerID: Number(CustomerID),
            SaleDate: SaleDate || new Date(),
            Description: Description || '',
            TotalAmount: Total,
            ReceivedAmount: Paid,
            BalanceAmount: Balance,
            PaymentStatus
        });

        const newSaleID = masterResult[0].SaleID;
        if (!newSaleID) throw new Error("Failed to create Sale record");

        for (const item of Items) {
            const Qty = Number(item.Quantity);
            const Rate = Number(item.Rate);
            const Amount = Qty * Rate;
            const ProductID = Number(item.ProductID);

            await db.executeQuery(`
                INSERT INTO "SaleItems" ("SaleID", "ProductID", "Quantity", "Rate", "Amount")
                VALUES (@SaleID, @ProductID, @Quantity, @Rate, @Amount)
            `, { SaleID: newSaleID, ProductID, Quantity: Qty, Rate, Amount });

            await db.executeQuery(`
                UPDATE "Stock" SET "CurrentQuantity" = "CurrentQuantity" - @Qty, "LastUpdated" = NOW()
                WHERE "ProductID" = @ProductID
            `, { Qty, ProductID });
        }

        try {
            await db.executeQuery(`
                INSERT INTO "Ledger" ("VendorID", "TransactionDate", "TransactionType", "Remarks", "ReferenceID", "InvoiceNo", "Credit", "CreatedAt")
                VALUES (@VendorID, @SaleDate, 'Sale', @Remarks, @RefID, @InvoiceNo, @Amount, NOW())
            `, {
                VendorID: Number(CustomerID),
                SaleDate: SaleDate || new Date(),
                Remarks: `Sale: ${InvoiceNo}`,
                RefID: newSaleID,
                InvoiceNo,
                Amount: Total
            });
        } catch (ledgerError) {
            console.error("Ledger Update Failed:", ledgerError);
        }

        res.status(201).json({ success: true, message: "Sale created", SaleID: newSaleID, InvoiceNo });
    } catch (error) {
        console.error("Full Error creating Sale:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addPayment = async (req, res) => {
    try {
        const saleID = Number(req.params.id);
        const { amount, method, chequeNo, bankDetails, notes } = req.body;

        if (!amount || Number(amount) <= 0)
            return res.status(400).json({ success: false, message: "Valid amount is required" });

        const saleRes = await db.executeQuery(
            `SELECT * FROM "Sales" WHERE "SaleID" = @SaleID`, { SaleID: saleID }
        );
        if (!saleRes || saleRes.length === 0)
            return res.status(404).json({ success: false, message: "Sale not found" });

        const sale = saleRes[0];
        const payAmount  = Math.min(Number(amount), Number(sale.BalanceAmount));
        const newReceived = Number(sale.ReceivedAmount) + payAmount;
        const newBalance  = Number(sale.TotalAmount) - newReceived;
        const newStatus   = newBalance <= 0 ? 'Paid' : 'Partial';

        await db.executeQuery(`
            UPDATE "Sales"
            SET "ReceivedAmount" = @received,
                "BalanceAmount"  = @balance,
                "PaymentStatus"  = @status
            WHERE "SaleID" = @SaleID
        `, { received: newReceived, balance: newBalance, status: newStatus, SaleID: saleID });

        try {
            const remarks = `Payment (${method || 'Cash'})${chequeNo ? ' Chq#' + chequeNo : ''}${bankDetails ? ' - ' + bankDetails : ''}${notes ? ' | ' + notes : ''}`;
            await db.executeQuery(`
                INSERT INTO "Ledger" ("VendorID", "TransactionDate", "TransactionType", "Remarks", "ReferenceID", "InvoiceNo", "Debit", "CreatedAt")
                VALUES (@VendorID, NOW(), 'Payment', @Remarks, @RefID, @InvoiceNo, @Amount, NOW())
            `, {
                VendorID:  Number(sale.CustomerID),
                Remarks:   remarks,
                RefID:     saleID,
                InvoiceNo: sale.InvoiceNo,
                Amount:    payAmount
            });
        } catch (ledgerErr) {
            console.error("Ledger entry failed (non-blocking):", ledgerErr.message);
        }

        res.json({ success: true, message: "Payment recorded successfully", newBalance, newStatus });
    } catch (error) {
        console.error("Add Payment Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.returnSale = async (req, res) => {
    try {
        const { SaleID } = req.body;
        if (!SaleID) return res.status(400).json({ success: false, message: "SaleID is required" });

        const saleRes = await db.executeQuery(
            `SELECT * FROM "Sales" WHERE "SaleID" = @SaleID`, { SaleID: Number(SaleID) }
        );
        if (!saleRes || saleRes.length === 0)
            return res.status(404).json({ success: false, message: "Sale not found" });
        const sale = saleRes[0];

        if (sale.PaymentStatus === 'Returned')
            return res.status(400).json({ success: false, message: "Sale already returned" });

        const items = await db.executeQuery(
            `SELECT * FROM "SaleItems" WHERE "SaleID" = @SaleID`, { SaleID: Number(SaleID) }
        );

        for (const item of items) {
            await db.executeQuery(
                `UPDATE "Stock" SET "CurrentQuantity" = "CurrentQuantity" + @Qty, "LastUpdated" = NOW() WHERE "ProductID" = @ProductID`,
                { Qty: Number(item.Quantity), ProductID: Number(item.ProductID) }
            );
            await db.executeQuery(
                `INSERT INTO "StockMovement" ("ProductID", "MovementType", "Quantity", "ReferenceID", "ReferenceType", "Remarks", "CreatedAt")
                 VALUES (@ProductID, 'Return', @Qty, @RefID, 'Sale', @Remarks, NOW())`,
                { ProductID: Number(item.ProductID), Qty: Number(item.Quantity), RefID: Number(SaleID), Remarks: `Sale Return: ${sale.InvoiceNo}` }
            );
        }

        await db.executeQuery(
            `UPDATE "Sales" SET "PaymentStatus" = 'Returned', "IsActive" = false WHERE "SaleID" = @SaleID`,
            { SaleID: Number(SaleID) }
        );

        try {
            await db.executeQuery(
                `INSERT INTO "Ledger" ("VendorID", "TransactionDate", "TransactionType", "Remarks", "ReferenceID", "InvoiceNo", "Debit", "CreatedAt")
                 VALUES (@VendorID, NOW(), 'Sale Return', @Remarks, @RefID, @InvoiceNo, @Amount, NOW())`,
                { VendorID: Number(sale.CustomerID), Remarks: `Sale Return: ${sale.InvoiceNo}`, RefID: Number(SaleID), InvoiceNo: sale.InvoiceNo, Amount: Number(sale.TotalAmount) }
            );
        } catch (ledgerErr) {
            console.error("Ledger insert failed:", ledgerErr.message);
        }

        res.json({ success: true, message: "Sale returned successfully" });
    } catch (error) {
        console.error("Return Sale Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
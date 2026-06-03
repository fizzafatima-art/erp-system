const db = require('../config/database');

// @desc    Get all sales
// @route   GET /api/v1/sales
exports.getAllSales = async (req, res) => {
    try {
        const query = `
            SELECT 
                s.SaleID,
                s.InvoiceNo,
                s.SaleDate,
                s.CustomerID,
                v.VendorName AS CustomerName,
                v.City,
                s.TotalAmount,
                s.ReceivedAmount AS PaidAmount,
                s.BalanceAmount,
                s.PaymentStatus,
                s.Description
            FROM Sales s
            LEFT JOIN Vendors v ON s.CustomerID = v.VendorID
            WHERE s.IsActive = 1
            ORDER BY s.SaleDate DESC;
        `;
        
        const result = await db.executeQuery(query);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error in Sales Controller:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single sale by ID
// @route   GET /api/v1/sales/:id
exports.getSaleById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'SELECT * FROM Sales WHERE SaleID = @Id';
        const result = await db.executeQuery(query, { Id: id });
        
        if (result.length === 0) {
            return res.status(404).json({ success: false, message: "Sale not found" });
        }
        
        res.json({ success: true, data: result[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create a new Sale (With Stock Update, InvoiceNo & Ledger)
// @route   POST /api/v1/sales
exports.createSale = async (req, res) => {
    try {
        const { CustomerID, SaleDate, Description, TotalAmount, ReceivedAmount, Items } = req.body;
        
        console.log("Request Body:", req.body);

        if (!CustomerID || !Items || Items.length === 0) {
            return res.status(400).json({ success: false, message: "Customer and Items are required" });
        }

        // Generate Auto Invoice No
        const InvoiceNo = `INV-S-${Date.now()}`;

        const Paid = Number(ReceivedAmount) || 0;
        const Total = Number(TotalAmount) || 0;
        const Balance = Total - Paid;
        const PaymentStatus = Balance <= 0 ? 'Paid' : (Paid > 0 ? 'Partial' : 'Pending');

        // 1. Insert Sale Master
        const insertMasterQuery = `
            INSERT INTO Sales (InvoiceNo, CustomerID, SaleDate, Description, TotalAmount, ReceivedAmount, BalanceAmount, PaymentStatus)
            OUTPUT INSERTED.SaleID
            VALUES (@InvoiceNo, @CustomerID, @SaleDate, @Description, @TotalAmount, @ReceivedAmount, @BalanceAmount, @PaymentStatus)
        `;
        
        const masterParams = {
            InvoiceNo,
            CustomerID: Number(CustomerID),
            SaleDate: SaleDate || new Date(),
            Description: Description || '',
            TotalAmount: Total,
            ReceivedAmount: Paid,
            BalanceAmount: Balance,
            PaymentStatus
        };

        const masterResult = await db.executeQuery(insertMasterQuery, masterParams);
        const newSaleID = masterResult[0].SaleID; 

        console.log("New Sale ID Created:", newSaleID);

        if (!newSaleID) {
            throw new Error("Failed to create Sale record");
        }

        // 2. Insert Items aur Stock Update
        for (const item of Items) {
            const Qty = Number(item.Quantity);
            const Rate = Number(item.Rate);
            const Amount = Qty * Rate;
            const ProductID = Number(item.ProductID);

            // A. Insert SaleItem
            const itemQuery = `
                INSERT INTO SaleItems (SaleID, ProductID, Quantity, Rate, Amount)
                VALUES (@SaleID, @ProductID, @Quantity, @Rate, @Amount)
            `;
            await db.executeQuery(itemQuery, { SaleID: newSaleID, ProductID, Quantity: Qty, Rate, Amount });

            // B. UPDATE STOCK
            try {
                const stockQuery = `
                    UPDATE Stock 
                    SET CurrentQuantity = CurrentQuantity - @Qty,
                        LastUpdated = GETDATE()
                    WHERE ProductID = @ProductID
                `;
                await db.executeQuery(stockQuery, { Qty: Qty, ProductID: ProductID });
            } catch (stockError) {
                console.error("Stock Update Failed for ProductID " + ProductID, stockError);
            }
        }

        // 3. Insert into Ledger (Credit Entry) - ADDED
        try {
            const ledgerQuery = `
                INSERT INTO Ledger (VendorID, TransactionDate, TransactionType, Remarks, ReferenceID, InvoiceNo, Credit, CreatedAt)
                VALUES (@VendorID, @SaleDate, 'Sale', @Remarks, @RefID, @InvoiceNo, @Amount, GETDATE())
            `;
            await db.executeQuery(ledgerQuery, {
                VendorID: Number(CustomerID),
                SaleDate: SaleDate || new Date(),
                Remarks: `Sale: ${InvoiceNo}`,
                RefID: newSaleID,
                InvoiceNo: InvoiceNo,
                Amount: Total
            });
            console.log("Ledger Entry Added");
        } catch (ledgerError) {
            console.error("Ledger Update Failed:", ledgerError);
            // Ledger fail hone par sale rukna nahi chahiye
        }

        res.status(201).json({ success: true, message: "Sale created, Stock & Ledger updated", SaleID: newSaleID, InvoiceNo });
    } catch (error) {
        console.error("Full Error creating Sale:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Placeholder
exports.addPayment = async (req, res) => {
    res.status(501).json({ message: "Add Payment feature coming soon" });
};

// ... existing imports and functions ...

// @desc    Return a Sale (Refund & Restore Stock)
// @route   POST /api/v1/sales/return
// @desc    Return a Sale (Refund & Restore Stock & Reverse Ledger)
// @route   POST /api/v1/sales/return
// @desc    Return a Sale (Refund & Restore Stock & Reverse Ledger)
// @route   POST /api/v1/sales/return
// @desc    Return a Sale (Safe Version)
// @route   POST /api/v1/sales/return
// @desc    Return a Sale (Safe & Simple Version)
// @route   POST /api/v1/sales/return
// @desc    Return a Sale (Debug Version)
// @desc    Return a Sale
// @route   POST /api/v1/sales/return
exports.returnSale = async (req, res) => {
    try {
        const { SaleID } = req.body;
        console.log("🔄 Return Sale Request - SaleID:", SaleID);

        if (!SaleID) return res.status(400).json({ success: false, message: "SaleID is required" });

        const saleRes = await db.executeQuery(
            `SELECT * FROM Sales WHERE SaleID = @SaleID`,
            { SaleID: Number(SaleID) }
        );
        console.log("📋 Sale Found:", saleRes);

        if (saleRes.length === 0) return res.status(404).json({ success: false, message: "Sale not found" });
        const sale = saleRes[0];

        if (sale.PaymentStatus === 'Returned') {
            return res.status(400).json({ success: false, message: "Sale already returned" });
        }

        const items = await db.executeQuery(
            `SELECT * FROM SaleItems WHERE SaleID = @SaleID`,
            { SaleID: Number(SaleID) }
        );
        console.log("📦 Sale Items:", items);

        // Stock restore
        for (const item of items) {
            console.log("🔁 Restoring stock for ProductID:", item.ProductID, "Qty:", item.Quantity);
            await db.executeQuery(
                `UPDATE Stock SET CurrentQuantity = CurrentQuantity + @Qty, LastUpdated = GETDATE() WHERE ProductID = @ProductID`,
                { Qty: Number(item.Quantity), ProductID: Number(item.ProductID) }
            );

            // StockMovement
            await db.executeQuery(
                `INSERT INTO StockMovement (ProductID, MovementType, Quantity, ReferenceID, ReferenceType, Remarks, CreatedAt)
                 VALUES (@ProductID, 'Return', @Qty, @RefID, 'Sale', @Remarks, GETDATE())`,
                {
                    ProductID: Number(item.ProductID),
                    Qty: Number(item.Quantity),
                    RefID: Number(SaleID),
                    Remarks: `Sale Return: ${sale.InvoiceNo}`
                }
            );
        }

        // Sale status update
        console.log("✅ Updating Sale Status to Returned...");
        await db.executeQuery(
            `UPDATE Sales SET PaymentStatus = 'Returned', IsActive = 0 WHERE SaleID = @SaleID`,
            { SaleID: Number(SaleID) }
        );

        // Ledger - non-blocking
        try {
            await db.executeQuery(
                `INSERT INTO Ledger (VendorID, TransactionDate, TransactionType, Remarks, ReferenceID, InvoiceNo, Debit, CreatedAt)
                 VALUES (@VendorID, GETDATE(), 'Sale Return', @Remarks, @RefID, @InvoiceNo, @Amount, GETDATE())`,
                {
                    VendorID: Number(sale.CustomerID),
                    Remarks: `Sale Return: ${sale.InvoiceNo}`,
                    RefID: Number(SaleID),
                    InvoiceNo: sale.InvoiceNo,
                    Amount: Number(sale.TotalAmount)
                }
            );
            console.log("📒 Ledger entry added");
        } catch (ledgerErr) {
            console.error("⚠️ Ledger insert failed (non-blocking):", ledgerErr.message);
        }

        res.json({ success: true, message: "Sale returned successfully" });

    } catch (error) {
        console.error("❌ Return Sale Full Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// ... keep existing functions ...
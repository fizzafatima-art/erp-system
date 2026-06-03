const db = require('../config/database');

// @desc    Get General Ledger
// @route   GET /api/v1/ledger
exports.getGeneralLedger = async (req, res) => {
    try {
        // IMPORTANT: Column 'Description' nahi hai, use 'Remarks' likha hai.
        // Frontend ko 'Description' chahiye, isliye 'Remarks' ko 'Description' ke naam se bhejte hain.
        const query = `
            SELECT 
                l.LedgerID,
                l.TransactionDate,
                l.VendorID,
                v.VendorName,
                l.TransactionType,
                l.Remarks AS Description,  -- <--- FIX YAHAN HAI
                l.Debit,
                l.Credit,
                l.Balance
            FROM Ledger l
            LEFT JOIN Vendors v ON l.VendorID = v.VendorID
            ORDER BY l.TransactionDate DESC
        `;
        
        const result = await db.executeQuery(query);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error in Ledger Controller:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Ledger by Vendor/Customer ID
// @route   GET /api/v1/ledger/vendor/:id
exports.getLedgerByVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                *, 
                Remarks AS Description 
            FROM Ledger 
            WHERE VendorID = @Id 
            ORDER BY TransactionDate DESC
        `;
        const result = await db.executeQuery(query, { Id: id });
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
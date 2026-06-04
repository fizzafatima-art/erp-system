const db = require('../config/database');

exports.getGeneralLedger = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT 
                l."LedgerID", l."TransactionDate", l."VendorID",
                v."VendorName", l."TransactionType",
                l."Remarks" AS "Description",
                l."Debit", l."Credit", l."Balance"
            FROM "Ledger" l
            LEFT JOIN "Vendors" v ON l."VendorID" = v."VendorID"
            ORDER BY l."TransactionDate" DESC
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error in Ledger Controller:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getLedgerByVendor = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT *, "Remarks" AS "Description" 
            FROM "Ledger" 
            WHERE "VendorID" = @Id 
            ORDER BY "TransactionDate" DESC
        `, { Id: req.params.id });
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
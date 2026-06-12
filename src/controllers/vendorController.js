const db = require('../config/database');

// @desc    Get all vendors
exports.getAllVendors = async (req, res) => {
    try {
        const result = await db.executeQuery(
            `SELECT * FROM "Vendors" WHERE "IsActive" = true ORDER BY "VendorName" ASC`
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error in Vendor Controller:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Single Vendor
exports.getVendorById = async (req, res) => {
    try {
        const result = await db.executeQuery(
            `SELECT * FROM "Vendors" WHERE "VendorID" = @Id`,
            { Id: req.params.id }
        );
        if (!result || result.length === 0) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }
        res.json({ success: true, data: result[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create New Vendor
exports.createVendor = async (req, res) => {
    try {
        // ContactPerson wapas add kiya
        const { VendorName, ContactPerson, Phone, Email, City, Address, VendorType, OpeningBalance } = req.body;

        await db.executeQuery(`
            INSERT INTO "Vendors" (
                "VendorName", "ContactPerson", "Phone", "Email", "City", "Address", 
                "VendorType", "OpeningBalance", "IsActive", "CreatedAt"
            ) VALUES (
                @VendorName, @ContactPerson, @Phone, @Email, @City, @Address,
                @VendorType, @OpeningBalance, true, NOW()
            )
        `, { 
            VendorName, 
            ContactPerson: ContactPerson || null, // Agar empty hai to null save hoga
            Phone, 
            Email, 
            City, 
            Address, 
            VendorType, 
            OpeningBalance: OpeningBalance || 0 
        });

        res.json({ success: true, message: 'Vendor added successfully' });
    } catch (error) {
        console.error("Create Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Vendor
exports.updateVendor = async (req, res) => {
    try {
        const { VendorName, ContactPerson, Phone, Email, City, Address, VendorType, OpeningBalance } = req.body;

        await db.executeQuery(`
            UPDATE "Vendors" SET
                "VendorName"     = @VendorName,
                "ContactPerson"  = @ContactPerson,
                "Phone"          = @Phone,
                "Email"          = @Email,
                "City"           = @City,
                "Address"        = @Address,
                "VendorType"     = @VendorType,
                "OpeningBalance" = @OpeningBalance
            WHERE "VendorID" = @Id
        `, { 
            VendorName, 
            ContactPerson: ContactPerson || null,
            Phone, 
            Email, 
            City, 
            Address, 
            VendorType, 
            OpeningBalance: OpeningBalance || 0, 
            Id: req.params.id 
        });

        res.json({ success: true, message: 'Vendor updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Vendor (Soft Delete)
exports.deleteVendor = async (req, res) => {
    try {
        await db.executeQuery(
            `UPDATE "Vendors" SET "IsActive" = false WHERE "VendorID" = @Id`,
            { Id: req.params.id }
        );
        res.json({ success: true, message: 'Vendor deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Vendor Ledger
exports.getVendorLedger = async (req, res) => {
    try {
        const result = await db.executeQuery(
            `SELECT * FROM "Ledger" WHERE "VendorID" = @Id ORDER BY "TransactionDate" DESC`,
            { Id: req.params.id }
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Ledger Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
const db = require('../config/database');

// Helper: convert string fields to UPPERCASE (keep email lowercase by convention, but per requirement we uppercase everything except maybe email)
const upper = (v) => (v == null || v === '') ? v : String(v).trim().toUpperCase();

// @desc    Get all vendors (only ACTIVE vendors - for dropdowns & transactions)
exports.getAllVendors = async (req, res) => {
    try {
        const { includeInactive } = req.query;

        const query = includeInactive === 'true'
            ? `SELECT * FROM "Vendors" ORDER BY "VendorName" ASC`
            : `SELECT * FROM "Vendors" WHERE "IsActive" = true ORDER BY "VendorName" ASC`;

        const result = await db.executeQuery(query);
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
        const { VendorName, ContactPerson, Phone, Email, City, Address, VendorType, OpeningBalance } = req.body;

        if (!VendorName || !VendorName.trim()) {
            return res.status(400).json({ success: false, message: 'Vendor Name is required' });
        }

        // Normalize VendorType - only allow valid values
        const allowedTypes = ['SUPPLIER', 'CUSTOMER', 'BOTH'];
        let finalType = upper(VendorType);
        if (!allowedTypes.includes(finalType)) {
            finalType = 'CUSTOMER'; // safe default
        }

        await db.executeQuery(`
            INSERT INTO "Vendors" (
                "VendorName", "ContactPerson", "Phone", "Email", "City", "Address", 
                "VendorType", "OpeningBalance", "IsActive", "CreatedAt"
            ) VALUES (
                @VendorName, @ContactPerson, @Phone, @Email, @City, @Address,
                @VendorType, @OpeningBalance, true, NOW()
            )
        `, {
            VendorName:     upper(VendorName),
            ContactPerson:  upper(ContactPerson) || null,
            Phone:          Phone || null,
            Email:          Email ? String(Email).trim().toLowerCase() : null, // emails stay lowercase
            City:           upper(City),
            Address:        upper(Address),
            VendorType:     finalType,
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
        const { VendorName, ContactPerson, Phone, Email, City, Address, VendorType, OpeningBalance, IsActive } = req.body;

        if (!VendorName || !VendorName.trim()) {
            return res.status(400).json({ success: false, message: 'Vendor Name is required' });
        }

        const allowedTypes = ['SUPPLIER', 'CUSTOMER', 'BOTH'];
        let finalType = upper(VendorType);
        if (!allowedTypes.includes(finalType)) {
            finalType = 'CUSTOMER';
        }

        // IsActive can come as boolean or string 'true'/'false'
        const isActiveVal = (IsActive === false || IsActive === 'false') ? false : true;

        await db.executeQuery(`
            UPDATE "Vendors" SET
                "VendorName"     = @VendorName,
                "ContactPerson"  = @ContactPerson,
                "Phone"          = @Phone,
                "Email"          = @Email,
                "City"           = @City,
                "Address"        = @Address,
                "VendorType"     = @VendorType,
                "OpeningBalance" = @OpeningBalance,
                "IsActive"       = @IsActive
            WHERE "VendorID" = @Id
        `, {
            VendorName:     upper(VendorName),
            ContactPerson:  upper(ContactPerson) || null,
            Phone:          Phone || null,
            Email:          Email ? String(Email).trim().toLowerCase() : null,
            City:           upper(City),
            Address:        upper(Address),
            VendorType:     finalType,
            OpeningBalance: OpeningBalance || 0,
            IsActive:       isActiveVal,
            Id:             req.params.id
        });

        res.json({ success: true, message: 'Vendor updated successfully' });
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Vendor (Soft Delete) - Blocked if vendor has transactions
exports.deleteVendor = async (req, res) => {
    try {
        const vendorId = req.params.id;

        // Check if vendor has any transactions in Purchases, Sales, or Ledger
        const checkQuery = `
            SELECT
                (SELECT COUNT(*) FROM "Purchases" WHERE "VendorID" = @Id) AS "PurchaseCount",
                (SELECT COUNT(*) FROM "Sales" WHERE "CustomerID" = @Id) AS "SalesCount",
                (SELECT COUNT(*) FROM "Ledger" WHERE "VendorID" = @Id) AS "LedgerCount"
        `;
        const checkResult = await db.executeQuery(checkQuery, { Id: vendorId });
        const counts = checkResult[0];

        const totalTransactions =
            Number(counts.PurchaseCount) + Number(counts.SalesCount) + Number(counts.LedgerCount);

        if (totalTransactions > 0) {
            // Don't allow hard/soft delete if transactions exist - only allow deactivation
            return res.status(400).json({
                success: false,
                message: `Cannot delete this vendor — it has ${totalTransactions} linked transaction(s). You can mark it as Inactive instead.`
            });
        }

        // No transactions found - safe to soft delete (deactivate)
        await db.executeQuery(
            `UPDATE "Vendors" SET "IsActive" = false WHERE "VendorID" = @Id`,
            { Id: vendorId }
        );
        res.json({ success: true, message: 'Vendor deleted successfully' });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Toggle vendor Active/Inactive status (used by frontend toggle, no transaction check needed)
exports.toggleVendorStatus = async (req, res) => {
    try {
        const { IsActive } = req.body;
        const isActiveVal = (IsActive === false || IsActive === 'false') ? false : true;

        await db.executeQuery(
            `UPDATE "Vendors" SET "IsActive" = @IsActive WHERE "VendorID" = @Id`,
            { IsActive: isActiveVal, Id: req.params.id }
        );
        res.json({ success: true, message: `Vendor marked as ${isActiveVal ? 'Active' : 'Inactive'}` });
    } catch (error) {
        console.error("Toggle Status Error:", error);
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
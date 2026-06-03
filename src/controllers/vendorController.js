const db = require('../config/database');

// @desc    Get all vendors
// @route   GET /api/v1/vendors
exports.getAllVendors = async (req, res) => {
    try {
        const query = 'SELECT * FROM Vendors WHERE IsActive = 1 ORDER BY VendorName ASC';
        const result = await db.executeQuery(query);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error in Vendor Controller:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Single Vendor (For Editing)
// @route   GET /api/v1/vendors/:id
exports.getVendorById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'SELECT * FROM Vendors WHERE VendorID = @Id';
        const params = { Id: id }; 
        const result = await db.executeQuery(query, params);
        
        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }
        res.json({ success: true, data: result[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create New Vendor
// @route   POST /api/v1/vendors
exports.createVendor = async (req, res) => {
    try {
        const { 
            VendorName, ContactPerson, Phone, Email, City, Address, 
            VendorType, OpeningBalance 
            // NTN aur STRN remove kar diye hain kyunki DB mein nahi hain
        } = req.body;

        const query = `
            INSERT INTO Vendors (
                VendorName, ContactPerson, Phone, Email, City, Address, 
                VendorType, OpeningBalance, IsActive, CreatedAt
            ) VALUES (
                @VendorName, @ContactPerson, @Phone, @Email, @City, @Address, 
                @VendorType, @OpeningBalance, 1, GETDATE()
            )
        `;
        
        const params = {
            VendorName, ContactPerson, Phone, Email, City, Address,
            VendorType, OpeningBalance
        };

        await db.executeQuery(query, params);
        res.json({ success: true, message: 'Vendor added successfully' });
    } catch (error) {
        console.error("Create Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Vendor
// @route   PUT /api/v1/vendors/:id
exports.updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            VendorName, ContactPerson, Phone, Email, City, Address, 
            VendorType, OpeningBalance 
        } = req.body;

        const query = `
            UPDATE Vendors SET
                VendorName = @VendorName,
                ContactPerson = @ContactPerson,
                Phone = @Phone,
                Email = @Email,
                City = @City,
                Address = @Address,
                VendorType = @VendorType,
                OpeningBalance = @OpeningBalance
            WHERE VendorID = @Id
        `;

        const params = {
            VendorName, ContactPerson, Phone, Email, City, Address,
            VendorType, OpeningBalance,
            Id: id
        };

        await db.executeQuery(query, params);
        res.json({ success: true, message: 'Vendor updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Vendor (Soft Delete)
// @route   DELETE /api/v1/vendors/:id
exports.deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'UPDATE Vendors SET IsActive = 0 WHERE VendorID = @Id';
        await db.executeQuery(query, { Id: id });
        res.json({ success: true, message: 'Vendor deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Vendor Ledger
// @route   GET /api/v1/vendors/:id/ledger
exports.getVendorLedger = async (req, res) => {
    try {
        const { id } = req.params;
        // DB schema ke mutabiq 'Ledger' table use ho raha hai
        const query = 'SELECT * FROM Ledger WHERE VendorID = @Id ORDER BY TransactionDate DESC';
        
        const params = { Id: id };
        const result = await db.executeQuery(query, params);
        
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Ledger Error:", error);
        if(error.message.includes('Invalid object name')) {
             res.status(500).json({ success: false, message: 'Ledger table not found in database.' });
        } else {
             res.status(500).json({ success: false, message: error.message });
        }
    }
};
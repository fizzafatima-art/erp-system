const db = require('../config/database');
const logger = require('../utils/logger');

// @desc    Get all payments
// @route   GET /api/v1/payments
exports.getAllPayments = async (req, res) => {
    try {
        const query = `
            SELECT p.*, 
                   v.VendorName as VendorCustomerName,
                   CASE WHEN p.TransactionType = 'Purchase' THEN pur.InvoiceNo 
                        WHEN p.TransactionType = 'Sale' THEN s.InvoiceNo 
                   END as InvoiceNo
            FROM Payments p
            LEFT JOIN Vendors v ON p.VendorCustomerID = v.VendorID
            LEFT JOIN Purchases pur ON p.TransactionType = 'Purchase' AND p.TransactionID = pur.PurchaseID
            LEFT JOIN Sales s ON p.TransactionType = 'Sale' AND p.TransactionID = s.SaleID
            ORDER BY p.PaymentDate DESC
        `;
        const result = await db.executeQuery(query);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Error in getAllPayments:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get payment by ID
// @route   GET /api/v1/payments/:id
exports.getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT p.*, 
                   v.VendorName as VendorCustomerName
            FROM Payments p
            LEFT JOIN Vendors v ON p.VendorCustomerID = v.VendorID
            WHERE p.PaymentID = @id
        `;
        const result = await db.executeQuery(query, { id });
        
        if (!result || result.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }
        
        res.json({ success: true, data: result[0] });
    } catch (error) {
        logger.error('Error in getPaymentById:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create new payment
// @route   POST /api/v1/payments
exports.createPayment = async (req, res) => {
    try {
        const { transactionType, transactionID, vendorCustomerID, amount, paymentDate, paymentMode, referenceNo, notes } = req.body;
        
        // Validate required fields
        if (!transactionType || !transactionID || !vendorCustomerID || !amount || !paymentDate || !paymentMode) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        const query = `
            INSERT INTO Payments (TransactionType, TransactionID, VendorCustomerID, Amount, PaymentDate, PaymentMode, ReferenceNo, Notes)
            VALUES (@transactionType, @transactionID, @vendorCustomerID, @amount, @paymentDate, @paymentMode, @referenceNo, @notes);
            SELECT SCOPE_IDENTITY() as PaymentID;
        `;
        
        const result = await db.executeQuery(query, {
            transactionType,
            transactionID,
            vendorCustomerID,
            amount,
            paymentDate,
            paymentMode,
            referenceNo: referenceNo || null,
            notes: notes || null
        });
        
        // Update the purchase/sale balance
        if (transactionType === 'Purchase') {
            await db.executeQuery('EXEC sp_UpdatePurchaseBalance @purchaseId', { purchaseId: transactionID });
        } else if (transactionType === 'Sale') {
            await db.executeQuery('EXEC sp_UpdateSaleBalance @saleId', { saleId: transactionID });
        }
        
        res.status(201).json({ success: true, data: { paymentID: result[0].PaymentID }, message: 'Payment recorded successfully' });
    } catch (error) {
        logger.error('Error in createPayment:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Update payment
// @route   PUT /api/v1/payments/:id
exports.updatePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMode, referenceNo, notes } = req.body;
        
        const query = `
            UPDATE Payments 
            SET PaymentMode = @paymentMode,
                ReferenceNo = @referenceNo,
                Notes = @notes,
                UpdatedAt = GETDATE()
            WHERE PaymentID = @id
        `;
        
        await db.executeQuery(query, {
            id,
            paymentMode,
            referenceNo: referenceNo || null,
            notes: notes || null
        });
        
        res.json({ success: true, message: 'Payment updated successfully' });
    } catch (error) {
        logger.error('Error in updatePayment:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Delete payment
// @route   DELETE /api/v1/payments/:id
exports.deletePayment = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get payment details before deleting
        const paymentQuery = 'SELECT * FROM Payments WHERE PaymentID = @id';
        const payment = await db.executeQuery(paymentQuery, { id });
        
        if (!payment || payment.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }
        
        // Delete payment
        const deleteQuery = 'DELETE FROM Payments WHERE PaymentID = @id';
        await db.executeQuery(deleteQuery, { id });
        
        // Update the purchase/sale balance
        if (payment[0].TransactionType === 'Purchase') {
            await db.executeQuery('EXEC sp_UpdatePurchaseBalance @purchaseId', { purchaseId: payment[0].TransactionID });
        } else if (payment[0].TransactionType === 'Sale') {
            await db.executeQuery('EXEC sp_UpdateSaleBalance @saleId', { saleId: payment[0].TransactionID });
        }
        
        res.json({ success: true, message: 'Payment deleted successfully' });
    } catch (error) {
        logger.error('Error in deletePayment:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get outstanding payments for a vendor/customer
// @route   GET /api/v1/payments/vendor/:vendorId
exports.getVendorPayments = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const query = `
            SELECT p.*, v.VendorName
            FROM Payments p
            LEFT JOIN Vendors v ON p.VendorCustomerID = v.VendorID
            WHERE p.VendorCustomerID = @vendorId
            ORDER BY p.PaymentDate DESC
        `;
        const result = await db.executeQuery(query, { vendorId });
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Error in getVendorPayments:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllPayments,
    getPaymentById,
    createPayment,
    updatePayment,
    deletePayment,
    getVendorPayments
};
const db = require('../config/database');
const logger = require('../utils/logger');

exports.getAllPayments = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT p.*, 
                   v."VendorName" as "VendorCustomerName",
                   CASE WHEN p."TransactionType" = 'Purchase' THEN pur."InvoiceNo" 
                        WHEN p."TransactionType" = 'Sale' THEN s."InvoiceNo" 
                   END as "InvoiceNo"
            FROM "Payments" p
            LEFT JOIN "Vendors" v ON p."VendorCustomerID" = v."VendorID"
            LEFT JOIN "Purchases" pur ON p."TransactionType" = 'Purchase' AND p."TransactionID" = pur."PurchaseID"
            LEFT JOIN "Sales" s ON p."TransactionType" = 'Sale' AND p."TransactionID" = s."SaleID"
            ORDER BY p."PaymentDate" DESC
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Error in getAllPayments:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPaymentById = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT p.*, v."VendorName" as "VendorCustomerName"
            FROM "Payments" p
            LEFT JOIN "Vendors" v ON p."VendorCustomerID" = v."VendorID"
            WHERE p."PaymentID" = @id
        `, { id: req.params.id });

        if (!result || result.length === 0)
            return res.status(404).json({ success: false, message: 'Payment not found' });

        res.json({ success: true, data: result[0] });
    } catch (error) {
        logger.error('Error in getPaymentById:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createPayment = async (req, res) => {
    try {
        const { transactionType, transactionID, vendorCustomerID, amount, paymentDate, paymentMode, referenceNo, notes } = req.body;

        if (!transactionType || !transactionID || !vendorCustomerID || !amount || !paymentDate || !paymentMode)
            return res.status(400).json({ success: false, message: 'Missing required fields' });

        const result = await db.executeQuery(`
            INSERT INTO "Payments" ("TransactionType", "TransactionID", "VendorCustomerID", "Amount", "PaymentDate", "PaymentMode", "ReferenceNo", "Notes")
            VALUES (@transactionType, @transactionID, @vendorCustomerID, @amount, @paymentDate, @paymentMode, @referenceNo, @notes)
            RETURNING "PaymentID"
        `, { transactionType, transactionID, vendorCustomerID, amount, paymentDate, paymentMode, referenceNo: referenceNo || null, notes: notes || null });

        // Update purchase/sale balance
        if (transactionType === 'Purchase') {
            await db.executeQuery(
                `UPDATE "Purchases" SET "PaidAmount" = "PaidAmount" + @amount, "BalanceAmount" = "BalanceAmount" - @amount WHERE "PurchaseID" = @id`,
                { amount: Number(amount), id: transactionID }
            );
        } else if (transactionType === 'Sale') {
            await db.executeQuery(
                `UPDATE "Sales" SET "ReceivedAmount" = "ReceivedAmount" + @amount, "BalanceAmount" = "BalanceAmount" - @amount WHERE "SaleID" = @id`,
                { amount: Number(amount), id: transactionID }
            );
        }

        res.status(201).json({ success: true, data: { paymentID: result[0].PaymentID }, message: 'Payment recorded successfully' });
    } catch (error) {
        logger.error('Error in createPayment:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updatePayment = async (req, res) => {
    try {
        const { paymentMode, referenceNo, notes } = req.body;

        await db.executeQuery(`
            UPDATE "Payments" 
            SET "PaymentMode" = @paymentMode,
                "ReferenceNo" = @referenceNo,
                "Notes"       = @notes
            WHERE "PaymentID" = @id
        `, { id: req.params.id, paymentMode, referenceNo: referenceNo || null, notes: notes || null });

        res.json({ success: true, message: 'Payment updated successfully' });
    } catch (error) {
        logger.error('Error in updatePayment:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deletePayment = async (req, res) => {
    try {
        const payment = await db.executeQuery(
            'SELECT * FROM "Payments" WHERE "PaymentID" = @id', { id: req.params.id }
        );

        if (!payment || payment.length === 0)
            return res.status(404).json({ success: false, message: 'Payment not found' });

        await db.executeQuery('DELETE FROM "Payments" WHERE "PaymentID" = @id', { id: req.params.id });

        res.json({ success: true, message: 'Payment deleted successfully' });
    } catch (error) {
        logger.error('Error in deletePayment:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getVendorPayments = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT p.*, v."VendorName"
            FROM "Payments" p
            LEFT JOIN "Vendors" v ON p."VendorCustomerID" = v."VendorID"
            WHERE p."VendorCustomerID" = @vendorId
            ORDER BY p."PaymentDate" DESC
        `, { vendorId: req.params.vendorId });
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Error in getVendorPayments:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
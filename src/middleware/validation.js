const logger = require('../utils/logger');

// Vendor validation
const validateVendor = (req, res, next) => {
    const { vendorName, vendorType, city } = req.body;
    const errors = [];

    if (!vendorName || vendorName.trim() === '') {
        errors.push('Vendor name is required');
    }
    
    if (!vendorType || !['Vendor', 'Customer', 'Both'].includes(vendorType)) {
        errors.push('Valid vendor type is required (Vendor, Customer, or Both)');
    }
    
    if (!city || city.trim() === '') {
        errors.push('City is required');
    }

    if (errors.length > 0) {
        logger.warn('Vendor validation failed:', errors);
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    next();
};

// Product validation
const validateProduct = (req, res, next) => {
    const { productName, category, unit } = req.body;
    const errors = [];

    if (!productName || productName.trim() === '') {
        errors.push('Product name is required');
    }
    
    if (!category || category.trim() === '') {
        errors.push('Category is required');
    }
    
    if (!unit || !['KG', 'Piece', 'Bundle', 'Liter', 'Box'].includes(unit)) {
        errors.push('Valid unit is required');
    }

    if (errors.length > 0) {
        logger.warn('Product validation failed:', errors);
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    next();
};

// Purchase validation
const validatePurchase = (req, res, next) => {
    const { vendorId, items } = req.body;
    const errors = [];

    if (!vendorId) {
        errors.push('Vendor ID is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        errors.push('At least one item is required');
    }

    if (items && items.length > 0) {
        items.forEach((item, index) => {
            if (!item.productId) errors.push(`Item ${index + 1}: Product ID is required`);
            if (!item.quantity || item.quantity <= 0) errors.push(`Item ${index + 1}: Valid quantity is required`);
            if (!item.rate || item.rate < 0) errors.push(`Item ${index + 1}: Valid rate is required`);
        });
    }

    if (errors.length > 0) {
        logger.warn('Purchase validation failed:', errors);
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    next();
};

// Sale validation
const validateSale = (req, res, next) => {
    const { customerId, items } = req.body;
    const errors = [];

    if (!customerId) {
        errors.push('Customer ID is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        errors.push('At least one item is required');
    }

    if (items && items.length > 0) {
        items.forEach((item, index) => {
            if (!item.productId) errors.push(`Item ${index + 1}: Product ID is required`);
            if (!item.quantity || item.quantity <= 0) errors.push(`Item ${index + 1}: Valid quantity is required`);
            if (!item.rate || item.rate < 0) errors.push(`Item ${index + 1}: Valid rate is required`);
        });
    }

    if (errors.length > 0) {
        logger.warn('Sale validation failed:', errors);
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    next();
};

// Payment validation
const validatePayment = (req, res, next) => {
    const { transactionType, transactionID, vendorCustomerID, amount, paymentDate, paymentMode } = req.body;
    const errors = [];

    if (!transactionType || !['Purchase', 'Sale'].includes(transactionType)) {
        errors.push('Valid transaction type is required');
    }

    if (!transactionID || transactionID <= 0) {
        errors.push('Valid transaction ID is required');
    }

    if (!vendorCustomerID || vendorCustomerID <= 0) {
        errors.push('Valid vendor/customer ID is required');
    }

    if (!amount || amount <= 0) {
        errors.push('Valid amount is required');
    }

    if (!paymentDate) {
        errors.push('Payment date is required');
    }

    if (!paymentMode || !['Cash', 'Cheque', 'NEFT', 'RTGS', 'UPI', 'Bank Transfer'].includes(paymentMode)) {
        errors.push('Valid payment mode is required');
    }

    if (errors.length > 0) {
        logger.warn('Payment validation failed:', errors);
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    next();
};

// Expense validation
const validateExpense = (req, res, next) => {
    const { category, description, amount, paymentMethod } = req.body;
    const errors = [];

    if (!category || !['Operational', 'Utilities', 'Office Supplies', 'Transport', 'Miscellaneous'].includes(category)) {
        errors.push('Valid expense category is required');
    }

    if (!description || description.trim() === '') {
        errors.push('Description is required');
    }

    if (!amount || amount <= 0) {
        errors.push('Valid amount is required');
    }

    if (!paymentMethod || !['Cash', 'Bank', 'Cheque', 'UPI'].includes(paymentMethod)) {
        errors.push('Valid payment method is required');
    }

    if (errors.length > 0) {
        logger.warn('Expense validation failed:', errors);
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    next();
};

module.exports = {
    validateVendor,
    validateProduct,
    validatePurchase,
    validateSale,
    validatePayment,
    validateExpense
};
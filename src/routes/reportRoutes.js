const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Dashboard Route
router.get('/dashboard', reportController.getDashboardKPI);
router.get('/outstanding', reportController.getOutstanding);

// Detailed Reports
router.get('/vendor-profit',          reportController.getVendorProfit);
router.get('/top-products',           reportController.getTopProducts);
router.get('/top-customers',          reportController.getTopCustomers);
router.get('/outstanding-customers',  reportController.getOutstandingCustomers);
router.get('/outstanding-suppliers',  reportController.getOutstandingSuppliers);
router.get('/city-report',            reportController.getCityReport);

module.exports = router;
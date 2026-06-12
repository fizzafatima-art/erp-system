const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Dashboard Routes
router.get('/dashboard', reportController.getDashboardKPI);
router.get('/outstanding', reportController.getOutstanding);

// Detailed Report Routes
router.get('/vendor-profit',   reportController.getVendorProfit);
router.get('/top-products',    reportController.getTopProducts);
router.get('/top-customers',   reportController.getTopCustomers);
router.get('/outstanding-customers', reportController.getOutstandingCustomers); // Name changed to avoid conflict with simple outstanding
router.get('/city-report',     reportController.getCityReport);

module.exports = router;
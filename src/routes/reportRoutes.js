const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/dashboard', reportController.getDashboardKPI);
router.get('/outstanding', reportController.getOutstanding);

module.exports = router;
const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');

// ✅ Specific routes PEHLE
router.post('/return',  saleController.returnSale);
router.post('/payment', saleController.addPayment);

// Generic routes BAAD MEIN
router.get('/',     saleController.getAllSales);
router.post('/',    saleController.createSale);
router.get('/:id',  saleController.getSaleById);

module.exports = router;
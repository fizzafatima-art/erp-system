const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

router.put('/:id/payment', purchaseController.addPayment);
router.get('/', purchaseController.getAllPurchases);
router.post('/', purchaseController.createPurchase);
router.get('/:id', purchaseController.getPurchaseById);
router.post('/return', purchaseController.returnPurchase); // <--- ADDED
router.post('/:id/payment', purchaseController.addPayment);

module.exports = router;
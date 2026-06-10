const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

router.get('/',            purchaseController.getAllPurchases);
router.post('/',           purchaseController.createPurchase);
router.get('/:id',         purchaseController.getPurchaseById);
router.put('/:id/payment', purchaseController.addPayment);

module.exports = router;
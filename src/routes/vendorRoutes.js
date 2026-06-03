const express = require('express');
const router = express.Router();
// Ensure this path is correct: '../controllers/vendorController' (Singular)
const vendorController = require('../controllers/vendorController');

router.get('/', vendorController.getAllVendors);
router.get('/:id', vendorController.getVendorById);
router.post('/', vendorController.createVendor);
router.put('/:id', vendorController.updateVendor);
router.delete('/:id', vendorController.deleteVendor);
router.get('/:id/ledger', vendorController.getVendorLedger);

module.exports = router;
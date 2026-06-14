const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');

router.get('/',              vendorController.getAllVendors);
router.get('/:id',           vendorController.getVendorById);
router.post('/',             vendorController.createVendor);
router.put('/:id',           vendorController.updateVendor);
router.patch('/:id/status',  vendorController.toggleVendorStatus);
router.delete('/:id',        vendorController.deleteVendor);
router.get('/:id/ledger',    vendorController.getVendorLedger);

module.exports = router;
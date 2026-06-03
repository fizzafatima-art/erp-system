const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledgerController');

router.get('/', ledgerController.getGeneralLedger);
router.get('/vendor/:id', ledgerController.getLedgerByVendor);

module.exports = router;
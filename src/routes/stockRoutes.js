const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

router.get('/',             stockController.getCurrentStock);
router.get('/low-stock',    stockController.getLowStock);
router.get('/movement',     stockController.getStockMovement);  // ← PEHLE
router.post('/:id/adjust',  stockController.adjustStock);
router.get('/:id',          stockController.getStockById);      // ← BAAD MEIN

module.exports = router;
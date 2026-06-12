const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

router.get('/',            stockController.getCurrentStock);
router.get('/low-stock',   stockController.getLowStock);
router.post('/:id/adjust', stockController.adjustStock);  // ✅ GET /:id se PEHLE
router.get('/:id',         stockController.getStockById);
router.get('/movement', stockController.getStockMovement);
module.exports = router;
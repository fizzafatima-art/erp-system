const express = require('express');
const router = express.Router();

// ✅ TEST ROUTE (Harcode)
router.get('/reports/dashboard', async (req, res) => {
  console.log("🚨🚨🚨 ROUTE HIT SUCCESSFULLY 🚨🚨🚨");
  
  try {
    const sql = require('mssql');
    const { getPool } = require('../config/database');
    const pool = await getPool();
    
    const result = await pool.request().query('SELECT SUM(TotalAmount) as TestSales FROM Sales');
    const sales = result.recordset[0].TestSales;
    
    console.log("🔥 DB SALES:", sales);

    res.json({ 
      success: true, 
      data: {
        CurrentDB: "TestRoute",
        totalSales: sales,
        totalPurchases: 0,
        totalExpenses: 0,
        outstandingPayables: 0,
        outstandingReceivables: 0,
        lowStockCount: 0,
        recentSales: [],
        recentPurchases: []
      }
    });
    
  } catch (e) {
    console.error("TEST ERROR:", e);
    res.json({ success: false, message: e.message });
  }
});

module.exports = router;
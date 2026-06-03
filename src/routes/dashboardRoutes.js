const express = require('express');
const router = express.Router();

router.get('/reports/dashboard', async (req, res) => {
  console.log("🚨🚨🚨 ROUTE HIT SUCCESSFULLY 🚨🚨🚨");
  
  try {
    const { getPool } = require('../config/database');
    const pool = getPool(); // PostgreSQL mein await nahi lagta
    
    // PostgreSQL syntax - pool.query() directly
    const result = await pool.query('SELECT SUM("TotalAmount") as testsales FROM "Sales"');
    const sales = result.rows[0].testsales;
    
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
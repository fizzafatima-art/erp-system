const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 1. Get all warehouses
router.get('/warehouses', async (req, res) => {
  try {
    const result = await db.executeQuery(`SELECT * FROM "Warehouses" WHERE "IsActive" = true ORDER BY "WarehouseName" ASC`);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 2. Get warehouse-wise stock
router.get('/warehouse-stock', async (req, res) => {
  try {
    const { warehouseId } = req.query;
    let query = `
      SELECT ws."WarehouseID", w."WarehouseName", ws."ProductID", p."ProductName", p."Unit", 
             ws."CurrentQuantity", ws."LastUpdated"
      FROM "WarehouseStock" ws
      JOIN "Warehouses" w ON w."WarehouseID" = ws."WarehouseID"
      JOIN "Products" p ON p."ProductID" = ws."ProductID"
    `;
    if (warehouseId) {
      query += ` WHERE ws."WarehouseID" = ${Number(warehouseId)}`;
    }
    query += ` ORDER BY w."WarehouseName", p."ProductName"`;
    const result = await db.executeQuery(query);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 3. Get warehouse transfers (movement report)
router.get('/warehouse-transfers', async (req, res) => {
  try {
    const { fromId, toId, dateFrom, dateTo } = req.query;
    let query = `
      SELECT wt."TransferID", wt."TransferNo", wt."TransferDate",
             fw."WarehouseName" AS "FromWarehouse", tw."WarehouseName" AS "ToWarehouse",
             wt."Status", wt."Notes", wt."CreatedAt",
             (SELECT COUNT(*) FROM "TransferItems" ti WHERE ti."TransferID" = wt."TransferID") AS "ItemCount"
      FROM "WarehouseTransfers" wt
      LEFT JOIN "Warehouses" fw ON fw."WarehouseID" = wt."FromWarehouseID"
      LEFT JOIN "Warehouses" tw ON tw."WarehouseID" = wt."ToWarehouseID"
      WHERE 1=1
    `;
    if (fromId) query += ` AND wt."FromWarehouseID" = ${Number(fromId)}`;
    if (toId) query += ` AND wt."ToWarehouseID" = ${Number(toId)}`;
    if (dateFrom) query += ` AND wt."TransferDate" >= '${dateFrom}'`;
    if (dateTo) query += ` AND wt."TransferDate" <= '${dateTo}'`;
    query += ` ORDER BY wt."TransferDate" DESC, wt."TransferID" DESC`;
    const result = await db.executeQuery(query);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 4. Get transfer detail with items
router.get('/warehouse-transfers/:id', async (req, res) => {
  try {
    const main = await db.executeQuery(`
      SELECT wt.*, fw."WarehouseName" AS "FromWarehouse", tw."WarehouseName" AS "ToWarehouse"
      FROM "WarehouseTransfers" wt
      LEFT JOIN "Warehouses" fw ON fw."WarehouseID" = wt."FromWarehouseID"
      LEFT JOIN "Warehouses" tw ON tw."WarehouseID" = wt."ToWarehouseID"
      WHERE wt."TransferID" = @Id
    `, { Id: req.params.id });

    const items = await db.executeQuery(`
      SELECT ti.*, p."ProductName", p."Unit"
      FROM "TransferItems" ti
      LEFT JOIN "Products" p ON p."ProductID" = ti."ProductID"
      WHERE ti."TransferID" = @Id
    `, { Id: req.params.id });

    res.json({ success: true, data: { ...main[0], Items: items } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 5. Get warehouse summary (total products, total value per warehouse)
router.get('/warehouse-summary', async (req, res) => {
  try {
    const result = await db.executeQuery(`
      SELECT w."WarehouseID", w."WarehouseName", w."City",
             COUNT(ws."ProductID") AS "ProductCount",
             SUM(ws."CurrentQuantity") AS "TotalQty",
             SUM(ws."CurrentQuantity" * p."Price") AS "TotalValue"
      FROM "Warehouses" w
      LEFT JOIN "WarehouseStock" ws ON ws."WarehouseID" = w."WarehouseID"
      LEFT JOIN "Products" p ON p."ProductID" = ws."ProductID"
      WHERE w."IsActive" = true
      GROUP BY w."WarehouseID", w."WarehouseName", w."City"
      ORDER BY w."WarehouseName"
    `);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
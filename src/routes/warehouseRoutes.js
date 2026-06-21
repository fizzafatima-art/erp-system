const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/warehouses', async (req, res) => {
  try {
    const result = await db.executeQuery(`SELECT * FROM "Warehouses" WHERE "IsActive" = true ORDER BY "WarehouseName" ASC`);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

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
    if (warehouseId) query += ` WHERE ws."WarehouseID" = ${Number(warehouseId)}`;
    query += ` ORDER BY w."WarehouseName", p."ProductName"`;
    const result = await db.executeQuery(query);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

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
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

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
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

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
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
// Add warehouse
router.post('/warehouses', async (req, res) => {
  try {
    const { WarehouseName, Location, City, Phone } = req.body;
    if (!WarehouseName) return res.status(400).json({ success: false, message: 'Name required' });
    const result = await db.executeQuery(
      `INSERT INTO "Warehouses" ("WarehouseName","Location","City","Phone") VALUES (@N,@L,@C,@P) RETURNING *`,
      { N: WarehouseName, L: Location||'', C: City||'', P: Phone||'' }
    );
    res.status(201).json({ success: true, data: result[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Update warehouse
router.put('/warehouses/:id', async (req, res) => {
  try {
    const { WarehouseName, Location, City, Phone } = req.body;
    const result = await db.executeQuery(
      `UPDATE "Warehouses" SET "WarehouseName"=@N,"Location"=@L,"City"=@C,"Phone"=@P WHERE "WarehouseID"=@Id RETURNING *`,
      { N: WarehouseName, L: Location||'', C: City||'', P: Phone||'', Id: req.params.id }
    );
    res.json({ success: true, data: result[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Delete warehouse
router.delete('/warehouses/:id', async (req, res) => {
  try {
    await db.executeQuery(`UPDATE "Warehouses" SET "IsActive"=false WHERE "WarehouseID"=@Id`, { Id: req.params.id });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Transfer stock
router.post('/transfer', async (req, res) => {
  try {
    const { FromWarehouseID, ToWarehouseID, TransferDate, Notes, Items } = req.body;
    if (!FromWarehouseID || !ToWarehouseID || !Items?.length)
      return res.status(400).json({ success: false, message: 'From, To and Items required' });
    if (FromWarehouseID === ToWarehouseID)
      return res.status(400).json({ success: false, message: 'From and To cannot be same' });

    for (const item of Items) {
      const stock = await db.executeQuery(
        `SELECT "CurrentQuantity" FROM "WarehouseStock" WHERE "WarehouseID"=@W AND "ProductID"=@P`,
        { W: FromWarehouseID, P: item.ProductID }
      );
      const available = stock.length > 0 ? Number(stock[0].CurrentQuantity) : 0;
      if (available < Number(item.Quantity))
        return res.status(400).json({ success: false, message: `Insufficient stock. Available: ${available}` });
    }

    const TransferNo = `TRF-${Date.now()}`;
    const tr = await db.executeQuery(
      `INSERT INTO "WarehouseTransfers" ("TransferNo","FromWarehouseID","ToWarehouseID","TransferDate","Notes") VALUES (@TN,@F,@T,@D,@N) RETURNING "TransferID"`,
      { TN: TransferNo, F: FromWarehouseID, T: ToWarehouseID, D: TransferDate||new Date(), N: Notes||'' }
    );
    const TransferID = tr[0].TransferID;

    for (const item of Items) {
      const Qty = Number(item.Quantity);
      const PID = Number(item.ProductID);
      await db.executeQuery(
        `INSERT INTO "TransferItems" ("TransferID","ProductID","Quantity","Rate") VALUES (@TID,@PID,@Qty,@Rate)`,
        { TID: TransferID, PID, Qty, Rate: Number(item.Rate)||0 }
      );
      await db.executeQuery(
        `UPDATE "WarehouseStock" SET "CurrentQuantity"="CurrentQuantity"-@Qty,"LastUpdated"=NOW() WHERE "WarehouseID"=@W AND "ProductID"=@P`,
        { Qty, W: FromWarehouseID, P: PID }
      );
      await db.executeQuery(
        `INSERT INTO "WarehouseStock" ("WarehouseID","ProductID","CurrentQuantity","LastUpdated") VALUES (@W,@P,@Qty,NOW())
         ON CONFLICT ("WarehouseID","ProductID") DO UPDATE SET "CurrentQuantity"="WarehouseStock"."CurrentQuantity"+@Qty,"LastUpdated"=NOW()`,
        { W: ToWarehouseID, P: PID, Qty }
      );
    }
    res.status(201).json({ success: true, message: 'Transfer completed', TransferID, TransferNo });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
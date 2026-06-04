const db = require('../config/database');

exports.getCurrentStock = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT 
                s."StockID", s."ProductID", s."CurrentQuantity", 
                s."MinimumQuantity", s."MaximumQuantity", s."LastUpdated",
                p."ProductName", p."Category", p."Unit"
            FROM "Stock" s
            JOIN "Products" p ON s."ProductID" = p."ProductID"
            ORDER BY p."ProductName" ASC
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error in Stock Controller:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getLowStock = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT 
                s."StockID", s."ProductID", s."CurrentQuantity", 
                s."MinimumQuantity", p."ProductName", p."Unit"
            FROM "Stock" s
            JOIN "Products" p ON s."ProductID" = p."ProductID"
            WHERE s."CurrentQuantity" <= s."MinimumQuantity"
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error in getLowStock:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.adjustStock = async (req, res) => {
    try {
        const ProductID = req.params.id || req.body.ProductID;
        const { adjustmentType, quantity, reason } = req.body;

        if (!ProductID || !quantity) {
            return res.status(400).json({ success: false, message: "Product ID and Quantity are required" });
        }

        const Qty = Number(quantity);
        const isAdd = adjustmentType === 'Add';
        const adjustmentAmount = isAdd ? Qty : -Qty;

        await db.executeQuery(`
            UPDATE "Stock" 
            SET "CurrentQuantity" = "CurrentQuantity" + @AdjAmount, "LastUpdated" = NOW()
            WHERE "ProductID" = @ProductID
        `, { AdjAmount: adjustmentAmount, ProductID: Number(ProductID) });

        await db.executeQuery(`
            INSERT INTO "StockMovement" ("ProductID", "MovementType", "Quantity", "Remarks", "CreatedAt")
            VALUES (@ProductID, @MovementType, @Quantity, @Remarks, NOW())
        `, {
            ProductID: Number(ProductID),
            MovementType: 'Adjustment',
            Quantity: Qty,
            Remarks: reason || 'Manual Adjustment via UI'
        });

        res.json({ success: true, message: "Stock adjusted successfully" });
    } catch (error) {
        console.error("Adjust Stock Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getStockById = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT s.*, p."ProductName", p."Unit" 
            FROM "Stock" s 
            JOIN "Products" p ON s."ProductID" = p."ProductID" 
            WHERE s."StockID" = @Id
        `, { Id: req.params.id });
        if (!result || result.length === 0) return res.status(404).json({ success: false, message: 'Stock not found' });
        res.json({ success: true, data: result[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
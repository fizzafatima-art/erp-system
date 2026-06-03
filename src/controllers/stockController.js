const db = require('../config/database');

// @desc    Get all current stock
// @route   GET /api/v1/stock
exports.getCurrentStock = async (req, res) => {
    try {
        const query = `
            SELECT 
                s.StockID, 
                s.ProductID, 
                s.CurrentQuantity, 
                s.MinimumQuantity, 
                s.MaximumQuantity, 
                s.LastUpdated,
                p.ProductName, 
                p.Category, 
                p.Unit
            FROM Stock s
            JOIN Products p ON s.ProductID = p.ProductID
            ORDER BY p.ProductName ASC
        `;
        const result = await db.executeQuery(query);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error in Stock Controller:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get low stock items
// @route   GET /api/v1/stock/low-stock
exports.getLowStock = async (req, res) => {
    try {
        const query = `
            SELECT 
                s.StockID, 
                s.ProductID, 
                s.CurrentQuantity, 
                s.MinimumQuantity, 
                p.ProductName, 
                p.Unit
            FROM Stock s
            JOIN Products p ON s.ProductID = p.ProductID
            WHERE s.CurrentQuantity <= s.MinimumQuantity
        `;
        const result = await db.executeQuery(query);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error in getLowStock:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Adjust Stock
// @route   POST /api/v1/stock/:id/adjust
// @desc    Adjust Stock (Fixed Keys)
// @route   POST /api/v1/stock/:id/adjust
exports.adjustStock = async (req, res) => {
    try {
        // Frontend se 'quantity' (lowercase) aa raha hai, wo 'Quantity' (uppercase) bana lenge
        const ProductID = req.params.id || req.body.ProductID || req.body.productid;
        const { adjustmentType, quantity, reason } = req.body; 
        
        if (!ProductID || !quantity) {
            return res.status(400).json({ success: false, message: "Product ID and Quantity are required" });
        }

        const Qty = Number(quantity); // Note: small 'q' nahi, variable 'Qty' use kar rahe hain
        const isAdd = adjustmentType === 'Add'; 
        
        const adjustmentAmount = isAdd ? Qty : -Qty;

        // 1. Update Stock Table
        const updateQuery = `
            UPDATE Stock 
            SET CurrentQuantity = CurrentQuantity + @AdjAmount,
                LastUpdated = GETDATE()
            WHERE ProductID = @ProductID
        `;
        
        await db.executeQuery(updateQuery, { 
            AdjAmount: adjustmentAmount, 
            ProductID: Number(ProductID) 
        });

        // 2. Add to Stock Movement
        const movementQuery = `
            INSERT INTO StockMovement (ProductID, MovementType, Quantity, Remarks, CreatedAt)
            VALUES (@ProductID, @MovementType, @Quantity, @Remarks, GETDATE())
        `;
        
        await db.executeQuery(movementQuery, {
            ProductID: Number(ProductID),
            MovementType: isAdd ? 'Manual Addition' : 'Manual Deduction',
            Quantity: Qty,
            Remarks: reason || 'Manual Adjustment via UI'
        });

        res.json({ success: true, message: "Stock adjusted successfully" });

    } catch (error) {
        console.error("Adjust Stock Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Single Stock
// @route   GET /api/v1/stock/:id
exports.getStockById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT s.*, p.ProductName, p.Unit FROM Stock s 
            JOIN Products p ON s.ProductID = p.ProductID 
            WHERE s.StockID = @Id
        `;
        const result = await db.executeQuery(query, { Id: id });
        if (result.length === 0) return res.status(404).json({ success: false, message: 'Stock not found' });
        res.json({ success: true, data: result[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
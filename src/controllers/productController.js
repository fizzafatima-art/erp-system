const db = require('../config/database');

// @desc    Get all products
// @route   GET /api/v1/products
exports.getAllProducts = async (req, res) => {
    try {
        const query = `
            SELECT 
                P.ProductID, 
                P.ProductName, 
                P.Category, 
                P.Unit, 
                P.Price, 
                P.IsActive,
                ISNULL(S.CurrentQuantity, 0) AS CurrentQuantity,
                ISNULL(S.MinimumQuantity, 0) AS MinimumQuantity
            FROM Products P
            LEFT JOIN Stock S ON P.ProductID = S.ProductID
            WHERE P.IsActive = 1
            ORDER BY P.ProductName;
        `;
        
        const result = await db.executeQuery(query);

        // DEBUG LOG: Ye terminal mein dikhayega DB kya bhej raha hai
        console.log("RAW RESULT:", JSON.stringify(result).substring(0, 500));

        // FIX: Agar result.recordset hai to use lo, nahi to result (backward compatibility)
        const data = result.recordset || result;

        res.json({ 
            success: true, 
            data: data 
        });
    } catch (error) {
        console.error("Error in getAllProducts:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// @desc    Get single product by ID
// @route   GET /api/v1/products/:id
exports.getProductById = async (req, res) => {
    try {
        const query = `
            SELECT 
                P.ProductID, 
                P.ProductName, 
                P.Category, 
                P.Unit, 
                P.Price, 
                P.IsActive,
                ISNULL(S.MinimumQuantity, 0) AS MinimumQuantity,
                ISNULL(S.CurrentQuantity, 0) AS CurrentQuantity
            FROM Products P
            LEFT JOIN Stock S ON P.ProductID = S.ProductID
            WHERE P.ProductID = @id
        `;
        const result = await db.executeQuery(query, { id: req.params.id });
        
        // FIX: Same logic yahan bhi
        const data = result.recordset || result;

        // Check length on the array, not the object
        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.json({ success: true, data: data[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create a new Product
// @route   POST /api/v1/products
exports.createProduct = async (req, res) => {
    try {
        const { productName, category, unit, minimumQuantity, price } = req.body;

        if (!productName) {
            return res.status(400).json({ success: false, message: 'Product Name is required.' });
        }

        const finalUnit = (unit && ['KG', 'Piece', 'Box', 'Liter', 'Bundle'].includes(unit.trim())) ? unit.trim() : 'Piece';

        const insertQuery = `
            INSERT INTO Products (ProductName, Category, Unit, Price)
            OUTPUT INSERTED.ProductID
            VALUES (@productName, @category, @unit, @price);
        `;

        const productResult = await db.executeQuery(insertQuery, {
            productName: productName.trim(),
            category:    (category || '').trim(),
            unit:        finalUnit,
            price:       price || 0,
        });

        // ID extraction logic: Pehle recordset check karo, phir direct array
        let newProductID;
        const insertData = productResult.recordset || productResult;
        
        if (Array.isArray(insertData) && insertData.length > 0) {
            newProductID = insertData[0].ProductID;
        } else {
            throw new Error("Could not retrieve new Product ID");
        }

        // Initialize Stock
        const minQty = minimumQuantity ? Number(minimumQuantity) : 10;
        
        const checkStockResult = await db.executeQuery(`SELECT StockID FROM Stock WHERE ProductID = @id`, { id: newProductID });
        const stockData = checkStockResult.recordset || checkStockResult;

        if (stockData.length === 0) {
            await db.executeQuery(
                `INSERT INTO Stock (ProductID, CurrentQuantity, MinimumQuantity) VALUES (@id, 0, @minQty)`,
                { id: newProductID, minQty }
            );
        }

        res.status(201).json({ success: true, message: 'Product created successfully' });
    } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Product
// @route   PUT /api/v1/products/:id
exports.updateProduct = async (req, res) => {
    try {
        const { productName, category, unit, minimumQuantity, price } = req.body;
        
        const finalUnit = (unit && ['KG', 'Piece', 'Box', 'Liter', 'Bundle'].includes(unit.trim())) ? unit.trim() : 'Piece';

        // UPDATE query usually returns { recordset: [], rowsAffected: X }
        // Humein result recordset ki zaroorat nahi padti update ke liye sirf confirmation chahiye
        await db.executeQuery(
            `UPDATE Products
             SET ProductName  = @productName,
                 Category     = @category,
                 Unit         = @unit,
                 Price        = @price
             WHERE ProductID = @id`,
            {
                id:          req.params.id,
                productName: (productName || '').trim(),
                category:    (category || '').trim(),
                unit:        finalUnit,
                price:       price || 0,
            }
        );

        if (minimumQuantity != null) {
            await db.executeQuery(
                `UPDATE Stock SET MinimumQuantity = @minQty WHERE ProductID = @id`,
                { id: req.params.id, minQty: Number(minimumQuantity) }
            );
        }

        res.json({ success: true, message: 'Product updated successfully' });
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Product
// @route   DELETE /api/v1/products/:id
exports.deleteProduct = async (req, res) => {
    try {
        await db.executeQuery(
            `UPDATE Products SET IsActive = 0 WHERE ProductID = @id`,
            { id: req.params.id }
        );
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
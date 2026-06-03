const db = require('../config/database');

// @desc    Get all products
// @route   GET /api/v1/products
exports.getAllProducts = async (req, res) => {
    try {
        const query = `
            SELECT 
                p."ProductID", 
                p."ProductName", 
                p."Category", 
                p."Unit", 
                p."Price", 
                p."IsActive",
                COALESCE(s."CurrentQuantity", 0) AS "CurrentQuantity",
                COALESCE(s."MinimumQuantity", 0) AS "MinimumQuantity"
            FROM "Products" p
            LEFT JOIN "Stock" s ON p."ProductID" = s."ProductID"
            WHERE p."IsActive" = true
            ORDER BY p."ProductName"
        `;
        const result = await db.executeQuery(query);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error in getAllProducts:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single product by ID
// @route   GET /api/v1/products/:id
exports.getProductById = async (req, res) => {
    try {
        const query = `
            SELECT 
                p."ProductID", 
                p."ProductName", 
                p."Category", 
                p."Unit", 
                p."Price", 
                p."IsActive",
                COALESCE(s."MinimumQuantity", 0) AS "MinimumQuantity",
                COALESCE(s."CurrentQuantity", 0) AS "CurrentQuantity"
            FROM "Products" p
            LEFT JOIN "Stock" s ON p."ProductID" = s."ProductID"
            WHERE p."ProductID" = @id
        `;
        const result = await db.executeQuery(query, { id: req.params.id });

        if (!result || result.length === 0) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        res.json({ success: true, data: result[0] });
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

        // PostgreSQL: OUTPUT INSERTED -> RETURNING
        const insertQuery = `
            INSERT INTO "Products" ("ProductName", "Category", "Unit", "Price")
            VALUES (@productName, @category, @unit, @price)
            RETURNING "ProductID"
        `;

        const productResult = await db.executeQuery(insertQuery, {
            productName: productName.trim(),
            category:    (category || '').trim(),
            unit:        finalUnit,
            price:       price || 0,
        });

        if (!productResult || productResult.length === 0) {
            throw new Error("Could not retrieve new Product ID");
        }
        const newProductID = productResult[0].ProductID;

        // Initialize Stock
        const minQty = minimumQuantity ? Number(minimumQuantity) : 10;
        
        const stockCheck = await db.executeQuery(
            `SELECT "StockID" FROM "Stock" WHERE "ProductID" = @id`, 
            { id: newProductID }
        );

        if (!stockCheck || stockCheck.length === 0) {
            await db.executeQuery(
                `INSERT INTO "Stock" ("ProductID", "CurrentQuantity", "MinimumQuantity") VALUES (@id, 0, @minQty)`,
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

        await db.executeQuery(
            `UPDATE "Products"
             SET "ProductName" = @productName,
                 "Category"    = @category,
                 "Unit"        = @unit,
                 "Price"       = @price
             WHERE "ProductID" = @id`,
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
                `UPDATE "Stock" SET "MinimumQuantity" = @minQty WHERE "ProductID" = @id`,
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
            `UPDATE "Products" SET "IsActive" = false WHERE "ProductID" = @id`,
            { id: req.params.id }
        );
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
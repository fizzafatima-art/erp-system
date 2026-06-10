const db = require('../config/database');
const logger = require('../utils/logger');

class ProductService {
    async getAllProducts(filters = {}) {
        try {
            let query = 'SELECT * FROM Products WHERE IsActive = 1';
            if (filters.category) query += ` AND Category = '${filters.category}'`;
            if (filters.brand) query += ` AND Brand = '${filters.brand}'`;
            
            const result = await db.executeQuery(query);
            return result;
        } catch (error) {
            logger.error('Database Error:', error);
            throw error;
        }
    }

    async getProductById(id) {
        const query = 'SELECT * FROM Products WHERE ProductID = @id';
        const result = await db.executeQuery(query, { id });
        return result[0];
    }

    async createProduct(data) {
        const { productName, category, brand, unit, description, companyName } = data;
        const query = `
            INSERT INTO Products (ProductName, Category, Brand, Unit, Description, CompanyName)
            VALUES (@productName, @category, @brand, @unit, @description);
            SELECT SCOPE_IDENTITY() as ProductID;
        `;
        const result = await db.executeQuery(query, { productName, category, brand, unit, description });
        return result[0].ProductID;
    }

       async updateProduct(id, data) {
        const updates = [];
        const params = { id };
        
        Object.keys(data).forEach(key => {
            // FIX: Convert 'productName' to 'ProductName' (PascalCase) to match SQL Schema
            // We do this by capitalizing the first letter
            const sqlColName = key.charAt(0).toUpperCase() + key.slice(1);
            
            updates.push(`${sqlColName} = @${key}`);
            params[key] = data[key];
        });

        // Ensure there is something to update
        if (updates.length === 0) return;

        const query = `UPDATE Products SET ${updates.join(', ')}, UpdatedAt = GETDATE() WHERE ProductID = @id`;
        await db.executeQuery(query, params);
    }
    async deleteProduct(id) {
        const query = 'UPDATE Products SET IsActive = 0 WHERE ProductID = @id';
        await db.executeQuery(query, { id });
    }

    camelToSnake(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
}

module.exports = new ProductService();

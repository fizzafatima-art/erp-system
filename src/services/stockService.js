const db = require('../config/database');

class StockService {
    async getCurrentStock() {
        const query = `
            SELECT s.*, p.ProductName, p.Category 
            FROM Stock s 
            JOIN Products p ON s.ProductID = p.ProductID
        `;
        return await db.executeQuery(query);
    }

    async getLowStock() {
        const query = `
            SELECT s.*, p.ProductName 
            FROM Stock s 
            JOIN Products p ON s.ProductID = p.ProductID 
            WHERE s.CurrentQuantity <= s.MinimumQuantity
        `;
        return await db.executeQuery(query);
    }
}

module.exports = new StockService();
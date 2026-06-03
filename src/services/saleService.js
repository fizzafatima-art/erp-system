const db = require('../config/database');
const logger = require('../utils/logger');

class SaleService {
    async getAllSales(filters) {
        let query = `
            SELECT s.*, v.VendorName 
            FROM Sales s 
            JOIN Vendors v ON s.CustomerID = v.VendorID 
            WHERE s.IsActive = 1
        `;
        return await db.executeQuery(query);
    }

    async createSale(data) {
        const transaction = new db.sql.Transaction();
        try {
            await transaction.begin();
            const request = new db.sql.Request(transaction);

            let invoiceNo = 'INV-S0001';

            request.input('invoiceNo', db.sql.NVarChar, invoiceNo);
            request.input('customerId', db.sql.Int, data.customerId);
            request.input('saleDate', db.sql.DateTime2, new Date());
            
            const result = await request.query(`
                INSERT INTO Sales (InvoiceNo, CustomerID, SaleDate, PaymentStatus)
                OUTPUT INSERTED.SaleID
                VALUES (@invoiceNo, @customerId, @saleDate, 'Pending')
            `);
            const saleId = result.recordset[0].SaleID;

            let totalAmount = 0;
            for (const item of data.items) {
                const amount = item.quantity * item.rate;
                totalAmount += amount;
                
                const itemReq = new db.sql.Request(transaction);
                itemReq.input('saleId', db.sql.Int, saleId);
                itemReq.input('productId', db.sql.Int, item.productId);
                itemReq.input('quantity', db.sql.Decimal(10,2), item.quantity);
                itemReq.input('rate', db.sql.Decimal(12,2), item.rate);
                itemReq.input('amount', db.sql.Decimal(12,2), amount);

                await itemReq.query(`
                    INSERT INTO SaleItems (SaleID, ProductID, Quantity, Rate, Amount)
                    VALUES (@saleId, @productId, @quantity, @rate, @amount)
                `);

                await itemReq.query(`
                    EXEC sp_UpdateStock @productId, 'Sale', @quantity, @saleId, 'Sale'
                `);
            }

            const updateReq = new db.sql.Request(transaction);
            updateReq.input('saleId', db.sql.Int, saleId);
            await updateReq.query(`EXEC sp_UpdateSaleBalance @saleId`);

            const ledgerReq = new db.sql.Request(transaction);
            ledgerReq.input('customerId', db.sql.Int, data.customerId);
            ledgerReq.input('saleId', db.sql.Int, saleId);
            ledgerReq.input('invoiceNo', db.sql.NVarChar, invoiceNo);
            ledgerReq.input('amount', db.sql.Decimal(12,2), totalAmount);
            await ledgerReq.query(`
                EXEC sp_UpdateVendorLedger @customerId, 'Sale', @saleId, @invoiceNo, GETDATE(), @amount, 0
            `);

            await transaction.commit();
            return saleId;
        } catch (err) {
            await transaction.rollback();
            logger.error('Transaction Error:', err);
            throw err;
        }
    }

    async getSaleDetails(id) {
        const masterQuery = 'SELECT * FROM Sales WHERE SaleID = @id';
        const itemsQuery = 'SELECT * FROM SaleItems WHERE SaleID = @id';
        const master = await db.executeQuery(masterQuery, { id });
        const items = await db.executeQuery(itemsQuery, { id });
        return { ...master[0], items };
    }

    async addPayment(saleId, paymentData) {
        const { amount, paymentMode, customerId } = paymentData;
        await db.executeQuery(`
            INSERT INTO Payments (TransactionType, TransactionID, VendorCustomerID, Amount, PaymentDate, PaymentMode)
            VALUES ('Sale', @saleId, @customerId, @amount, GETDATE(), @paymentMode);
            EXEC sp_UpdateSaleBalance @saleId;
        `, { saleId, customerId, amount, paymentMode });

        await db.executeQuery(`
            EXEC sp_UpdateVendorLedger @customerId, 'Payment', @saleId, 'RCPT-'+CONVERT(VARCHAR, @saleId), GETDATE(), 0, @amount
        `, { customerId, saleId, amount });
    }
}

module.exports = new SaleService();
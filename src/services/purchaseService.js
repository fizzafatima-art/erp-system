const db = require('../config/database');
const logger = require('../utils/logger');

class PurchaseService {
    async getAllPurchases(filters) {
        let query = `
            SELECT p.*, v.VendorName 
            FROM Purchases p 
            JOIN Vendors v ON p.VendorID = v.VendorID 
            WHERE p.IsActive = 1
        `;
        return await db.executeQuery(query);
    }

    async createPurchase(data) {
        const transaction = new db.sql.Transaction();
        try {
            await transaction.begin();
            const request = new db.sql.Request(transaction);

            let invoiceNo = 'INV-P0001'; 
            
            request.input('invoiceNo', db.sql.NVarChar, invoiceNo);
            request.input('vendorId', db.sql.Int, data.vendorId);
            request.input('purchaseDate', db.sql.DateTime2, new Date());
            
            const result = await request.query(`
                INSERT INTO Purchases (InvoiceNo, VendorID, PurchaseDate, PaymentStatus)
                OUTPUT INSERTED.PurchaseID
                VALUES (@invoiceNo, @vendorId, @purchaseDate, 'Pending')
            `);
            const purchaseId = result.recordset[0].PurchaseID;

            let totalAmount = 0;
            for (const item of data.items) {
                const amount = item.quantity * item.rate;
                totalAmount += amount;
                
                const itemReq = new db.sql.Request(transaction);
                itemReq.input('purchaseId', db.sql.Int, purchaseId);
                itemReq.input('productId', db.sql.Int, item.productId);
                itemReq.input('quantity', db.sql.Decimal(10,2), item.quantity);
                itemReq.input('rate', db.sql.Decimal(12,2), item.rate);
                itemReq.input('amount', db.sql.Decimal(12,2), amount);

                await itemReq.query(`
                    INSERT INTO PurchaseItems (PurchaseID, ProductID, Quantity, Rate, Amount)
                    VALUES (@purchaseId, @productId, @quantity, @rate, @amount)
                `);

                await itemReq.query(`
                    EXEC sp_UpdateStock @productId, 'Purchase', @quantity, @purchaseId, 'Purchase'
                `);
            }

            const updateReq = new db.sql.Request(transaction);
            updateReq.input('purchaseId', db.sql.Int, purchaseId);
            updateReq.input('totalAmount', db.sql.Decimal(12,2), totalAmount);
            await updateReq.query(`
                EXEC sp_UpdatePurchaseBalance @purchaseId
            `);

            const ledgerReq = new db.sql.Request(transaction);
            ledgerReq.input('vendorId', db.sql.Int, data.vendorId);
            ledgerReq.input('purchaseId', db.sql.Int, purchaseId);
            ledgerReq.input('invoiceNo', db.sql.NVarChar, invoiceNo);
            ledgerReq.input('amount', db.sql.Decimal(12,2), totalAmount);
            await ledgerReq.query(`
                EXEC sp_UpdateVendorLedger @vendorId, 'Purchase', @purchaseId, @invoiceNo, GETDATE(), @amount, 0
            `);

            await transaction.commit();
            return purchaseId;
        } catch (err) {
            await transaction.rollback();
            logger.error('Transaction Error:', err);
            throw err;
        }
    }

    async getPurchaseDetails(id) {
        const masterQuery = 'SELECT * FROM Purchases WHERE PurchaseID = @id';
        const itemsQuery = 'SELECT * FROM PurchaseItems WHERE PurchaseID = @id';
        
        const master = await db.executeQuery(masterQuery, { id });
        const items = await db.executeQuery(itemsQuery, { id });
        
        return { ...master[0], items };
    }

    async addPayment(purchaseId, paymentData) {
        const { amount, paymentMode, vendorId } = paymentData;
        const query = `
            INSERT INTO Payments (TransactionType, TransactionID, VendorCustomerID, Amount, PaymentDate, PaymentMode)
            VALUES ('Purchase', @purchaseId, @vendorId, @amount, GETDATE(), @paymentMode);
            EXEC sp_UpdatePurchaseBalance @purchaseId;
        `;
        await db.executeQuery(query, { purchaseId, vendorId, amount, paymentMode });
        
        await db.executeQuery(`
            EXEC sp_UpdateVendorLedger @vendorId, 'Payment', @purchaseId, 'PAY-'+CONVERT(VARCHAR, @purchaseId), GETDATE(), 0, @amount
        `, { vendorId, purchaseId, amount });
    }
}

module.exports = new PurchaseService();
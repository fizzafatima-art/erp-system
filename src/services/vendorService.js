const db = require('../config/database');
const logger = require('../utils/logger');

class VendorService {
    async getAllVendors(filters = {}) {
        try {
            let query = 'SELECT * FROM Vendors WHERE IsActive = 1';
            
            if (filters.type) {
                query += ` AND VendorType = '${filters.type}'`;
            }
            if (filters.city) {
                query += ` AND City = '${filters.city}'`;
            }
            
            query += ' ORDER BY VendorName ASC';
            
            const result = await db.executeQuery(query);
            return result;
        } catch (error) {
            logger.error('Error in getAllVendors:', error);
            throw error;
        }
    }
    
    async getVendorById(vendorId) {
        try {
            const query = 'SELECT * FROM Vendors WHERE VendorID = @vendorId';
            const result = await db.executeQuery(query, { vendorId });
            return result[0] || null;
        } catch (error) {
            logger.error('Error in getVendorById:', error);
            throw error;
        }
    }
    
    async createVendor(vendorData) {
        try {
            const {
                vendorName,
                vendorType,
                contactPerson,
                phone,
                email,
                city,
                address,
                openingBalance
            } = vendorData;
            
            const query = `
                INSERT INTO Vendors (VendorName, VendorType, ContactPerson, Phone, Email, City, Address, OpeningBalance)
                VALUES (@vendorName, @vendorType, @contactPerson, @phone, @email, @city, @address, @openingBalance);
                SELECT SCOPE_IDENTITY() as VendorID;
            `;
            
            const result = await db.executeQuery(query, {
                vendorName,
                vendorType,
                contactPerson,
                phone,
                email,
                city,
                address,
                openingBalance: openingBalance || 0
            });
            
            return result[0].VendorID;
        } catch (error) {
            logger.error('Error in createVendor:', error);
            throw error;
        }
    }
    
    async updateVendor(vendorId, vendorData) {
        try {
            const updates = [];
            const params = { vendorId };
            
            Object.keys(vendorData).forEach(key => {
                const snakeKey = this.camelToSnake(key);
                updates.push(`${snakeKey} = @${key}`);
                params[key] = vendorData[key];
            });
            
            const query = `UPDATE Vendors SET ${updates.join(', ')}, UpdatedAt = GETDATE() WHERE VendorID = @vendorId`;
            
            await db.executeQuery(query, params);
            return await this.getVendorById(vendorId);
        } catch (error) {
            logger.error('Error in updateVendor:', error);
            throw error;
        }
    }
    
    async deleteVendor(vendorId) {
        try {
            const query = 'UPDATE Vendors SET IsActive = 0 WHERE VendorID = @vendorId';
            await db.executeQuery(query, { vendorId });
        } catch (error) {
            logger.error('Error in deleteVendor:', error);
            throw error;
        }
    }
    
    async getVendorLedger(vendorId) {
        try {
            const query = `
                SELECT * FROM Ledger 
                WHERE VendorCustomerID = @vendorId
                ORDER BY TransactionDate ASC
            `;
            return await db.executeQuery(query, { vendorId });
        } catch (error) {
            logger.error('Error in getVendorLedger:', error);
            throw error;
        }
    }
    
    camelToSnake(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
}

module.exports = new VendorService();
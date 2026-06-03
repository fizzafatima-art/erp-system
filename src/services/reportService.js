const db = require('../config/database');
const logger = require('../utils/logger');

class ReportService {
    // Get Dashboard KPI
    async getDashboardKPI() {
        try {
            const result = await db.executeQuery('EXEC sp_GetDashboardKPI');
            return result[0] || {};
        } catch (error) {
            logger.error('Error in getDashboardKPI:', error);
            throw error;
        }
    }

    // Get Outstanding Payables and Receivables
    async getOutstanding() {
        try {
            const payables = await db.executeQuery(
                "SELECT ISNULL(SUM(BalanceAmount), 0) as Total FROM Purchases WHERE PaymentStatus != 'Paid'"
            );
            const receivables = await db.executeQuery(
                "SELECT ISNULL(SUM(BalanceAmount), 0) as Total FROM Sales WHERE PaymentStatus != 'Paid'"
            );
            
            return {
                payables: payables[0]?.Total || 0,
                receivables: receivables[0]?.Total || 0
            };
        } catch (error) {
            logger.error('Error in getOutstanding:', error);
            throw error;
        }
    }

    // Get Recent Purchases
    async getRecentPurchases(limit = 5) {
        try {
            const query = `
                SELECT TOP ${limit} p.*, v.VendorName
                FROM Purchases p
                LEFT JOIN Vendors v ON p.VendorID = v.VendorID
                WHERE p.IsActive = 1
                ORDER BY p.PurchaseDate DESC
            `;
            return await db.executeQuery(query);
        } catch (error) {
            logger.error('Error in getRecentPurchases:', error);
            throw error;
        }
    }

    // Get Recent Sales
    async getRecentSales(limit = 5) {
        try {
            const query = `
                SELECT TOP ${limit} s.*, v.VendorName as CustomerName
                FROM Sales s
                LEFT JOIN Vendors v ON s.CustomerID = v.VendorID
                WHERE s.IsActive = 1
                ORDER BY s.SaleDate DESC
            `;
            return await db.executeQuery(query);
        } catch (error) {
            logger.error('Error in getRecentSales:', error);
            throw error;
        }
    }

    // Get Low Stock Items
    async getLowStockItems() {
        try {
            const query = `
                SELECT s.*, p.ProductName, p.Category
                FROM Stock s
                JOIN Products p ON s.ProductID = p.ProductID
                WHERE s.CurrentQuantity <= s.MinimumQuantity
                ORDER BY s.CurrentQuantity ASC
            `;
            return await db.executeQuery(query);
        } catch (error) {
            logger.error('Error in getLowStockItems:', error);
            throw error;
        }
    }

    // Vendor-wise Purchase Summary
    async getVendorPurchaseSummary() {
        try {
            const query = `
                SELECT 
                    v.VendorID,
                    v.VendorName,
                    COUNT(DISTINCT p.PurchaseID) as PurchaseCount,
                    ISNULL(SUM(p.TotalAmount), 0) as TotalPurchase,
                    ISNULL(SUM(p.BalanceAmount), 0) as OutstandingAmount
                FROM Vendors v
                LEFT JOIN Purchases p ON v.VendorID = p.VendorID
                WHERE v.VendorType IN ('Vendor', 'Both')
                GROUP BY v.VendorID, v.VendorName
                ORDER BY TotalPurchase DESC
            `;
            return await db.executeQuery(query);
        } catch (error) {
            logger.error('Error in getVendorPurchaseSummary:', error);
            throw error;
        }
    }

    // Customer-wise Sales Summary
    async getCustomerSalesSummary() {
        try {
            const query = `
                SELECT 
                    v.VendorID,
                    v.VendorName,
                    COUNT(DISTINCT s.SaleID) as SalesCount,
                    ISNULL(SUM(s.TotalAmount), 0) as TotalSales,
                    ISNULL(SUM(s.BalanceAmount), 0) as OutstandingAmount
                FROM Vendors v
                LEFT JOIN Sales s ON v.VendorID = s.CustomerID
                WHERE v.VendorType IN ('Customer', 'Both')
                GROUP BY v.VendorID, v.VendorName
                ORDER BY TotalSales DESC
            `;
            return await db.executeQuery(query);
        } catch (error) {
            logger.error('Error in getCustomerSalesSummary:', error);
            throw error;
        }
    }

    // Profit and Loss Report
    async getProfitAndLossReport(fromDate, toDate) {
        try {
            const totalSales = await db.executeQuery(
                'SELECT ISNULL(SUM(TotalAmount), 0) as Amount FROM Sales WHERE SaleDate BETWEEN @fromDate AND @toDate',
                { fromDate, toDate }
            );
            
            const totalPurchase = await db.executeQuery(
                'SELECT ISNULL(SUM(TotalAmount), 0) as Amount FROM Purchases WHERE PurchaseDate BETWEEN @fromDate AND @toDate',
                { fromDate, toDate }
            );
            
            const totalExpenses = await db.executeQuery(
                'SELECT ISNULL(SUM(Amount), 0) as Amount FROM Expenses WHERE ExpenseDate BETWEEN @fromDate AND @toDate',
                { fromDate, toDate }
            );
            
            const revenue = totalSales[0]?.Amount || 0;
            const cogs = totalPurchase[0]?.Amount || 0;
            const expenses = totalExpenses[0]?.Amount || 0;
            const grossProfit = revenue - cogs;
            const netProfit = grossProfit - expenses;
            
            return {
                totalRevenue: revenue,
                totalCost: cogs,
                grossProfit: grossProfit,
                totalExpenses: expenses,
                netProfit: netProfit,
                profitMargin: revenue ? ((netProfit / revenue) * 100).toFixed(2) : 0
            };
        } catch (error) {
            logger.error('Error in getProfitAndLossReport:', error);
            throw error;
        }
    }

    // Get Monthly Sales vs Purchase
    async getMonthlySalesVsPurchase(year) {
        try {
            const query = `
                SELECT 
                    MONTH(TransactionDate) as Month,
                    ISNULL(SUM(CASE WHEN Type = 'Purchase' THEN Amount ELSE 0 END), 0) as TotalPurchase,
                    ISNULL(SUM(CASE WHEN Type = 'Sale' THEN Amount ELSE 0 END), 0) as TotalSales
                FROM (
                    SELECT 'Purchase' as Type, PurchaseDate as TransactionDate, TotalAmount as Amount FROM Purchases
                    UNION ALL
                    SELECT 'Sale', SaleDate, TotalAmount FROM Sales
                ) t
                WHERE YEAR(TransactionDate) = @year
                GROUP BY MONTH(TransactionDate)
                ORDER BY MONTH(TransactionDate)
            `;
            return await db.executeQuery(query, { year });
        } catch (error) {
            logger.error('Error in getMonthlySalesVsPurchase:', error);
            throw error;
        }
    }

    // Get Payment Status Summary
    async getPaymentStatusSummary() {
        try {
            const query = `
                SELECT 
                    'Purchases' as Category,
                    PaymentStatus,
                    COUNT(*) as Count,
                    ISNULL(SUM(BalanceAmount), 0) as OutstandingAmount
                FROM Purchases
                GROUP BY PaymentStatus
                UNION ALL
                SELECT 
                    'Sales',
                    PaymentStatus,
                    COUNT(*),
                    ISNULL(SUM(BalanceAmount), 0)
                FROM Sales
                GROUP BY PaymentStatus
            `;
            return await db.executeQuery(query);
        } catch (error) {
            logger.error('Error in getPaymentStatusSummary:', error);
            throw error;
        }
    }

    // Get Stock Movement Report
    async getStockMovementReport(productId = null) {
        try {
            let query = `
                SELECT sm.*, p.ProductName
                FROM StockMovement sm
                JOIN Products p ON sm.ProductID = p.ProductID
            `;
            
            if (productId) {
                query += ` WHERE sm.ProductID = @productId`;
            }
            
            query += ` ORDER BY sm.CreatedAt DESC`;
            
            const params = productId ? { productId } : {};
            return await db.executeQuery(query, params);
        } catch (error) {
            logger.error('Error in getStockMovementReport:', error);
            throw error;
        }
    }

    // Get Top Vendors by Purchase
    async getTopVendors(limit = 10) {
        try {
            const query = `
                SELECT TOP ${limit} 
                    v.VendorID,
                    v.VendorName,
                    v.City,
                    COUNT(p.PurchaseID) as PurchaseCount,
                    ISNULL(SUM(p.TotalAmount), 0) as TotalAmount
                FROM Vendors v
                LEFT JOIN Purchases p ON v.VendorID = p.VendorID
                WHERE v.VendorType IN ('Vendor', 'Both')
                GROUP BY v.VendorID, v.VendorName, v.City
                ORDER BY TotalAmount DESC
            `;
            return await db.executeQuery(query);
        } catch (error) {
            logger.error('Error in getTopVendors:', error);
            throw error;
        }
    }

    // Get Top Customers by Sales
    async getTopCustomers(limit = 10) {
        try {
            const query = `
                SELECT TOP ${limit} 
                    v.VendorID,
                    v.VendorName,
                    v.City,
                    COUNT(s.SaleID) as SalesCount,
                    ISNULL(SUM(s.TotalAmount), 0) as TotalAmount
                FROM Vendors v
                LEFT JOIN Sales s ON v.VendorID = s.CustomerID
                WHERE v.VendorType IN ('Customer', 'Both')
                GROUP BY v.VendorID, v.VendorName, v.City
                ORDER BY TotalAmount DESC
            `;
            return await db.executeQuery(query);
        } catch (error) {
            logger.error('Error in getTopCustomers:', error);
            throw error;
        }
    }
}

module.exports = new ReportService();
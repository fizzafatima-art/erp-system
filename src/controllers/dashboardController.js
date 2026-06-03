const db = require('../config/database');

// @desc    Get Dashboard KPIs (Total Sales, Purchases, etc)
// @route   GET /api/v1/reports/dashboard
exports.getDashboardKPI = async (req, res) => {
    try {
        // 1. Total Sales
        const salesQuery = `SELECT ISNULL(SUM(TotalAmount), 0) as Total FROM Sales WHERE IsActive = 1`;
        const salesRes = await db.executeQuery(salesQuery);
        const totalSales = salesRes[0]?.Total || 0;

        // 2. Total Purchases
        const purchaseQuery = `SELECT ISNULL(SUM(TotalAmount), 0) as Total FROM Purchases WHERE IsActive = 1`;
        const purchaseRes = await db.executeQuery(purchaseQuery);
        const totalPurchases = purchaseRes[0]?.Total || 0;

        // 3. Total Expenses
        const expenseQuery = `SELECT ISNULL(SUM(Amount), 0) as Total FROM Expenses`;
        const expenseRes = await db.executeQuery(expenseQuery);
        const totalExpenses = expenseRes[0]?.Total || 0;

        // 4. Receivables
        const receivablesQuery = `SELECT ISNULL(SUM(TotalAmount), 0) - ISNULL(SUM(ReceivedAmount), 0) as Total FROM Sales WHERE IsActive = 1`;
        const recRes = await db.executeQuery(receivablesQuery);
        const receivables = recRes[0]?.Total || 0;

        // 5. Payables
        const payablesQuery = `SELECT ISNULL(SUM(TotalAmount), 0) - ISNULL(SUM(PaidAmount), 0) as Total FROM Purchases WHERE IsActive = 1`;
        const payRes = await db.executeQuery(payablesQuery);
        const payables = payRes[0]?.Total || 0;

        // 6. Low Stock
        const lowStockQuery = `SELECT COUNT(*) as Count FROM Stock WHERE CurrentQuantity <= MinimumQuantity`;
        const lowRes = await db.executeQuery(lowStockQuery);
        const lowStockCount = lowRes[0]?.Count || 0;

        const netProfit = totalSales - totalPurchases - totalExpenses;

        res.json({
            success: true,
            data: {
                totalSales,
                totalPurchases,
                totalExpenses,
                receivables,
                payables,
                lowStockCount,
                netProfit
            }
        });

    } catch (error) {
        console.error("Dashboard Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get City Wise Analytics
// @route   GET /api/v1/reports/city-analytics
// @desc    Get Detailed City & Product Breakdown
// @route   GET /api/v1/reports/city-analytics
exports.getCityAnalytics = async (req, res) => {
    try {
        const query = `
            SELECT 
                v.City,
                p.ProductName,
                SUM(si.Quantity) as TotalQuantity,
                SUM(si.Amount) as TotalRevenue
            FROM Sales s
            JOIN SaleItems si ON s.SaleID = si.SaleID
            JOIN Products p ON si.ProductID = p.ProductID
            JOIN Vendors v ON s.CustomerID = v.VendorID
            WHERE s.IsActive = 1
            GROUP BY v.City, p.ProductName
            ORDER BY TotalRevenue DESC
        `;
        const result = await db.executeQuery(query);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("City Analytics Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
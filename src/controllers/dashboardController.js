const db = require('../config/database');

exports.getDashboardKPI = async (req, res) => {
    try {
        const salesRes = await db.executeQuery(
            `SELECT COALESCE(SUM("TotalAmount"), 0) as "Total" FROM "Sales" WHERE "IsActive" = true`
        );
        const totalSales = salesRes[0]?.Total || 0;

        const purchaseRes = await db.executeQuery(
            `SELECT COALESCE(SUM("TotalAmount"), 0) as "Total" FROM "Purchases" WHERE "IsActive" = true`
        );
        const totalPurchases = purchaseRes[0]?.Total || 0;

        const expenseRes = await db.executeQuery(
            `SELECT COALESCE(SUM("Amount"), 0) as "Total" FROM "Expenses"`
        );
        const totalExpenses = expenseRes[0]?.Total || 0;

        const recRes = await db.executeQuery(
            `SELECT COALESCE(SUM("BalanceAmount"), 0) as "Total" FROM "Sales" WHERE "IsActive" = true AND "BalanceAmount" > 0`
        );
        const receivables = recRes[0]?.Total || 0;

        const payRes = await db.executeQuery(
            `SELECT COALESCE(SUM("BalanceAmount"), 0) as "Total" FROM "Purchases" WHERE "IsActive" = true AND "BalanceAmount" > 0`
        );
        const payables = payRes[0]?.Total || 0;

        const lowRes = await db.executeQuery(
            `SELECT COUNT(*) as "Count" FROM "Stock" WHERE "CurrentQuantity" <= "MinimumQuantity"`
        );
        const lowStockCount = lowRes[0]?.Count || 0;

        const netProfit = totalSales - totalPurchases - totalExpenses;

        res.json({
            success: true,
            data: { totalSales, totalPurchases, totalExpenses, receivables, payables, lowStockCount, netProfit }
        });
    } catch (error) {
        console.error("Dashboard Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCityAnalytics = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT 
                v."City",
                p."ProductName",
                SUM(si."Quantity") as "TotalQuantity",
                SUM(si."Amount") as "TotalRevenue"
            FROM "Sales" s
            JOIN "SaleItems" si ON s."SaleID" = si."SaleID"
            JOIN "Products" p ON si."ProductID" = p."ProductID"
            JOIN "Vendors" v ON s."CustomerID" = v."VendorID"
            WHERE s."IsActive" = true
            GROUP BY v."City", p."ProductName"
            ORDER BY "TotalRevenue" DESC
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("City Analytics Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
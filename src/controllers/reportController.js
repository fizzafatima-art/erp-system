const db = require('../config/database');

const getDashboardKPI = async (req, res) => {
    try {
        const salesRes = await db.executeQuery(
            `SELECT COALESCE(SUM("TotalAmount"), 0) as "Total" FROM "Sales" WHERE "IsActive" = true`
        );
        const purchaseRes = await db.executeQuery(
            `SELECT COALESCE(SUM("TotalAmount"), 0) as "Total" FROM "Purchases" WHERE "IsActive" = true`
        );
        const expenseRes = await db.executeQuery(
            `SELECT COALESCE(SUM("Amount"), 0) as "Total" FROM "Expenses"`
        );
        const payablesRes = await db.executeQuery(
            `SELECT COALESCE(SUM("BalanceAmount"), 0) as "Total" FROM "Purchases" WHERE "PaymentStatus" != 'Paid'`
        );
        const receivablesRes = await db.executeQuery(
            `SELECT COALESCE(SUM("BalanceAmount"), 0) as "Total" FROM "Sales" WHERE "PaymentStatus" != 'Paid'`
        );
        const lowStockRes = await db.executeQuery(
            `SELECT COUNT(*) as "Count" FROM "Stock" WHERE "CurrentQuantity" <= "MinimumQuantity"`
        );

        res.json({
            success: true,
            data: {
                totalSales:      salesRes[0]?.Total || 0,
                totalPurchases:  purchaseRes[0]?.Total || 0,
                totalExpenses:   expenseRes[0]?.Total || 0,
                payables:        payablesRes[0]?.Total || 0,
                receivables:     receivablesRes[0]?.Total || 0,
                lowStockCount:   lowStockRes[0]?.Count || 0,
                netProfit:       (salesRes[0]?.Total || 0) - (purchaseRes[0]?.Total || 0) - (expenseRes[0]?.Total || 0)
            }
        });
    } catch (error) {
        console.error("Error fetching dashboard KPI:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getOutstanding = async (req, res) => {
    try {
        const payables = await db.executeQuery(
            `SELECT COALESCE(SUM("BalanceAmount"), 0) as "Total" FROM "Purchases" WHERE "PaymentStatus" != 'Paid'`
        );
        const receivables = await db.executeQuery(
            `SELECT COALESCE(SUM("BalanceAmount"), 0) as "Total" FROM "Sales" WHERE "PaymentStatus" != 'Paid'`
        );

        res.json({
            success: true,
            data: {
                payables:    payables[0].Total,
                receivables: receivables[0].Total
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getDashboardKPI, getOutstanding };
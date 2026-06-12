const db = require('../config/database');

// ==========================================
// DASHBOARD KPIs
// ==========================================
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
            `SELECT COALESCE(SUM("BalanceAmount"), 0) as "Total" FROM "Purchases" WHERE "IsActive" = true AND "BalanceAmount" > 0`
        );
        const receivablesRes = await db.executeQuery(
            `SELECT COALESCE(SUM("BalanceAmount"), 0) as "Total" FROM "Sales" WHERE "IsActive" = true AND "BalanceAmount" > 0`
        );
        const lowStockRes = await db.executeQuery(
            `SELECT COUNT(*) as "Count" FROM "Stock" WHERE "CurrentQuantity" <= "MinimumQuantity"`
        );

        const netProfit = (salesRes[0]?.Total || 0) - (purchaseRes[0]?.Total || 0) - (expenseRes[0]?.Total || 0);

        res.json({
            success: true,
            data: {
                totalSales:     salesRes[0]?.Total || 0,
                totalPurchases: purchaseRes[0]?.Total || 0,
                totalExpenses:  expenseRes[0]?.Total || 0,
                payables:       payablesRes[0]?.Total || 0,
                receivables:    receivablesRes[0]?.Total || 0,
                lowStockCount:  lowStockRes[0]?.Count || 0,
                netProfit:      netProfit
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
            `SELECT COALESCE(SUM("BalanceAmount"), 0) as "Total" FROM "Purchases" WHERE "IsActive" = true AND "BalanceAmount" > 0`
        );
        const receivables = await db.executeQuery(
            `SELECT COALESCE(SUM("BalanceAmount"), 0) as "Total" FROM "Sales" WHERE "IsActive" = true AND "BalanceAmount" > 0`
        );
        res.json({ success: true, data: { payables: payables[0].Total, receivables: receivables[0].Total } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getVendorProfit = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT 
                v."VendorName",
                SUM((si."Rate" - p."Price") * si."Quantity") AS "TotalProfit"
            FROM "SaleItems" si
            JOIN "Sales" s ON si."SaleID" = s."SaleID"
            JOIN "Products" p ON si."ProductID" = p."ProductID"
            JOIN "Vendors" v ON p."VendorID" = v."VendorID"
            WHERE v."VendorType" IN ('Vendor', 'Supplier')
            GROUP BY v."VendorName"
            ORDER BY "TotalProfit" DESC
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getTopProducts = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT p."ProductName", SUM(si."Quantity") AS "TotalSold"
            FROM "SaleItems" si
            JOIN "Products" p ON si."ProductID" = p."ProductID"
            GROUP BY p."ProductName"
            ORDER BY "TotalSold" DESC
            LIMIT 10
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getTopCustomers = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT v."VendorName" AS "CustomerName", v."City", SUM(s."TotalAmount") AS "TotalSpent"
            FROM "Sales" s
            JOIN "Vendors" v ON s."CustomerID" = v."VendorID"
            WHERE v."VendorType" = 'Customer'
            GROUP BY v."VendorName", v."City"
            ORDER BY "TotalSpent" DESC
            LIMIT 10
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getOutstandingCustomers = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT v."VendorID", v."VendorName", v."Phone", v."City",
                SUM(s."BalanceAmount") AS "TotalOutstanding"
            FROM "Sales" s
            JOIN "Vendors" v ON s."CustomerID" = v."VendorID"
            WHERE v."VendorType" = 'Customer' AND s."BalanceAmount" > 0
            GROUP BY v."VendorID", v."VendorName", v."Phone", v."City"
            ORDER BY "TotalOutstanding" DESC
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCityReport = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT v."City", COUNT(DISTINCT s."CustomerID") AS "CustomerCount",
                SUM(s."TotalAmount") AS "TotalSales"
            FROM "Sales" s
            JOIN "Vendors" v ON s."CustomerID" = v."VendorID"
            WHERE v."VendorType" = 'Customer'
            GROUP BY v."City"
            ORDER BY "TotalSales" DESC
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { 
    getDashboardKPI, 
    getOutstanding,
    getVendorProfit:             exports.getVendorProfit,
    getTopProducts:              exports.getTopProducts,
    getTopCustomers:             exports.getTopCustomers,
    getOutstandingCustomers:     exports.getOutstandingCustomers,
    getCityReport:               exports.getCityReport
};
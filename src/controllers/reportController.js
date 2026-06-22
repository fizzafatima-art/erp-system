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

const getVendorProfit = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT 
                v."VendorName",
                COALESCE(SUM(p."TotalAmount"), 0) AS "TotalPurchases",
                COALESCE(SUM(p."PaidAmount"), 0) AS "TotalPaid",
                COALESCE(SUM(p."BalanceAmount"), 0) AS "TotalBalance"
            FROM "Purchases" p
            JOIN "Vendors" v ON p."VendorID" = v."VendorID"
            WHERE UPPER(v."VendorType") IN ('VENDOR', 'SUPPLIER', 'BOTH')
            GROUP BY v."VendorName"
            ORDER BY "TotalPurchases" DESC
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getTopProducts = async (req, res) => {
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

const getTopCustomers = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT v."VendorName" AS "CustomerName", v."City", SUM(s."TotalAmount") AS "TotalSpent"
            FROM "Sales" s
            JOIN "Vendors" v ON s."CustomerID" = v."VendorID"
            WHERE UPPER(v."VendorType") IN ('CUSTOMER', 'BOTH')
            GROUP BY v."VendorName", v."City"
            ORDER BY "TotalSpent" DESC
            LIMIT 10
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getOutstandingCustomers = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT v."VendorID", v."VendorName", v."Phone", v."City",
                SUM(s."BalanceAmount") AS "TotalOutstanding"
            FROM "Sales" s
            JOIN "Vendors" v ON s."CustomerID" = v."VendorID"
            WHERE UPPER(v."VendorType") IN ('CUSTOMER', 'BOTH') AND s."BalanceAmount" > 0
            GROUP BY v."VendorID", v."VendorName", v."Phone", v."City"
            ORDER BY "TotalOutstanding" DESC
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getOutstandingSuppliers = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT v."VendorID", v."VendorName", v."Phone", v."City",
                SUM(p."BalanceAmount") AS "TotalOutstanding"
            FROM "Purchases" p
            JOIN "Vendors" v ON p."VendorID" = v."VendorID"
            WHERE UPPER(v."VendorType") IN ('SUPPLIER', 'VENDOR', 'BOTH') AND p."BalanceAmount" > 0
            GROUP BY v."VendorID", v."VendorName", v."Phone", v."City"
            ORDER BY "TotalOutstanding" DESC
        `);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getCityReport = async (req, res) => {
    try {
        const result = await db.executeQuery(`
            SELECT v."City", COUNT(DISTINCT s."CustomerID") AS "CustomerCount",
                SUM(s."TotalAmount") AS "TotalSales"
            FROM "Sales" s
            JOIN "Vendors" v ON s."CustomerID" = v."VendorID"
            WHERE UPPER(v."VendorType") IN ('CUSTOMER', 'BOTH')
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
    getVendorProfit,
    getTopProducts,
    getTopCustomers,
    getOutstandingCustomers,
    getOutstandingSuppliers,
    getCityReport
};
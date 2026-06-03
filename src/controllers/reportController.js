const db = require('../config/database');
const { executeQuery } = require('../config/database');

// @desc    Get Dashboard KPI Data
// @route   GET /api/v1/reports/dashboard
const getDashboardKPI = async (req, res) => {
    try {
        const result = await executeQuery("EXEC sp_GetDashboardKPI");

        if (result && result.length > 0) {
            res.status(200).json(result[0]);
        } else {
            res.status(200).json({ 
                totalPurchases: 0, 
                totalSales: 0, 
                totalExpenses: 0,
                outstandingPayables: 0,
                outstandingReceivables: 0,
                lowStockCount: 0
            });
        }
    } catch (error) {
        console.error("Error fetching dashboard KPI:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// @desc    Get Dashboard summary (purchases, sales, expenses, net profit)
// @route   GET /api/v1/reports/dashboard (alternate)
const getDashboard = async (req, res) => {
    try {
        const purchases = await db.executeQuery('SELECT ISNULL(SUM(TotalAmount),0) as Total FROM Purchases');
        const sales = await db.executeQuery('SELECT ISNULL(SUM(TotalAmount),0) as Total FROM Sales');
        const expenses = await db.executeQuery('SELECT ISNULL(SUM(Amount),0) as Total FROM Expenses');
        
        res.json({
            success: true,
            data: {
                totalPurchase: purchases[0].Total,
                totalSale: sales[0].Total,
                totalExpense: expenses[0].Total,
                netProfit: sales[0].Total - purchases[0].Total - expenses[0].Total
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get outstanding payables and receivables
// @route   GET /api/v1/reports/outstanding
const getOutstanding = async (req, res) => {
    try {
        const payables = await db.executeQuery(
            "SELECT ISNULL(SUM(BalanceAmount),0) as Total FROM Purchases WHERE PaymentStatus != 'Paid'"
        );
        const receivables = await db.executeQuery(
            "SELECT ISNULL(SUM(BalanceAmount),0) as Total FROM Sales WHERE PaymentStatus != 'Paid'"
        );
        
        res.json({
            success: true,
            data: {
                payables: payables[0].Total,
                receivables: receivables[0].Total
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// All functions exported together — never mix module.exports and exports.x
module.exports = {
    getDashboardKPI,
    getDashboard,
    getOutstanding
};
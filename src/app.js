const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const logger = require('./utils/logger');

dotenv.config();

const app = express();

// Middleware
// CORS ko har jagah se allow karne ke liye (Tension free setup)
app.use(cors({
    origin: '*', // Yeh har tarah ke frontend (localhost aur live website) ko allow kardega
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// API Config
const apiVersion = process.env.API_VERSION || 'v1';
const apiBase = `/api/${apiVersion}`;

// Helper to load routes safely
const loadRoute = (path, routeModule) => {
    try {
        app.use(`${apiBase}${path}`, routeModule);
        logger.info(`✅ Route loaded: ${apiBase}${path}`);
    } catch (error) {
        logger.error(`❌ Failed to load route ${path}:`, error.message);
    }
};

// --- 1. CORE MODULES (These must exist) ---
loadRoute('/vendors', require('./routes/vendorRoutes'));
loadRoute('/products', require('./routes/productRoutes'));
loadRoute('/purchases', require('./routes/purchaseRoutes'));
loadRoute('/sales', require('./routes/saleRoutes')); // Ensure saleRoutes.js has /return route
loadRoute('/stock', require('./routes/stockRoutes'));

// --- 2. DASHBOARD (Fixed & Mounted) ---
// Directly require and mount to ensure it works regardless of reportRoutes
try {
    const dashboardController = require('./controllers/dashboardController');
    
    // Dashboard KPIs
    app.get(`${apiBase}/reports/dashboard`, dashboardController.getDashboardKPI);
    
    // City Wise Analytics (ADDED)
    app.get(`${apiBase}/reports/city-analytics`, dashboardController.getCityAnalytics);
    
    console.log("✅ Dashboard API Mounted");
} catch (err) {
    console.error("❌ Dashboard Controller Missing:", err.message);
}

// --- 3. LEDGER (Safely Loaded) ---
try {
    loadRoute('/ledger', require('./routes/ledgerRoutes'));
} catch (e) { console.log("⚠️  Ledger routes not found. Skipping..."); }

// --- 4. OTHER MODULES (Optional) ---
try {
    loadRoute('/expenses', require('./routes/expenseRoutes'));
} catch (e) { console.log("⚠️  Expenses routes not found. Skipping..."); }

try {
    loadRoute('/reports', require('./routes/reportRoutes'));
} catch (e) { console.log("⚠️  Reports routes not found. Skipping..."); }

try {
    loadRoute('/payments', require('./routes/paymentRoutes'));
} catch (e) { console.log("⚠️  Payments routes not found. Skipping..."); }


// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// 404 Handler (Agar upar koi route match nahi karta)
app.use((req, res) => {
    console.log(`❌ 404 Hit: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        success: false, 
        message: 'Endpoint not found', 
        path: req.originalUrl,
        hint: 'Check if the route file exists in /routes folder'
    });
});

// Global Error Handler (Internal Server Errors ke liye)
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(err.statusCode || 500).json({ 
        success: false, 
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.stack : {}
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Dashboard: http://localhost:${PORT}/api/v1/reports/dashboard`);
});

module.exports = app;
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const logger = require('./utils/logger');

dotenv.config();
const app = express();

// CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

const apiVersion = process.env.API_VERSION || 'v1';
const apiBase = `/api/${apiVersion}`;

const loadRoute = (path, routeModule) => {
    try {
        app.use(`${apiBase}${path}`, routeModule);
        logger.info(`Route loaded: ${apiBase}${path}`);
    } catch (error) {
        logger.error(`Route failed: ${apiBase}${path} - ${error.message}`);
    }
};

// Routes
try { loadRoute('/vendors',   require('./routes/vendorRoutes'));   }
catch (e) { console.log("Vendors skipped:", e.message); }

try { loadRoute('/products',  require('./routes/productRoutes'));  }  // ← ADDED
catch (e) { console.log("Products skipped:", e.message); }

try { loadRoute('/sales',     require('./routes/saleRoutes'));     }  // ← saleRoutes (bina s)
catch (e) { console.log("Sales skipped:", e.message); }

try { loadRoute('/purchases', require('./routes/purchaseRoutes')); }
catch (e) { console.log("Purchases skipped:", e.message); }

try { loadRoute('/stock',     require('./routes/stockRoutes'));    }  // ← ADDED
catch (e) { console.log("Stock skipped:", e.message); }

try { loadRoute('/ledger',    require('./routes/ledgerRoutes'));   }
catch (e) { console.log("Ledger skipped:", e.message); }

try { loadRoute('/expenses',  require('./routes/expenseRoutes'));  }
catch (e) { console.log("Expenses skipped:", e.message); }

try { loadRoute('/reports',   require('./routes/reportRoutes'));   }
catch (e) { console.log("Reports skipped:", e.message); }

try { loadRoute('/payments',  require('./routes/paymentRoutes'));  }
catch (e) { console.log("Payments skipped:", e.message); }

try { loadRoute('/dashboard', require('./routes/dashboardRoutes')); }
catch (e) { console.log("Dashboard skipped:", e.message); }

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error Handler
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
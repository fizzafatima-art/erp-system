const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
// Agar utils bhi src ke andar hai, toh path update kiya
const logger = require('./utils/logger');

dotenv.config();
const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

const apiBase = `/api/${process.env.API_VERSION || 'v1'}`;

const loadRoute = (path, routeModule) => {
    app.use(`${apiBase}${path}`, routeModule);
    logger.info(`Route loaded: ${apiBase}${path}`);
};

// --- Updated Paths (src folder ke andar) ---
try { loadRoute('/vendors',   require('./src/routes/vendorRoutes'));   } catch(e) { console.log('vendors skip:', e.message); }
try { loadRoute('/products',  require('./src/routes/productRoutes'));  } catch(e) { console.log('products skip:', e.message); }
try { loadRoute('/sales',     require('./src/routes/saleRoutes'));     } catch(e) { console.log('sales skip:', e.message); }
try { loadRoute('/purchases', require('./src/routes/purchaseRoutes')); } catch(e) { console.log('purchases skip:', e.message); }
try { loadRoute('/stock',     require('./src/routes/stockRoutes'));    } catch(e) { console.log('stock skip:', e.message); }
try { loadRoute('/ledger',    require('./src/routes/ledgerRoutes'));   } catch(e) { console.log('ledger skip:', e.message); }
try { loadRoute('/expenses',  require('./src/routes/expenseRoutes'));  } catch(e) { console.log('expenses skip:', e.message); }
try { loadRoute('/reports',   require('./src/routes/reportRoutes'));   } catch(e) { console.log('reports skip:', e.message); }
try { loadRoute('/payments',  require('./src/routes/paymentRoutes'));  } catch(e) { console.log('payments skip:', e.message); }
try { loadRoute('/dashboard', require('./src/routes/dashboardRoutes')); } catch(e) { console.log('dashboard skip:', e.message); }

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
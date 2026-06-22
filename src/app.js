const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
// Agar utils bhi src ke andar hai, toh path update kiya
const logger = require('./utils/logger');

dotenv.config();
const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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

try { loadRoute('/vendors',     require('./routes/vendorRoutes'));     } catch(e) { console.log('vendors skip:', e.message); }
try { loadRoute('/products',    require('./routes/productRoutes'));    } catch(e) { console.log('products skip:', e.message); }
try { loadRoute('/sales',       require('./routes/saleRoutes'));       } catch(e) { console.log('sales skip:', e.message); }
try { loadRoute('/purchases',   require('./routes/purchaseRoutes'));   } catch(e) { console.log('purchases skip:', e.message); }
try { loadRoute('/stock',       require('./routes/stockRoutes'));      } catch(e) { console.log('stock skip:', e.message); }
try { loadRoute('/warehouse',   require('./routes/warehouseRoutes'));  } catch(e) { console.log('warehouse skip:', e.message); }
try { loadRoute('/ledger',      require('./routes/ledgerRoutes'));     } catch(e) { console.log('ledger skip:', e.message); }
try { loadRoute('/expenses',    require('./routes/expenseRoutes'));    } catch(e) { console.log('expenses skip:', e.message); }
try { loadRoute('/reports',     require('./routes/reportRoutes'));     } catch(e) { console.log('reports skip:', e.message); }
try { loadRoute('/payments',    require('./routes/paymentRoutes'));    } catch(e) { console.log('payments skip:', e.message); }
try { loadRoute('/dashboard',        require('./routes/dashboardRoutes'));   } catch(e) { console.log('dashboard skip:', e.message); }
try { loadRoute('/bank-reconciliation', require('./routes/bankRoutes'));      } catch(e) { console.log('bank skip:', e.message); }

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
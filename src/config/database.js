const { Pool } = require('pg');
const logger = require('../utils/logger');

// PostgreSQL Configuration Object
const config = {
     host: process.env.DB_HOST || 'localhost',  // DB_SERVER → DB_HOST
    database: process.env.DB_NAME || 'ERP_System',
    user: process.env.DB_USER || 'erp_user',
    password: process.env.DB_PASSWORD || 'ErpPass@123',
    port: parseInt(process.env.DB_PORT) || 5432,
    // Render PostgreSQL ke liye SSL zaroori hota hai
   ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

const pool = new Pool(config);

// Connection test karne ke liye
pool.on('connect', () => {
    logger.info('Database connected successfully');
});

pool.on('error', (err) => {
    logger.error('Unexpected error on idle database client', err);
});

async function executeQuery(query, params = {}) {
    try {
        // SQL Server mein params @paramName hote hain, Postgres mein $1, $2 hote hain.
        // Agar aapke pas simple queries hain bina params ke, to ye direct chalegi.
        // Agar params hain, to unhein array format mein convert karna hoga.
        const paramKeys = Object.keys(params);
        let formattedQuery = query;
        const paramValues = [];

        paramKeys.forEach((key, index) => {
            formattedQuery = formattedQuery.replace(new RegExp(`@${key}`, 'g'), `$${index + 1}`);
            paramValues.push(params[key]);
        });

        const result = await pool.query(formattedQuery, paramValues);
        return result.rows || result.rowCount;
    } catch (error) {
        logger.error('Database query error:', error);
        throw error;
    }
}

// Baki functions ka placeholder taake backend crash na ho agar kahin import hain
async function getConnection() { return pool; }
async function closeConnection() { await pool.end(); }

module.exports = { 
    getConnection, 
    getPool: () => pool,  
    closeConnection, 
    executeQuery,
    // Agar stored procedures use ho rahe hain to Postgres mein unhein CALL kiya jata hai
    executeStoredProcedure: async (name, params) => {
        logger.warn('Stored procedures need manual conversion in PostgreSQL');
        return [];
    }
};
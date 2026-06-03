// Only if you need to validate env vars strictly
// Usually dotenv handles this, but this file exists per your structure
require('dotenv').config();

module.exports = {
    port: process.env.PORT || 5000,
    dbConfig: {
        server: process.env.DB_SERVER,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    }
};
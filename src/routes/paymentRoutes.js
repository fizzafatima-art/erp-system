const express = require('express');
const router = express.Router();

// Payments are handled within Purchase and Sale routes typically, 
// but we keep this file to prevent app.js from crashing
router.get('/', (req, res) => {
    res.json({ message: "Payment module is integrated with Purchases and Sales." });
});

module.exports = router;
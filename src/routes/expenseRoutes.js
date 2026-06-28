const express = require('express');
const router  = express.Router();
const c = require('../controllers/expenseController');

// Expenses
router.get('/',        c.getAllExpenses);
router.post('/',       c.createExpense);
router.put('/:id',     c.updateExpense);
router.delete('/:id',  c.deleteExpense);

// Expense Types
router.get('/types',        c.getAllExpenseTypes);
router.post('/types',       c.createExpenseType);
router.delete('/types/:id', c.deleteExpenseType);

// Petty Cash
router.get('/petty-cash',              c.getPettyCash);
router.post('/petty-cash/fund',        c.addPettyCashFund);
router.post('/petty-cash/expense',     c.addPettyCashExpense);
router.delete('/petty-cash/:id',       c.deletePettyCashTransaction);

module.exports = router;
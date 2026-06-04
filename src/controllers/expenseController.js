const db = require('../config/database');

exports.getAllExpenses = async (req, res) => {
  try {
    let query = 'SELECT * FROM "Expenses"';
    const params = {};
    const conditions = [];

    if (req.query.from) { conditions.push('"ExpenseDate" >= @from'); params.from = req.query.from; }
    if (req.query.to)   { conditions.push('"ExpenseDate" <= @to');   params.to   = req.query.to; }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY "ExpenseDate" DESC';

    const result = await db.executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('getAllExpenses error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const { category, description, amount, paymentMethod } = req.body;

    if (!category || !category.toString().trim())
      return res.status(400).json({ success: false, message: 'Category is required.' });
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });

    await db.executeQuery(`
      INSERT INTO "Expenses" ("ExpenseDate", "Category", "Description", "Amount", "PaymentMethod", "IsApproved")
      VALUES (NOW(), @category, @description, @amount, @paymentMethod, true)
    `, {
      category:      category.toString().trim(),
      description:   description ? description.toString().trim() : null,
      amount:        Number(amount),
      paymentMethod: paymentMethod ? paymentMethod.toString() : 'Cash',
    });

    res.status(201).json({ success: true, message: 'Expense recorded successfully.' });
  } catch (err) {
    console.error('createExpense error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const { category, description, amount, paymentMethod, expenseDate } = req.body;

    if (!category || !category.toString().trim())
      return res.status(400).json({ success: false, message: 'Category is required.' });
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });

    await db.executeQuery(`
      UPDATE "Expenses"
      SET "Category"      = @category,
          "Description"   = @description,
          "Amount"        = @amount,
          "PaymentMethod" = @paymentMethod
          ${expenseDate ? ', "ExpenseDate" = @expenseDate' : ''}
      WHERE "ExpenseID" = @id
    `, {
      id:            req.params.id,
      category:      category.toString().trim(),
      description:   description ? description.toString().trim() : null,
      amount:        Number(amount),
      paymentMethod: paymentMethod ? paymentMethod.toString() : 'Cash',
      ...(expenseDate ? { expenseDate } : {}),
    });

    res.json({ success: true, message: 'Expense updated.' });
  } catch (err) {
    console.error('updateExpense error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    await db.executeQuery('DELETE FROM "Expenses" WHERE "ExpenseID" = @id', { id: req.params.id });
    res.json({ success: true, message: 'Expense deleted.' });
  } catch (err) {
    console.error('deleteExpense error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
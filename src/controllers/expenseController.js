const db = require('../config/database');

// ─── EXPENSES ───────────────────────────────────────────────
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
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const { category, description, amount, paymentMethod, expenseDate, chequeNo } = req.body;
    if (!category || !category.toString().trim())
      return res.status(400).json({ success: false, message: 'Category is required.' });
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });
    await db.executeQuery(`
      INSERT INTO "Expenses" ("ExpenseDate", "Category", "Description", "Amount", "PaymentMethod", "ChequeNo", "IsApproved")
      VALUES (@expenseDate, @category, @description, @amount, @paymentMethod, @chequeNo, true)
    `, {
      category:      category.toString().trim(),
      description:   description ? description.toString().trim() : null,
      amount:        Number(amount),
      paymentMethod: paymentMethod ? paymentMethod.toString() : 'Cash',
      expenseDate:   expenseDate || new Date().toISOString().split('T')[0],
      chequeNo:      chequeNo ? chequeNo.toString().trim() : null,
    });
    res.status(201).json({ success: true, message: 'Expense recorded successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const { category, description, amount, paymentMethod, expenseDate, chequeNo } = req.body;
    if (!category || !category.toString().trim())
      return res.status(400).json({ success: false, message: 'Category is required.' });
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });
    await db.executeQuery(`
      UPDATE "Expenses"
      SET "Category"      = @category,
          "Description"   = @description,
          "Amount"        = @amount,
          "PaymentMethod" = @paymentMethod,
          "ChequeNo"      = @chequeNo,
          "ExpenseDate"   = @expenseDate
      WHERE "ExpenseID" = @id
    `, {
      id:            req.params.id,
      category:      category.toString().trim(),
      description:   description ? description.toString().trim() : null,
      amount:        Number(amount),
      paymentMethod: paymentMethod ? paymentMethod.toString() : 'Cash',
      expenseDate:   expenseDate || new Date().toISOString().split('T')[0],
      chequeNo:      chequeNo ? chequeNo.toString().trim() : null,
    });
    res.json({ success: true, message: 'Expense updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    await db.executeQuery('DELETE FROM "Expenses" WHERE "ExpenseID" = @id', { id: req.params.id });
    res.json({ success: true, message: 'Expense deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── EXPENSE TYPES ───────────────────────────────────────────
exports.getAllExpenseTypes = async (req, res) => {
  try {
    const result = await db.executeQuery(`SELECT * FROM "ExpenseTypes" WHERE "IsActive" = true ORDER BY "TypeName"`);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createExpenseType = async (req, res) => {
  try {
    const { typeName } = req.body;
    if (!typeName || !typeName.trim())
      return res.status(400).json({ success: false, message: 'Type name is required.' });
    await db.executeQuery(
      `INSERT INTO "ExpenseTypes" ("TypeName") VALUES (@typeName)`,
      { typeName: typeName.trim() }
    );
    res.status(201).json({ success: true, message: 'Expense type added.' });
  } catch (err) {
    if (err.message && err.message.includes('unique'))
      return res.status(400).json({ success: false, message: 'This type already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteExpenseType = async (req, res) => {
  try {
    await db.executeQuery(`DELETE FROM "ExpenseTypes" WHERE "TypeID" = @id`, { id: req.params.id });
    res.json({ success: true, message: 'Expense type deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PETTY CASH ──────────────────────────────────────────────
exports.getPettyCash = async (req, res) => {
  try {
    const balRes = await db.executeQuery(`SELECT * FROM "PettyCash" LIMIT 1`);
    const txRes  = await db.executeQuery(`SELECT * FROM "PettyCashTransactions" ORDER BY "TransactionDate" DESC`);
    res.json({
      success: true,
      balance: balRes.length > 0 ? Number(balRes[0].CurrentBalance) : 0,
      transactions: txRes
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addPettyCashFund = async (req, res) => {
  try {
    const { amount, description, date } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });

    const Amt = Number(amount);

    // Balance update karo
    const balRes = await db.executeQuery(`SELECT "CurrentBalance" FROM "PettyCash" LIMIT 1`);
    const oldBal = balRes.length > 0 ? Number(balRes[0].CurrentBalance) : 0;
    const newBal = oldBal + Amt;

    await db.executeQuery(`UPDATE "PettyCash" SET "CurrentBalance" = @bal, "LastUpdated" = NOW()`, { bal: newBal });

    // Transaction record karo
    await db.executeQuery(`
      INSERT INTO "PettyCashTransactions" ("TransactionDate", "TransactionType", "Amount", "Category", "Description", "BalanceAfter")
      VALUES (@date, 'Fund Add', @amount, 'Fund', @description, @balAfter)
    `, {
      date:        date || new Date(),
      amount:      Amt,
      description: description || 'Petty Cash Fund Added',
      balAfter:    newBal
    });

    // Ledger entry
    try {
      await db.executeQuery(`
        INSERT INTO "Ledger" ("VendorID", "TransactionDate", "TransactionType", "Remarks", "ReferenceID", "InvoiceNo", "Debit", "CreatedAt")
        VALUES (0, @date, 'Petty Cash', @remarks, 0, 'PC-FUND', @amount, NOW())
      `, {
        date:    date || new Date(),
        remarks: description || 'Petty Cash Fund Added',
        amount:  Amt
      });
    } catch (e) { console.error('Ledger entry failed:', e.message); }

    res.status(201).json({ success: true, message: 'Fund added.', newBalance: newBal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addPettyCashExpense = async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });

    const Amt = Number(amount);

    const balRes = await db.executeQuery(`SELECT "CurrentBalance" FROM "PettyCash" LIMIT 1`);
    const oldBal = balRes.length > 0 ? Number(balRes[0].CurrentBalance) : 0;

    if (oldBal < Amt)
      return res.status(400).json({ success: false, message: `Insufficient petty cash balance. Available: Rs.${oldBal}` });

    const newBal = oldBal - Amt;

    await db.executeQuery(`UPDATE "PettyCash" SET "CurrentBalance" = @bal, "LastUpdated" = NOW()`, { bal: newBal });

    await db.executeQuery(`
      INSERT INTO "PettyCashTransactions" ("TransactionDate", "TransactionType", "Amount", "Category", "Description", "BalanceAfter")
      VALUES (@date, 'Expense', @amount, @category, @description, @balAfter)
    `, {
      date:        date || new Date(),
      amount:      Amt,
      category:    category || 'General',
      description: description || '',
      balAfter:    newBal
    });

    // Ledger entry
    try {
      await db.executeQuery(`
        INSERT INTO "Ledger" ("VendorID", "TransactionDate", "TransactionType", "Remarks", "ReferenceID", "InvoiceNo", "Credit", "CreatedAt")
        VALUES (0, @date, 'Petty Cash', @remarks, 0, 'PC-EXP', @amount, NOW())
      `, {
        date:    date || new Date(),
        remarks: `Petty Cash Expense: ${category || 'General'} - ${description || ''}`,
        amount:  Amt
      });
    } catch (e) { console.error('Ledger entry failed:', e.message); }

    res.status(201).json({ success: true, message: 'Petty cash expense recorded.', newBalance: newBal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deletePettyCashTransaction = async (req, res) => {
  try {
    const txRes = await db.executeQuery(
      `SELECT * FROM "PettyCashTransactions" WHERE "TransactionID" = @id`,
      { id: req.params.id }
    );
    if (!txRes || txRes.length === 0)
      return res.status(404).json({ success: false, message: 'Transaction not found.' });

    const tx = txRes[0];
    const balRes = await db.executeQuery(`SELECT "CurrentBalance" FROM "PettyCash" LIMIT 1`);
    const oldBal = balRes.length > 0 ? Number(balRes[0].CurrentBalance) : 0;

    // Reverse karo
    const newBal = tx.TransactionType === 'Fund Add'
      ? oldBal - Number(tx.Amount)
      : oldBal + Number(tx.Amount);

    await db.executeQuery(`UPDATE "PettyCash" SET "CurrentBalance" = @bal, "LastUpdated" = NOW()`, { bal: newBal });
    await db.executeQuery(`DELETE FROM "PettyCashTransactions" WHERE "TransactionID" = @id`, { id: req.params.id });

    res.json({ success: true, message: 'Transaction deleted.', newBalance: newBal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
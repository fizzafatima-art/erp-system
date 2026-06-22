const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── Bank Accounts ────────────────────────────────────────
router.get('/accounts', async (req, res) => {
  try {
    const result = await db.executeQuery(`SELECT * FROM "BankAccounts" WHERE "IsActive" = true ORDER BY "BankName"`);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/accounts', async (req, res) => {
  try {
    const { BankName, AccountTitle, AccountNo, BranchCode, OpeningBalance } = req.body;
    if (!BankName) return res.status(400).json({ success: false, message: 'Bank name required' });
    const result = await db.executeQuery(
      `INSERT INTO "BankAccounts" ("BankName","AccountTitle","AccountNo","BranchCode","OpeningBalance")
       VALUES (@BN,@AT,@AN,@BC,@OB) RETURNING *`,
      { BN: BankName, AT: AccountTitle||'', AN: AccountNo||'', BC: BranchCode||'', OB: Number(OpeningBalance)||0 }
    );
    res.status(201).json({ success: true, data: result[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/accounts/:id', async (req, res) => {
  try {
    const { BankName, AccountTitle, AccountNo, BranchCode, OpeningBalance } = req.body;
    const result = await db.executeQuery(
      `UPDATE "BankAccounts" SET "BankName"=@BN,"AccountTitle"=@AT,"AccountNo"=@AN,"BranchCode"=@BC,"OpeningBalance"=@OB
       WHERE "AccountID"=@Id RETURNING *`,
      { BN: BankName, AT: AccountTitle||'', AN: AccountNo||'', BC: BranchCode||'', OB: Number(OpeningBalance)||0, Id: req.params.id }
    );
    res.json({ success: true, data: result[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    await db.executeQuery(`UPDATE "BankAccounts" SET "IsActive"=false WHERE "AccountID"=@Id`, { Id: req.params.id });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Bank Statements ──────────────────────────────────────
router.get('/statements', async (req, res) => {
  try {
    const { accountId, dateFrom, dateTo } = req.query;
    let query = `
      SELECT bs.*, ba."BankName", ba."AccountNo"
      FROM "BankStatements" bs
      JOIN "BankAccounts" ba ON bs."AccountID" = ba."AccountID"
      WHERE 1=1
    `;
    if (accountId) query += ` AND bs."AccountID" = ${Number(accountId)}`;
    if (dateFrom)  query += ` AND bs."TransactionDate" >= '${dateFrom}'`;
    if (dateTo)    query += ` AND bs."TransactionDate" <= '${dateTo}'`;
    query += ` ORDER BY bs."TransactionDate" DESC, bs."StatementID" DESC`;
    const result = await db.executeQuery(query);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/statements', async (req, res) => {
  try {
    const { AccountID, TransactionDate, Description, Debit, Credit, Balance, ReferenceNo } = req.body;
    if (!AccountID || !TransactionDate) return res.status(400).json({ success: false, message: 'AccountID and Date required' });
    const result = await db.executeQuery(
      `INSERT INTO "BankStatements" ("AccountID","TransactionDate","Description","Debit","Credit","Balance","ReferenceNo")
       VALUES (@AID,@TD,@Desc,@D,@C,@B,@Ref) RETURNING *`,
      { AID: Number(AccountID), TD: TransactionDate, Desc: Description||'', D: Number(Debit)||0, C: Number(Credit)||0, B: Number(Balance)||0, Ref: ReferenceNo||'' }
    );
    res.status(201).json({ success: true, data: result[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/statements/:id', async (req, res) => {
  try {
    await db.executeQuery(`DELETE FROM "BankStatements" WHERE "StatementID"=@Id`, { Id: req.params.id });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Bank Payments (system transactions) ─────────────────
router.get('/payments', async (req, res) => {
  try {
    const { accountId, dateFrom, dateTo } = req.query;
    let query = `
      SELECT bp.*, ba."BankName", ba."AccountNo"
      FROM "BankPayments" bp
      JOIN "BankAccounts" ba ON bp."AccountID" = ba."AccountID"
      WHERE 1=1
    `;
    if (accountId) query += ` AND bp."AccountID" = ${Number(accountId)}`;
    if (dateFrom)  query += ` AND bp."TransactionDate" >= '${dateFrom}'`;
    if (dateTo)    query += ` AND bp."TransactionDate" <= '${dateTo}'`;
    query += ` ORDER BY bp."TransactionDate" DESC, bp."PaymentID" DESC`;
    const result = await db.executeQuery(query);
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/payments', async (req, res) => {
  try {
    const { AccountID, TransactionDate, TransactionType, ReferenceType, ReferenceID, Description, Debit, Credit } = req.body;
    if (!AccountID || !TransactionDate) return res.status(400).json({ success: false, message: 'AccountID and Date required' });
    const result = await db.executeQuery(
      `INSERT INTO "BankPayments" ("AccountID","TransactionDate","TransactionType","ReferenceType","ReferenceID","Description","Debit","Credit")
       VALUES (@AID,@TD,@TT,@RT,@RID,@Desc,@D,@C) RETURNING *`,
      { AID: Number(AccountID), TD: TransactionDate, TT: TransactionType||'', RT: ReferenceType||'', RID: Number(ReferenceID)||0, Desc: Description||'', D: Number(Debit)||0, C: Number(Credit)||0 }
    );
    res.status(201).json({ success: true, data: result[0] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Match Statement with Payment ─────────────────────────
router.post('/match', async (req, res) => {
  try {
    const { StatementID, PaymentID } = req.body;
    if (!StatementID || !PaymentID) return res.status(400).json({ success: false, message: 'StatementID and PaymentID required' });

    await db.executeQuery(
      `UPDATE "BankStatements" SET "IsMatched"=true, "MatchedWith"=@PID WHERE "StatementID"=@SID`,
      { PID: Number(PaymentID), SID: Number(StatementID) }
    );
    await db.executeQuery(
      `UPDATE "BankPayments" SET "IsMatched"=true, "StatementID"=@SID WHERE "PaymentID"=@PID`,
      { SID: Number(StatementID), PID: Number(PaymentID) }
    );
    res.json({ success: true, message: 'Matched successfully' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/unmatch', async (req, res) => {
  try {
    const { StatementID, PaymentID } = req.body;
    await db.executeQuery(
      `UPDATE "BankStatements" SET "IsMatched"=false, "MatchedWith"=NULL WHERE "StatementID"=@SID`,
      { SID: Number(StatementID) }
    );
    await db.executeQuery(
      `UPDATE "BankPayments" SET "IsMatched"=false, "StatementID"=NULL WHERE "PaymentID"=@PID`,
      { PID: Number(PaymentID) }
    );
    res.json({ success: true, message: 'Unmatched successfully' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Reconciliation Report ────────────────────────────────
router.get('/reconciliation', async (req, res) => {
  try {
    const { accountId, dateFrom, dateTo } = req.query;
    if (!accountId) return res.status(400).json({ success: false, message: 'AccountID required' });

    let dateFilter = '';
    if (dateFrom) dateFilter += ` AND "TransactionDate" >= '${dateFrom}'`;
    if (dateTo)   dateFilter += ` AND "TransactionDate" <= '${dateTo}'`;

    const statements = await db.executeQuery(
      `SELECT * FROM "BankStatements" WHERE "AccountID"=${Number(accountId)}${dateFilter} ORDER BY "TransactionDate"`
    );
    const payments = await db.executeQuery(
      `SELECT * FROM "BankPayments" WHERE "AccountID"=${Number(accountId)}${dateFilter} ORDER BY "TransactionDate"`
    );

    const matched   = statements.filter(s => s.IsMatched);
    const unmatched = statements.filter(s => !s.IsMatched);
    const unmatchedPayments = payments.filter(p => !p.IsMatched);

    const totalStatementDebit  = statements.reduce((sum, s) => sum + Number(s.Debit),  0);
    const totalStatementCredit = statements.reduce((sum, s) => sum + Number(s.Credit), 0);
    const totalPaymentDebit    = payments.reduce((sum, p) => sum + Number(p.Debit),    0);
    const totalPaymentCredit   = payments.reduce((sum, p) => sum + Number(p.Credit),   0);

    res.json({
      success: true,
      data: {
        statements, payments, matched, unmatched, unmatchedPayments,
        summary: {
          totalStatements: statements.length,
          totalPayments:   payments.length,
          matchedCount:    matched.length,
          unmatchedStatements: unmatched.length,
          unmatchedPayments:   unmatchedPayments.length,
          totalStatementDebit, totalStatementCredit,
          totalPaymentDebit,   totalPaymentCredit,
          difference: (totalStatementCredit - totalStatementDebit) - (totalPaymentCredit - totalPaymentDebit)
        }
      }
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
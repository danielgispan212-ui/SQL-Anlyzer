const path = require('path');
const express = require('express');
const sql = require('mssql');

const app = express();
app.use(express.json());

// SQL config
const config = {
  server: 'localhost',
  database: 'MyDB',
  user: 'testuser',
  password: 'Test1234!',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

// connect
async function getPool() {
  return await sql.connect(config);
}

// ---------------------
// SELECT queries
// ---------------------
app.post('/api/query', async (req, res) => {
  const { sql: query, db } = req.body;

  try {
    const pool = await getPool();
    const effectiveQuery = db ? `USE [${db}]; ${query}` : query;
    const result = await pool.request().query(effectiveQuery);

    let columns = [];
    if (result.columns) {
      columns = Array.isArray(result.columns) ? result.columns : Object.keys(result.columns);
    } else if (result.recordset && result.recordset.columns) {
      columns = Object.keys(result.recordset.columns);
    } else if (result.recordsets && result.recordsets[0] && result.recordsets[0].columns) {
      columns = Object.keys(result.recordsets[0].columns);
    } else if (Array.isArray(result.recordset) && result.recordset.length > 0) {
      columns = Object.keys(result.recordset[0]);
    }

    res.json({ rows: result.recordset, columns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------
// PARSE only syntax check
// ---------------------
app.post('/api/parse', async (req, res) => {
  const { sql: query, db } = req.body;

  try {
    const pool = await getPool();
    const effectiveQuery = db
      ? `USE [${db}]; SET NOEXEC ON; ${query}; SET NOEXEC OFF;`
      : `SET NOEXEC ON; ${query}; SET NOEXEC OFF;`;

    await pool.request().query(effectiveQuery);
    res.json({ success: true });
  } catch (err) {
    const message = err.originalError?.message || err.message || 'Unknown SQL syntax error';
    const lineMatch = message.match(/Line\s+(\d+)/i);
    const line = lineMatch ? Math.max(parseInt(lineMatch[1], 10) - 1, 0) : 0;
    res.status(400).json({ success: false, error: message, line });
  }
});

// ---------------------
// COMMIT queries
// ---------------------
app.post('/api/commit', async (req, res) => {
  const { sql: query } = req.body;

  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);
      const result = await request.query(query);

      await transaction.commit();

      let message = "Query executed successfully";
      let color = "white";

      const q = query.toLowerCase();

      if (q.includes("create table")) {
        const tableName = query.match(/create table\s+([\[\]\w\.]+)/i)?.[1];
        message = `✅ Table ${tableName} created successfully`;
        color = "lightgreen";
      }
      else if (q.includes("drop table")) {
        const tableName = query.match(/drop table\s+([\[\]\w\.]+)/i)?.[1];
        message = `🗑️ Table ${tableName} deleted successfully`;
        color = "red";
      }
      else if (q.includes("insert")) {
        message = `✅ Insert successful (${result.rowsAffected[0]} row(s))`;
        color = "lightgreen";
      }
      else if (q.includes("delete")) {
        message = `🗑️ Delete successful (${result.rowsAffected[0]} row(s))`;
        color = "red";
      }
      else if (q.includes("update")) {
        message = `✏️ Update successful (${result.rowsAffected[0]} row(s))`;
        color = "orange";
      }

      res.json({ success: true, message, color });

    } catch (err) {
      await transaction.rollback();
      res.status(500).json({ success: false, error: err.message });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------
// EXECUTION PLAN
// ---------------------
app.post('/api/plan', async (req, res) => {
  const { sql: query } = req.body;

  try {
    const pool = await getPool();
    const planQuery = `SET SHOWPLAN_XML ON; ${query}; SET SHOWPLAN_XML OFF;`;
    const result = await pool.request().query(planQuery);
    res.json({ planXml: result.recordset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// static files from public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// static files from node_modules
app.use('/node_modules', express.static(path.join(__dirname, '..', 'node_modules')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
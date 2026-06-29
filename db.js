// db.js — PostgreSQL connection pool (Supabase)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },   // required for Supabase
  max: 10,
  idleTimeoutMillis: 30000,
});

// Helper: run a query and return rows
pool.q  = (text, params) => pool.query(text, params).then(r => r.rows);
// Helper: run a query and return first row
pool.q1 = (text, params) => pool.query(text, params).then(r => r.rows[0] || null);

module.exports = pool;

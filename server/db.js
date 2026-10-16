const mysql = require('mysql2/promise');
const { recordQuery } = require('./queryLogger');

function getEnvNumber(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: getEnvNumber('DB_PORT', 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'psits_web_system',
  ssl: process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud') 
    ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } 
    : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Helper to instrument query execution with timing and transparent metrics logging
function wrapExecution(target, originalMethod, poolInstance) {
  return async function profiledQuery(...args) {
    const start = performance.now();
    try {
      const result = await originalMethod.apply(target, args);
      const durationMs = performance.now() - start;
      const sql = typeof args[0] === 'string' ? args[0] : (args[0]?.sql || '');
      const params = Array.isArray(args[1]) || (typeof args[1] === 'object' && args[1] !== null) ? args[1] : undefined;
      recordQuery({ sql, params, durationMs, pool: poolInstance });
      return result;
    } catch (err) {
      const durationMs = performance.now() - start;
      const sql = typeof args[0] === 'string' ? args[0] : (args[0]?.sql || '');
      const params = Array.isArray(args[1]) || (typeof args[1] === 'object' && args[1] !== null) ? args[1] : undefined;
      recordQuery({ sql, params, durationMs, pool: poolInstance });
      throw err;
    }
  };
}

// Preserve raw query/execute functions for internal unprofiled operations if needed
pool.rawQuery = pool.query.bind(pool);
pool.rawExecute = pool.execute.bind(pool);

// Wrap pool query and execute methods
const originalPoolQuery = pool.query.bind(pool);
const originalPoolExecute = pool.execute.bind(pool);
pool.query = wrapExecution(pool, originalPoolQuery, pool);
pool.execute = wrapExecution(pool, originalPoolExecute, pool);

// Wrap pool.getConnection to instrument transactions and connection-level queries
const originalGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async function profiledGetConnection(...args) {
  const conn = await originalGetConnection(...args);
  const origConnQuery = conn.query.bind(conn);
  const origConnExecute = conn.execute.bind(conn);
  conn.query = wrapExecution(conn, origConnQuery, pool);
  conn.execute = wrapExecution(conn, origConnExecute, pool);
  return conn;
};

module.exports = { pool };

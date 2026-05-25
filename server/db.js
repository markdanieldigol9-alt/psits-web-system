const mysql = require('mysql2/promise');

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

module.exports = { pool };


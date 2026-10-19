/**
 * Database Query Performance & Slow Query Logger (Database / Backend Engine)
 * Automatically tracks query duration, detects queries exceeding the threshold,
 * logs slow queries directly into the `slow_query_logs` database table, and alerts in server logs.
 */

let thresholdMs = Number(process.env.SLOW_QUERY_THRESHOLD_MS) || 100;

/**
 * Normalizes SQL query strings into a standardized fingerprint for aggregation.
 * Strips literal strings, numbers, hex, UUIDs, and collapsible IN-clauses.
 */
function fingerprintQuery(sql) {
  if (!sql || typeof sql !== 'string') return 'UNKNOWN_QUERY';

  return sql
    .replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '') // Remove comments
    .replace(/'(?:[^'\\]|\\.)*'/g, '?')      // Replace string literals with ?
    .replace(/"(?:[^"\\]|\\.)*"/g, '?')      // Replace double-quoted string literals with ?
    .replace(/\b\d+\b/g, '?')                 // Replace integers with ?
    .replace(/\b0x[a-f0-9]+\b/gi, '?')       // Replace hex literals with ?
    .replace(/\(\s*\?(?:\s*,\s*\?)+\s*\)/g, '(?)') // Collapse IN (?, ?, ?) -> (?)
    .replace(/\s+/g, ' ')                    // Normalize whitespaces
    .trim();
}

/**
 * Get current configured slow query threshold in milliseconds.
 */
function getThresholdMs() {
  return thresholdMs;
}

/**
 * Set slow query threshold in milliseconds.
 */
function setThresholdMs(val) {
  const parsed = Number(val);
  if (Number.isFinite(parsed) && parsed > 0) {
    thresholdMs = Math.round(parsed);
  }
  return thresholdMs;
}

/**
 * Record a query execution.
 * When duration exceeds threshold, asynchronously records into MySQL `slow_query_logs` table.
 * @param {object} param0
 * @param {string} param0.sql
 * @param {Array|object} [param0.params]
 * @param {number} param0.durationMs
 * @param {import('mysql2/promise').Pool} [param0.pool]
 */
function recordQuery({ sql, params, durationMs, pool }) {
  if (!sql || typeof sql !== 'string') return;

  // Skip tracking internal queries to prevent recursion & noise
  if (
    sql.includes('slow_query_logs') ||
    sql.includes('INFORMATION_SCHEMA') ||
    sql.includes('SHOW COLUMNS') ||
    sql.includes('SHOW TABLES') ||
    sql.includes('SHOW CREATE TABLE') ||
    sql.includes('v_slow_query_')
  ) {
    return;
  }

  const isSlow = durationMs >= thresholdMs;

  // If slow, log a warning to terminal and asynchronously persist to database table
  if (isSlow) {
    const roundedMs = Math.round(durationMs * 100) / 100;
    const fingerprint = fingerprintQuery(sql);

    // Terminal warning
    // eslint-disable-next-line no-console
    console.warn(`⚠️ [SLOW QUERY ${roundedMs}ms >= ${thresholdMs}ms] ${sql.slice(0, 180)}`);

    // Async write to MySQL `slow_query_logs` table
    if (pool && (typeof pool.rawQuery === 'function' || typeof pool.query === 'function')) {
      const sanitizedSql = sql.slice(0, 4000);
      const paramsJson = params ? JSON.stringify(params).slice(0, 1000) : null;
      const execFn = typeof pool.rawQuery === 'function' ? pool.rawQuery.bind(pool) : pool.query.bind(pool);
      execFn(
        'INSERT INTO slow_query_logs (query_fingerprint, duration_ms, query_sql, params_json) VALUES (?, ?, ?, ?)',
        [fingerprint.slice(0, 255), roundedMs, sanitizedSql, paramsJson]
      ).catch(() => {
        // Silent catch to ensure DB logging errors never affect application flow
      });
    }
  }
}

/**
 * Initialize saved threshold from DB settings table on startup.
 */
async function initializeThresholdFromDb(pool) {
  try {
    const [rows] = await pool.query(
      "SELECT value_text FROM settings WHERE key_name = 'slow_query_threshold_ms' LIMIT 1"
    );
    if (rows.length && rows[0].value_text) {
      setThresholdMs(rows[0].value_text);
    }
  } catch {
    // fallback to default
  }
}

module.exports = {
  recordQuery,
  fingerprintQuery,
  getThresholdMs,
  setThresholdMs,
  initializeThresholdFromDb,
};

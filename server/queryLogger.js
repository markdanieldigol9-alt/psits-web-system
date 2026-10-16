/**
 * Database Query Performance & Slow Query Logger
 * Provides automated slow query detection, fingerprinting, execution metrics aggregation,
 * and persistence for the PSITS Database Query Performance Dashboard.
 */

let thresholdMs = Number(process.env.SLOW_QUERY_THRESHOLD_MS) || 100;

// Ring buffer of recent slow query occurrences (up to 150 items)
const MAX_RECENT_LOGS = 150;
const recentSlowLogs = [];

// Aggregated metrics by fingerprint
const fingerprintStats = new Map();

// Global execution counters
let totalQueriesTracked = 0;
let totalSlowQueries = 0;
let totalExecutionTimeMs = 0;
let maxExecutionTimeObserved = 0;
const trackingStartTime = new Date();

/**
 * Normalizes SQL query strings into a standardized fingerprint for group-by aggregation.
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
 * Record a query execution. Non-blocking and synchronous in-memory tracking.
 * @param {object} param0
 * @param {string} param0.sql
 * @param {Array|object} [param0.params]
 * @param {number} param0.durationMs
 * @param {import('mysql2/promise').Pool} [param0.pool]
 */
function recordQuery({ sql, params, durationMs, pool }) {
  if (!sql || typeof sql !== 'string') return;

  // Skip tracking internal queries used by this logger and migration inspection to prevent recursion & noise
  if (
    sql.includes('slow_query_logs') ||
    sql.includes('INFORMATION_SCHEMA') ||
    sql.includes('SHOW COLUMNS') ||
    sql.includes('SHOW TABLES') ||
    sql.includes('SHOW CREATE TABLE')
  ) {
    return;
  }

  totalQueriesTracked += 1;
  totalExecutionTimeMs += durationMs;
  if (durationMs > maxExecutionTimeObserved) {
    maxExecutionTimeObserved = durationMs;
  }

  const isSlow = durationMs >= thresholdMs;
  if (isSlow) {
    totalSlowQueries += 1;
  }

  const fingerprint = fingerprintQuery(sql);
  const now = new Date();

  // Aggregate stats per fingerprint
  let stat = fingerprintStats.get(fingerprint);
  if (!stat) {
    stat = {
      fingerprint,
      count: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
      minDurationMs: durationMs,
      maxDurationMs: durationMs,
      slowCount: 0,
      sampleSql: sql.slice(0, 1000),
      firstSeen: now,
      lastSeen: now,
    };
    fingerprintStats.set(fingerprint, stat);
  }

  stat.count += 1;
  stat.totalDurationMs += durationMs;
  stat.avgDurationMs = Math.round((stat.totalDurationMs / stat.count) * 100) / 100;
  stat.minDurationMs = Math.min(stat.minDurationMs, durationMs);
  stat.maxDurationMs = Math.max(stat.maxDurationMs, durationMs);
  stat.lastSeen = now;
  if (isSlow) {
    stat.slowCount += 1;
  }

  // If slow, record in ring buffer and asynchronously persist to database
  if (isSlow) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fingerprint,
      sql: sql.slice(0, 2000),
      params: params ? JSON.stringify(params).slice(0, 500) : null,
      durationMs: Math.round(durationMs * 100) / 100,
      timestamp: now.toISOString(),
    };

    recentSlowLogs.unshift(entry);
    if (recentSlowLogs.length > MAX_RECENT_LOGS) {
      recentSlowLogs.pop();
    }

    // Async write to database without blocking request execution
    if (pool && (typeof pool.rawQuery === 'function' || typeof pool.query === 'function')) {
      const sanitizedSql = sql.slice(0, 4000);
      const paramsJson = params ? JSON.stringify(params).slice(0, 1000) : null;
      const execFn = typeof pool.rawQuery === 'function' ? pool.rawQuery.bind(pool) : pool.query.bind(pool);
      execFn(
        'INSERT INTO slow_query_logs (query_fingerprint, duration_ms, query_sql, params_json) VALUES (?, ?, ?, ?)',
        [fingerprint.slice(0, 255), Math.round(durationMs * 100) / 100, sanitizedSql, paramsJson]
      ).catch(() => {
        // Silent catch to guarantee DB insert failures never interrupt application logic
      });
    }
  }
}

/**
 * Controller: GET /api/admin/query-performance
 */
async function getQueryPerformanceSummary(req, res) {
  const pool = req.app.get('db_pool') || require('./db').pool;
  const currentThreshold = getThresholdMs();

  // Sort fingerprints by total consumed time descending
  const sortedFingerprints = Array.from(fingerprintStats.values())
    .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
    .slice(0, 50);

  // Attempt to fetch persistent recent slow logs from database
  let dbSlowLogs = [];
  try {
    const [rows] = await pool.query(
      `SELECT id, query_fingerprint AS fingerprint, duration_ms AS durationMs,
              query_sql AS \`sql\`, params_json AS params, created_at AS timestamp
       FROM slow_query_logs
       ORDER BY id DESC
       LIMIT 100`
    );
    dbSlowLogs = rows.map((r) => ({
      id: String(r.id),
      fingerprint: r.fingerprint,
      durationMs: Number(r.durationMs),
      sql: r.sql,
      params: r.params,
      timestamp: r.timestamp,
    }));
  } catch {
    // Fall back to in-memory ring buffer
    dbSlowLogs = recentSlowLogs;
  }

  const avgQueryDurationMs =
    totalQueriesTracked > 0
      ? Math.round((totalExecutionTimeMs / totalQueriesTracked) * 100) / 100
      : 0;

  const slowQueryPercentage =
    totalQueriesTracked > 0
      ? Math.round((totalSlowQueries / totalQueriesTracked) * 10000) / 100
      : 0;

  return res.json({
    success: true,
    summary: {
      thresholdMs: currentThreshold,
      totalQueriesTracked,
      totalSlowQueries,
      slowQueryPercentage,
      totalExecutionTimeMs: Math.round(totalExecutionTimeMs * 100) / 100,
      avgQueryDurationMs,
      maxExecutionTimeObserved: Math.round(maxExecutionTimeObserved * 100) / 100,
      trackingStartedAt: trackingStartTime.toISOString(),
      uniqueQueryPatterns: fingerprintStats.size,
    },
    topResourceConsumingQueries: sortedFingerprints,
    recentSlowLogs: dbSlowLogs.length ? dbSlowLogs : recentSlowLogs,
  });
}

/**
 * Controller: POST /api/admin/query-performance/threshold
 */
async function updateSlowQueryThreshold(req, res) {
  const pool = req.app.get('db_pool') || require('./db').pool;
  const body = req.body || {};
  const newThreshold = Number(body.thresholdMs);

  if (!Number.isFinite(newThreshold) || newThreshold < 1) {
    return res.status(400).json({
      success: false,
      message: 'Threshold must be a positive number in milliseconds (e.g. 50, 100, 200).',
    });
  }

  const updated = setThresholdMs(newThreshold);

  // Persist to database settings
  try {
    await pool.execute(
      `INSERT INTO settings (key_name, value_text)
       VALUES ('slow_query_threshold_ms', ?)
       ON DUPLICATE KEY UPDATE value_text = ?`,
      [String(updated), String(updated)]
    );
  } catch {
    // Best-effort persistence
  }

  return res.json({
    success: true,
    message: `Slow query threshold updated to ${updated}ms.`,
    thresholdMs: updated,
  });
}

/**
 * Controller: POST /api/admin/query-performance/clear
 */
async function clearQueryPerformanceLogs(req, res) {
  const pool = req.app.get('db_pool') || require('./db').pool;

  // Clear in-memory stats
  fingerprintStats.clear();
  recentSlowLogs.length = 0;
  totalQueriesTracked = 0;
  totalSlowQueries = 0;
  totalExecutionTimeMs = 0;
  maxExecutionTimeObserved = 0;

  // Clear database table
  try {
    await pool.query('DELETE FROM slow_query_logs');
  } catch {
    // Ignore if table does not exist
  }

  return res.json({
    success: true,
    message: 'Query performance logs and metrics have been reset successfully.',
  });
}

/**
 * Controller: POST /api/admin/query-performance/test-slow
 * Simulates a slow query to verify alerting and dashboard reporting.
 */
async function triggerTestSlowQuery(req, res) {
  const pool = req.app.get('db_pool') || require('./db').pool;
  const delaySec = Math.max(0.15, Math.min(2.0, Number(req.body?.delaySeconds || 0.2)));

  try {
    // Test query execution with SLEEP
    const [result] = await pool.query('SELECT SLEEP(?) AS test_sleep_result', [delaySec]);
    return res.json({
      success: true,
      message: `Simulated slow query executed (${delaySec}s delay). Check the dashboard to view the logged record.`,
      result,
    });
  } catch (err) {
    // Fallback if SLEEP isn't supported on cloud TiDB: do a computational pause
    const start = performance.now();
    await new Promise((resolve) => setTimeout(resolve, Math.round(delaySec * 1000)));
    recordQuery({
      sql: `SELECT /* SIMULATED_SLOW_QUERY */ ${delaySec} AS delay`,
      params: [delaySec],
      durationMs: performance.now() - start,
      pool,
    });
    return res.json({
      success: true,
      message: `Simulated slow query logged (${delaySec}s delay fallback).`,
    });
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
  getQueryPerformanceSummary,
  updateSlowQueryThreshold,
  clearQueryPerformanceLogs,
  triggerTestSlowQuery,
  initializeThresholdFromDb,
};

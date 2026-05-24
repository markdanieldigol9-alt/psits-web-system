function isDbError(err) {
  const code = err && typeof err === 'object' ? err.code : undefined;
  if (!code || typeof code !== 'string') return false;

  // Common mysql2 / Node network + auth errors when MySQL is down or misconfigured.
  return [
    'ECONNREFUSED',
    'ECONNRESET',
    'EPIPE',
    'ENOTFOUND',
    'ETIMEDOUT',
    'PROTOCOL_CONNECTION_LOST',
    'ER_ACCESS_DENIED_ERROR',
    'ER_BAD_DB_ERROR',
    'ER_DBACCESS_DENIED_ERROR',
    'ER_HANDSHAKE_ERROR',
    'ER_CON_COUNT_ERROR',
    'ER_HOST_IS_BLOCKED',
    'ER_HOST_NOT_PRIVILEGED',
  ].includes(code);
}

function getDbUnavailableMessage(err) {
  const code = err && typeof err === 'object' ? err.code : undefined;
  const suffix = code ? ` (code: ${code})` : '';
  return `Database unavailable. Ensure MySQL is running and set DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME.${suffix}`;
}

module.exports = { isDbError, getDbUnavailableMessage };


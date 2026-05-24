const Redis = require('ioredis');

function defaultKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function resolveKey(req, getKey) {
  try {
    const custom = typeof getKey === 'function' ? String(getKey(req) || '').trim() : '';
    if (custom) return custom.slice(0, 200);
  } catch {
    // ignore and fall back to default
  }
  return defaultKey(req);
}

function createInMemoryLimiter({ windowMs, max, message, getKey }) {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = resolveKey(req, getKey);
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ success: false, message });
    }

    return next();
  };
}

function createRedisLimiter(redis, { windowMs, max, message, name, getKey }) {
  return async (req, res, next) => {
    try {
      const key = `rl:${name}:${resolveKey(req, getKey)}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }
      if (count > max) {
        const ttlMs = await redis.pttl(key);
        const retryAfter = Math.max(1, Math.ceil(ttlMs / 1000));
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({ success: false, message });
      }
      return next();
    } catch (err) {
      return next();
    }
  };
}

function createRateLimiter({ windowMs, max, message, name, redis, getKey }) {
  if (redis) {
    return createRedisLimiter(redis, { windowMs, max, message, name, getKey });
  }
  return createInMemoryLimiter({ windowMs, max, message, getKey });
}

function buildRedisClient() {
  const url = String(process.env.REDIS_URL || '').trim();
  if (!url) return null;

  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });

  client.on('error', () => {
    // keep server running even if redis is down
  });

  return client;
}

module.exports = {
  buildRedisClient,
  createRateLimiter,
};

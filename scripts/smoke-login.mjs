import http from 'node:http';

function getEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
        headers: {
          'content-type': 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            // ignore
          }
          resolve({ status: res.statusCode || 0, json, raw: data });
        });
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

const baseUrl = process.env.SMOKE_API_URL || 'http://localhost:3000';
const email = getEnv('SMOKE_EMAIL');
const password = getEnv('SMOKE_PASSWORD');

const result = await postJson(`${baseUrl}/api/auth/login`, { email, password });

const ok = result.status === 200 && result.json && result.json.success === true && typeof result.json.token === 'string';
if (!ok) {
  // Avoid printing secrets; return server message if present.
  const message = result.json?.message || result.raw?.slice(0, 300) || 'Login failed.';
  // eslint-disable-next-line no-console
  console.error(`FAIL (${result.status}): ${message}`);
  process.exitCode = 1;
} else {
  // eslint-disable-next-line no-console
  console.log(`OK (${result.status}): ${result.json.user?.email || email}`);
}


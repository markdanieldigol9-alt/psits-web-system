import http from 'node:http';
import https from 'node:https';

const BASE_URL = process.env.API_BASE_URL || process.env.SMOKE_API_URL || 'https://psits-web-system.onrender.com/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@psits.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPsits@123';

console.log(`\n======================================================`);
console.log(`  PSITS Automated API Verification & Regression Suite `);
console.log(`  Target Base URL: ${BASE_URL}`);
console.log(`======================================================\n`);

async function sendRequest(method, urlString, body = null, headers = {}) {
  const url = new URL(urlString);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  const defaultPort = isHttps ? 443 : 80;
  const options = {
    method,
    hostname: url.hostname,
    port: url.port || defaultPort,
    path: url.pathname + url.search,
    headers: {
      'Accept': 'application/json',
      ...headers,
    },
  };

  if (body) {
    options.headers['Content-Type'] = 'application/json';
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = data ? JSON.parse(data) : null;
        } catch {
          // not JSON
        }
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          data: json,
          raw: data,
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    process.stdout.write(`  • ${name}... `);
    await fn();
    console.log(`\x1b[32mPASS\x1b[0m`);
    passed++;
  } catch (err) {
    console.log(`\x1b[31mFAIL\x1b[0m`);
    console.log(`    \x1b[31mError: ${err.message}\x1b[0m`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

let adminToken = null;

async function runAllTests() {
  console.log(`[Suite 1: Public & System Health Endpoints]`);
  
  await test('GET /health returns db ok and migration ok', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/health`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data && res.data.ok === true, `Expected ok: true in response`);
    assert(res.data.db && res.data.db.ok === true, `Expected db.ok: true`);
  });

  await test('GET /settings/public returns system metadata', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/settings/public`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data && res.data.success === true, `Expected success: true`);
  });

  console.log(`\n[Suite 2: Authentication & Security Gateways]`);

  await test('POST /auth/login rejects invalid credentials with 401', async () => {
    const res = await sendRequest('POST', `${BASE_URL}/auth/login`, {
      email: 'invalid-nonexistent-user@psits.com',
      password: 'WrongPassword123!',
    });
    assert(res.status === 401, `Expected 401 status for bad credentials, got ${res.status}`);
    assert(res.data && res.data.success === false, `Expected success: false`);
  });

  await test('POST /auth/login authenticates Super Admin and returns JWT token', async () => {
    const res = await sendRequest('POST', `${BASE_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
    assert(res.data && res.data.success === true, `Expected success: true`);
    assert(typeof res.data.token === 'string' && res.data.token.length > 20, `Missing or invalid token in response`);
    adminToken = res.data.token;
  });

  await test('GET /me with invalid token returns 401/403', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/me`, null, {
      Authorization: 'Bearer invalid.bogus.jwt.token',
    });
    assert(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${adminToken}`,
  });

  console.log(`\n[Suite 3: Authenticated User & Core Management Modules]`);

  await test('GET /me returns current user profile with Super Admin role', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/me`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data && res.data.success === true, `Expected success: true`);
    assert(res.data.user && res.data.user.email === ADMIN_EMAIL, `Profile email mismatch`);
  });

  await test('GET /events returns array of events', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/events`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const events = res.data.events || res.data;
    assert(Array.isArray(events), `Expected array of events`);
  });

  await test('GET /members returns member directory', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/members`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const members = res.data.members || res.data;
    assert(Array.isArray(members), `Expected array of members`);
  });

  await test('GET /officers returns officer list', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/officers`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const officers = res.data.officers || res.data;
    assert(Array.isArray(officers), `Expected array of officers`);
  });

  await test('GET /officer-positions returns standard position catalog', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/officer-positions`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.positions), `Expected array of positions`);
  });

  await test('GET /announcements returns announcements feed', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/announcements`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const announcements = res.data.announcements || res.data;
    assert(Array.isArray(announcements), `Expected array of announcements`);
  });

  await test('GET /forum/posts returns active forum discussions', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/forum/posts`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const posts = res.data.posts || res.data;
    assert(Array.isArray(posts), `Expected array of forum posts`);
  });

  await test('GET /elections returns active elections', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/elections`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const elections = res.data.elections || res.data;
    assert(Array.isArray(elections), `Expected array of elections`);
  });

  await test('GET /partners returns partner organizations', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/partners`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const partners = res.data.partners || res.data;
    assert(Array.isArray(partners), `Expected array of partners`);
  });

  await test('GET /payments returns transactions list', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/payments`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const payments = res.data.payments || res.data;
    assert(Array.isArray(payments), `Expected array of payments`);
  });

  await test('GET /notifications returns notification channel items', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/notifications`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const notifications = res.data.notifications || res.data;
    assert(Array.isArray(notifications), `Expected array of notifications`);
  });

  console.log(`\n[Suite 4: Reporting & Analytical Insights]`);

  await test('GET /reports/dashboard returns aggregate KPI data', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/reports/dashboard`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data && res.data.success === true, `Expected success: true`);
  });

  await test('GET /reports/partners/contributions returns partner contributions summary', async () => {
    const res = await sendRequest('GET', `${BASE_URL}/reports/partners/contributions`, null, authHeaders());
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data && res.data.success === true, `Expected success: true`);
  });

  console.log(`\n======================================================`);
  console.log(`  TEST RESULTS SUMMARY`);
  console.log(`  Total: ${passed + failed} | Passed: \x1b[32m${passed}\x1b[0m | Failed: ${failed > 0 ? `\x1b[31m${failed}\x1b[0m` : '0'}`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.resolve(__dirname, '..', 'PSITS', 'node_modules', '@playwright/test'));

const BASE_URL = 'https://psits-web-system.vercel.app';
const ONLINE_API = 'https://psits-web-system.onrender.com';
const ADMIN_EMAIL = 'admin@psits.com';
const ADMIN_PASSWORD = 'AdminPsits@123';

const PROJECT_OUTPUT_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');
const ARTIFACT_OUTPUT_DIR = path.resolve('C:\\Users\\Mark Daneil\\.gemini\\antigravity\\brain\\926ffafb-d13e-4ce2-9789-6a63c5038f99', 'screenshots');

[PROJECT_OUTPUT_DIR, ARTIFACT_OUTPUT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureScreen(page, filename, description) {
  console.log(`[Capturing] ${description} -> ${filename}`);
  // Generous sleep to ensure data tables, avatars, charts, and metrics are fully loaded
  await sleep(2500);

  const projectPath = path.join(PROJECT_OUTPUT_DIR, filename);
  const artifactPath = path.join(ARTIFACT_OUTPUT_DIR, filename);

  await page.screenshot({ path: projectPath, fullPage: false });
  fs.copyFileSync(projectPath, artifactPath);
  console.log(`  ✓ Saved: ${filename}`);
}

async function run() {
  console.log('Authenticating with backend server...');
  let loginData = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(`${ONLINE_API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });
      const data = await res.json();
      if (data.token) {
        loginData = data;
        console.log('✓ Authentication successful as Super Admin.');
        break;
      }
    } catch (e) {
      console.log(`Login attempt ${attempt} failed, waiting...`);
    }
    await sleep(4000);
  }

  if (!loginData || !loginData.token) {
    throw new Error('Failed to obtain authentication token from backend.');
  }

  const browser = await chromium.launch({ headless: true });

  // 1. PUBLIC PAGES (Unauthenticated Context)
  console.log('\n--- 1. Capturing Public & Authentication Pages ---');
  const publicContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  const publicPage = await publicContext.newPage();

  await publicPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(publicPage, '01_landing_page.png', 'Landing & Welcome Portal');

  await publicPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(publicPage, '02_login_page.png', 'User Login Portal');

  await publicPage.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(publicPage, '03_register_page.png', 'Member Registration Portal');

  await publicPage.goto(`${BASE_URL}/forgot-password`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(publicPage, '04_forgot_password_page.png', 'Forgot Password Verification Portal');

  await publicPage.goto(`${BASE_URL}/privacy`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(publicPage, '05_privacy_policy_page.png', 'Data Privacy Policy (RA 10173)');

  await publicPage.goto(`${BASE_URL}/terms`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(publicPage, '06_terms_conditions_page.png', 'Terms and Conditions Portal');

  await publicContext.close();

  // 2. AUTHENTICATED PAGES (Super Admin Session)
  console.log('\n--- 2. Capturing Core Management & System Functions ---');
  const authContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });

  await authContext.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token: loginData.token, user: loginData.user }
  );

  const authPage = await authContext.newPage();

  await authPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '07_dashboard_overview.png', 'Executive Dashboard & KPI Telemetry');

  await authPage.goto(`${BASE_URL}/members`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '08_members_management.png', 'Membership Registry (Objective 1)');

  await authPage.goto(`${BASE_URL}/institution-members`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '09_institution_members.png', 'Institution Participants Roster (Objective 1)');

  await authPage.goto(`${BASE_URL}/officers`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '10_officers_management.png', 'Officer Hierarchy & Appointments (Objective 2)');

  await authPage.goto(`${BASE_URL}/elections`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '11_officer_elections.png', 'Officer Elections & Voting Flow (Objective 2)');

  await authPage.goto(`${BASE_URL}/live-events`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '12_live_events_viewer.png', 'Live Events Streaming Viewer (Objective 3)');

  await authPage.goto(`${BASE_URL}/live-events/studio`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '13_live_studio_broadcast.png', 'Admin Live Broadcast Studio (Objective 3)');

  await authPage.goto(`${BASE_URL}/events`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '14_events_management.png', 'Events Management & Dynamic Rosters (Objective 4)');

  await authPage.goto(`${BASE_URL}/my-events`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '15_my_registered_events.png', 'My Registered Events (Objective 4)');

  await authPage.goto(`${BASE_URL}/payments`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '16_payment_tracking.png', 'Payment Tracking & Verification Queue (Objective 5)');

  await authPage.goto(`${BASE_URL}/partners`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '17_partners_sponsors.png', 'Partners & Sponsorship Registry (Objective 6)');

  await authPage.goto(`${BASE_URL}/forum`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '18_community_forum.png', 'Community & Discussion Forum (Objective 7)');

  await authPage.goto(`${BASE_URL}/announcements`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '19_announcements_board.png', 'Centralized Announcements Board (Objective 7)');

  await authPage.goto(`${BASE_URL}/reports`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '20_reports_analytics.png', 'Decision-Support Reports & Exports (Objective 8)');

  await authPage.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '21_system_notifications.png', 'System Notifications & Expiration Alerts');

  await authPage.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '22_account_settings.png', 'Account & Security Settings');

  await authPage.goto(`${BASE_URL}/admin/query-performance`, { waitUntil: 'networkidle' }).catch(() => {});
  await captureScreen(authPage, '23_query_performance.png', 'Database Query Performance Monitor');

  console.log('\n✓ Successfully captured all 23 UI screens for mock design documentation!');
  await authContext.close();
  await browser.close();
}

run().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});

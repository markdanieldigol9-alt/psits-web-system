const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.resolve(__dirname, '..', 'PSITS', 'node_modules', '@playwright/test'));

const BASE_URL = 'https://psits-web-system.vercel.app';
const ONLINE_API = 'https://psits-web-system.onrender.com';
const ADMIN_EMAIL = 'admin@psits.com';
const ADMIN_PASSWORD = 'AdminPsits@123';

const PROJECT_BASE_DIR = path.resolve(__dirname, '..', 'docs', 'role-screenshots');
const ARTIFACT_BASE_DIR = path.resolve('C:\\Users\\Mark Daneil\\.gemini\\antigravity\\brain\\926ffafb-d13e-4ce2-9789-6a63c5038f99', 'role-screenshots');

const roleConfigs = [
  {
    roleKey: 'admin',
    displayName: 'Admin (Super Admin Governance)',
    user: {
      id: '1',
      email: 'admin@psits.com',
      username: 'admin',
      fullName: 'Admin / President',
      role: 'super_admin',
      sector: 'institution',
      sectorDetails: 'PSITS Region XII Executive Board',
      status: 'active',
      isActive: true,
    },
    screens: [
      { filename: 'admin_01_dashboard.png', path: '/dashboard', label: 'Admin Executive Governance Dashboard' },
      { filename: 'admin_02_members.png', path: '/members', label: 'Membership Registry & Enforcement' },
      { filename: 'admin_03_institution_members.png', path: '/institution-members', label: 'Institution Participants Roster' },
      { filename: 'admin_04_officers.png', path: '/officers', label: 'Officer Executive Hierarchy' },
      { filename: 'admin_05_elections.png', path: '/elections', label: 'Officer Elections & Voting Suite' },
      { filename: 'admin_06_events.png', path: '/events', label: 'Events Operations & Dynamic Formats' },
      { filename: 'admin_07_payments.png', path: '/payments', label: 'Payment Verification Queue' },
      { filename: 'admin_08_reports.png', path: '/reports', label: 'Decision-Support Reports & Exports' },
    ],
  },
  {
    roleKey: 'individual',
    displayName: 'Individual Member (Student / Professional)',
    user: {
      id: '140',
      email: 'juan.delacruz@example.com',
      username: 'juandelacruz',
      fullName: 'Juan Dela Cruz',
      role: 'member',
      sector: 'school',
      sectorDetails: 'STI College Gensan - BSIT 3rd Year',
      memberType: 'individual',
      status: 'active',
      isActive: true,
      membershipExpiresAt: '2027-03-31T00:00:00.000Z',
    },
    screens: [
      { filename: 'individual_01_dashboard.png', path: '/dashboard', label: 'Individual Member Dashboard & Membership Status' },
      { filename: 'individual_02_events.png', path: '/events', label: 'Event Catalog & Registration' },
      { filename: 'individual_03_my_events.png', path: '/my-events', label: 'My Registered Events & QR Tickets' },
      { filename: 'individual_04_payments.png', path: '/payments', label: 'Payment History & Receipt Upload' },
      { filename: 'individual_05_forum.png', path: '/forum', label: 'Community Forum & Peer Discussions' },
      { filename: 'individual_06_elections.png', path: '/elections', label: 'Elections Ballot & Voter Interface' },
    ],
  },
  {
    roleKey: 'institution',
    displayName: 'Institution Member (School / University Representative)',
    user: {
      id: '122',
      email: 'digol.348659@gensan.sti.edu.ph',
      username: 'stigensan_rep',
      fullName: 'Prof. Almar Dulangon (Dean)',
      role: 'member',
      sector: 'institution',
      sectorDetails: 'STI College General Santos, Inc.',
      memberType: 'institution',
      representativeName: 'Prof. Almar Dulangon',
      position: 'Dean of Information Technology',
      status: 'active',
      isActive: true,
      membershipExpiresAt: '2027-06-30T00:00:00.000Z',
    },
    screens: [
      { filename: 'institution_01_dashboard.png', path: '/dashboard', label: 'Institution Representative Dashboard' },
      { filename: 'institution_02_institution_members.png', path: '/institution-members', label: 'School Student Roster Management' },
      { filename: 'institution_03_events.png', path: '/events', label: 'Events & Delegation Participation' },
      { filename: 'institution_04_my_events.png', path: '/my-events', label: 'Institution Registered Delegation Passes' },
      { filename: 'institution_05_payments.png', path: '/payments', label: 'Institutional Fee & Payment History' },
      { filename: 'institution_06_officers.png', path: '/officers', label: 'Regional Officers & Executive Directory' },
    ],
  },
  {
    roleKey: 'industry',
    displayName: 'Industry Member (Corporate Partner / Sponsor)',
    user: {
      id: '270002',
      email: 'customercare@smsupermalls.com',
      username: 'sm_gensan_corp',
      fullName: 'SM Supermalls - General Santos',
      role: 'member',
      sector: 'industry',
      sectorDetails: 'SM Prime Holdings / SM City Gensan',
      memberType: 'industry',
      representativeName: 'Mark Anthony Reyes',
      position: 'Regional Corporate Affairs Lead',
      status: 'active',
      isActive: true,
      membershipExpiresAt: '2027-12-31T00:00:00.000Z',
    },
    screens: [
      { filename: 'industry_01_dashboard.png', path: '/dashboard', label: 'Industry Partner Collaboration Dashboard' },
      { filename: 'industry_02_partners.png', path: '/partners', label: 'Corporate Sponsorship Tiers & Registry' },
      { filename: 'industry_03_events.png', path: '/events', label: 'Sponsored Summits & Regional Competitions' },
      { filename: 'industry_04_payments.png', path: '/payments', label: 'Sponsorship Contribution & Transaction History' },
      { filename: 'industry_05_reports.png', path: '/reports', label: 'Industry Analytics & Talent Engagement Reports' },
    ],
  },
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('Fetching live session token from backend...');
  const loginRes = await fetch(`${ONLINE_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const { token } = await loginRes.json();
  if (!token) throw new Error('Could not obtain live session token.');
  console.log('✓ Token acquired successfully.');

  const browser = await chromium.launch({ headless: true });

  for (const rc of roleConfigs) {
    console.log(`\n========================================`);
    console.log(`Capturing Role: ${rc.displayName} [${rc.roleKey}]`);
    console.log(`========================================`);

    const projectDir = path.join(PROJECT_BASE_DIR, rc.roleKey);
    const artifactDir = path.join(ARTIFACT_BASE_DIR, rc.roleKey);
    [projectDir, artifactDir].forEach((d) => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
    });

    await context.addInitScript(
      ({ t, u }) => {
        localStorage.setItem('auth_token', t);
        localStorage.setItem('auth_user', JSON.stringify(u));
        localStorage.setItem('user', JSON.stringify(u));
      },
      { t: token, u: rc.user }
    );

    await context.route('**/api/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, user: rc.user }),
      });
    });

    const page = await context.newPage();

    for (const sc of rc.screens) {
      console.log(`[Capturing] ${sc.label} -> ${sc.filename}`);
      await page.goto(`${BASE_URL}${sc.path}`, { waitUntil: 'networkidle' }).catch(() => {});
      await sleep(2500);

      const projectPath = path.join(projectDir, sc.filename);
      const artifactPath = path.join(artifactDir, sc.filename);

      await page.screenshot({ path: projectPath, fullPage: false });
      fs.copyFileSync(projectPath, artifactPath);
      console.log(`  ✓ Saved: ${sc.filename}`);
    }

    await context.close();
  }

  await browser.close();
  console.log('\n✓ All role-based screenshots successfully captured and organized!');
}

run().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});

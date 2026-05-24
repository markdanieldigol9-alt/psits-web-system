import { test, expect, request } from '@playwright/test';

const apiBase = 'http://127.0.0.1:3000';
const adminCreds = {
  email: process.env.ADMIN_EMAIL || 'admin@psits.com',
  password: process.env.ADMIN_PASSWORD || 'AdminPsits@123',
};
const memberCreds = {
  email: process.env.MEMBER_EMAIL || '',
  password: process.env.MEMBER_PASSWORD || '',
};

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
];

const adminPages = [
  '/dashboard',
  '/members',
  '/officers',
  '/events',
  '/payments',
  '/announcements',
  '/partners',
  '/live-events',
  '/reports',
  '/institution-members',
  '/notifications',
  '/settings',
];

const memberPages = [
  '/dashboard',
  '/officers',
  '/events',
  '/my-events',
  '/payments',
  '/announcements',
  '/partners',
  '/notifications',
  '/settings',
];

let adminToken: string | null = null;
let memberToken: string | null = null;
const seededIds: {
  eventId?: string;
  announcementId?: string;
  partnerId?: string;
  liveEventId?: string;
  officerUserId?: string;
  paymentId?: string;
} = {};

async function loginUI(page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(/\/dashboard/);
}

async function stabilizePage(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
}

async function expectNoHorizontalOverflow(page) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(
      doc.scrollWidth,
      body ? body.scrollWidth : 0
    );
    const clientWidth = doc.clientWidth;
    return { scrollWidth, clientWidth };
  });
  expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth + 2);
}

function screenshotName(state: 'empty' | 'data', role: 'admin' | 'member', viewport: string, path: string) {
  const safePath = path === '/' ? 'root' : path.replace(/\//g, '_');
  return `resp-${state}-${role}-${viewport}-${safePath}.png`;
}

test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: apiBase });
  const login = await api.post('/api/auth/login', { data: adminCreds });
  const loginText = await login.text();
  if (!login.ok()) {
    throw new Error(`Admin login failed: ${login.status()} ${loginText}`);
  }
  const loginData = JSON.parse(loginText);
  adminToken = loginData.token;

  if (!memberCreds.email || !memberCreds.password) {
    const unique = Math.random().toString(16).slice(2, 10);
    memberCreds.email = `member.test.${unique}@example.com`;
    memberCreds.password = 'MemberTest123!';

    const paymentProof =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X8Z8AAAAASUVORK5CYII=';

    const register = await api.post('/api/auth/register', {
      data: {
        fullName: 'Test Member',
        email: memberCreds.email,
        password: memberCreds.password,
        memberType: 'individual',
        sector: 'institution',
        address: 'Test Address',
        contactNumber: '09999999997',
        birthdate: '2000-01-01',
        gender: 'Male',
        membershipMode: 'new',
        paymentProof,
        termsAccepted: true,
      },
    });

    const registerText = await register.text();
    if (!register.ok()) {
      throw new Error(`Member register failed: ${register.status()} ${registerText}`);
    }

    const list = await api.get(`/api/members?search=${encodeURIComponent(memberCreds.email)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listText = await list.text();
    if (!list.ok()) {
      throw new Error(`List members failed: ${list.status()} ${listText}`);
    }
    const listData = JSON.parse(listText);
    const member = (listData.members || []).find((m) => m.email === memberCreds.email);
    if (!member?.id) {
      throw new Error('Provisioned member not found in /api/members list.');
    }

    const approve = await api.put(`/api/members/${member.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'active' },
    });
    const approveText = await approve.text();
    if (!approve.ok()) {
      throw new Error(`Activate member failed: ${approve.status()} ${approveText}`);
    }
  }

  const memberLogin = await api.post('/api/auth/login', { data: memberCreds });
  const memberLoginText = await memberLogin.text();
  if (!memberLogin.ok()) {
    throw new Error(`Member login failed: ${memberLogin.status()} ${memberLoginText}`);
  }
  const memberLoginData = JSON.parse(memberLoginText);
  memberToken = memberLoginData.token;

  await api.dispose();
});

test.afterAll(async () => {
  if (!adminToken) return;
  const api = await request.newContext({ baseURL: apiBase });
  if (seededIds.eventId) {
    await api.delete(`/api/events/${seededIds.eventId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }
  if (seededIds.announcementId) {
    await api.delete(`/api/announcements/${seededIds.announcementId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }
  if (seededIds.partnerId) {
    await api.delete(`/api/partners/${seededIds.partnerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }
  if (seededIds.liveEventId) {
    await api.delete(`/api/live-events/${seededIds.liveEventId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }
  if (seededIds.officerUserId) {
    await api.delete(`/api/officers/${seededIds.officerUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }
  await api.dispose();
});

test.describe.serial('Responsive: empty state', () => {
  for (const vp of viewports) {
    test(`Admin pages (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginUI(page, adminCreds.email, adminCreds.password);
      await stabilizePage(page);

      for (const path of adminPages) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        await expect(page).not.toHaveURL(/\/unauthorized/);
        await expectNoHorizontalOverflow(page);
        await expect(page).toHaveScreenshot(screenshotName('empty', 'admin', vp.name, path), {
          fullPage: true,
        });
      }
    });

    test(`Member pages (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginUI(page, memberCreds.email, memberCreds.password);
      await stabilizePage(page);

      for (const path of memberPages) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        await expect(page).not.toHaveURL(/\/unauthorized/);
        await expectNoHorizontalOverflow(page);
        await expect(page).toHaveScreenshot(screenshotName('empty', 'member', vp.name, path), {
          fullPage: true,
        });
      }
    });
  }
});

test.describe.serial('Responsive: data state', () => {
  test.beforeAll(async () => {
    if (!adminToken || !memberToken) return;
    const api = await request.newContext({ baseURL: apiBase });

    const eventRes = await api.post('/api/events', {
      data: {
        title: 'Snapshot Event',
        description: 'Snapshot data seed for responsive tests.',
        registrationMode: 'individual',
        location: 'PSITS Hall',
        startAt: new Date(Date.now() + 86400000).toISOString(),
        fee: 150,
        capacity: 100,
        status: 'upcoming',
      },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const eventData = await eventRes.json();
    if (eventData?.event?.id) seededIds.eventId = eventData.event.id;

    const announcementRes = await api.post('/api/announcements', {
      data: {
        title: 'Snapshot Announcement',
        content: 'Responsive snapshot seeded announcement.',
        audience: ['all'],
        status: 'published',
      },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const announcementData = await announcementRes.json();
    if (announcementData?.announcement?.id) seededIds.announcementId = announcementData.announcement.id;

    const partnerRes = await api.post('/api/partners', {
      data: {
        company: 'Snapshot Partner Inc.',
        type: 'Industry',
        contactPerson: 'Alex Partner',
        location: 'General Santos City',
        email: 'partner@example.com',
        phone: '09171234567',
        website: 'https://partner.example.com',
      },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const partnerData = await partnerRes.json();
    if (partnerData?.partner?.id) seededIds.partnerId = partnerData.partner.id;

    const liveEventRes = await api.post('/api/live-events', {
      data: {
        title: 'Snapshot Live Event',
        description: 'Live event data for responsive snapshots.',
        hostLabel: 'PSITS Host',
        meetingUrl: 'https://meet.example.com/psits',
        status: 'scheduled',
        startAt: new Date(Date.now() + 7200000).toISOString().slice(0, 19).replace('T', ' '),
      },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const liveEventData = await liveEventRes.json();
    if (liveEventData?.liveEvent?.id) seededIds.liveEventId = liveEventData.liveEvent.id;

    const officerRes = await api.post('/api/officers', {
      data: {
        fullName: 'Snapshot Officer',
        email: `officer.snapshot.${Date.now()}@psits.local`,
        password: 'Officer@12345',
        position: 'Program Coordinator',
        contactNumber: '09181234567',
        sector: 'institution',
        sectorDetails: 'PSITS Region XII',
      },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const officerData = await officerRes.json();
    if (officerData?.officer?.id) seededIds.officerUserId = officerData.officer.id;

    await api.dispose();
  });

  for (const vp of viewports) {
    test(`Admin pages (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginUI(page, adminCreds.email, adminCreds.password);
      await stabilizePage(page);

      for (const path of adminPages) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        await expect(page).not.toHaveURL(/\/unauthorized/);
        await expectNoHorizontalOverflow(page);
        await expect(page).toHaveScreenshot(screenshotName('data', 'admin', vp.name, path), {
          fullPage: true,
        });
      }
    });

    test(`Member pages (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginUI(page, memberCreds.email, memberCreds.password);
      await stabilizePage(page);

      for (const path of memberPages) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        await expect(page).not.toHaveURL(/\/unauthorized/);
        await expectNoHorizontalOverflow(page);
        await expect(page).toHaveScreenshot(screenshotName('data', 'member', vp.name, path), {
          fullPage: true,
        });
      }
    });
  }
});

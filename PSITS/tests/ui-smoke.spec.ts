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

let adminToken: string | null = null;

async function loginUI(page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(/\/dashboard/);
}

const adminLinks = [
  { label: 'Members', path: '/members' },
  { label: 'Officers', path: '/officers' },
  { label: 'Events', path: '/events' },
  { label: 'Payments', path: '/payments' },
  { label: 'Announcements', path: '/announcements' },
  { label: 'Partners', path: '/partners' },
  { label: 'Live Events', path: '/live-events' },
  { label: 'Reports', path: '/reports' },
  { label: 'Institution Members', path: '/institution-members' },
  { label: 'Notifications', path: '/notifications' },
  { label: 'Settings', path: '/settings' },
];

const memberLinks = [
  { label: 'Officers', path: '/officers' },
  { label: 'Events', path: '/events' },
  { label: 'My Events', path: '/my-events' },
  { label: 'Payments', path: '/payments' },
  { label: 'Announcements', path: '/announcements' },
  { label: 'Partners', path: '/partners' },
  { label: 'Notifications', path: '/notifications' },
  { label: 'Profile', path: '/settings' },
];

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

  await api.dispose();
});

test('Admin can navigate core pages', async ({ page }) => {
  await loginUI(page, adminCreds.email, adminCreds.password);
  await expect(page.getByText(/Dashboard updates live from the database/i)).toBeVisible();

  for (const item of adminLinks) {
    await page.getByRole('link', { name: item.label, exact: true }).click();
    await expect(page).not.toHaveURL(/\/unauthorized/);
    await expect(page).toHaveURL(new RegExp(`${item.path}$`));
  }
});

test('Member can access allowed pages and is blocked from restricted pages', async ({ page }) => {
  await loginUI(page, memberCreds.email, memberCreds.password);
  await expect(page.getByText(/Welcome, /i)).toBeVisible();

  for (const item of memberLinks) {
    await page.getByRole('link', { name: item.label, exact: true }).click();
    await expect(page).not.toHaveURL(/\/unauthorized/);
    await expect(page).toHaveURL(new RegExp(`${item.path}$`));
  }
});

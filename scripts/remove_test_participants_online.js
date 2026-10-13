const ONLINE_URL = 'https://psits-web-system.onrender.com';
const ADMIN_EMAIL = 'admin@psits.com';
const ADMIN_PASSWORD = 'AdminPsits@123';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeTestParticipants() {
  console.log('Connecting to online server to remove Test Participants...');

  let token = null;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      console.log(`Attempt ${attempt}: Logging in as super_admin...`);
      const loginRes = await fetch(`${ONLINE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });

      if (loginRes.ok) {
        const loginData = await loginRes.json();
        if (loginData.token) {
          token = loginData.token;
          console.log('Authentication successful.');
          break;
        }
      } else {
        const err = await loginRes.json().catch(() => ({}));
        console.log(`Server status ${loginRes.status}:`, err.message || 'Waiting for deploy...');
      }
    } catch (e) {
      console.log('Waiting for online server deployment to complete:', e.message);
    }
    await sleep(10000);
  }

  if (!token) {
    throw new Error('Could not log in to online server.');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Check how many exist right now
  const listRes = await fetch(`${ONLINE_URL}/api/institution-members`, { headers });
  const listData = await listRes.json();
  const allMembers = Array.isArray(listData) ? listData : (listData.members || []);

  const testMembers = allMembers.filter(
    (m) => (m.fullName && m.fullName.includes('Test Participant')) || (m.email && m.email.includes('test_part'))
  );

  console.log(`Found ${testMembers.length} Test Participant records online before removal:`);
  testMembers.forEach((m) => console.log(`  - ID: ${m.id} | ${m.fullName} (${m.email})`));

  if (testMembers.length === 0) {
    console.log('No Test Participants found online. All clean!');
    return;
  }

  console.log('\nTriggering cleanup on online server...');
  const cleanupRes = await fetch(`${ONLINE_URL}/api/institution-members/cleanup-test`, {
    method: 'POST',
    headers,
  });

  const cleanupData = await cleanupRes.json();
  console.log('Cleanup API response:', cleanupData);

  // Verify list again
  const verifyRes = await fetch(`${ONLINE_URL}/api/institution-members`, { headers });
  const verifyData = await verifyRes.json();
  const remaining = Array.isArray(verifyData) ? verifyData : (verifyData.members || []);

  const remainingTest = remaining.filter(
    (m) => (m.fullName && m.fullName.includes('Test Participant')) || (m.email && m.email.includes('test_part'))
  );

  console.log(`\nVerification after removal: ${remainingTest.length} Test Participant records remaining.`);
  console.log(`Remaining institution members total: ${remaining.length}`);
  remaining.forEach((m) => console.log(`  - ${m.fullName} | Institution: ${m.institutionName} | Status: ${m.status}`));
}

removeTestParticipants().catch(console.error);

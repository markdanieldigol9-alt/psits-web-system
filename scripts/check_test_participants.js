const { pool } = require('../server/db');

async function check() {
  console.log('--- LOCAL DATABASE ---');
  const [instRows] = await pool.query(
    "SELECT id, full_name, email, status, created_at FROM institution_members WHERE full_name LIKE '%Test Participant%' OR email LIKE '%test_part%'"
  );
  console.log('Local institution_members count:', instRows.length);
  instRows.forEach((r) => console.log('  ID:', r.id, '| Name:', r.full_name, '| Email:', r.email));

  const [userRows] = await pool.query(
    "SELECT id, full_name, email, role, status FROM users WHERE full_name LIKE '%Test Participant%' OR email LIKE '%test_part%'"
  );
  console.log('Local users count:', userRows.length);
  userRows.forEach((r) => console.log('  ID:', r.id, '| Name:', r.full_name, '| Email:', r.email));

  console.log('\n--- ONLINE DATABASE (https://psits-web-system.onrender.com) ---');
  const loginRes = await fetch('https://psits-web-system.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@psits.com', password: 'AdminPsits@123' }),
  });
  const { token } = await loginRes.json();
  const headers = { Authorization: `Bearer ${token}` };

  const instRes = await fetch('https://psits-web-system.onrender.com/api/institution-members', { headers });
  const instData = await instRes.json();
  const onlineMembers = Array.isArray(instData) ? instData : (instData.members || []);

  const testInstMembers = onlineMembers.filter(
    (m) => (m.fullName && m.fullName.includes('Test Participant')) || (m.email && m.email.includes('test_part'))
  );

  console.log('Total online institution_members:', onlineMembers.length);
  console.log('Online institution_members matching Test Participant:', testInstMembers.length);
  testInstMembers.forEach((m) => console.log('  ID:', m.id, '| Name:', m.fullName, '| Email:', m.email));

  process.exit(0);
}

check().catch(console.error);

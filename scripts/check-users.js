const crypto = require('node:crypto');
const { pool } = require('../server/db');

function verifyPassword(password, passwordHash) {
  const parts = String(passwordHash || '').split(':');
  if (parts.length !== 3 || parts[0] !== 's2') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(String(password), salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

async function main() {
  const passwords = {
    'digol.348659@gensan.sti.edu.ph': '@STIgensan12345',
    'mdigol19@mail.com': '@Md12345678',
  };

  const [rows] = await pool.query('SELECT * FROM users');
  console.log('Total users:', rows.length);
  for (const user of rows) {
    let pwdStatus = 'N/A';
    if (passwords[user.email]) {
      const match = verifyPassword(passwords[user.email], user.password_hash);
      pwdStatus = match ? 'MATCH' : 'MISMATCH';
    }
    console.log(`- ${user.email} (Status: ${user.status}, Role: ${user.role}, FailedLogins: ${user.failed_login_count}, LockedUntil: ${user.lock_until}) - Password: ${pwdStatus}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

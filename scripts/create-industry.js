const crypto = require('node:crypto');
const { pool } = require('../server/db');

async function check() {
  try {
    const email = 'industrytest@psits.com';
    const pass = '@Industry123';
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(pass, salt, 64);
    const passHash = `s2:${salt.toString('hex')}:${hash.toString('hex')}`;

    // check if exists
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      await pool.execute(
        `INSERT INTO users (email, full_name, password_hash, role, member_type, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [email, 'Industry Tester', passHash, 'member', 'industry', 'active']
      );
      console.log('Created industrytest@psits.com');
    } else {
      console.log('User already exists');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
check();

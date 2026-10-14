const { pool } = require('../server/db');

async function check() {
  const [users] = await pool.query("SELECT id, full_name, email, member_type, role FROM users WHERE member_type = 'institution' OR role = 'institution'");
  console.log('--- INSTITUTION USERS ---');
  console.table(users);

  const [cols] = await pool.query("SHOW COLUMNS FROM institution_members");
  console.log('--- INSTITUTION MEMBERS COLUMNS ---');
  console.table(cols.map(c => c.Field));

  const [members] = await pool.query(`
    SELECT im.institution_user_id, u.full_name AS institution_name, COUNT(im.id) as headCount
    FROM institution_members im
    LEFT JOIN users u ON u.id = im.institution_user_id
    GROUP BY im.institution_user_id, u.full_name
  `);
  console.log('--- INSTITUTION MEMBERS COUNT ---');
  console.table(members);

  const [payments] = await pool.query("SELECT id, member_id, amount, payment_kind, is_partial, partial_amount, remaining_balance, status FROM payments");
  console.log('--- PAYMENTS ---');
  console.table(payments);

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});

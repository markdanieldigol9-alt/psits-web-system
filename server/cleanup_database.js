require('dotenv').config();
const { pool } = require('./db');

async function cleanDatabase() {
  console.log('=== PSITS DATABASE CLEANUP PROTOCOL ===\n');

  try {
    // 1. Drop unused junk tables named after UI screens
    const junkTables = [
      'addmembermodal',
      'addofficersmodal',
      'announcementspage',
      'eventspage',
      'live_eventspage',
      'loginpage',
      'memberspages',
      'registerpage'
    ];

    console.log('1. Checking and dropping unused junk UI tables...');
    for (const tbl of junkTables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS \`${tbl}\``);
        console.log(`   ✓ Dropped unused table: ${tbl}`);
      } catch (err) {
        console.warn(`   ! Error dropping ${tbl}: ${err.message}`);
      }
    }

    // 2. Clean up expired user sessions
    console.log('\n2. Cleaning up expired user sessions...');
    const [sessResult] = await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
    console.log(`   ✓ Purged ${sessResult.affectedRows} expired sessions.`);

    // 3. Clean up orphaned notifications for deleted users
    console.log('\n3. Cleaning up orphaned notifications...');
    const [notifResult] = await pool.query(
      'DELETE FROM notifications WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)'
    );
    console.log(`   ✓ Purged ${notifResult.affectedRows} orphaned notifications.`);

    // 4. Clean up orphaned payment records & logs
    console.log('\n4. Cleaning up orphaned payment records...');
    const [orphanPayRows] = await pool.query(
      'SELECT id FROM payments WHERE member_id NOT IN (SELECT id FROM users)'
    );
    const orphanPayIds = orphanPayRows.map(r => r.id);
    if (orphanPayIds.length > 0) {
      const [logResult] = await pool.query(
        'DELETE FROM payment_status_logs WHERE payment_id IN (?)',
        [orphanPayIds]
      );
      console.log(`   ✓ Purged ${logResult.affectedRows} orphaned payment status logs.`);

      const [payResult] = await pool.query(
        'DELETE FROM payments WHERE id IN (?)',
        [orphanPayIds]
      );
      console.log(`   ✓ Purged ${payResult.affectedRows} orphaned payment records.`);
    } else {
      console.log('   ✓ No orphaned payments found.');
    }

    // 5. Truncate / clear query profiling logs
    console.log('\n5. Optimizing query profiling logs...');
    try {
      await pool.query('TRUNCATE TABLE slow_query_logs');
      console.log('   ✓ Cleared slow_query_logs.');
    } catch (err) {
      console.log(`   ! slow_query_logs notice: ${err.message}`);
    }

    // 6. Run OPTIMIZE TABLE on all active primary tables
    console.log('\n6. Optimizing database tables & index statistics...');
    const [activeTables] = await pool.query('SHOW TABLES');
    const tableKey = Object.keys(activeTables[0])[0];
    const tableNames = activeTables.map(r => r[tableKey]);

    for (const name of tableNames) {
      try {
        await pool.query(`OPTIMIZE TABLE \`${name}\``);
        console.log(`   ✓ Optimized table: ${name}`);
      } catch (err) {
        // Some engines (like TiDB or views) may not support OPTIMIZE TABLE
        console.log(`   - Skipped optimize on ${name}: ${err.message}`);
      }
    }

    console.log('\n=== DATABASE CLEANUP COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('Database cleanup error:', err);
    process.exit(1);
  }
}

cleanDatabase();

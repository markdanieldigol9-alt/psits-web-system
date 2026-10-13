const fs = require('fs/promises');
const path = require('path');
const { exportDataFromPool } = require('../server/dataSync');

const ONLINE_URL = 'https://psits-web-system.onrender.com';
const ADMIN_EMAIL = 'admin@psits.com';
const ADMIN_PASSWORD = 'AdminPsits@123';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('========================================================');
  console.log(' PSITS REGION XII: LOCAL TO ONLINE DATA EXPORT & SYNC');
  console.log('========================================================\n');

  console.log('Step 1: Exporting data from local MySQL database...');
  const localData = await exportDataFromPool();

  console.log('  Local entities retrieved:');
  console.log(`    - Users / PSITS Members: ${localData.users.length}`);
  console.log(`    - Partners:              ${localData.partners.length}`);
  console.log(`    - Partner Contributions: ${localData.partner_contributions.length}`);
  console.log(`    - Events:                ${localData.events.length}`);
  console.log(`    - Event Details:         ${localData.event_details.length}`);
  console.log(`    - Event Registrations:   ${localData.event_registrations.length}`);
  console.log(`    - Payments:              ${localData.payments.length}`);
  console.log(`    - Payment Status Logs:   ${localData.payment_status_logs.length}\n`);

  // Save backup file locally
  const exportFilePath = path.join(__dirname, '..', 'server', 'exports', 'local_database_export.json');
  await fs.writeFile(exportFilePath, JSON.stringify(localData, null, 2), 'utf8');
  console.log(`Step 2: Saved complete local backup to:\n  -> ${exportFilePath}\n`);

  console.log('Step 3: Authenticating with online server...');
  let token = null;
  const maxAuthAttempts = 15;

  for (let attempt = 1; attempt <= maxAuthAttempts; attempt++) {
    try {
      console.log(`  Attempt ${attempt}/${maxAuthAttempts}: Logging in to ${ONLINE_URL}/api/auth/login ...`);
      const loginRes = await fetch(`${ONLINE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });

      if (loginRes.ok) {
        const loginData = await loginRes.json();
        if (loginData.token) {
          token = loginData.token;
          console.log('  Authentication successful! Obtained super_admin session token.\n');
          break;
        }
      } else {
        const errJson = await loginRes.json().catch(() => ({}));
        console.log(`  Server response (${loginRes.status}):`, errJson.message || 'Waiting for deployment...');
      }
    } catch (netErr) {
      console.log('  Connection error (server may be deploying/restarting):', netErr.message);
    }
    console.log('  Waiting 10 seconds for Render deployment to finish...');
    await sleep(10000);
  }

  if (!token) {
    throw new Error('Failed to obtain token from online server after multiple attempts.');
  }

  console.log('Step 4: Sending data to online sync endpoint (/api/admin/data-sync)...');
  const syncRes = await fetch(`${ONLINE_URL}/api/admin/data-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(localData),
  });

  const syncResult = await syncRes.json();
  if (!syncRes.ok || !syncResult.success) {
    console.error('Sync failed:', syncResult);
    throw new Error(syncResult.message || 'Sync failed');
  }

  const report = syncResult.report;
  console.log('\n========================================================');
  console.log(' SYNCHRONIZATION COMPLETED SUCCESSFULLY');
  console.log('========================================================\n');

  console.log('RESULTS SUMMARY:');
  console.log('  PSITS Members / Users:');
  console.log(`    - Total local:       ${report.users.totalLocal}`);
  console.log(`    - Skipped (already exists online): ${report.users.skippedDuplicates}`);
  console.log(`    - Successfully inserted:           ${report.users.inserted}`);
  console.log('    Details:');
  for (const d of report.users.details) {
    if (d.status === 'skipped_duplicate') {
      console.log(`      * [DUPLICATE - SKIPPED] ${d.email} (${d.fullName || ''}) -> ${d.reason}`);
    } else if (d.status === 'inserted') {
      console.log(`      * [INSERTED] ${d.email} (${d.fullName || ''}) -> Online ID: ${d.onlineId}`);
    }
  }

  console.log('\n  Partners:');
  console.log(`    - Total local:       ${report.partners.totalLocal}`);
  console.log(`    - Skipped duplicates: ${report.partners.skippedDuplicates}`);
  console.log(`    - Successfully inserted: ${report.partners.inserted}`);

  console.log('\n  Events:');
  console.log(`    - Total local:       ${report.events.totalLocal}`);
  console.log(`    - Skipped duplicates: ${report.events.skippedDuplicates}`);
  console.log(`    - Successfully inserted: ${report.events.inserted}`);

  console.log('\n  Event Registrations:');
  console.log(`    - Total local:       ${report.event_registrations.totalLocal}`);
  console.log(`    - Skipped duplicates: ${report.event_registrations.skippedDuplicates}`);
  console.log(`    - Successfully inserted: ${report.event_registrations.inserted}`);

  console.log('\n  Payment Tracking:');
  console.log(`    - Total local:       ${report.payments.totalLocal}`);
  console.log(`    - Skipped duplicates: ${report.payments.skippedDuplicates}`);
  console.log(`    - Successfully inserted: ${report.payments.inserted}`);

  console.log('\n  Payment Status Logs:');
  console.log(`    - Successfully inserted: ${report.payment_status_logs.inserted}`);

  // Save report file
  const reportFilePath = path.join(__dirname, '..', 'server', 'exports', 'sync_execution_report.json');
  await fs.writeFile(reportFilePath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nDetailed report saved to: ${reportFilePath}`);
}

run().catch((err) => {
  console.error('\nSync process encountered an error:', err);
  process.exit(1);
});

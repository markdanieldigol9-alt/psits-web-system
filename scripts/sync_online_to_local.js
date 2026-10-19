const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../server/db');
const { exportDataFromPool } = require('../server/dataSync');

const ONLINE_URL = 'https://psits-web-system.onrender.com';
const ADMIN_EMAIL = 'admin@psits.com';
const ADMIN_PASSWORD = 'AdminPsits@123';

function normalizeStr(str) {
  return String(str || '').trim().toLowerCase();
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTableCount(tableName) {
  try {
    const [[row]] = await pool.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    return row.count;
  } catch (err) {
    return 'N/A';
  }
}

async function getTableCountsSnapshot() {
  const tables = [
    'users',
    'partners',
    'partner_contributions',
    'events',
    'event_details',
    'event_registrations',
    'payments',
    'payment_status_logs',
    'institution_members',
    'officers',
    'officer_positions',
    'elections',
    'election_candidates',
    'election_votes',
    'announcements',
    'announcement_comments',
    'announcement_likes',
    'forum_posts',
    'forum_comments',
    'forum_likes',
    'live_events'
  ];

  const counts = {};
  for (const t of tables) {
    counts[t] = await getTableCount(t);
  }
  return counts;
}

async function run() {
  console.log('================================================================');
  console.log(' PSITS REGION XII: ONLINE TO LOCAL DATABASE SYNCHRONIZATION');
  console.log('================================================================\n');

  // Step 1: Pre-sync snapshot and backup of local database
  console.log('Step 1: Capturing pre-sync snapshot of local database...');
  const beforeCounts = await getTableCountsSnapshot();
  console.log('  Current local record counts:');
  console.log(`    - Users:               ${beforeCounts.users}`);
  console.log(`    - Events:              ${beforeCounts.events}`);
  console.log(`    - Event Registrations: ${beforeCounts.event_registrations}`);
  console.log(`    - Institution Members: ${beforeCounts.institution_members}`);
  console.log(`    - Payments:            ${beforeCounts.payments}`);
  console.log(`    - Officers:            ${beforeCounts.officers}`);
  console.log(`    - Elections:           ${beforeCounts.elections}`);
  console.log(`    - Announcements:       ${beforeCounts.announcements}`);
  console.log(`    - Partners:            ${beforeCounts.partners}\n`);

  console.log('Step 2: Backing up current local database to file...');
  const exportsDir = path.join(__dirname, '..', 'server', 'exports');
  await fs.mkdir(exportsDir, { recursive: true });
  const preSyncData = await exportDataFromPool();
  const backupFilePath = path.join(exportsDir, `local_pre_sync_backup_${Date.now()}.json`);
  await fs.writeFile(backupFilePath, JSON.stringify(preSyncData, null, 2), 'utf8');
  console.log(`  Local database backup saved to:\n  -> ${backupFilePath}\n`);

  // Step 3: Authenticate with Online Server
  console.log('Step 3: Authenticating with online server...');
  let token = null;
  const maxAuthAttempts = 20;

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
          console.log('  Authentication successful! Super admin session token obtained.\n');
          break;
        }
      } else {
        const errJson = await loginRes.json().catch(() => ({}));
        console.log(`  Server response (${loginRes.status}):`, errJson.message || 'Waiting for deploy...');
      }
    } catch (netErr) {
      console.log('  Connection error (server may be restarting/deploying):', netErr.message);
    }
    console.log('  Waiting 10 seconds for online server...');
    await sleep(10000);
  }

  if (!token) {
    throw new Error('Failed to obtain token from online server after multiple attempts.');
  }

  // Step 4: Fetch online data
  console.log('Step 4: Fetching complete data payload from online server...');
  let onlineData = null;
  const maxExportAttempts = 20;

  for (let attempt = 1; attempt <= maxExportAttempts; attempt++) {
    try {
      console.log(`  Attempt ${attempt}/${maxExportAttempts}: Calling GET /api/admin/data-export ...`);
      const exportRes = await fetch(`${ONLINE_URL}/api/admin/data-export`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (exportRes.ok) {
        const json = await exportRes.json();
        if (json.success && json.data) {
          onlineData = json.data;
          console.log('  Data export retrieved successfully from online server!\n');
          break;
        }
      } else if (exportRes.status === 404) {
        console.log('  Endpoint /api/admin/data-export returned 404 (Render deployment in progress)...');
      } else {
        const errJson = await exportRes.json().catch(() => ({}));
        console.log(`  Export response (${exportRes.status}):`, errJson.message || 'Waiting...');
      }
    } catch (netErr) {
      console.log('  Export request error:', netErr.message);
    }
    console.log('  Waiting 10 seconds for deployment to settle...');
    await sleep(10000);
  }

  if (!onlineData) {
    throw new Error('Could not retrieve data export from online server.');
  }

  // Save the full online export locally
  const onlineExportFilePath = path.join(exportsDir, 'online_database_export.json');
  await fs.writeFile(onlineExportFilePath, JSON.stringify(onlineData, null, 2), 'utf8');
  console.log(`Step 5: Saved raw online export to:\n  -> ${onlineExportFilePath}\n`);

  console.log('Step 6: Online records retrieved:');
  console.log(`  - Users:               ${(onlineData.users || []).length}`);
  console.log(`  - Events:              ${(onlineData.events || []).length}`);
  console.log(`  - Event Registrations: ${(onlineData.event_registrations || []).length}`);
  console.log(`  - Institution Members: ${(onlineData.institution_members || []).length}`);
  console.log(`  - Payments:            ${(onlineData.payments || []).length}`);
  console.log(`  - Payment Status Logs: ${(onlineData.payment_status_logs || []).length}`);
  console.log(`  - Officers:            ${(onlineData.officers || []).length}`);
  console.log(`  - Officer Positions:   ${(onlineData.officer_positions || []).length}`);
  console.log(`  - Elections:           ${(onlineData.elections || []).length}`);
  console.log(`  - Election Candidates: ${(onlineData.election_candidates || []).length}`);
  console.log(`  - Election Votes:      ${(onlineData.election_votes || []).length}`);
  console.log(`  - Announcements:       ${(onlineData.announcements || []).length}`);
  console.log(`  - Partners:            ${(onlineData.partners || []).length}\n`);

  // Step 7: Importing into local MySQL database
  console.log('Step 7: Importing and synchronizing data into local MySQL database...\n');
  const report = {
    users: { total: (onlineData.users || []).length, inserted: 0, skipped: 0 },
    partners: { total: (onlineData.partners || []).length, inserted: 0, skipped: 0 },
    partner_contributions: { total: (onlineData.partner_contributions || []).length, inserted: 0, skipped: 0 },
    events: { total: (onlineData.events || []).length, inserted: 0, skipped: 0 },
    event_details: { total: (onlineData.event_details || []).length, inserted: 0, skipped: 0 },
    event_registrations: { total: (onlineData.event_registrations || []).length, inserted: 0, skipped: 0 },
    institution_members: { total: (onlineData.institution_members || []).length, inserted: 0, skipped: 0 },
    payments: { total: (onlineData.payments || []).length, inserted: 0, skipped: 0 },
    payment_status_logs: { total: (onlineData.payment_status_logs || []).length, inserted: 0, skipped: 0 },
    officers: { total: (onlineData.officers || []).length, inserted: 0, skipped: 0 },
    officer_positions: { total: (onlineData.officer_positions || []).length, inserted: 0, skipped: 0 },
    elections: { total: (onlineData.elections || []).length, inserted: 0, skipped: 0 },
    election_candidates: { total: (onlineData.election_candidates || []).length, inserted: 0, skipped: 0 },
    election_votes: { total: (onlineData.election_votes || []).length, inserted: 0, skipped: 0 },
    announcements: { total: (onlineData.announcements || []).length, inserted: 0, skipped: 0 },
    announcement_comments: { total: (onlineData.announcement_comments || []).length, inserted: 0, skipped: 0 },
    announcement_likes: { total: (onlineData.announcement_likes || []).length, inserted: 0, skipped: 0 },
    live_events: { total: (onlineData.live_events || []).length, inserted: 0, skipped: 0 },
  };

  // -------------------------------------------------------------
  // A. USERS
  // -------------------------------------------------------------
  console.log('  [1/10] Synchronizing Users...');
  const [existingLocalUsers] = await pool.query('SELECT id, email, username FROM users');
  const emailToLocalUserId = new Map();
  const usernameToLocalUserId = new Map();
  for (const u of existingLocalUsers) {
    if (u.email) emailToLocalUserId.set(normalizeStr(u.email), Number(u.id));
    if (u.username) usernameToLocalUserId.set(normalizeStr(u.username), Number(u.id));
  }

  const onlineUserIdToLocalUserId = new Map();

  for (const onlineUser of onlineData.users || []) {
    const normEmail = normalizeStr(onlineUser.email);
    const normUsername = normalizeStr(onlineUser.username);

    if (normEmail && emailToLocalUserId.has(normEmail)) {
      const localId = emailToLocalUserId.get(normEmail);
      onlineUserIdToLocalUserId.set(onlineUser.id, localId);
      report.users.skipped += 1;
      continue;
    }

    if (normUsername && usernameToLocalUserId.has(normUsername)) {
      const localId = usernameToLocalUserId.get(normUsername);
      onlineUserIdToLocalUserId.set(onlineUser.id, localId);
      report.users.skipped += 1;
      continue;
    }

    // Insert new user
    try {
      const userCols = [
        'email', 'username', 'full_name', 'password_hash', 'role', 'contact_number',
        'sector', 'sector_details', 'member_type', 'status', 'address', 'gender',
        'occupation', 'representative_name', 'representative_name_2', 'position',
        'company_email', 'website', 'membership_mode', 'terms_accepted',
        'representative_position_2', 'birthdate', 'failed_login_count', 'lock_until',
        'approval_email_sent_at', 'approval_email_status', 'approval_email_error',
        'renew_reference_id', 'banned_reason', 'suspended_reason', 'archived_at',
        'status_updated_at', 'status_updated_by', 'membership_started_at',
        'membership_expires_at', 'avatar_url', 'created_at', 'updated_at'
      ];

      const colNames = [];
      const colValues = [];
      const placeholders = [];

      for (const col of userCols) {
        if (onlineUser[col] !== undefined) {
          colNames.push(`\`${col}\``);
          colValues.push(onlineUser[col]);
          placeholders.push('?');
        }
      }

      const sql = `INSERT INTO users (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
      const [insertRes] = await pool.query(sql, colValues);
      const newLocalId = insertRes.insertId;

      onlineUserIdToLocalUserId.set(onlineUser.id, newLocalId);
      if (normEmail) emailToLocalUserId.set(normEmail, newLocalId);
      if (normUsername) usernameToLocalUserId.set(normUsername, newLocalId);

      report.users.inserted += 1;
      console.log(`    + Inserted user: ${onlineUser.email} (${onlineUser.full_name}) -> Local ID: ${newLocalId}`);
    } catch (err) {
      console.warn(`    ! User insert error for ${onlineUser.email}:`, err.message);
    }
  }

  // -------------------------------------------------------------
  // B. PARTNERS & CONTRIBUTIONS
  // -------------------------------------------------------------
  console.log('  [2/10] Synchronizing Partners & Contributions...');
  const [existingLocalPartners] = await pool.query('SELECT id, company FROM partners');
  const companyToLocalPartnerId = new Map();
  for (const p of existingLocalPartners) {
    if (p.company) companyToLocalPartnerId.set(normalizeStr(p.company), Number(p.id));
  }

  const onlinePartnerIdToLocalPartnerId = new Map();

  for (const onlinePartner of onlineData.partners || []) {
    const normCompany = normalizeStr(onlinePartner.company);

    if (normCompany && companyToLocalPartnerId.has(normCompany)) {
      const localId = companyToLocalPartnerId.get(normCompany);
      onlinePartnerIdToLocalPartnerId.set(onlinePartner.id, localId);
      report.partners.skipped += 1;
      continue;
    }

    try {
      const partnerCols = [
        'company', 'type', 'contact_person', 'location', 'email', 'phone',
        'website', 'created_by', 'created_at', 'updated_at', 'logo_url',
        'partnership_status', 'description', 'archived_at'
      ];
      const colNames = [];
      const colValues = [];
      const placeholders = [];

      for (const col of partnerCols) {
        if (onlinePartner[col] !== undefined) {
          colNames.push(`\`${col}\``);
          if (col === 'created_by') {
            colValues.push(onlineUserIdToLocalUserId.get(onlinePartner[col]) || 1);
          } else {
            colValues.push(onlinePartner[col]);
          }
          placeholders.push('?');
        }
      }

      const sql = `INSERT INTO partners (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
      const [insertRes] = await pool.query(sql, colValues);
      const newLocalId = insertRes.insertId;

      onlinePartnerIdToLocalPartnerId.set(onlinePartner.id, newLocalId);
      companyToLocalPartnerId.set(normCompany, newLocalId);
      report.partners.inserted += 1;
      console.log(`    + Inserted partner: ${onlinePartner.company} -> Local ID: ${newLocalId}`);
    } catch (err) {
      console.warn(`    ! Partner insert error for ${onlinePartner.company}:`, err.message);
    }
  }

  // Partner Contributions
  for (const onlineContrib of onlineData.partner_contributions || []) {
    const targetPartnerId = onlinePartnerIdToLocalPartnerId.get(onlineContrib.partner_id);
    if (!targetPartnerId) continue;

    try {
      const [existingContrib] = await pool.query(
        'SELECT id FROM partner_contributions WHERE partner_id = ? AND contribution_type = ? AND amount = ? LIMIT 1',
        [targetPartnerId, onlineContrib.contribution_type, onlineContrib.amount]
      );
      if (existingContrib.length) {
        report.partner_contributions.skipped += 1;
        continue;
      }

      await pool.query(
        `INSERT INTO partner_contributions (
          partner_id, contribution_type, title, amount, description, contribution_date, status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          targetPartnerId,
          onlineContrib.contribution_type,
          onlineContrib.title || null,
          onlineContrib.amount,
          onlineContrib.description || null,
          onlineContrib.contribution_date || null,
          onlineContrib.status || 'received',
          onlineUserIdToLocalUserId.get(onlineContrib.created_by) || 1,
          onlineContrib.created_at || new Date(),
          onlineContrib.updated_at || new Date(),
        ]
      );
      report.partner_contributions.inserted += 1;
    } catch (err) {
      console.warn('    ! Partner contribution insert error:', err.message);
    }
  }

  // -------------------------------------------------------------
  // C. EVENTS & EVENT REGISTRATIONS
  // -------------------------------------------------------------
  console.log('  [3/10] Synchronizing Events & Event Details...');
  const [existingLocalEvents] = await pool.query('SELECT id, title FROM events');
  const titleToLocalEventId = new Map();
  for (const e of existingLocalEvents) {
    if (e.title) titleToLocalEventId.set(normalizeStr(e.title), Number(e.id));
  }

  const onlineEventIdToLocalEventId = new Map();

  for (const onlineEvent of onlineData.events || []) {
    const normTitle = normalizeStr(onlineEvent.title);

    if (normTitle && titleToLocalEventId.has(normTitle)) {
      const localId = titleToLocalEventId.get(normTitle);
      onlineEventIdToLocalEventId.set(onlineEvent.id, localId);
      report.events.skipped += 1;
      continue;
    }

    try {
      const eventCols = [
        'title', 'description', 'start_at', 'end_at', 'location', 'registration_fee',
        'capacity', 'status', 'created_by', 'created_at', 'updated_at', 'guidelines',
        'registration_mode', 'event_type', 'registration_start_at', 'registration_end_at',
        'registration_override', 'is_esports', 'esports_game', 'esports_bracket_format',
        'banner_url', 'theme_color', 'custom_badge', 'requires_coach',
        'guidelines_file_url', 'guidelines_file_name'
      ];

      const colNames = [];
      const colValues = [];
      const placeholders = [];

      for (const col of eventCols) {
        if (onlineEvent[col] !== undefined) {
          colNames.push(`\`${col}\``);
          if (col === 'created_by') {
            colValues.push(onlineUserIdToLocalUserId.get(onlineEvent[col]) || 1);
          } else {
            colValues.push(onlineEvent[col]);
          }
          placeholders.push('?');
        }
      }

      const sql = `INSERT INTO events (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
      const [insertRes] = await pool.query(sql, colValues);
      const newLocalId = insertRes.insertId;

      onlineEventIdToLocalEventId.set(onlineEvent.id, newLocalId);
      titleToLocalEventId.set(normTitle, newLocalId);
      report.events.inserted += 1;
      console.log(`    + Inserted event: "${onlineEvent.title}" -> Local ID: ${newLocalId}`);
    } catch (err) {
      console.warn(`    ! Event insert error for "${onlineEvent.title}":`, err.message);
    }
  }

  // Event Details
  for (const onlineDetails of onlineData.event_details || []) {
    const targetEventId = onlineEventIdToLocalEventId.get(onlineDetails.event_id);
    if (!targetEventId) continue;

    try {
      const [exists] = await pool.query('SELECT id FROM event_details WHERE event_id = ? LIMIT 1', [targetEventId]);
      if (!exists.length) {
        await pool.query(
          `INSERT INTO event_details (event_id, rules, schedule, prizes, contact_email, contact_phone, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            targetEventId,
            onlineDetails.rules || null,
            onlineDetails.schedule || null,
            onlineDetails.prizes || null,
            onlineDetails.contact_email || null,
            onlineDetails.contact_phone || null,
            onlineDetails.created_at || new Date(),
            onlineDetails.updated_at || new Date(),
          ]
        );
        report.event_details.inserted += 1;
      } else {
        report.event_details.skipped += 1;
      }
    } catch (err) {
      console.warn('    ! Event details error:', err.message);
    }
  }

  // Event Registrations
  for (const onlineReg of onlineData.event_registrations || []) {
    let targetEventId = onlineEventIdToLocalEventId.get(onlineReg.event_id);
    if (!targetEventId && onlineReg._event_title) {
      targetEventId = titleToLocalEventId.get(normalizeStr(onlineReg._event_title));
    }

    let targetMemberId = onlineUserIdToLocalUserId.get(onlineReg.member_id);
    if (!targetMemberId && onlineReg._member_email) {
      targetMemberId = emailToLocalUserId.get(normalizeStr(onlineReg._member_email));
    }

    if (!targetEventId || !targetMemberId) {
      continue;
    }

    try {
      const [exists] = await pool.query(
        'SELECT id FROM event_registrations WHERE event_id = ? AND member_id = ? LIMIT 1',
        [targetEventId, targetMemberId]
      );

      if (exists.length) {
        report.event_registrations.skipped += 1;
        continue;
      }

      await pool.query(
        `INSERT INTO event_registrations (
          event_id, member_id, participant_count, status, qr_token, notes, approved_by, approved_at, rejection_reason, created_at, updated_at, team_profile_url, checked_in_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          targetEventId,
          targetMemberId,
          onlineReg.participant_count || 1,
          onlineReg.status || 'pending',
          onlineReg.qr_token || null,
          onlineReg.notes || null,
          onlineUserIdToLocalUserId.get(onlineReg.approved_by) || null,
          onlineReg.approved_at || null,
          onlineReg.rejection_reason || null,
          onlineReg.created_at || new Date(),
          onlineReg.updated_at || new Date(),
          onlineReg.team_profile_url || null,
          onlineReg.checked_in_count || 0,
        ]
      );
      report.event_registrations.inserted += 1;
    } catch (err) {
      console.warn('    ! Event registration insert error:', err.message);
    }
  }

  // -------------------------------------------------------------
  // D. INSTITUTION MEMBERS (Participants)
  // -------------------------------------------------------------
  console.log('  [4/10] Synchronizing Institution Members (Participants)...');
  const [existingLocalInstMembers] = await pool.query('SELECT id, institution_user_id, full_name, email, event_id FROM institution_members');
  const instMemberEmailSet = new Set();
  const instMemberCompositeSet = new Set();

  for (const m of existingLocalInstMembers) {
    if (m.email) instMemberEmailSet.add(normalizeStr(m.email));
    const compKey = `${m.institution_user_id}|${normalizeStr(m.full_name)}|${m.event_id || 0}`;
    instMemberCompositeSet.add(compKey);
  }

  for (const onlineInstMember of onlineData.institution_members || []) {
    // Resolve local institution user ID
    let targetInstUserId = onlineUserIdToLocalUserId.get(onlineInstMember.institution_user_id);
    if (!targetInstUserId && onlineInstMember._institution_email) {
      targetInstUserId = emailToLocalUserId.get(normalizeStr(onlineInstMember._institution_email));
    }
    if (!targetInstUserId) {
      targetInstUserId = 1; // Fallback to Super Admin user ID
    }

    // Resolve local event ID
    let targetEventId = null;
    if (onlineInstMember.event_id) {
      targetEventId = onlineEventIdToLocalEventId.get(onlineInstMember.event_id);
    }
    if (!targetEventId && onlineInstMember._event_title) {
      targetEventId = titleToLocalEventId.get(normalizeStr(onlineInstMember._event_title));
    }

    const normEmail = normalizeStr(onlineInstMember.email);
    const compKey = `${targetInstUserId}|${normalizeStr(onlineInstMember.full_name)}|${targetEventId || 0}`;

    // Duplicate check
    if (normEmail && instMemberEmailSet.has(normEmail)) {
      report.institution_members.skipped += 1;
      continue;
    }

    if (instMemberCompositeSet.has(compKey)) {
      report.institution_members.skipped += 1;
      continue;
    }

    try {
      const instCols = [
        'institution_user_id', 'full_name', 'email', 'contact_number', 'gender',
        'position', 'event_title', 'notes', 'created_by', 'created_at', 'updated_at',
        'event_id', 'status', 'approved_by', 'approved_at', 'rejection_reason',
        'password_hash', 'checked_in', 'checked_in_at'
      ];

      const colNames = [];
      const colValues = [];
      const placeholders = [];

      for (const col of instCols) {
        if (onlineInstMember[col] !== undefined) {
          colNames.push(`\`${col}\``);
          if (col === 'institution_user_id') {
            colValues.push(targetInstUserId);
          } else if (col === 'event_id') {
            colValues.push(targetEventId || null);
          } else if (col === 'created_by') {
            colValues.push(onlineUserIdToLocalUserId.get(onlineInstMember[col]) || targetInstUserId);
          } else if (col === 'approved_by') {
            colValues.push(onlineUserIdToLocalUserId.get(onlineInstMember[col]) || null);
          } else {
            colValues.push(onlineInstMember[col]);
          }
          placeholders.push('?');
        }
      }

      const sql = `INSERT INTO institution_members (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
      await pool.query(sql, colValues);

      if (normEmail) instMemberEmailSet.add(normEmail);
      instMemberCompositeSet.add(compKey);
      report.institution_members.inserted += 1;
    } catch (err) {
      console.warn(`    ! Institution member insert error (${onlineInstMember.full_name}):`, err.message);
    }
  }
  console.log(`    -> Done: ${report.institution_members.inserted} inserted, ${report.institution_members.skipped} skipped.`);

  // -------------------------------------------------------------
  // E. PAYMENTS & PAYMENT STATUS LOGS
  // -------------------------------------------------------------
  console.log('  [5/10] Synchronizing Payments...');
  const [existingLocalPayments] = await pool.query('SELECT id, member_id, event_id, reference_number FROM payments');
  const localRefNumbers = new Set();
  for (const pay of existingLocalPayments) {
    if (pay.reference_number) localRefNumbers.add(normalizeStr(pay.reference_number));
  }

  const onlinePaymentIdToLocalPaymentId = new Map();

  for (const onlinePay of onlineData.payments || []) {
    // Resolve member_id
    let targetMemberId = onlineUserIdToLocalUserId.get(onlinePay.member_id);
    if (!targetMemberId && onlinePay._member_email) {
      targetMemberId = emailToLocalUserId.get(normalizeStr(onlinePay._member_email));
    }
    if (!targetMemberId) targetMemberId = 1;

    // Resolve event_id
    let targetEventId = null;
    if (onlinePay.event_id) {
      targetEventId = onlineEventIdToLocalEventId.get(onlinePay.event_id);
    }
    if (!targetEventId && onlinePay._event_title) {
      targetEventId = titleToLocalEventId.get(normalizeStr(onlinePay._event_title));
    }

    const normRef = normalizeStr(onlinePay.reference_number);
    if (normRef && localRefNumbers.has(normRef)) {
      // Find matching local payment ID
      const match = existingLocalPayments.find((p) => normalizeStr(p.reference_number) === normRef);
      if (match) onlinePaymentIdToLocalPaymentId.set(onlinePay.id, match.id);
      report.payments.skipped += 1;
      continue;
    }

    try {
      const payCols = [
        'member_id', 'member_name', 'event', 'amount', 'method', 'status', 'date',
        'proof_url', 'rejection_reason', 'verified_by', 'verified_at', 'created_at',
        'updated_at', 'event_id', 'payment_method', 'reference_number', 'payment_status',
        'process_status', 'payment_kind', 'total_heads', 'rate_per_head', 'free_slots',
        'gross_amount', 'discount_amount', 'net_amount', 'partial_amount',
        'remaining_balance', 'is_partial', 'billing_breakdown_json'
      ];

      const colNames = [];
      const colValues = [];
      const placeholders = [];

      for (const col of payCols) {
        if (onlinePay[col] !== undefined) {
          colNames.push(`\`${col}\``);
          if (col === 'member_id') {
            colValues.push(targetMemberId);
          } else if (col === 'event_id') {
            colValues.push(targetEventId || null);
          } else if (col === 'verified_by') {
            colValues.push(onlineUserIdToLocalUserId.get(onlinePay[col]) || (onlinePay[col] ? 1 : null));
          } else {
            colValues.push(onlinePay[col]);
          }
          placeholders.push('?');
        }
      }

      const sql = `INSERT INTO payments (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
      const [insertRes] = await pool.query(sql, colValues);
      const newLocalPayId = insertRes.insertId;

      onlinePaymentIdToLocalPaymentId.set(onlinePay.id, newLocalPayId);
      if (normRef) localRefNumbers.add(normRef);
      report.payments.inserted += 1;
    } catch (err) {
      console.warn('    ! Payment insert error:', err.message);
    }
  }

  // Payment status logs
  for (const onlineLog of onlineData.payment_status_logs || []) {
    const targetPayId = onlinePaymentIdToLocalPaymentId.get(onlineLog.payment_id);
    if (!targetPayId) continue;

    try {
      const [exists] = await pool.query(
        'SELECT id FROM payment_status_logs WHERE payment_id = ? AND old_status = ? AND new_status = ? AND created_at = ? LIMIT 1',
        [targetPayId, onlineLog.old_status, onlineLog.new_status, onlineLog.created_at]
      );
      if (exists.length) {
        report.payment_status_logs.skipped += 1;
        continue;
      }

      await pool.query(
        `INSERT INTO payment_status_logs (payment_id, old_status, new_status, reason, changed_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          targetPayId,
          onlineLog.old_status,
          onlineLog.new_status,
          onlineLog.reason || null,
          onlineUserIdToLocalUserId.get(onlineLog.changed_by) || 1,
          onlineLog.created_at || new Date(),
        ]
      );
      report.payment_status_logs.inserted += 1;
    } catch (err) {
      console.warn('    ! Payment status log error:', err.message);
    }
  }

  // -------------------------------------------------------------
  // F. OFFICERS & POSITIONS
  // -------------------------------------------------------------
  console.log('  [6/10] Synchronizing Officers & Positions...');
  for (const pos of onlineData.officer_positions || []) {
    try {
      const posName = pos.name || pos.title || '';
      const [exists] = await pool.query('SELECT id FROM officer_positions WHERE name = ? LIMIT 1', [posName]);
      if (!exists.length && posName) {
        await pool.query(
          `INSERT INTO officer_positions (name, description, is_default, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [posName, pos.description || null, pos.is_default !== undefined ? pos.is_default : 0, pos.created_at || new Date(), pos.updated_at || new Date()]
        );
        report.officer_positions.inserted += 1;
      } else {
        report.officer_positions.skipped += 1;
      }
    } catch (err) {
      console.warn('    ! Officer position error:', err.message);
    }
  }

  const [existingLocalOfficers] = await pool.query('SELECT id, user_id FROM officers');
  const localOfficerUserIds = new Set(existingLocalOfficers.map((o) => o.user_id));

  for (const o of onlineData.officers || []) {
    let targetUserId = onlineUserIdToLocalUserId.get(o.user_id);
    if (!targetUserId && o._user_email) {
      targetUserId = emailToLocalUserId.get(normalizeStr(o._user_email));
    }
    if (!targetUserId) continue;

    if (localOfficerUserIds.has(targetUserId)) {
      report.officers.skipped += 1;
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO officers (user_id, position, start_date, end_date, created_at, updated_at, term_start, term_end, officer_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          targetUserId,
          o.position,
          o.start_date || new Date(),
          o.end_date || null,
          o.created_at || new Date(),
          o.updated_at || new Date(),
          o.term_start || null,
          o.term_end || null,
          o.officer_status || 'active',
        ]
      );
      localOfficerUserIds.add(targetUserId);
      report.officers.inserted += 1;
      console.log(`    + Inserted officer for user ID ${targetUserId} (${o.position})`);
    } catch (err) {
      console.warn(`    ! Officer insert error for user ${targetUserId}:`, err.message);
    }
  }

  // -------------------------------------------------------------
  // G. ELECTIONS, CANDIDATES & VOTES
  // -------------------------------------------------------------
  console.log('  [7/10] Synchronizing Elections...');
  const [existingLocalElections] = await pool.query('SELECT id, title FROM elections');
  const electionTitleToLocalId = new Map();
  for (const e of existingLocalElections) {
    if (e.title) electionTitleToLocalId.set(normalizeStr(e.title), Number(e.id));
  }

  const onlineElectionIdToLocalId = new Map();

  for (const el of onlineData.elections || []) {
    const normTitle = normalizeStr(el.title);
    if (normTitle && electionTitleToLocalId.has(normTitle)) {
      const localId = electionTitleToLocalId.get(normTitle);
      onlineElectionIdToLocalId.set(el.id, localId);
      report.elections.skipped += 1;
      continue;
    }

    try {
      const [insertRes] = await pool.query(
        `INSERT INTO elections (title, description, start_date, end_date, status, created_by, created_at, updated_at, allowed_positions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          el.title,
          el.description || null,
          el.start_date || new Date(),
          el.end_date || new Date(),
          el.status || 'draft',
          onlineUserIdToLocalUserId.get(el.created_by) || 1,
          el.created_at || new Date(),
          el.updated_at || new Date(),
          el.allowed_positions || null,
        ]
      );
      const newLocalId = insertRes.insertId;
      onlineElectionIdToLocalId.set(el.id, newLocalId);
      electionTitleToLocalId.set(normTitle, newLocalId);
      report.elections.inserted += 1;
      console.log(`    + Inserted election: "${el.title}" -> Local ID: ${newLocalId}`);
    } catch (err) {
      console.warn(`    ! Election insert error for "${el.title}":`, err.message);
    }
  }

  // Election Candidates
  for (const ec of onlineData.election_candidates || []) {
    const targetElectionId = onlineElectionIdToLocalId.get(ec.election_id);
    let targetMemberId = onlineUserIdToLocalUserId.get(ec.member_id);
    if (!targetMemberId && ec._member_email) {
      targetMemberId = emailToLocalUserId.get(normalizeStr(ec._member_email));
    }
    if (!targetElectionId || !targetMemberId) continue;

    try {
      const [exists] = await pool.query(
        'SELECT id FROM election_candidates WHERE election_id = ? AND member_id = ? LIMIT 1',
        [targetElectionId, targetMemberId]
      );
      if (exists.length) {
        report.election_candidates.skipped += 1;
        continue;
      }

      await pool.query(
        `INSERT INTO election_candidates (election_id, member_id, position, platform, status, votes_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          targetElectionId,
          targetMemberId,
          ec.position,
          ec.platform || null,
          ec.status || 'pending',
          ec.votes_count || 0,
          ec.created_at || new Date(),
          ec.updated_at || new Date(),
        ]
      );
      report.election_candidates.inserted += 1;
    } catch (err) {
      console.warn('    ! Election candidate insert error:', err.message);
    }
  }

  // -------------------------------------------------------------
  // H. ANNOUNCEMENTS, COMMENTS & LIKES
  // -------------------------------------------------------------
  console.log('  [8/10] Synchronizing Announcements...');
  const [existingLocalAnnouncements] = await pool.query('SELECT id, title FROM announcements');
  const titleToLocalAnnouncementId = new Map();
  for (const a of existingLocalAnnouncements) {
    if (a.title) titleToLocalAnnouncementId.set(normalizeStr(a.title), Number(a.id));
  }

  const onlineAnnouncementIdToLocalId = new Map();

  for (const a of onlineData.announcements || []) {
    const normTitle = normalizeStr(a.title);
    if (normTitle && titleToLocalAnnouncementId.has(normTitle)) {
      const localId = titleToLocalAnnouncementId.get(normTitle);
      onlineAnnouncementIdToLocalId.set(a.id, localId);
      report.announcements.skipped += 1;
      continue;
    }

    try {
      let targetPostedBy = null;
      if (a.posted_by) {
        const [memberExists] = await pool.query('SELECT id FROM members WHERE id = ? LIMIT 1', [a.posted_by]);
        if (memberExists.length) targetPostedBy = a.posted_by;
      }

      const [insertRes] = await pool.query(
        `INSERT INTO announcements (title, content, status, audience, posted_by, date, created_at, updated_at, audience_json, schedule_at, created_by, image_url, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.title,
          a.content,
          a.status || 'published',
          a.audience || 'all',
          targetPostedBy,
          a.date || new Date(),
          a.created_at || new Date(),
          a.updated_at || new Date(),
          a.audience_json || null,
          a.schedule_at || null,
          onlineUserIdToLocalUserId.get(a.created_by) || 1,
          a.image_url || null,
          a.archived_at || null,
        ]
      );
      const newLocalId = insertRes.insertId;
      onlineAnnouncementIdToLocalId.set(a.id, newLocalId);
      titleToLocalAnnouncementId.set(normTitle, newLocalId);
      report.announcements.inserted += 1;
      console.log(`    + Inserted announcement: "${a.title}" -> Local ID: ${newLocalId}`);
    } catch (err) {
      console.warn(`    ! Announcement insert error for "${a.title}":`, err.message);
    }
  }

  // -------------------------------------------------------------
  // I. LIVE EVENTS
  // -------------------------------------------------------------
  console.log('  [9/10] Synchronizing Live Events...');
  const [existingLocalLive] = await pool.query('SELECT id, title, session_identifier FROM live_events');
  const localLiveIdentSet = new Set(existingLocalLive.map((l) => l.session_identifier || normalizeStr(l.title)));

  for (const le of onlineData.live_events || []) {
    const ident = le.session_identifier || normalizeStr(le.title);
    if (ident && localLiveIdentSet.has(ident)) {
      report.live_events.skipped += 1;
      continue;
    }

    let targetEventId = null;
    if (le.event_id) {
      targetEventId = onlineEventIdToLocalEventId.get(le.event_id);
    }

    try {
      await pool.query(
        `INSERT INTO live_events (
          title, description, host_label, start_at, status, meeting_url, recording_url, viewers_count, created_by, created_at, updated_at,
          stream_url, room_code, event_id, duration_minutes, session_type, privacy, chat_enabled, allow_participant_mic,
          allow_participant_camera, allow_participant_screenshare, allow_raise_hand, allow_reactions, recording_path, session_identifier,
          end_at, join_link, waiting_room_enabled, session_token, recording_enabled, recording_visibility, recording_expires_at, stream_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          le.title,
          le.description || null,
          le.host_label || null,
          le.start_at || new Date(),
          le.status || 'scheduled',
          le.meeting_url || null,
          le.recording_url || null,
          le.viewers_count || 0,
          onlineUserIdToLocalUserId.get(le.created_by) || 1,
          le.created_at || new Date(),
          le.updated_at || new Date(),
          le.stream_url || null,
          le.room_code || null,
          targetEventId,
          le.duration_minutes || 60,
          le.session_type || 'webinar',
          le.privacy || 'public',
          le.chat_enabled !== undefined ? le.chat_enabled : 1,
          le.allow_participant_mic !== undefined ? le.allow_participant_mic : 1,
          le.allow_participant_camera !== undefined ? le.allow_participant_camera : 1,
          le.allow_participant_screenshare !== undefined ? le.allow_participant_screenshare : 1,
          le.allow_raise_hand !== undefined ? le.allow_raise_hand : 1,
          le.allow_reactions !== undefined ? le.allow_reactions : 1,
          le.recording_path || null,
          le.session_identifier || null,
          le.end_at || null,
          le.join_link || null,
          le.waiting_room_enabled !== undefined ? le.waiting_room_enabled : 0,
          le.session_token || null,
          le.recording_enabled !== undefined ? le.recording_enabled : 0,
          le.recording_visibility || 'unlisted',
          le.recording_expires_at || null,
          le.stream_source || 'webrtc',
        ]
      );
      report.live_events.inserted += 1;
    } catch (err) {
      console.warn(`    ! Live event error:`, err.message);
    }
  }

  // -------------------------------------------------------------
  // Step 8: Post-Sync Snapshot & Comparison
  // -------------------------------------------------------------
  console.log('\nStep 8: Verifying updated local database counts...');
  const afterCounts = await getTableCountsSnapshot();

  console.log('\n================================================================');
  console.log(' SYNCHRONIZATION COMPLETED SUCCESSFULLY');
  console.log('================================================================\n');

  console.log('COMPARISON (BEFORE -> AFTER SYNC):');
  console.log(`  - Users:               ${beforeCounts.users} -> ${afterCounts.users} (Inserted: ${report.users.inserted})`);
  console.log(`  - Events:              ${beforeCounts.events} -> ${afterCounts.events} (Inserted: ${report.events.inserted})`);
  console.log(`  - Event Registrations: ${beforeCounts.event_registrations} -> ${afterCounts.event_registrations} (Inserted: ${report.event_registrations.inserted})`);
  console.log(`  - Institution Members: ${beforeCounts.institution_members} -> ${afterCounts.institution_members} (Inserted: ${report.institution_members.inserted})`);
  console.log(`  - Payments:            ${beforeCounts.payments} -> ${afterCounts.payments} (Inserted: ${report.payments.inserted})`);
  console.log(`  - Payment Status Logs: ${beforeCounts.payment_status_logs} -> ${afterCounts.payment_status_logs} (Inserted: ${report.payment_status_logs.inserted})`);
  console.log(`  - Officers:            ${beforeCounts.officers} -> ${afterCounts.officers} (Inserted: ${report.officers.inserted})`);
  console.log(`  - Officer Positions:   ${beforeCounts.officer_positions} -> ${afterCounts.officer_positions} (Inserted: ${report.officer_positions.inserted})`);
  console.log(`  - Elections:           ${beforeCounts.elections} -> ${afterCounts.elections} (Inserted: ${report.elections.inserted})`);
  console.log(`  - Election Candidates: ${beforeCounts.election_candidates} -> ${afterCounts.election_candidates} (Inserted: ${report.election_candidates.inserted})`);
  console.log(`  - Announcements:       ${beforeCounts.announcements} -> ${afterCounts.announcements} (Inserted: ${report.announcements.inserted})`);
  console.log(`  - Partners:            ${beforeCounts.partners} -> ${afterCounts.partners} (Inserted: ${report.partners.inserted})`);

  // Save detailed report
  const reportPath = path.join(exportsDir, 'online_to_local_sync_report.json');
  await fs.writeFile(
    reportPath,
    JSON.stringify({ completedAt: new Date().toISOString(), report, beforeCounts, afterCounts }, null, 2),
    'utf8'
  );
  console.log(`\nSync report saved to: ${reportPath}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSync failed with error:', err);
    process.exit(1);
  });

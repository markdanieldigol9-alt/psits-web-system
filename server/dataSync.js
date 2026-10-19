const { pool } = require('./db');

function normalizeStr(str) {
  return String(str || '').trim().toLowerCase();
}

async function safeQuery(targetPool, sql, params = []) {
  try {
    const [rows] = await targetPool.query(sql, params);
    return rows;
  } catch (err) {
    console.warn(`[exportDataFromPool] safeQuery note for "${sql}": ${err.message}`);
    return [];
  }
}

/**
 * Exports data from the currently connected database pool.
 */
async function exportDataFromPool(targetPool = pool) {
  const users = await safeQuery(targetPool, 'SELECT * FROM users ORDER BY id ASC');
  const partners = await safeQuery(targetPool, 'SELECT * FROM partners ORDER BY id ASC');
  const partnerContribs = await safeQuery(targetPool, 'SELECT * FROM partner_contributions ORDER BY id ASC');
  const events = await safeQuery(targetPool, 'SELECT * FROM events ORDER BY id ASC');
  const eventDetails = await safeQuery(targetPool, 'SELECT * FROM event_details ORDER BY id ASC');
  const eventRegistrations = await safeQuery(targetPool, 'SELECT * FROM event_registrations ORDER BY id ASC');
  const payments = await safeQuery(targetPool, 'SELECT * FROM payments ORDER BY id ASC');
  const paymentStatusLogs = await safeQuery(targetPool, 'SELECT * FROM payment_status_logs ORDER BY id ASC');
  const institutionMembers = await safeQuery(targetPool, 'SELECT * FROM institution_members ORDER BY id ASC');
  const officers = await safeQuery(targetPool, 'SELECT * FROM officers ORDER BY id ASC');
  const officerPositions = await safeQuery(targetPool, 'SELECT * FROM officer_positions ORDER BY id ASC');
  const elections = await safeQuery(targetPool, 'SELECT * FROM elections ORDER BY id ASC');
  const electionCandidates = await safeQuery(targetPool, 'SELECT * FROM election_candidates ORDER BY id ASC');
  const electionVotes = await safeQuery(targetPool, 'SELECT * FROM election_votes ORDER BY election_id ASC');
  const announcements = await safeQuery(targetPool, 'SELECT * FROM announcements ORDER BY id ASC');
  const announcementComments = await safeQuery(targetPool, 'SELECT * FROM announcement_comments ORDER BY id ASC');
  const announcementLikes = await safeQuery(targetPool, 'SELECT * FROM announcement_likes ORDER BY announcement_id ASC');
  const forumPosts = await safeQuery(targetPool, 'SELECT * FROM forum_posts ORDER BY id ASC');
  const forumComments = await safeQuery(targetPool, 'SELECT * FROM forum_comments ORDER BY id ASC');
  const forumLikes = await safeQuery(targetPool, 'SELECT * FROM forum_likes ORDER BY post_id ASC');
  const liveEvents = await safeQuery(targetPool, 'SELECT * FROM live_events ORDER BY id ASC');
  const memberStatusLogs = await safeQuery(targetPool, 'SELECT * FROM member_status_logs ORDER BY id ASC');

  // Create email lookup for users
  const userEmailMap = {};
  for (const u of users) {
    if (u.id) userEmailMap[u.id] = u.email;
  }

  // Create title lookup for events
  const eventTitleMap = {};
  for (const e of events) {
    if (e.id) eventTitleMap[e.id] = e.title;
  }

  // Enrich payments with member_email and event_title for robust foreign-key mapping
  const enrichedPayments = payments.map((p) => ({
    ...p,
    _member_email: userEmailMap[p.member_id] || null,
    _event_title: p.event_id ? (eventTitleMap[p.event_id] || p.event || null) : null,
  }));

  // Enrich event registrations with member_email and event_title
  const enrichedRegistrations = eventRegistrations.map((r) => ({
    ...r,
    _member_email: userEmailMap[r.member_id] || null,
    _event_title: eventTitleMap[r.event_id] || null,
  }));

  // Enrich institution_members with institution_email and event_title
  const enrichedInstitutionMembers = institutionMembers.map((m) => ({
    ...m,
    _institution_email: userEmailMap[m.institution_user_id] || null,
    _event_title: m.event_id ? (eventTitleMap[m.event_id] || m.event_title || null) : (m.event_title || null),
  }));

  // Enrich officers with user_email
  const enrichedOfficers = officers.map((o) => ({
    ...o,
    _user_email: userEmailMap[o.user_id] || null,
  }));

  // Enrich election candidates with member_email
  const enrichedCandidates = electionCandidates.map((c) => ({
    ...c,
    _member_email: userEmailMap[c.member_id] || null,
  }));

  // Enrich election votes with user_email
  const enrichedVotes = electionVotes.map((v) => ({
    ...v,
    _user_email: userEmailMap[v.user_id] || null,
  }));

  return {
    exportedAt: new Date().toISOString(),
    users,
    partners,
    partner_contributions: partnerContribs,
    events,
    event_details: eventDetails,
    event_registrations: enrichedRegistrations,
    payments: enrichedPayments,
    payment_status_logs: paymentStatusLogs,
    institution_members: enrichedInstitutionMembers,
    officers: enrichedOfficers,
    officer_positions: officerPositions,
    elections,
    election_candidates: enrichedCandidates,
    election_votes: enrichedVotes,
    announcements,
    announcement_comments: announcementComments,
    announcement_likes: announcementLikes,
    forum_posts: forumPosts,
    forum_comments: forumComments,
    forum_likes: forumLikes,
    live_events: liveEvents,
    member_status_logs: memberStatusLogs,
  };
}

/**
 * Imports exported data into the target database pool with duplicate prevention.
 */
async function importDataIntoPool(data, targetPool = pool) {
  const report = {
    startedAt: new Date().toISOString(),
    users: { totalLocal: (data.users || []).length, skippedDuplicates: 0, inserted: 0, details: [] },
    partners: { totalLocal: (data.partners || []).length, skippedDuplicates: 0, inserted: 0, details: [] },
    partner_contributions: { totalLocal: (data.partner_contributions || []).length, skippedDuplicates: 0, inserted: 0, details: [] },
    events: { totalLocal: (data.events || []).length, skippedDuplicates: 0, inserted: 0, details: [] },
    event_registrations: { totalLocal: (data.event_registrations || []).length, skippedDuplicates: 0, inserted: 0, details: [] },
    payments: { totalLocal: (data.payments || []).length, skippedDuplicates: 0, inserted: 0, details: [] },
    payment_status_logs: { totalLocal: (data.payment_status_logs || []).length, skippedDuplicates: 0, inserted: 0, details: [] },
    logs: [],
  };

  function log(msg) {
    report.logs.push(`[${new Date().toISOString()}] ${msg}`);
  }

  log('Starting data sync to online database...');

  // ==========================================
  // 1. USERS / PSITS MEMBERS
  // ==========================================
  log('--- Step 1: Processing PSITS Members / Users ---');
  const [existingOnlineUsers] = await targetPool.query('SELECT id, email, username, full_name, role FROM users');
  const emailToOnlineUserId = new Map();
  const usernameToOnlineUserId = new Map();

  for (const u of existingOnlineUsers) {
    if (u.email) emailToOnlineUserId.set(normalizeStr(u.email), Number(u.id));
    if (u.username) usernameToOnlineUserId.set(normalizeStr(u.username), Number(u.id));
  }

  const localUserIdToOnlineUserId = new Map();

  for (const localUser of data.users || []) {
    const normEmail = normalizeStr(localUser.email);
    const normUsername = normalizeStr(localUser.username);

    // Duplicate check: check if email or username already exists online
    if (normEmail && emailToOnlineUserId.has(normEmail)) {
      const onlineId = emailToOnlineUserId.get(normEmail);
      localUserIdToOnlineUserId.set(localUser.id, onlineId);
      report.users.skippedDuplicates += 1;
      report.users.details.push({
        status: 'skipped_duplicate',
        email: localUser.email,
        fullName: localUser.full_name,
        reason: `Email already exists online with user ID ${onlineId}`,
      });
      log(`[USER SKIP] ${localUser.email} (${localUser.full_name}) already exists online (ID: ${onlineId}).`);
      continue;
    }

    if (normUsername && usernameToOnlineUserId.has(normUsername)) {
      const onlineId = usernameToOnlineUserId.get(normUsername);
      localUserIdToOnlineUserId.set(localUser.id, onlineId);
      report.users.skippedDuplicates += 1;
      report.users.details.push({
        status: 'skipped_duplicate',
        email: localUser.email,
        fullName: localUser.full_name,
        reason: `Username '${localUser.username}' already exists online with user ID ${onlineId}`,
      });
      log(`[USER SKIP] Username ${localUser.username} already exists online (ID: ${onlineId}).`);
      continue;
    }

    // New user from local - insert into online database
    try {
      const userColumns = [
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

      for (const col of userColumns) {
        if (localUser[col] !== undefined) {
          colNames.push(`\`${col}\``);
          colValues.push(localUser[col]);
          placeholders.push('?');
        }
      }

      const sql = `INSERT INTO users (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
      const [insertResult] = await targetPool.query(sql, colValues);
      const newId = insertResult.insertId;

      localUserIdToOnlineUserId.set(localUser.id, newId);
      if (normEmail) emailToOnlineUserId.set(normEmail, newId);
      if (normUsername) usernameToOnlineUserId.set(normUsername, newId);

      report.users.inserted += 1;
      report.users.details.push({
        status: 'inserted',
        email: localUser.email,
        fullName: localUser.full_name,
        onlineId: newId,
      });
      log(`[USER INSERT] Created user ${localUser.email} (${localUser.full_name}) -> Online ID ${newId}`);
    } catch (insertErr) {
      log(`[USER ERROR] Failed to insert user ${localUser.email}: ${insertErr.message}`);
      report.users.details.push({
        status: 'error',
        email: localUser.email,
        error: insertErr.message,
      });
    }
  }

  // ==========================================
  // 2. PARTNERS & CONTRIBUTIONS
  // ==========================================
  log('--- Step 2: Processing Partners & Contributions ---');
  const [existingOnlinePartners] = await targetPool.query('SELECT id, company FROM partners');
  const companyToOnlinePartnerId = new Map();
  for (const p of existingOnlinePartners) {
    if (p.company) companyToOnlinePartnerId.set(normalizeStr(p.company), Number(p.id));
  }

  const localPartnerIdToOnlinePartnerId = new Map();

  for (const localPartner of data.partners || []) {
    const normCompany = normalizeStr(localPartner.company);

    if (normCompany && companyToOnlinePartnerId.has(normCompany)) {
      const onlineId = companyToOnlinePartnerId.get(normCompany);
      localPartnerIdToOnlinePartnerId.set(localPartner.id, onlineId);
      report.partners.skippedDuplicates += 1;
      log(`[PARTNER SKIP] Partner "${localPartner.company}" already exists online (ID: ${onlineId}).`);
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
        if (localPartner[col] !== undefined) {
          colNames.push(`\`${col}\``);
          if (col === 'created_by') {
            colValues.push(localUserIdToOnlineUserId.get(localPartner[col]) || 1);
          } else {
            colValues.push(localPartner[col]);
          }
          placeholders.push('?');
        }
      }

      const sql = `INSERT INTO partners (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
      const [insertResult] = await targetPool.query(sql, colValues);
      const newId = insertResult.insertId;

      localPartnerIdToOnlinePartnerId.set(localPartner.id, newId);
      companyToOnlinePartnerId.set(normCompany, newId);
      report.partners.inserted += 1;
      log(`[PARTNER INSERT] Created partner "${localPartner.company}" -> Online ID ${newId}`);
    } catch (err) {
      log(`[PARTNER ERROR] Failed to insert partner "${localPartner.company}": ${err.message}`);
    }
  }

  // Partner Contributions
  for (const localContrib of data.partner_contributions || []) {
    const targetPartnerId = localPartnerIdToOnlinePartnerId.get(localContrib.partner_id);
    if (!targetPartnerId) {
      log(`[CONTRIB SKIP] Could not map partner_id ${localContrib.partner_id} for contribution.`);
      continue;
    }

    try {
      // Check if duplicate contribution exists
      const [existingContrib] = await targetPool.query(
        'SELECT id FROM partner_contributions WHERE partner_id = ? AND contribution_type = ? AND amount = ? LIMIT 1',
        [targetPartnerId, localContrib.contribution_type, localContrib.amount]
      );

      if (existingContrib.length) {
        report.partner_contributions.skippedDuplicates += 1;
        continue;
      }

      await targetPool.query(
        `INSERT INTO partner_contributions (
          partner_id, contribution_type, title, amount, description, contribution_date, status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          targetPartnerId,
          localContrib.contribution_type,
          localContrib.title || null,
          localContrib.amount,
          localContrib.description || null,
          localContrib.contribution_date || null,
          localContrib.status || 'received',
          localUserIdToOnlineUserId.get(localContrib.created_by) || 1,
          localContrib.created_at || new Date(),
          localContrib.updated_at || new Date(),
        ]
      );
      report.partner_contributions.inserted += 1;
      log(`[CONTRIB INSERT] Added contribution for partner ID ${targetPartnerId}.`);
    } catch (err) {
      log(`[CONTRIB ERROR] Error inserting contribution: ${err.message}`);
    }
  }

  // ==========================================
  // 3. EVENTS & EVENT REGISTRATIONS
  // ==========================================
  log('--- Step 3: Processing Events & Registrations ---');
  const [existingOnlineEvents] = await targetPool.query('SELECT id, title FROM events');
  const titleToOnlineEventId = new Map();
  for (const e of existingOnlineEvents) {
    if (e.title) titleToOnlineEventId.set(normalizeStr(e.title), Number(e.id));
  }

  const localEventIdToOnlineEventId = new Map();

  for (const localEvent of data.events || []) {
    const normTitle = normalizeStr(localEvent.title);

    if (normTitle && titleToOnlineEventId.has(normTitle)) {
      const onlineId = titleToOnlineEventId.get(normTitle);
      localEventIdToOnlineEventId.set(localEvent.id, onlineId);
      report.events.skippedDuplicates += 1;
      log(`[EVENT SKIP] Event "${localEvent.title}" already exists online (ID: ${onlineId}).`);
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
        if (localEvent[col] !== undefined) {
          colNames.push(`\`${col}\``);
          if (col === 'created_by') {
            colValues.push(localUserIdToOnlineUserId.get(localEvent[col]) || 1);
          } else {
            colValues.push(localEvent[col]);
          }
          placeholders.push('?');
        }
      }

      const sql = `INSERT INTO events (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
      const [insertResult] = await targetPool.query(sql, colValues);
      const newId = insertResult.insertId;

      localEventIdToOnlineEventId.set(localEvent.id, newId);
      titleToOnlineEventId.set(normTitle, newId);
      report.events.inserted += 1;
      log(`[EVENT INSERT] Created event "${localEvent.title}" -> Online ID ${newId}`);
    } catch (err) {
      log(`[EVENT ERROR] Failed to insert event "${localEvent.title}": ${err.message}`);
    }
  }

  // Event Details
  for (const localDetails of data.event_details || []) {
    const targetEventId = localEventIdToOnlineEventId.get(localDetails.event_id);
    if (!targetEventId) continue;

    try {
      const [exists] = await targetPool.query('SELECT id FROM event_details WHERE event_id = ? LIMIT 1', [targetEventId]);
      if (!exists.length) {
        await targetPool.query(
          `INSERT INTO event_details (event_id, rules, schedule, prizes, contact_email, contact_phone, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            targetEventId,
            localDetails.rules || null,
            localDetails.schedule || null,
            localDetails.prizes || null,
            localDetails.contact_email || null,
            localDetails.contact_phone || null,
            localDetails.created_at || new Date(),
            localDetails.updated_at || new Date(),
          ]
        );
      }
    } catch (err) {
      log(`[EVENT DETAILS ERROR] ${err.message}`);
    }
  }

  // Event Registrations
  for (const localReg of data.event_registrations || []) {
    // Resolve online event id
    let targetEventId = localEventIdToOnlineEventId.get(localReg.event_id);
    if (!targetEventId && localReg._event_title) {
      targetEventId = titleToOnlineEventId.get(normalizeStr(localReg._event_title));
    }

    // Resolve online member id
    let targetMemberId = localUserIdToOnlineUserId.get(localReg.member_id);
    if (!targetMemberId && localReg._member_email) {
      targetMemberId = emailToOnlineUserId.get(normalizeStr(localReg._member_email));
    }

    if (!targetEventId || !targetMemberId) {
      log(`[REG SKIP] Unable to map event (${localReg.event_id}) or member (${localReg.member_id}) for registration.`);
      continue;
    }

    try {
      const [exists] = await targetPool.query(
        'SELECT id FROM event_registrations WHERE event_id = ? AND member_id = ? LIMIT 1',
        [targetEventId, targetMemberId]
      );

      if (exists.length) {
        report.event_registrations.skippedDuplicates += 1;
        continue;
      }

      await targetPool.query(
        `INSERT INTO event_registrations (
          event_id, member_id, participant_count, status, qr_token, notes, approved_by, approved_at, rejection_reason, created_at, updated_at, team_profile_url, checked_in_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          targetEventId,
          targetMemberId,
          localReg.participant_count || 1,
          localReg.status || 'pending',
          localReg.qr_token || null,
          localReg.notes || null,
          localUserIdToOnlineUserId.get(localReg.approved_by) || null,
          localReg.approved_at || null,
          localReg.rejection_reason || null,
          localReg.created_at || new Date(),
          localReg.updated_at || new Date(),
          localReg.team_profile_url || null,
          localReg.checked_in_count || 0,
        ]
      );
      report.event_registrations.inserted += 1;
      log(`[REG INSERT] Registered member ID ${targetMemberId} for event ID ${targetEventId}.`);
    } catch (err) {
      log(`[REG ERROR] Registration insert failed: ${err.message}`);
    }
  }

  // ==========================================
  // 4. PAYMENT TRACKING
  // ==========================================
  log('--- Step 4: Processing Payment Tracking ---');
  const [existingOnlinePayments] = await targetPool.query('SELECT id, member_id, event_id, reference_number, amount, payment_kind FROM payments');
  const onlineRefNumbers = new Set();
  for (const pay of existingOnlinePayments) {
    if (pay.reference_number) onlineRefNumbers.add(normalizeStr(pay.reference_number));
  }

  for (const localPay of data.payments || []) {
    // Resolve member_id
    let targetMemberId = localUserIdToOnlineUserId.get(localPay.member_id);
    if (!targetMemberId && localPay._member_email) {
      targetMemberId = emailToOnlineUserId.get(normalizeStr(localPay._member_email));
    }

    // Resolve event_id
    let targetEventId = null;
    if (localPay.event_id) {
      targetEventId = localEventIdToOnlineEventId.get(localPay.event_id);
      if (!targetEventId && localPay._event_title) {
        targetEventId = titleToOnlineEventId.get(normalizeStr(localPay._event_title));
      }
    }

    if (!targetMemberId) {
      // If member_id was a deleted test user, fallback to 1 (Admin) or skip
      targetMemberId = 1;
    }

    // Duplicate check by reference number
    const normRef = normalizeStr(localPay.reference_number);
    if (normRef && onlineRefNumbers.has(normRef)) {
      report.payments.skippedDuplicates += 1;
      log(`[PAY SKIP] Reference number ${localPay.reference_number} already exists online.`);
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
        if (localPay[col] !== undefined) {
          colNames.push(`\`${col}\``);
          if (col === 'member_id') {
            colValues.push(targetMemberId);
          } else if (col === 'event_id') {
            colValues.push(targetEventId || null);
          } else if (col === 'verified_by') {
            colValues.push(localUserIdToOnlineUserId.get(localPay[col]) || (localPay[col] ? 1 : null));
          } else {
            colValues.push(localPay[col]);
          }
          placeholders.push('?');
        }
      }

      const sql = `INSERT INTO payments (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
      const [insertResult] = await targetPool.query(sql, colValues);
      const newPayId = insertResult.insertId;

      if (normRef) onlineRefNumbers.add(normRef);
      report.payments.inserted += 1;
      log(`[PAY INSERT] Inserted payment ID ${newPayId} (Amount: ${localPay.amount}, Ref: ${localPay.reference_number || 'N/A'}).`);

      // Payment status logs for this payment
      const logsForPay = (data.payment_status_logs || []).filter((l) => l.payment_id === localPay.id);
      for (const pl of logsForPay) {
        await targetPool.query(
          `INSERT INTO payment_status_logs (payment_id, old_status, new_status, reason, changed_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            newPayId,
            pl.old_status,
            pl.new_status,
            pl.reason || null,
            localUserIdToOnlineUserId.get(pl.changed_by) || 1,
            pl.created_at || new Date(),
          ]
        );
        report.payment_status_logs.inserted += 1;
      }
    } catch (err) {
      log(`[PAY ERROR] Failed to insert payment: ${err.message}`);
    }
  }

  report.completedAt = new Date().toISOString();
  log('Data sync finished successfully!');
  return report;
}

module.exports = {
  exportDataFromPool,
  importDataIntoPool,
};

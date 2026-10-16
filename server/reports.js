const { pool } = require('./db');

function monthLabel(date) {
  return date.toLocaleString('en-US', { month: 'short' });
}

function firstOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

async function getDashboardReport(_req, res) {
  const user = _req?.user;
  const role = String(user?.role || '');
  const memberType = String(user?.member_type || '').toLowerCase();

  const isModerator = role === 'super_admin' || role === 'admin' || role === 'officer';
  const isIndustryMember = role === 'member' && memberType === 'industry';

  if (!isModerator && !isIndustryMember) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }

  const [[{ totalUsers }]] = await pool.query(
    "SELECT COUNT(*) AS totalUsers FROM users WHERE role='member'"
  );
  const [[{ totalInstMembers }]] = await pool.query(
    "SELECT COUNT(*) AS totalInstMembers FROM institution_members"
  );
  const totalMembers = (Number(totalUsers) || 0) + (Number(totalInstMembers) || 0);

  const [[{ activeUsers }]] = await pool.query(
    "SELECT COUNT(*) AS activeUsers FROM users WHERE role='member' AND status='active'"
  );
  const [[{ approvedInstMembers }]] = await pool.query(
    "SELECT COUNT(*) AS approvedInstMembers FROM institution_members WHERE status='approved'"
  );
  const activeMembers = (Number(activeUsers) || 0) + (Number(approvedInstMembers) || 0);

  const [[{ pendingUsers }]] = await pool.query(
    "SELECT COUNT(*) AS pendingUsers FROM users WHERE role='member' AND status='pending'"
  );
  const [[{ pendingInstMembers }]] = await pool.query(
    "SELECT COUNT(*) AS pendingInstMembers FROM institution_members WHERE status='pending'"
  );
  const pendingApprovals = (Number(pendingUsers) || 0) + (Number(pendingInstMembers) || 0);

  const [[{ activeEvents }]] = await pool.query(
    "SELECT COUNT(*) AS activeEvents FROM events WHERE status IN ('upcoming','ongoing')"
  );
  const [[{ totalRevenue }]] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS totalRevenue FROM payments WHERE status='verified'"
  );
  const [[{ grossCollections }]] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS grossCollections FROM payments"
  );
  const [[{ pendingCollections }]] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS pendingCollections FROM payments WHERE status='pending'"
  );
  const [[{ remainingReceivables }]] = await pool.query(
    "SELECT COALESCE(SUM(remaining_balance), 0) AS remainingReceivables FROM payments WHERE remaining_balance > 0"
  );

  const [revenueRows] = await pool.query(
    "SELECT method, COALESCE(SUM(amount), 0) AS total FROM payments WHERE status IN ('verified', 'approved') GROUP BY method"
  );
  const methodLabelMap = {
    gcash: 'GCash',
    paypal: 'PayPal',
    paymaya: 'PayMaya',
    bank_transfer: 'Bank Transfer',
    bank: 'Bank Transfer',
    card: 'Bank Transfer',
    officer: 'Through Officer',
    through_officer: 'Through Officer',
    cash: 'Through Officer',
    cheque: 'Cheque',
  };
  const methodTotals = new Map([
    ['GCash', 0],
    ['Bank Transfer', 0],
    ['Through Officer', 0],
    ['Cheque', 0],
    ['PayMaya', 0],
  ]);
  for (const row of revenueRows) {
    const raw = String(row.method || 'other').toLowerCase();
    const label = methodLabelMap[raw] || raw.toUpperCase();
    methodTotals.set(label, (methodTotals.get(label) || 0) + Number(row.total || 0));
  }
  const revenueByMethod = Array.from(methodTotals.entries()).map(([name, value]) => ({ name, value }));

  let pendingRows = [];
  if (isModerator) {
    const [rows] = await pool.execute(
      `SELECT id, full_name, email, sector, member_type, status, created_at
       FROM users
       WHERE role='member' AND status='pending'
       ORDER BY created_at DESC
       LIMIT 5`
    );
    pendingRows = rows;
  }

  const now = new Date();
  const start = addMonths(firstOfMonth(now), -5);

  const [registeredUsers] = await pool.execute(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS cnt
     FROM users
     WHERE role='member' AND created_at >= ?
     GROUP BY ym
     ORDER BY ym`,
    [start]
  );

  const [registeredInst] = await pool.execute(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS cnt
     FROM institution_members
     WHERE created_at >= ?
     GROUP BY ym
     ORDER BY ym`,
    [start]
  );

  const [approvedUsers] = await pool.execute(
    `SELECT DATE_FORMAT(updated_at, '%Y-%m') AS ym, COUNT(*) AS cnt
     FROM users
     WHERE role='member' AND status='active' AND updated_at >= ?
     GROUP BY ym
     ORDER BY ym`,
    [start]
  );

  const [approvedInst] = await pool.execute(
    `SELECT DATE_FORMAT(COALESCE(approved_at, updated_at), '%Y-%m') AS ym, COUNT(*) AS cnt
     FROM institution_members
     WHERE status='approved' AND COALESCE(approved_at, updated_at) >= ?
     GROUP BY ym
     ORDER BY ym`,
    [start]
  );

  const regMap = new Map();
  for (const r of registeredUsers) {
    regMap.set(r.ym, (regMap.get(r.ym) || 0) + Number(r.cnt));
  }
  for (const r of registeredInst) {
    regMap.set(r.ym, (regMap.get(r.ym) || 0) + Number(r.cnt));
  }

  const apprMap = new Map();
  for (const r of approvedUsers) {
    apprMap.set(r.ym, (apprMap.get(r.ym) || 0) + Number(r.cnt));
  }
  for (const r of approvedInst) {
    apprMap.set(r.ym, (apprMap.get(r.ym) || 0) + Number(r.cnt));
  }

  const memberGrowth = [];
  for (let i = 0; i < 6; i += 1) {
    const d = addMonths(start, i);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    memberGrowth.push({
      month: monthLabel(d),
      members: regMap.get(ym) || 0,
      active: apprMap.get(ym) || 0,
    });
  }

  const summary = isModerator
    ? {
      totalMembers: Number(totalMembers) || 0,
      activeMembers: Number(activeMembers) || 0,
      pendingApprovals: Number(pendingApprovals) || 0,
      psitsMembers: Number(totalUsers) || 0,
      institutionMembers: Number(totalInstMembers) || 0,
      activePsitsMembers: Number(activeUsers) || 0,
      activeInstitutionMembers: Number(approvedInstMembers) || 0,
      pendingPsitsMembers: Number(pendingUsers) || 0,
      pendingInstitutionMembers: Number(pendingInstMembers) || 0,
      activeEvents: Number(activeEvents) || 0,
      totalRevenue: Number(totalRevenue) || 0,
      grossCollections: Number(grossCollections) || 0,
      pendingCollections: Number(pendingCollections) || 0,
      remainingReceivables: Number(remainingReceivables) || 0,
    }
    : {
      totalMembers: Number(totalMembers) || 0,
      activeMembers: Number(activeMembers) || 0,
      psitsMembers: Number(totalUsers) || 0,
      institutionMembers: Number(totalInstMembers) || 0,
      activeEvents: Number(activeEvents) || 0,
      totalRevenue: Number(totalRevenue) || 0,
      grossCollections: Number(grossCollections) || 0,
      pendingCollections: Number(pendingCollections) || 0,
      remainingReceivables: Number(remainingReceivables) || 0,
    };

  return res.json({
    success: true,
    summary,
    memberGrowth,
    revenueByMethod,
    pendingMembers: isModerator
      ? pendingRows.map((r) => ({
        id: String(r.id),
        fullName: r.full_name,
        email: r.email,
        sector: r.sector,
        memberType: r.member_type === 'school' ? 'student' : r.member_type,
        status: r.status,
        createdAt: r.created_at,
      }))
      : [],
  });
}

async function getElectionReport(req, res) {
  const electionId = Number(req.params.id);
  if (!Number.isFinite(electionId)) {
    return res.status(400).json({ success: false, message: 'Invalid election ID.' });
  }

  try {
    const [electionRows] = await pool.execute(
      'SELECT id, title, description, start_date, end_date, status FROM elections WHERE id = ? LIMIT 1',
      [electionId]
    );

    if (!electionRows.length) {
      return res.status(404).json({ success: false, message: 'Election not found.' });
    }

    const [candidateRows] = await pool.execute(
      `SELECT ec.id, ec.position, ec.platform, ec.status, ec.votes_count, u.full_name AS name
       FROM election_candidates ec
       JOIN users u ON u.id = ec.member_id
       WHERE ec.election_id = ?
       ORDER BY ec.position, ec.votes_count DESC`,
      [electionId]
    );

    const [[{ totalVotes }]] = await pool.execute(
      'SELECT COUNT(*) AS totalVotes FROM election_votes WHERE election_id = ?',
      [electionId]
    );

    return res.json({
      success: true,
      election: electionRows[0],
      candidates: candidateRows,
      totalVotes: Number(totalVotes || 0)
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getPartnerContributionsReport(req, res) {
  try {
    const [contributionRows] = await pool.execute(
      `SELECT pc.id, pc.deal_title, pc.contribution_type, pc.value_amount, pc.description, pc.created_at,
              p.company AS partner_name, e.title AS event_title
       FROM partner_contributions pc
       JOIN partners p ON p.id = pc.partner_id
       LEFT JOIN events e ON e.id = pc.event_id
       ORDER BY pc.created_at DESC`
    );

    const [summaryRows] = await pool.execute(
      `SELECT pc.contribution_type, COALESCE(SUM(pc.value_amount), 0) AS total_value, COUNT(*) AS count
       FROM partner_contributions pc
       GROUP BY pc.contribution_type`
    );

    const [[{ totalContributionsValue }]] = await pool.execute(
      'SELECT COALESCE(SUM(value_amount), 0) AS total FROM partner_contributions'
    );

    return res.json({
      success: true,
      contributions: contributionRows,
      summary: summaryRows,
      totalValue: Number(totalContributionsValue || 0)
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getAllMembersReport(req, res) {
  try {
    const { category, institution, search, status } = req.query;

    const baseSql = `
      SELECT 
        CONCAT('u-', u.id) AS unique_id,
        u.id AS raw_id,
        u.full_name,
        u.email,
        u.contact_number,
        CASE 
          WHEN u.member_type = 'industry' THEN 'industry'
          WHEN u.member_type = 'institution' THEN 'institution'
          ELSE 'individual'
        END AS category,
        COALESCE(u.sector_details, 
          CASE WHEN u.member_type = 'institution' THEN u.full_name ELSE NULL END
        ) AS institution_name,
        COALESCE(u.occupation, u.sector, u.member_type) AS position,
        u.status,
        u.created_at,
        'PSITS Member' AS source
      FROM users u
      WHERE u.role = 'member'

      UNION ALL

      SELECT 
        CONCAT('im-', im.id) AS unique_id,
        im.id AS raw_id,
        im.full_name,
        im.email,
        im.contact_number,
        'institution' AS category,
        COALESCE(u.sector_details, u.full_name, 'Institution Member') AS institution_name,
        COALESCE(im.position, 'Participant') AS position,
        im.status,
        im.created_at,
        'Institution Member' AS source
      FROM institution_members im
      LEFT JOIN users u ON u.id = im.institution_user_id
    `;

    const filterClauses = [];
    const params = [];

    if (category && category !== 'all') {
      filterClauses.push('m.category = ?');
      params.push(String(category).toLowerCase());
    }

    if (institution && institution !== 'all') {
      filterClauses.push('m.institution_name = ?');
      params.push(String(institution));
    }

    if (status && status !== 'all') {
      if (status === 'active' || status === 'approved') {
        filterClauses.push("(m.status = 'active' OR m.status = 'approved')");
      } else {
        filterClauses.push('m.status = ?');
        params.push(String(status));
      }
    }

    if (search && String(search).trim()) {
      filterClauses.push('(m.full_name LIKE ? OR m.email LIKE ? OR m.institution_name LIKE ? OR m.position LIKE ?)');
      const s = `%${String(search).trim()}%`;
      params.push(s, s, s, s);
    }

    const whereClause = filterClauses.length > 0 ? `WHERE ${filterClauses.join(' AND ')}` : '';
    const finalSql = `
      SELECT * FROM (${baseSql}) AS m
      ${whereClause}
      ORDER BY m.created_at DESC
    `;

    const [rows] = await pool.query(finalSql, params);

    const [instRows] = await pool.query(`
      SELECT DISTINCT m.institution_name 
      FROM (${baseSql}) AS m 
      WHERE m.institution_name IS NOT NULL AND m.institution_name <> ''
      ORDER BY m.institution_name ASC
    `);
    const institutions = instRows.map((r) => r.institution_name);

    const [countRows] = await pool.query(`
      SELECT m.category, COUNT(*) AS count
      FROM (${baseSql}) AS m
      GROUP BY m.category
    `);
    const counts = { total: 0, individual: 0, institution: 0, industry: 0 };
    for (const r of countRows) {
      counts[r.category] = Number(r.count);
      counts.total += Number(r.count);
    }

    return res.json({
      success: true,
      members: rows,
      institutions,
      counts
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getEventParticipationReport(req, res) {
  try {
    const { eventId, institution, search, status } = req.query;

    const [events] = await pool.query(`
      SELECT 
        e.id,
        e.title,
        e.event_type AS category,
        e.status,
        e.location,
        e.capacity,
        e.registration_fee,
        e.start_at,
        e.end_at,
        (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) AS direct_registrations,
        (SELECT COUNT(*) FROM institution_members im WHERE im.event_id = e.id OR (im.event_id IS NULL AND im.event_title = e.title)) AS institution_registrations,
        (
          (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) +
          (SELECT COUNT(*) FROM institution_members im WHERE im.event_id = e.id OR (im.event_id IS NULL AND im.event_title = e.title))
        ) AS total_participants
      FROM events e
      ORDER BY e.start_at DESC
    `);

    const baseParticipantSql = `
      SELECT 
        CONCAT('reg-', er.id) AS participant_key,
        e.id AS event_id,
        e.title AS event_title,
        e.event_type AS event_category,
        u.full_name,
        u.email,
        u.contact_number,
        COALESCE(u.sector_details, CASE WHEN u.member_type = 'institution' THEN u.full_name ELSE 'PSITS Individual Member' END) AS institution_name,
        COALESCE(u.occupation, u.sector, u.member_type, 'Member') AS position,
        'Individual Registration' AS registration_source,
        er.status AS registration_status,
        (er.checked_in_count > 0) AS is_checked_in,
        er.created_at AS registered_at
      FROM event_registrations er
      JOIN events e ON e.id = er.event_id
      JOIN users u ON u.id = er.member_id

      UNION ALL

      SELECT
        CONCAT('inst-', im.id) AS participant_key,
        e.id AS event_id,
        e.title AS event_title,
        e.event_type AS event_category,
        im.full_name,
        im.email,
        im.contact_number,
        COALESCE(u.sector_details, u.full_name, 'Institution Member') AS institution_name,
        COALESCE(im.position, 'Participant') AS position,
        'Institution Roster' AS registration_source,
        im.status AS registration_status,
        (im.checked_in = 1) AS is_checked_in,
        im.created_at AS registered_at
      FROM institution_members im
      JOIN users u ON u.id = im.institution_user_id
      JOIN events e ON (e.id = im.event_id OR (im.event_id IS NULL AND e.title = im.event_title))
    `;

    const filterClauses = [];
    const params = [];

    if (eventId && eventId !== 'all') {
      filterClauses.push('p.event_id = ?');
      params.push(Number(eventId) || String(eventId));
    }

    if (institution && institution !== 'all') {
      filterClauses.push('p.institution_name = ?');
      params.push(String(institution));
    }

    if (status && status !== 'all') {
      if (status === 'checked_in') {
        filterClauses.push('p.is_checked_in = 1');
      } else {
        filterClauses.push('p.registration_status = ?');
        params.push(String(status));
      }
    }

    if (search && String(search).trim()) {
      filterClauses.push('(p.full_name LIKE ? OR p.email LIKE ? OR p.institution_name LIKE ? OR p.event_title LIKE ? OR p.position LIKE ?)');
      const s = `%${String(search).trim()}%`;
      params.push(s, s, s, s, s);
    }

    const whereClause = filterClauses.length > 0 ? `WHERE ${filterClauses.join(' AND ')}` : '';
    const finalSql = `
      SELECT * FROM (${baseParticipantSql}) AS p
      ${whereClause}
      ORDER BY p.registered_at DESC
    `;

    const [participants] = await pool.query(finalSql, params);

    const [instRows] = await pool.query(`
      SELECT DISTINCT p.institution_name 
      FROM (${baseParticipantSql}) AS p 
      WHERE p.institution_name IS NOT NULL AND p.institution_name <> ''
      ORDER BY p.institution_name ASC
    `);
    const institutions = instRows.map((r) => r.institution_name);

    return res.json({
      success: true,
      events,
      participants,
      institutions,
      summary: {
        totalEvents: events.length,
        totalParticipants: participants.length,
        totalInstitutions: institutions.length,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getDashboardReport,
  getElectionReport,
  getPartnerContributionsReport,
  getAllMembersReport,
  getEventParticipationReport
};

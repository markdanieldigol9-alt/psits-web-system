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

const TIME_IN_OPENS_BEFORE_MIN = 60;
const TIME_OUT_CLOSES_AFTER_MIN = 60;
const LATE_GRACE_MIN = 15;

const toIso = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function resolveSchedule(eventRow) {
  const startAt = eventRow.start_at ? new Date(eventRow.start_at) : null;
  let endAt = eventRow.end_at ? new Date(eventRow.end_at) : null;
  if (startAt && (!endAt || endAt.getTime() < startAt.getTime())) {
    endAt = new Date(startAt);
    endAt.setHours(23, 59, 59, 0);
  }
  const timeInOpensAt = startAt ? new Date(startAt.getTime() - TIME_IN_OPENS_BEFORE_MIN * 60000) : null;
  const timeOutClosesAt = endAt ? new Date(endAt.getTime() + TIME_OUT_CLOSES_AFTER_MIN * 60000) : null;
  return { startAt, endAt, timeInOpensAt, timeOutClosesAt };
}

function isModeratorUser(req) {
  const role = String(req?.user?.role || '');
  return role === 'super_admin' || role === 'admin' || role === 'officer';
}

function parseOptionalPositiveInt(raw, paramName) {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  const str = String(raw).trim();
  if (!str || str === 'all') {
    return { ok: true, value: null };
  }
  if (!/^\d+$/.test(str)) {
    return { ok: false, message: `Invalid ${paramName}. Must be a positive integer or "all".` };
  }
  const num = Number(str);
  if (num <= 0 || !Number.isSafeInteger(num)) {
    return { ok: false, message: `Invalid ${paramName}. Must be a positive integer or "all".` };
  }
  return { ok: true, value: num };
}

function parseOptionalDateParam(raw, paramName) {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  const str = String(raw).trim();
  if (!str) {
    return { ok: true, value: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return { ok: false, message: `Invalid ${paramName}. Expected YYYY-MM-DD format.` };
  }
  const d = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== str) {
    return { ok: false, message: `Invalid ${paramName}. Calendar date does not exist.` };
  }
  return { ok: true, value: str };
}

async function fetchDistinctReportInstitutions() {
  const [instRows] = await pool.query(`
    SELECT DISTINCT institution_name
    FROM (
      SELECT COALESCE(u.sector_details, CASE WHEN u.member_type = 'institution' THEN u.full_name ELSE 'PSITS Individual Member' END) AS institution_name
      FROM event_registrations er
      JOIN users u ON u.id = er.member_id
      UNION
      SELECT COALESCE(u.sector_details, u.full_name, 'Institution Member') AS institution_name
      FROM institution_members im
      JOIN users u ON u.id = im.institution_user_id
    ) AS inst_list
    WHERE institution_name IS NOT NULL AND institution_name <> ''
    ORDER BY institution_name ASC
  `);
  return instRows.map((r) => r.institution_name);
}

async function getDashboardReport(_req, res) {
  const user = _req?.user;
  const role = String(user?.role || '');

  const isModerator = role === 'super_admin' || role === 'admin' || role === 'officer';

  if (!isModerator) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }

  // Consolidated parallel aggregation: 11 sequential queries reduced to fast concurrent queries
  const [
    [[userStats]],
    [[instStats]],
    [[payStats]],
    [[eventStats]],
    [revenueRows],
  ] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) AS totalUsers,
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS activeUsers,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pendingUsers
      FROM users
      WHERE role = 'member'
    `),
    pool.query(`
      SELECT
        COUNT(*) AS totalInstMembers,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approvedInstMembers,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pendingInstMembers
      FROM institution_members
    `),
    pool.query(`
      SELECT
        COALESCE(SUM(amount), 0) AS grossCollections,
        COALESCE(SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END), 0) AS totalRevenue,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pendingCollections,
        COALESCE(SUM(CASE WHEN remaining_balance > 0 THEN remaining_balance ELSE 0 END), 0) AS remainingReceivables
      FROM payments
    `),
    pool.query(`
      SELECT COUNT(*) AS activeEvents
      FROM events
      WHERE status IN ('upcoming', 'ongoing')
    `),
    pool.query(`
      SELECT method, COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE status IN ('verified', 'approved')
      GROUP BY method
    `),
  ]);

  const totalUsers = userStats?.totalUsers || 0;
  const totalInstMembers = instStats?.totalInstMembers || 0;
  const totalMembers = (Number(totalUsers) || 0) + (Number(totalInstMembers) || 0);

  const activeUsers = userStats?.activeUsers || 0;
  const approvedInstMembers = instStats?.approvedInstMembers || 0;
  const activeMembers = (Number(activeUsers) || 0) + (Number(approvedInstMembers) || 0);

  const pendingUsers = userStats?.pendingUsers || 0;
  const pendingInstMembers = instStats?.pendingInstMembers || 0;
  const pendingApprovals = (Number(pendingUsers) || 0) + (Number(pendingInstMembers) || 0);

  const activeEvents = eventStats?.activeEvents || 0;
  const totalRevenue = payStats?.totalRevenue || 0;
  const grossCollections = payStats?.grossCollections || 0;
  const pendingCollections = payStats?.pendingCollections || 0;
  const remainingReceivables = payStats?.remainingReceivables || 0;
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

  const [
    [registeredUsers],
    [registeredInst],
    [approvedUsers],
    [approvedInst],
  ] = await Promise.all([
    pool.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS cnt
       FROM users
       WHERE role='member' AND created_at >= ?
       GROUP BY ym
       ORDER BY ym`,
      [start]
    ),
    pool.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS cnt
       FROM institution_members
       WHERE created_at >= ?
       GROUP BY ym
       ORDER BY ym`,
      [start]
    ),
    pool.execute(
      `SELECT DATE_FORMAT(updated_at, '%Y-%m') AS ym, COUNT(*) AS cnt
       FROM users
       WHERE role='member' AND status='active' AND updated_at >= ?
       GROUP BY ym
       ORDER BY ym`,
      [start]
    ),
    pool.execute(
      `SELECT DATE_FORMAT(COALESCE(approved_at, updated_at), '%Y-%m') AS ym, COUNT(*) AS cnt
       FROM institution_members
       WHERE status='approved' AND COALESCE(approved_at, updated_at) >= ?
       GROUP BY ym
       ORDER BY ym`,
      [start]
    ),
  ]);

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
  const user = req?.user;
  const role = String(user?.role || '');
  const isModerator = role === 'super_admin' || role === 'admin' || role === 'officer';
  if (!isModerator) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }

  const electionId = Number(req.params.id);
  if (!Number.isFinite(electionId)) {
    return res.status(400).json({ success: false, message: 'Invalid election ID.' });
  }

  try {
    const [electionRows] = await pool.execute(
      'SELECT id, title, description, start_date, end_date, status, allowed_positions, created_by, created_at, updated_at FROM elections WHERE id = ? LIMIT 1',
      [electionId]
    );

    if (!electionRows.length) {
      return res.status(404).json({ success: false, message: 'Election not found.' });
    }

    const [candidateRows] = await pool.execute(
      `SELECT ec.id, ec.position, ec.platform, ec.status, ec.votes_count, ec.member_id,
              u.full_name AS name, u.email, u.member_type, u.sector, u.sector_details, u.avatar_url
       FROM election_candidates ec
       JOIN users u ON u.id = ec.member_id
       WHERE ec.election_id = ?
       ORDER BY ec.position, ec.votes_count DESC, ec.id ASC`,
      [electionId]
    );

    const [[{ totalVotes }]] = await pool.execute(
      'SELECT COUNT(*) AS totalVotes FROM election_votes WHERE election_id = ?',
      [electionId]
    );

    const [voterRows] = await pool.execute(
      `SELECT ev.user_id, ev.created_at AS voted_at,
              u.full_name AS voter_name, u.email AS voter_email, u.member_type, u.sector, u.sector_details
       FROM election_votes ev
       JOIN users u ON u.id = ev.user_id
       WHERE ev.election_id = ?
       ORDER BY ev.created_at DESC`,
      [electionId]
    );

    let totalEligibleVoters = 0;
    try {
      const [[{ eligibleCount }]] = await pool.execute(
        "SELECT COUNT(*) AS eligibleCount FROM users WHERE role = 'member' AND status = 'active'"
      );
      totalEligibleVoters = Number(eligibleCount || 0);
    } catch {
      totalEligibleVoters = 0;
    }

    // Positions analysis (determining current/elected officers, losers/runners-up, and vote distribution)
    const positionMap = new Map();
    for (const c of candidateRows) {
      const pos = c.position || 'General Position';
      if (!positionMap.has(pos)) {
        positionMap.set(pos, {
          position: pos,
          totalVotes: 0,
          candidates: []
        });
      }
      const pData = positionMap.get(pos);
      pData.totalVotes += Number(c.votes_count || 0);
      pData.candidates.push(c);
    }

    const positions = [];
    const winners = [];
    const defeated = [];

    for (const [pos, pData] of positionMap.entries()) {
      pData.candidates.sort((a, b) => Number(b.votes_count || 0) - Number(a.votes_count || 0));

      // Candidate with status === 'winner' is explicitly winning; fallback to top votes if votes > 0
      let winnerCandidates = pData.candidates.filter(c => c.status === 'winner');
      if (!winnerCandidates.length && pData.candidates.length > 0) {
        const topCandidate = pData.candidates[0];
        if (Number(topCandidate.votes_count || 0) > 0) {
          winnerCandidates = [topCandidate];
        }
      }

      const winnerIds = new Set(winnerCandidates.map(w => w.id));
      const topVotes = winnerCandidates.length > 0 ? Number(winnerCandidates[0].votes_count || 0) : 0;

      pData.candidates.forEach((c) => {
        const isWinner = winnerIds.has(c.id);
        const candidateShare = pData.totalVotes > 0 
          ? ((Number(c.votes_count || 0) / pData.totalVotes) * 100) 
          : 0;
        const deficit = isWinner ? 0 : Math.max(0, topVotes - Number(c.votes_count || 0));

        const candidateWithMetrics = {
          ...c,
          isWinner,
          voteShare: candidateShare,
          positionTotalVotes: pData.totalVotes,
          deficit
        };

        if (isWinner) {
          winners.push(candidateWithMetrics);
        } else {
          defeated.push(candidateWithMetrics);
        }
      });

      positions.push({
        position: pos,
        totalVotes: pData.totalVotes,
        candidatesCount: pData.candidates.length,
        winners: pData.candidates.filter(c => winnerIds.has(c.id)),
        runnersUp: pData.candidates.filter(c => !winnerIds.has(c.id))
      });
    }

    const maxPositionVotes = Math.max(0, ...positions.map(p => p.totalVotes));
    const effectiveTotalBallots = Math.max(Number(totalVotes || 0), maxPositionVotes);

    return res.json({
      success: true,
      election: electionRows[0],
      candidates: candidateRows,
      positions,
      winners,
      defeated,
      voters: voterRows,
      totalVotes: effectiveTotalBallots,
      totalBallotsCast: Number(totalVotes || 0),
      totalEligibleVoters,
      turnoutRate: totalEligibleVoters > 0 ? (effectiveTotalBallots / totalEligibleVoters) * 100 : 0
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getPartnerContributionsReport(req, res) {
  const user = req?.user;
  const role = String(user?.role || '');
  const isModerator = role === 'super_admin' || role === 'admin' || role === 'officer';
  if (!isModerator) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }

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
  const user = req?.user;
  const role = String(user?.role || '');
  const isModerator = role === 'super_admin' || role === 'admin' || role === 'officer';
  if (!isModerator) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }

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
          WHEN u.member_type = 'individual' OR u.member_type = 'student' THEN 'individual'
          WHEN u.member_type = 'industry' THEN 'industry'
          WHEN u.member_type = 'institution' THEN 'institution'
          WHEN u.sector = 'institution' AND u.sector_details IS NOT NULL THEN 'institution'
          WHEN u.sector = 'industry' AND u.sector_details IS NOT NULL THEN 'industry'
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
  if (!isModeratorUser(req)) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }

  try {
    const { eventId, institution, search, status } = req.query;

    const eventIdCheck = parseOptionalPositiveInt(eventId, 'eventId');
    if (!eventIdCheck.ok) {
      return res.status(400).json({ success: false, message: eventIdCheck.message });
    }
    const parsedEventId = eventIdCheck.value;
    const institutionVal = institution && String(institution).trim() && String(institution).trim() !== 'all'
      ? String(institution).trim()
      : null;
    const statusVal = status && String(status).trim() && String(status).trim() !== 'all'
      ? String(status).trim()
      : null;
    const searchVal = search && String(search).trim() ? String(search).trim() : null;

    const [events] = await pool.query(`
      SELECT 
        e.id,
        e.title,
        e.event_type AS category,
        e.event_type AS eventType,
        e.status,
        e.location,
        e.capacity,
        e.registration_fee,
        e.registration_fee AS fee,
        e.start_at,
        e.start_at AS startDate,
        e.end_at,
        e.end_at AS endDate,
        e.is_esports AS isEsports,
        e.esports_game AS esportsGame,
        COALESCE(reg_agg.direct_registrations, 0) AS direct_registrations,
        (COALESCE(inst_id_agg.cnt, 0) + COALESCE(inst_title_agg.cnt, 0)) AS institution_registrations,
        (COALESCE(reg_agg.direct_registrations, 0) + COALESCE(inst_id_agg.cnt, 0) + COALESCE(inst_title_agg.cnt, 0)) AS total_participants,
        (COALESCE(reg_agg.direct_registrations, 0) + COALESCE(inst_id_agg.cnt, 0) + COALESCE(inst_title_agg.cnt, 0)) AS registrations
      FROM events e
      LEFT JOIN (
        SELECT event_id, COUNT(*) AS direct_registrations
        FROM event_registrations
        GROUP BY event_id
      ) reg_agg ON reg_agg.event_id = e.id
      LEFT JOIN (
        SELECT event_id, COUNT(*) AS cnt
        FROM institution_members
        WHERE event_id IS NOT NULL
        GROUP BY event_id
      ) inst_id_agg ON inst_id_agg.event_id = e.id
      LEFT JOIN (
        SELECT event_title, COUNT(*) AS cnt
        FROM institution_members
        WHERE event_id IS NULL AND event_title IS NOT NULL
        GROUP BY event_title
      ) inst_title_agg ON inst_title_agg.event_title = e.title
      ORDER BY e.start_at DESC
    `);

    const b1Where = [];
    const b1Params = [];
    const b2aWhere = ['im.event_id IS NOT NULL'];
    const b2aParams = [];
    const b2bWhere = ['im.event_id IS NULL', 'im.event_title IS NOT NULL'];
    const b2bParams = [];

    if (parsedEventId !== null) {
      b1Where.push('er.event_id = ?');
      b1Params.push(parsedEventId);
      b2aWhere.push('im.event_id = ?');
      b2aParams.push(parsedEventId);
      b2bWhere.push('e.id = ?');
      b2bParams.push(parsedEventId);
    }

    if (institutionVal) {
      b1Where.push("COALESCE(u.sector_details, CASE WHEN u.member_type = 'institution' THEN u.full_name ELSE 'PSITS Individual Member' END) = ?");
      b1Params.push(institutionVal);
      b2aWhere.push("COALESCE(u.sector_details, u.full_name, 'Institution Member') = ?");
      b2aParams.push(institutionVal);
      b2bWhere.push("COALESCE(u.sector_details, u.full_name, 'Institution Member') = ?");
      b2bParams.push(institutionVal);
    }

    if (statusVal) {
      if (statusVal === 'checked_in') {
        b1Where.push('(er.is_checked_in = 1 OR er.checked_in_count > 0)');
        b2aWhere.push('im.checked_in = 1');
        b2bWhere.push('im.checked_in = 1');
      } else {
        b1Where.push('er.status = ?');
        b1Params.push(statusVal);
        b2aWhere.push('im.status = ?');
        b2aParams.push(statusVal);
        b2bWhere.push('im.status = ?');
        b2bParams.push(statusVal);
      }
    }

    if (searchVal) {
      const like = `%${searchVal}%`;
      b1Where.push("(u.full_name LIKE ? OR COALESCE(u.email, '') LIKE ? OR COALESCE(u.sector_details, CASE WHEN u.member_type = 'institution' THEN u.full_name ELSE 'PSITS Individual Member' END) LIKE ? OR e.title LIKE ? OR COALESCE(u.occupation, u.sector, u.member_type, 'Member') LIKE ?)");
      b1Params.push(like, like, like, like, like);
      b2aWhere.push("(im.full_name LIKE ? OR COALESCE(im.email, '') LIKE ? OR COALESCE(u.sector_details, u.full_name, 'Institution Member') LIKE ? OR e.title LIKE ? OR COALESCE(im.position, 'Participant') LIKE ?)");
      b2aParams.push(like, like, like, like, like);
      b2bWhere.push("(im.full_name LIKE ? OR COALESCE(im.email, '') LIKE ? OR COALESCE(u.sector_details, u.full_name, 'Institution Member') LIKE ? OR e.title LIKE ? OR COALESCE(im.position, 'Participant') LIKE ?)");
      b2bParams.push(like, like, like, like, like);
    }

    const b1WhereSql = b1Where.length > 0 ? `WHERE ${b1Where.join(' AND ')}` : '';
    const b2aWhereSql = `WHERE ${b2aWhere.join(' AND ')}`;
    const b2bWhereSql = `WHERE ${b2bWhere.join(' AND ')}`;

    const finalSql = `
      SELECT 
        CONCAT('reg-', er.id) AS participant_key,
        e.id AS event_id,
        e.title AS event_title,
        e.event_type AS event_category,
        u.full_name AS full_name,
        u.email,
        u.contact_number,
        COALESCE(u.sector_details, CASE WHEN u.member_type = 'institution' THEN u.full_name ELSE 'PSITS Individual Member' END) AS institution_name,
        COALESCE(u.occupation, u.sector, u.member_type, 'Member') AS position,
        'Individual Registration' AS registration_source,
        er.status AS registration_status,
        (er.is_checked_in = 1 OR er.checked_in_count > 0) AS is_checked_in,
        CASE WHEN (er.is_checked_in = 1 OR er.checked_in_count > 0) THEN er.checked_in_at ELSE NULL END AS checked_in_at,
        CASE WHEN (er.is_checked_in = 1 OR er.checked_in_count > 0) THEN er.checked_out_at ELSE NULL END AS checked_out_at,
        er.created_at AS registered_at
      FROM event_registrations er
      JOIN events e ON e.id = er.event_id
      JOIN users u ON u.id = er.member_id
      ${b1WhereSql}

      UNION ALL

      SELECT
        CONCAT('inst-', im.id) AS participant_key,
        e.id AS event_id,
        e.title AS event_title,
        e.event_type AS event_category,
        im.full_name AS full_name,
        im.email,
        im.contact_number,
        COALESCE(u.sector_details, u.full_name, 'Institution Member') AS institution_name,
        COALESCE(im.position, 'Participant') AS position,
        'Institution Roster' AS registration_source,
        im.status AS registration_status,
        (im.checked_in = 1) AS is_checked_in,
        CASE WHEN im.checked_in = 1 THEN im.checked_in_at ELSE NULL END AS checked_in_at,
        CASE WHEN im.checked_in = 1 THEN im.checked_out_at ELSE NULL END AS checked_out_at,
        im.created_at AS registered_at
      FROM institution_members im
      JOIN events e ON e.id = im.event_id
      JOIN users u ON u.id = im.institution_user_id
      ${b2aWhereSql}

      UNION ALL

      SELECT
        CONCAT('inst-', im.id) AS participant_key,
        e.id AS event_id,
        e.title AS event_title,
        e.event_type AS event_category,
        im.full_name AS full_name,
        im.email,
        im.contact_number,
        COALESCE(u.sector_details, u.full_name, 'Institution Member') AS institution_name,
        COALESCE(im.position, 'Participant') AS position,
        'Institution Roster' AS registration_source,
        im.status AS registration_status,
        (im.checked_in = 1) AS is_checked_in,
        CASE WHEN im.checked_in = 1 THEN im.checked_in_at ELSE NULL END AS checked_in_at,
        CASE WHEN im.checked_in = 1 THEN im.checked_out_at ELSE NULL END AS checked_out_at,
        im.created_at AS registered_at
      FROM institution_members im
      JOIN events e ON e.title = im.event_title
      JOIN users u ON u.id = im.institution_user_id
      ${b2bWhereSql}

      ORDER BY registered_at DESC
    `;

    const [[participantRows], institutions] = await Promise.all([
      pool.query(finalSql, [...b1Params, ...b2aParams, ...b2bParams]),
      fetchDistinctReportInstitutions(),
    ]);

    const participants = participantRows.map((p) => {
      const checkedInAt = p.is_checked_in ? toIso(p.checked_in_at) : null;
      const checkedOutAt = p.is_checked_in ? toIso(p.checked_out_at) : null;
      return {
        ...p,
        checked_in_at: checkedInAt,
        checked_out_at: checkedOutAt,
        checkedInAt,
        checkedOutAt,
      };
    });

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

async function getEventWinnersReport(req, res) {
  if (!isModeratorUser(req)) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }

  try {
    const eventIdCheck = parseOptionalPositiveInt(req.query?.eventId, 'eventId');
    if (!eventIdCheck.ok) {
      return res.status(400).json({ success: false, message: eventIdCheck.message });
    }
    const parsedEventId = eventIdCheck.value;

    const rawStatus = req.query?.status !== undefined && req.query?.status !== null
      ? String(req.query.status).trim()
      : '';
    const allowedStatuses = new Set(['', 'all', 'completed', 'ongoing', 'upcoming', 'cancelled', 'draft', 'all_including_draft']);
    if (!allowedStatuses.has(rawStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid status filter.' });
    }

    const rawHasWinners = req.query?.hasWinners !== undefined && req.query?.hasWinners !== null
      ? String(req.query.hasWinners).trim()
      : '';
    const allowedHasWinners = new Set(['', 'all', 'with_winners', 'without_winners']);
    if (!allowedHasWinners.has(rawHasWinners)) {
      return res.status(400).json({ success: false, message: 'Invalid hasWinners filter.' });
    }

    const startDateCheck = parseOptionalDateParam(req.query?.startDate, 'startDate');
    if (!startDateCheck.ok) {
      return res.status(400).json({ success: false, message: startDateCheck.message });
    }
    const endDateCheck = parseOptionalDateParam(req.query?.endDate, 'endDate');
    if (!endDateCheck.ok) {
      return res.status(400).json({ success: false, message: endDateCheck.message });
    }
    const startDate = startDateCheck.value;
    const endDate = endDateCheck.value;
    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({ success: false, message: 'startDate cannot be after endDate.' });
    }

    const rawEventType = req.query?.eventType !== undefined && req.query?.eventType !== null
      ? String(req.query.eventType).trim()
      : '';
    const searchVal = req.query?.search !== undefined && req.query?.search !== null
      ? String(req.query.search).trim()
      : '';

    const where = [];
    const params = [];

    if (parsedEventId !== null) {
      where.push('e.id = ?');
      params.push(parsedEventId);
    }

    if (rawStatus === '' || rawStatus === 'all') {
      where.push("e.status <> 'draft'");
    } else if (rawStatus !== 'all_including_draft') {
      where.push('e.status = ?');
      params.push(rawStatus);
    }

    if (rawEventType && rawEventType !== 'all') {
      where.push('e.event_type = ?');
      params.push(rawEventType);
    }

    if (rawHasWinners === 'with_winners') {
      where.push('w.id IS NOT NULL');
    } else if (rawHasWinners === 'without_winners') {
      where.push('w.id IS NULL');
    }

    if (startDate) {
      where.push('e.start_at >= ?');
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      where.push('e.start_at <= ?');
      params.push(`${endDate} 23:59:59`);
    }

    if (searchVal) {
      const like = `%${searchVal}%`;
      where.push(
        "(e.title LIKE ? OR e.location LIKE ? OR e.event_type LIKE ? OR COALESCE(e.esports_game, '') LIKE ? OR COALESCE(w.participant_name, '') LIKE ? OR COALESCE(w.institution_name, '') LIKE ? OR COALESCE(w.award_title, '') LIKE ? OR COALESCE(w.score_or_notes, '') LIKE ?)"
      );
      params.push(like, like, like, like, like, like, like, like);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT
        e.id AS event_id,
        e.title AS event_title,
        e.event_type,
        e.registration_mode,
        e.status AS event_status,
        e.location,
        e.start_at,
        e.end_at,
        e.is_esports,
        e.esports_game,
        w.id AS winner_id,
        w.rank_position,
        w.award_title,
        w.institution_name,
        w.participant_name,
        w.points,
        w.score_or_notes,
        COALESCE(
          w.event_mode,
          CASE WHEN e.registration_mode = 'group' THEN 'team' ELSE e.registration_mode END,
          'individual'
        ) AS resolved_event_mode,
        w.created_at AS awarded_at
      FROM events e
      LEFT JOIN event_competition_winners w ON w.event_id = e.id
      ${whereClause}
      ORDER BY e.start_at DESC, e.id DESC, w.rank_position ASC, w.points DESC, w.id ASC
    `;

    const [joinedRows] = await pool.query(sql, params);

    const eventMap = new Map();
    for (const r of joinedRows) {
      const eventKey = String(r.event_id);
      const fallbackMode = r.registration_mode === 'group' ? 'team' : (r.registration_mode || 'individual');
      if (!eventMap.has(eventKey)) {
        eventMap.set(eventKey, {
          eventId: eventKey,
          eventTitle: r.event_title,
          eventType: r.event_type || 'seminar',
          eventMode: fallbackMode,
          eventStatus: r.event_status,
          location: r.location || '',
          startAt: toIso(r.start_at),
          endAt: toIso(r.end_at),
          isEsports: Boolean(r.is_esports),
          esportsGame: r.esports_game || null,
          hasWinners: false,
          winnerCount: 0,
          winners: [],
        });
      }

      if (r.winner_id !== null && r.winner_id !== undefined) {
        eventMap.get(eventKey).winners.push({
          winnerId: String(r.winner_id),
          rankPosition: Number(r.rank_position),
          awardTitle: r.award_title,
          participantName: r.participant_name,
          institutionName: r.institution_name,
          points: Number(r.points || 0),
          scoreOrNotes: r.score_or_notes ? String(r.score_or_notes) : null,
          eventMode: r.resolved_event_mode || fallbackMode,
          awardedAt: toIso(r.awarded_at),
        });
      }
    }

    const events = Array.from(eventMap.values());
    const rows = [];
    let eventsWithWinners = 0;
    let eventsWithoutWinners = 0;
    let totalWinnerEntries = 0;
    let totalPointsAwarded = 0;

    for (const ev of events) {
      ev.winnerCount = ev.winners.length;
      ev.hasWinners = ev.winners.length > 0;

      if (ev.hasWinners) {
        eventsWithWinners += 1;
        for (const w of ev.winners) {
          totalWinnerEntries += 1;
          totalPointsAwarded += w.points;
          rows.push({
            eventId: ev.eventId,
            eventTitle: ev.eventTitle,
            eventType: ev.eventType,
            eventMode: w.eventMode,
            eventStatus: ev.eventStatus,
            location: ev.location,
            startAt: ev.startAt,
            endAt: ev.endAt,
            isEsports: ev.isEsports,
            esportsGame: ev.esportsGame,
            hasWinners: true,
            winnerCount: ev.winnerCount,
            winnerId: w.winnerId,
            rankPosition: w.rankPosition,
            awardTitle: w.awardTitle,
            participantName: w.participantName,
            institutionName: w.institutionName,
            points: w.points,
            scoreOrNotes: w.scoreOrNotes,
            awardedAt: w.awardedAt,
          });
        }
      } else {
        eventsWithoutWinners += 1;
        if (rawHasWinners !== 'with_winners') {
          rows.push({
            eventId: ev.eventId,
            eventTitle: ev.eventTitle,
            eventType: ev.eventType,
            eventMode: ev.eventMode,
            eventStatus: ev.eventStatus,
            location: ev.location,
            startAt: ev.startAt,
            endAt: ev.endAt,
            isEsports: ev.isEsports,
            esportsGame: ev.esportsGame,
            hasWinners: false,
            winnerCount: 0,
            winnerId: null,
            rankPosition: null,
            awardTitle: 'No Winners Recorded',
            participantName: '—',
            institutionName: '—',
            points: 0,
            scoreOrNotes: null,
            awardedAt: null,
          });
        }
      }
    }

    return res.json({
      success: true,
      summary: {
        totalEvents: events.length,
        eventsWithWinners,
        eventsWithoutWinners,
        totalWinnerEntries,
        totalPointsAwarded,
      },
      events,
      rows,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getAttendanceReport(req, res) {
  if (!isModeratorUser(req)) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }

  try {
    const eventIdCheck = parseOptionalPositiveInt(req.query?.eventId, 'eventId');
    if (!eventIdCheck.ok) {
      return res.status(400).json({ success: false, message: eventIdCheck.message });
    }
    const parsedEventId = eventIdCheck.value;

    const rawInstitution = req.query?.institution !== undefined && req.query?.institution !== null
      ? String(req.query.institution).trim()
      : '';
    const institutionVal = rawInstitution && rawInstitution !== 'all' ? rawInstitution : null;

    const rawSource = req.query?.source !== undefined && req.query?.source !== null
      ? String(req.query.source).trim()
      : '';
    const allowedSources = new Set(['', 'all', 'individual', 'institution']);
    if (!allowedSources.has(rawSource)) {
      return res.status(400).json({ success: false, message: 'Invalid source filter.' });
    }

    const rawAttendanceStatus = req.query?.attendanceStatus !== undefined && req.query?.attendanceStatus !== null
      ? String(req.query.attendanceStatus).trim()
      : '';
    const allowedAttendanceStatuses = new Set(['', 'all', 'timed_out', 'in_venue', 'not_timed_out', 'not_arrived']);
    if (!allowedAttendanceStatuses.has(rawAttendanceStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid attendanceStatus filter.' });
    }

    const rawRegStatus = req.query?.registrationStatus !== undefined && req.query?.registrationStatus !== null
      ? String(req.query.registrationStatus).trim()
      : '';
    const allowedRegStatuses = new Set(['', 'all', 'approved', 'pending', 'rejected']);
    if (!allowedRegStatuses.has(rawRegStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid registrationStatus filter.' });
    }

    const startDateCheck = parseOptionalDateParam(req.query?.startDate, 'startDate');
    if (!startDateCheck.ok) {
      return res.status(400).json({ success: false, message: startDateCheck.message });
    }
    const endDateCheck = parseOptionalDateParam(req.query?.endDate, 'endDate');
    if (!endDateCheck.ok) {
      return res.status(400).json({ success: false, message: endDateCheck.message });
    }
    const startDate = startDateCheck.value;
    const endDate = endDateCheck.value;
    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({ success: false, message: 'startDate cannot be after endDate.' });
    }

    const searchVal = req.query?.search !== undefined && req.query?.search !== null
      ? String(req.query.search).trim()
      : '';

    const branches = [];
    const unionParams = [];

    if (rawSource !== 'institution') {
      const b1Where = [];
      const b1Params = [];

      if (parsedEventId !== null) {
        b1Where.push('er.event_id = ?');
        b1Params.push(parsedEventId);
      }
      if (startDate) {
        b1Where.push('e.start_at >= ?');
        b1Params.push(`${startDate} 00:00:00`);
      }
      if (endDate) {
        b1Where.push('e.start_at <= ?');
        b1Params.push(`${endDate} 23:59:59`);
      }
      if (rawRegStatus === '') {
        b1Where.push("er.status <> 'rejected'");
      } else if (rawRegStatus !== 'all') {
        b1Where.push('er.status = ?');
        b1Params.push(rawRegStatus);
      }
      if (rawAttendanceStatus === 'not_arrived') {
        b1Where.push('NOT (er.is_checked_in = 1 OR er.checked_in_count > 0)');
      } else if (rawAttendanceStatus === 'timed_out') {
        b1Where.push('(er.is_checked_in = 1 OR er.checked_in_count > 0) AND er.checked_out_at IS NOT NULL');
      } else if (rawAttendanceStatus === 'in_venue' || rawAttendanceStatus === 'not_timed_out') {
        b1Where.push('(er.is_checked_in = 1 OR er.checked_in_count > 0) AND er.checked_out_at IS NULL');
      }
      if (institutionVal) {
        b1Where.push("COALESCE(u.sector_details, CASE WHEN u.member_type = 'institution' THEN u.full_name ELSE 'PSITS Individual Member' END) = ?");
        b1Params.push(institutionVal);
      }
      if (searchVal) {
        const like = `%${searchVal}%`;
        b1Where.push("(u.full_name LIKE ? OR COALESCE(u.email, '') LIKE ? OR COALESCE(u.sector_details, CASE WHEN u.member_type = 'institution' THEN u.full_name ELSE 'PSITS Individual Member' END) LIKE ? OR COALESCE(u.occupation, u.sector, u.member_type, 'Member') LIKE ? OR e.title LIKE ?)");
        b1Params.push(like, like, like, like, like);
      }

      const b1WhereSql = b1Where.length > 0 ? `WHERE ${b1Where.join(' AND ')}` : '';
      branches.push(`
        SELECT
          CONCAT('reg-', er.id) AS participant_key,
          'Individual Registration' AS registration_source,
          'individual' AS source_type,
          e.id AS event_id,
          e.title AS event_title,
          e.status AS event_status,
          e.start_at AS event_start_at,
          e.end_at AS event_end_at,
          u.full_name AS full_name,
          u.email,
          u.contact_number,
          COALESCE(u.sector_details, CASE WHEN u.member_type = 'institution' THEN u.full_name ELSE 'PSITS Individual Member' END) AS institution_name,
          COALESCE(u.occupation, u.sector, u.member_type, 'Member') AS position,
          er.status AS registration_status,
          (er.is_checked_in = 1 OR er.checked_in_count > 0) AS is_checked_in,
          CASE WHEN (er.is_checked_in = 1 OR er.checked_in_count > 0) THEN er.checked_in_at ELSE NULL END AS checked_in_at,
          CASE WHEN (er.is_checked_in = 1 OR er.checked_in_count > 0) THEN er.checked_out_at ELSE NULL END AS checked_out_at,
          er.created_at AS registered_at
        FROM event_registrations er
        JOIN events e ON e.id = er.event_id
        JOIN users u ON u.id = er.member_id
        ${b1WhereSql}
      `);
      unionParams.push(...b1Params);
    }

    if (rawSource !== 'individual') {
      const b2aWhere = ['im.event_id IS NOT NULL'];
      const b2aParams = [];
      const b2bWhere = ['im.event_id IS NULL', 'im.event_title IS NOT NULL'];
      const b2bParams = [];

      if (parsedEventId !== null) {
        b2aWhere.push('im.event_id = ?');
        b2aParams.push(parsedEventId);
        b2bWhere.push('e.id = ?');
        b2bParams.push(parsedEventId);
      }
      if (startDate) {
        b2aWhere.push('e.start_at >= ?');
        b2aParams.push(`${startDate} 00:00:00`);
        b2bWhere.push('e.start_at >= ?');
        b2bParams.push(`${startDate} 00:00:00`);
      }
      if (endDate) {
        b2aWhere.push('e.start_at <= ?');
        b2aParams.push(`${endDate} 23:59:59`);
        b2bWhere.push('e.start_at <= ?');
        b2bParams.push(`${endDate} 23:59:59`);
      }
      if (rawRegStatus === '') {
        b2aWhere.push("im.status <> 'rejected'");
        b2bWhere.push("im.status <> 'rejected'");
      } else if (rawRegStatus !== 'all') {
        b2aWhere.push('im.status = ?');
        b2aParams.push(rawRegStatus);
        b2bWhere.push('im.status = ?');
        b2bParams.push(rawRegStatus);
      }
      if (rawAttendanceStatus === 'not_arrived') {
        b2aWhere.push('im.checked_in = 0');
        b2bWhere.push('im.checked_in = 0');
      } else if (rawAttendanceStatus === 'timed_out') {
        b2aWhere.push('im.checked_in = 1 AND im.checked_out_at IS NOT NULL');
        b2bWhere.push('im.checked_in = 1 AND im.checked_out_at IS NOT NULL');
      } else if (rawAttendanceStatus === 'in_venue' || rawAttendanceStatus === 'not_timed_out') {
        b2aWhere.push('im.checked_in = 1 AND im.checked_out_at IS NULL');
        b2bWhere.push('im.checked_in = 1 AND im.checked_out_at IS NULL');
      }
      if (institutionVal) {
        b2aWhere.push("COALESCE(u.sector_details, u.full_name, 'Institution Member') = ?");
        b2aParams.push(institutionVal);
        b2bWhere.push("COALESCE(u.sector_details, u.full_name, 'Institution Member') = ?");
        b2bParams.push(institutionVal);
      }
      if (searchVal) {
        const like = `%${searchVal}%`;
        const searchSql = "(im.full_name LIKE ? OR COALESCE(im.email, '') LIKE ? OR COALESCE(u.sector_details, u.full_name, 'Institution Member') LIKE ? OR COALESCE(im.position, 'Participant') LIKE ? OR e.title LIKE ?)";
        b2aWhere.push(searchSql);
        b2aParams.push(like, like, like, like, like);
        b2bWhere.push(searchSql);
        b2bParams.push(like, like, like, like, like);
      }

      branches.push(`
        SELECT
          CONCAT('inst-', im.id) AS participant_key,
          'Institution Roster' AS registration_source,
          'institution' AS source_type,
          e.id AS event_id,
          e.title AS event_title,
          e.status AS event_status,
          e.start_at AS event_start_at,
          e.end_at AS event_end_at,
          im.full_name AS full_name,
          im.email,
          im.contact_number,
          COALESCE(u.sector_details, u.full_name, 'Institution Member') AS institution_name,
          COALESCE(im.position, 'Participant') AS position,
          im.status AS registration_status,
          (im.checked_in = 1) AS is_checked_in,
          CASE WHEN im.checked_in = 1 THEN im.checked_in_at ELSE NULL END AS checked_in_at,
          CASE WHEN im.checked_in = 1 THEN im.checked_out_at ELSE NULL END AS checked_out_at,
          im.created_at AS registered_at
        FROM institution_members im
        JOIN events e ON e.id = im.event_id
        JOIN users u ON u.id = im.institution_user_id
        WHERE ${b2aWhere.join(' AND ')}
      `);
      unionParams.push(...b2aParams);

      branches.push(`
        SELECT
          CONCAT('inst-', im.id) AS participant_key,
          'Institution Roster' AS registration_source,
          'institution' AS source_type,
          e.id AS event_id,
          e.title AS event_title,
          e.status AS event_status,
          e.start_at AS event_start_at,
          e.end_at AS event_end_at,
          im.full_name AS full_name,
          im.email,
          im.contact_number,
          COALESCE(u.sector_details, u.full_name, 'Institution Member') AS institution_name,
          COALESCE(im.position, 'Participant') AS position,
          im.status AS registration_status,
          (im.checked_in = 1) AS is_checked_in,
          CASE WHEN im.checked_in = 1 THEN im.checked_in_at ELSE NULL END AS checked_in_at,
          CASE WHEN im.checked_in = 1 THEN im.checked_out_at ELSE NULL END AS checked_out_at,
          im.created_at AS registered_at
        FROM institution_members im
        JOIN events e ON e.title = im.event_title
        JOIN users u ON u.id = im.institution_user_id
        WHERE ${b2bWhere.join(' AND ')}
      `);
      unionParams.push(...b2bParams);
    }

    const unionSql = `
      ${branches.join('\n      UNION ALL\n')}
      ORDER BY event_start_at DESC, event_id DESC, institution_name ASC, full_name ASC
    `;

    const [[eventRows], [participantRows], institutions] = await Promise.all([
      pool.query(`
        SELECT id, title, start_at, end_at, status, location
        FROM events
        ORDER BY start_at DESC, id DESC
      `),
      pool.query(unionSql, unionParams),
      fetchDistinctReportInstitutions(),
    ]);

    const events = eventRows.map((e) => {
      const schedule = resolveSchedule(e);
      return {
        id: String(e.id),
        title: e.title,
        startAt: toIso(schedule.startAt),
        endAt: toIso(schedule.endAt),
        status: e.status,
        location: e.location || '',
      };
    });

    const now = new Date();
    const nowMs = now.getTime();
    const classifiedRecords = [];

    for (const row of participantRows) {
      const { startAt, endAt, timeOutClosesAt } = resolveSchedule({ start_at: row.event_start_at, end_at: row.event_end_at });
      const isAttendanceClosed = Boolean(timeOutClosesAt && nowMs > timeOutClosesAt.getTime());
      const isCheckedIn = Boolean(row.is_checked_in);
      const checkedInAt = isCheckedIn ? toIso(row.checked_in_at) : null;
      const checkedOutAt = isCheckedIn ? toIso(row.checked_out_at) : null;
      const inMs = checkedInAt ? Date.parse(checkedInAt) : null;
      const outMs = checkedOutAt ? Date.parse(checkedOutAt) : null;
      const lateThresholdMs = startAt ? startAt.getTime() + LATE_GRACE_MIN * 60000 : null;
      const isLate = Boolean(isCheckedIn && inMs !== null && lateThresholdMs !== null && inMs > lateThresholdMs);

      let attendanceStatus;
      let attendanceStatusLabel;
      let leftEarly = false;
      let durationMinutes = null;
      let timeOutPlaceholder = null;

      if (!isCheckedIn) {
        attendanceStatus = 'not_arrived';
        attendanceStatusLabel = 'Not in Venue';
        timeOutPlaceholder = '—';
      } else if (outMs !== null) {
        attendanceStatus = 'timed_out';
        attendanceStatusLabel = 'Timed Out';
        leftEarly = Boolean(endAt && outMs < endAt.getTime());
        durationMinutes = inMs !== null ? Math.max(0, Math.round((outMs - inMs) / 60000)) : null;
        timeOutPlaceholder = null;
      } else if (isAttendanceClosed) {
        attendanceStatus = 'not_timed_out';
        attendanceStatusLabel = 'Not Timed Out';
        timeOutPlaceholder = 'Not Timed Out';
      } else {
        attendanceStatus = 'in_venue';
        attendanceStatusLabel = 'In Venue';
        const liveEndMs = endAt ? Math.min(nowMs, endAt.getTime()) : nowMs;
        durationMinutes = inMs !== null ? Math.max(0, Math.round((liveEndMs - inMs) / 60000)) : null;
        timeOutPlaceholder = '—';
      }

      if (rawAttendanceStatus && rawAttendanceStatus !== 'all' && attendanceStatus !== rawAttendanceStatus) {
        continue;
      }

      classifiedRecords.push({
        participantKey: row.participant_key,
        registrationSource: row.registration_source,
        sourceType: row.source_type,
        eventId: String(row.event_id),
        eventTitle: row.event_title,
        eventStatus: row.event_status,
        eventStartAt: toIso(startAt),
        eventEndAt: toIso(endAt),
        fullName: row.full_name,
        email: row.email || '',
        contactNumber: row.contact_number || '',
        institutionName: row.institution_name,
        position: row.position,
        registrationStatus: row.registration_status,
        isCheckedIn,
        checkedInAt,
        checkedOutAt,
        timeOutPlaceholder,
        attendanceStatus,
        attendanceStatusLabel,
        isLate,
        leftEarly,
        durationMinutes,
        registeredAt: toIso(row.registered_at),
      });
    }

    let checkedInCount = 0;
    let timedOutCount = 0;
    let inVenueCount = 0;
    let notTimedOutCount = 0;
    let notArrivedCount = 0;
    let lateCount = 0;
    let leftEarlyCount = 0;

    for (const rec of classifiedRecords) {
      if (rec.isCheckedIn) checkedInCount += 1;
      if (rec.attendanceStatus === 'timed_out') timedOutCount += 1;
      else if (rec.attendanceStatus === 'in_venue') inVenueCount += 1;
      else if (rec.attendanceStatus === 'not_timed_out') notTimedOutCount += 1;
      else if (rec.attendanceStatus === 'not_arrived') notArrivedCount += 1;
      if (rec.isLate) lateCount += 1;
      if (rec.leftEarly) leftEarlyCount += 1;
    }

    return res.json({
      success: true,
      summary: {
        totalRecords: classifiedRecords.length,
        checkedInCount,
        timedOutCount,
        inVenueCount,
        notTimedOutCount,
        notArrivedCount,
        lateCount,
        leftEarlyCount,
      },
      events,
      institutions,
      records: classifiedRecords,
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
  getEventParticipationReport,
  getEventWinnersReport,
  getAttendanceReport,
};

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

  const [[{ totalMembers }]] = await pool.query(
    "SELECT COUNT(*) AS totalMembers FROM users WHERE role='member'"
  );
  const [[{ activeMembers }]] = await pool.query(
    "SELECT COUNT(*) AS activeMembers FROM users WHERE role='member' AND status='active'"
  );
  const [[{ pendingApprovals }]] = await pool.query(
    "SELECT COUNT(*) AS pendingApprovals FROM users WHERE role='member' AND status='pending'"
  );
  const [[{ activeEvents }]] = await pool.query(
    "SELECT COUNT(*) AS activeEvents FROM events WHERE status IN ('upcoming','ongoing')"
  );
  const [[{ totalRevenue }]] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS totalRevenue FROM payments WHERE status='verified'"
  );

  const [revenueRows] = await pool.query(
    "SELECT method, COALESCE(SUM(amount), 0) AS total FROM payments WHERE status='verified' GROUP BY method"
  );
  const revenueMap = new Map(revenueRows.map((r) => [String(r.method), Number(r.total)]));

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

  const [registeredByMonth] = await pool.execute(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS cnt
     FROM users
     WHERE role='member' AND created_at >= ?
     GROUP BY ym
     ORDER BY ym`,
    [start]
  );

  const [approvedByMonth] = await pool.execute(
    `SELECT DATE_FORMAT(updated_at, '%Y-%m') AS ym, COUNT(*) AS cnt
     FROM users
     WHERE role='member' AND status='active' AND updated_at >= ?
     GROUP BY ym
     ORDER BY ym`,
    [start]
  );

  const regMap = new Map(registeredByMonth.map((r) => [r.ym, Number(r.cnt)]));
  const apprMap = new Map(approvedByMonth.map((r) => [r.ym, Number(r.cnt)]));

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

  const revenueByMethod = [
    { name: 'GCash', value: revenueMap.get('gcash') || 0 },
    { name: 'PayPal', value: revenueMap.get('paypal') || 0 },
    { name: 'PayMaya', value: revenueMap.get('paymaya') || 0 },
    { name: 'Bank Transfer', value: (revenueMap.get('bank_transfer') || 0) + (revenueMap.get('card') || 0) },
  ];

  const summary = isModerator
    ? {
      totalMembers: Number(totalMembers) || 0,
      activeMembers: Number(activeMembers) || 0,
      pendingApprovals: Number(pendingApprovals) || 0,
      activeEvents: Number(activeEvents) || 0,
      totalRevenue: Number(totalRevenue) || 0,
    }
    : {
      totalMembers: Number(totalMembers) || 0,
      activeMembers: Number(activeMembers) || 0,
      activeEvents: Number(activeEvents) || 0,
      totalRevenue: Number(totalRevenue) || 0,
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
              p.name AS partner_name, e.title AS event_title
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

module.exports = { getDashboardReport, getElectionReport, getPartnerContributionsReport };

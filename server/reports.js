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
    { name: 'Card', value: revenueMap.get('card') || 0 },
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

module.exports = { getDashboardReport };

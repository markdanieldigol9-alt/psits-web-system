const { pool } = require('./db');
function toPaymentDto(row) {
  const createdAt = row.created_at ? new Date(row.created_at) : null;
  const date = createdAt ? createdAt.toISOString().slice(0, 10) : '';

  let eventTitle = row.event_title || '';
  if (!eventTitle) {
    if (row.payment_kind === 'membership_renewal') {
      eventTitle = 'Membership Renewal';
    } else if (row.payment_kind === 'membership_registration' || row.payment_kind === 'membership') {
      eventTitle = 'Membership Registration';
    } else if (row.payment_kind === 'partner_sponsorship') {
      eventTitle = 'Partner Sponsorship';
    } else if (!row.event_id) {
      eventTitle = 'Membership Fee';
    }
  }

  return {
    id: String(row.id),
    memberId: String(row.member_id),
    memberName: row.member_name || 'Member',
    memberEmail: row.member_email || '',
    eventId: row.event_id ? String(row.event_id) : null,
    event: eventTitle,
    amount: Number(row.amount || 0),
    method: row.payment_method || row.method || 'gcash',
    paymentMethod: row.payment_method || row.method || 'gcash',
    paymentKind: row.payment_kind || (row.event_id ? 'event' : 'membership_registration'),
    referenceNumber: row.reference_number || null,
    paymentStatus: row.payment_status || (row.status === 'verified' ? 'paid' : 'pending'),
    processStatus: row.process_status || (row.status === 'verified' ? 'verified' : 'submitted'),
    verificationStatus: row.status || 'pending',
    status: row.status || 'pending',
    proofUrl: row.proof_url || null,
    rejectionReason: row.rejection_reason || null,
    verifiedBy: row.verified_by ? String(row.verified_by) : null,
    verifiedAt: row.verified_at || null,
    date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureLegacyMemberRow(userId) {
  try {
    const [tables] = await pool.execute("SHOW TABLES LIKE 'members'");
    if (!tables.length) return;

    const [rows] = await pool.execute('SELECT id FROM members WHERE id = ? LIMIT 1', [userId]);
    if (rows.length) return;

    const [userRows] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    const user = userRows[0];
    if (!user) return;

    const username = user.username || (user.email ? String(user.email).split('@')[0] : `member${userId}`);
    const memberType = user.member_type === 'school' ? 'student' : (user.member_type || 'individual');
    const sector = user.sector || 'institution';
    const joinDate = new Date().toISOString().slice(0, 10);

    await pool.execute(
      `INSERT INTO members
        (id, full_name, username, email, password, member_type, sector, sector_details, address, gender, occupation,
         representative_name, representative_name2, position, company_email, website, contact_number, membership_mode,
         terms_accepted, events, role, status, join_date)
       VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 1, 0, 'member', ?, ?)`,
      [
        userId,
        user.full_name || 'Member',
        username,
        user.email || `${username}@example.com`,
        user.password_hash || 'imported',
        memberType,
        sector,
        user.sector_details || null,
        user.address || null,
        user.gender || null,
        user.occupation || null,
        user.representative_name || null,
        user.representative_name_2 || null,
        user.position || null,
        user.company_email || null,
        user.website || null,
        user.contact_number || '',
        user.status || 'active',
        joinDate,
      ]
    );
  } catch {
    // best-effort; do not block payment
  }
}

async function listPayments(req, res) {
  const status = req.query.status ? String(req.query.status) : null; // legacy verification status
  const paymentStatus = req.query.paymentStatus ? String(req.query.paymentStatus) : null;
  const processStatus = req.query.processStatus ? String(req.query.processStatus) : null;
  const method = req.query.method ? String(req.query.method) : null;
  const eventId = req.query.eventId ? Number(req.query.eventId) : null;
  const memberId = req.query.memberId ? Number(req.query.memberId) : null;
  const where = [];
  const params = [];

  if (req.user?.role === 'member') {
    where.push('p.member_id = ?');
    params.push(req.user.id);
  }

  if (memberId && Number.isFinite(memberId) && req.user?.role !== 'member') {
    where.push('p.member_id = ?');
    params.push(memberId);
  }

  if (eventId && Number.isFinite(eventId)) {
    where.push('p.event_id = ?');
    params.push(eventId);
  }

  if (status && status !== 'all' && ['pending', 'verified', 'rejected'].includes(status)) {
    where.push('p.status = ?');
    params.push(status);
  }

  if (paymentStatus && paymentStatus !== 'all' && ['unpaid', 'pending', 'paid', 'rejected', 'refunded'].includes(paymentStatus)) {
    where.push('p.payment_status = ?');
    params.push(paymentStatus);
  }

  if (processStatus && processStatus !== 'all' && ['submitted', 'under_review', 'verified', 'rejected', 'completed'].includes(processStatus)) {
    where.push('p.process_status = ?');
    params.push(processStatus);
  }

  if (method && method !== 'all') {
    where.push('(p.payment_method = ? OR p.method = ?)');
    params.push(method, method);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT p.*, u.full_name AS member_name, u.email AS member_email, e.title AS event_title
     FROM payments p
     LEFT JOIN users u ON u.id = p.member_id
     LEFT JOIN events e ON e.id = p.event_id
     ${sqlWhere}
     ORDER BY p.created_at DESC`,
    params
  );

  return res.json({ success: true, payments: rows.map(toPaymentDto) });
}

async function createPayment(req, res) {
  const body = req.body || {};
  const eventId = body.eventId ? Number(body.eventId) : null;
  let amount = Number(body.amount || 0);
  const method = String(body.paymentMethod || body.method || '').toLowerCase();
  const referenceNumber = body.referenceNumber ? String(body.referenceNumber).trim().slice(0, 64) : null;
  const paymentKind = body.paymentKind ? String(body.paymentKind).trim().toLowerCase() : 'event';
  const proofUrl = body.proofUrl ? String(body.proofUrl).trim() : null;

  if (!['gcash', 'paymaya', 'bank_transfer', 'cash_officer', 'paymongo', 'paypal', 'card'].includes(method)) {
    return res.status(400).json({ success: false, message: 'Invalid payment method.' });
  }

  let eventFee = null;
  if (eventId && Number.isFinite(eventId)) {
    const [eventRows] = await pool.execute(
      'SELECT id, registration_fee FROM events WHERE id = ? LIMIT 1',
      [eventId]
    );
    if (!eventRows.length) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }
    eventFee = Number(eventRows[0].registration_fee || 0);
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: eventFee !== null && eventFee === 0 ? 'Event fee is 0. No payment required.' : 'Amount must be greater than 0.',
    });
  }

  if (!proofUrl) {
    return res.status(400).json({ success: false, message: 'Transaction proof image is required for verification.' });
  }

  const memberId = req.user?.id;
  if (!memberId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

  if (req.user?.status === 'suspended') {
    return res.status(403).json({
      success: false,
      message: 'Suspended accounts cannot submit payments or renewal requests. Please submit a reactivation appeal first.',
    });
  }

  if (eventId && Number.isFinite(eventId)) {
    const [paymentRows] = await pool.execute(
      "SELECT SUM(amount) AS total_paid FROM payments WHERE event_id = ? AND member_id = ? AND status = 'verified'",
      [eventId, memberId]
    );
    const totalPaid = Number(paymentRows[0]?.total_paid || 0);
    const remainingBalance = eventFee - totalPaid;

    if (amount > remainingBalance + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds the remaining balance of PHP ${remainingBalance.toFixed(2)}.`,
      });
    }
  }

  if (!['event', 'membership_renewal', 'membership_registration', 'membership', 'partner_sponsorship'].includes(paymentKind)) {
    return res.status(400).json({ success: false, message: 'Invalid payment kind.' });
  }

  // Ensure legacy members table row exists for FK compatibility.
  await ensureLegacyMemberRow(memberId);

  // Legacy schema compatibility: build columns dynamically.
  const [columnRows] = await pool.execute('SHOW COLUMNS FROM payments');
  const columnSet = new Set(columnRows.map((row) => String(row.Field)));

  const [userRows] = await pool.execute(
    'SELECT full_name FROM users WHERE id = ? LIMIT 1',
    [memberId]
  );
  const memberName = userRows[0]?.full_name || '';

  let eventTitle = '';
  if (eventId && Number.isFinite(eventId)) {
    const [eventRows] = await pool.execute('SELECT title FROM events WHERE id = ? LIMIT 1', [eventId]);
    eventTitle = eventRows[0]?.title || '';
  }

  const columns = [];
  const values = [];
  const add = (col, val) => {
    if (columnSet.has(col)) {
      columns.push(col);
      values.push(val);
    }
  };

  add('event_id', eventId && Number.isFinite(eventId) ? eventId : null);
  add('member_id', memberId);
  add('member_name', memberName);
  add('event', eventTitle);
  add('amount', amount);
  add('payment_kind', paymentKind);
  add('payment_method', method);
  add('reference_number', referenceNumber);
  add('method', method); // legacy
  add('proof_url', proofUrl);
  add('status', 'pending');
  add('payment_status', 'pending');
  add('process_status', 'submitted');
  if (columnSet.has('date')) {
    const today = new Date().toISOString().slice(0, 10);
    add('date', today);
  }

  const placeholders = columns.map(() => '?').join(', ');
  const columnSql = columns.map((c) => `\`${c}\``).join(', ');
  const [result] = await pool.execute(
    `INSERT INTO payments (${columnSql}) VALUES (${placeholders})`,
    values
  );

  // Notify Admins and Officers about the renewal or payment submission
  try {
    const [adminOfficerRows] = await pool.query(
      "SELECT id FROM users WHERE role IN ('admin', 'super_admin', 'officer') AND status = 'active'"
    );

    if (adminOfficerRows.length > 0) {
      const isRenewal = paymentKind === 'membership_renewal';
      const notifTitle = isRenewal
        ? `🔄 Membership Renewal Request - ${memberName || 'Member'}`
        : `💳 Payment Submitted - ${memberName || 'Member'}`;

      const notifMsg = isRenewal
        ? `Member ${memberName || 'Member'} (${req.user?.email || 'N/A'}) submitted a membership renewal request of ₱${Number(amount).toLocaleString()} (${method ? method.toUpperCase() : 'GCash'}, Ref: ${referenceNumber || 'N/A'}). Please review and verify.`
        : `Member ${memberName || 'Member'} submitted a payment of ₱${Number(amount).toLocaleString()} for ${eventTitle || 'Event / Membership'} (Ref: ${referenceNumber || 'N/A'}).`;

      const notifMeta = JSON.stringify({
        kind: isRenewal ? 'renewal_request' : 'payment_submission',
        paymentId: String(result.insertId),
        memberId: String(memberId),
        memberName: memberName || 'Member',
        memberEmail: req.user?.email || null,
        amount: Number(amount),
        method,
        referenceNumber,
        proofUrl,
        url: '/payments',
      });

      const values = adminOfficerRows.map((a) => [
        a.id,
        notifTitle,
        notifMsg,
        'warning',
        0,
        notifMeta,
      ]);

      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const flatParams = values.flat();
      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type, is_read, meta_json)
         VALUES ${placeholders}`,
        flatParams
      );
    }
  } catch (notifErr) {
    console.warn('[Payments] Could not insert admin renewal notification:', notifErr.message);
  }

  const [rows] = await pool.execute(
    `SELECT p.*, u.full_name AS member_name, e.title AS event_title
     FROM payments p
     JOIN users u ON u.id = p.member_id
     LEFT JOIN events e ON e.id = p.event_id
     WHERE p.id = ? LIMIT 1`,
    [result.insertId]
  );
  return res.status(201).json({ success: true, payment: toPaymentDto(rows[0]) });
}

async function verifyPayment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const body = req.body || {};
  const status = String(body.status || '').toLowerCase();
  const allowed = ['verified', 'rejected'];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });

  const rejectionReason = status === 'rejected' ? (body.rejectionReason ? String(body.rejectionReason).trim() : '') : null;

  const [beforeRows] = await pool.execute(
    'SELECT id, status, member_id, payment_kind FROM payments WHERE id = ? LIMIT 1',
    [id]
  );
  if (!beforeRows.length) return res.status(404).json({ success: false, message: 'Payment not found.' });
  const oldStatus = String(beforeRows[0].status || '');
  const paymentKind = String(beforeRows[0].payment_kind || 'event');
  const memberId = beforeRows[0].member_id ? Number(beforeRows[0].member_id) : null;

  const [columnRows] = await pool.execute('SHOW COLUMNS FROM payments');
  const columnSet = new Set(columnRows.map((row) => String(row.Field)));

  const sets = ['status = ?', 'verified_by = ?', 'rejection_reason = ?'];
  const params = [status, req.user?.id || null, rejectionReason];
  if (columnSet.has('verified_at')) {
    sets.push('verified_at = NOW()');
  }

  if (columnSet.has('payment_status')) {
    sets.push('payment_status = ?');
    params.push(status === 'verified' ? 'paid' : 'rejected');
  }
  if (columnSet.has('process_status')) {
    sets.push('process_status = ?');
    params.push(status === 'verified' ? 'verified' : 'rejected');
  }

  params.push(id);
  await pool.execute(
    `UPDATE payments
     SET ${sets.join(', ')}
     WHERE id = ?`,
    params
  );

  // If this is a verified membership payment (registration, renewal, or membership fee), activate member & extend validity.
  if (status === 'verified' && ['membership_renewal', 'membership_registration', 'membership'].includes(paymentKind) && memberId && Number.isFinite(memberId)) {
    try {
      const [uRows] = await pool.execute(
        `SELECT id, status, member_type, membership_started_at, membership_expires_at
         FROM users
         WHERE id = ? AND role = 'member'
         LIMIT 1`,
        [memberId]
      );
      if (uRows.length) {
        await pool.execute(
          `UPDATE users
           SET status = 'active',
               status_updated_at = NOW(),
               status_updated_by = ?,
               membership_started_at = COALESCE(membership_started_at, NOW()),
               membership_expires_at =
                 CASE
                   WHEN membership_expires_at IS NULL THEN DATE_ADD(NOW(), INTERVAL 1 YEAR)
                   WHEN membership_expires_at > NOW() THEN DATE_ADD(membership_expires_at, INTERVAL 1 YEAR)
                   ELSE DATE_ADD(NOW(), INTERVAL 1 YEAR)
                 END
           WHERE id = ? AND role = 'member'`,
          [req.user?.id || null, memberId]
        );
      }
    } catch (memErr) {
      console.error('Membership payment verification user update error:', memErr);
    }
  }

  if (oldStatus !== status) {
    try {
      await pool.execute(
        `INSERT INTO payment_status_logs (payment_id, old_status, new_status, remarks, changed_by)
         VALUES (?, ?, ?, ?, ?)`,
        [id, oldStatus, status, rejectionReason || null, req.user?.id || null]
      );
    } catch {
      // best effort
    }
  }

  const [rows] = await pool.execute(
    `SELECT p.*, u.full_name AS member_name, e.title AS event_title
     FROM payments p
     JOIN users u ON u.id = p.member_id
     LEFT JOIN events e ON e.id = p.event_id
     WHERE p.id = ? LIMIT 1`,
    [id]
  );
  return res.json({ success: true, payment: toPaymentDto(rows[0]) });
}

async function getPaymentStatusLogs(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid payment id.' });

  try {
    const [rows] = await pool.execute(
      `SELECT l.*, u.full_name AS changed_by_name
       FROM payment_status_logs l
       LEFT JOIN users u ON u.id = l.changed_by
       WHERE l.payment_id = ?
       ORDER BY l.created_at ASC`,
      [id]
    );

    const logs = rows.map((r) => ({
      id: String(r.id),
      paymentId: String(r.payment_id),
      oldStatus: r.old_status,
      newStatus: r.new_status,
      remarks: r.remarks,
      changedByName: r.changed_by_name || 'System',
      createdAt: r.created_at,
    }));

    return res.json({ success: true, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch payment status logs.', error: err.message });
  }
}

module.exports = { listPayments, createPayment, verifyPayment, getPaymentStatusLogs };

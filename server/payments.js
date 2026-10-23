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
    } else if (row.payment_kind === 'institution_batch_registration') {
      eventTitle = row.event || 'Institution Batch Member Registration';
    } else if (row.payment_kind === 'institution_partial_payment') {
      eventTitle = row.event || 'Institution Partial Payment';
    } else if (!row.event_id) {
      eventTitle = 'Membership Fee';
    }
  }

  let billingBreakdown = null;
  if (row.billing_breakdown_json) {
    try {
      billingBreakdown = typeof row.billing_breakdown_json === 'string'
        ? JSON.parse(row.billing_breakdown_json)
        : row.billing_breakdown_json;
    } catch {
      billingBreakdown = null;
    }
  }

  const institutionName = row.institution_name
    || (billingBreakdown && billingBreakdown.institutionName)
    || (row.payment_kind && String(row.payment_kind).includes('institution') ? row.member_name : null)
    || (row.member_type === 'institution' ? row.member_name : null)
    || null;

  return {
    id: String(row.id),
    memberId: String(row.member_id),
    memberName: row.member_name || 'Member',
    memberEmail: row.member_email || '',
    institutionName,
    memberType: row.member_type || null,
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
    totalHeads: row.total_heads !== null && row.total_heads !== undefined ? Number(row.total_heads) : null,
    ratePerHead: row.rate_per_head !== null && row.rate_per_head !== undefined ? Number(row.rate_per_head) : 250,
    freeSlots: row.free_slots !== null && row.free_slots !== undefined ? Number(row.free_slots) : 2,
    grossAmount: row.gross_amount !== null && row.gross_amount !== undefined ? Number(row.gross_amount) : null,
    discountAmount: row.discount_amount !== null && row.discount_amount !== undefined ? Number(row.discount_amount) : null,
    netAmount: row.net_amount !== null && row.net_amount !== undefined ? Number(row.net_amount) : null,
    partialAmount: row.partial_amount !== null && row.partial_amount !== undefined ? Number(row.partial_amount) : null,
    remainingBalance: row.remaining_balance !== null && row.remaining_balance !== undefined ? Number(row.remaining_balance) : null,
    isPartial: Boolean(row.is_partial),
    billingBreakdown,
    date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureInstitutionBatchPayments() {
  try {
    const [tables] = await pool.execute("SHOW TABLES LIKE 'institution_members'");
    if (!tables.length) return;

    const [instGroups] = await pool.execute(`
      SELECT im.institution_user_id,
             COUNT(*) AS total_heads,
             MIN(im.created_at) AS first_created,
             COALESCE(u.sector_details, u.full_name, 'Institution') AS institution_name,
             COALESCE(u.email, '') AS institution_email
      FROM institution_members im
      LEFT JOIN users u ON u.id = im.institution_user_id
      GROUP BY im.institution_user_id, u.sector_details, u.full_name, u.email
    `);

    if (!instGroups.length) return;

    const [columns] = await pool.execute('SHOW COLUMNS FROM payments');
    const colSet = new Set(columns.map((c) => String(c.Field)));

    for (const inst of instGroups) {
      const instUserId = inst.institution_user_id;
      if (!instUserId) continue;

      const instName = inst.institution_name || `Institution #${instUserId}`;
      const heads = Number(inst.total_heads || 0);
      const rate = 250;
      const gross = heads * rate;
      const free = heads > 0 ? Math.min(heads, 2) : 0;
      const discount = free * rate;
      const net = Math.max(0, gross - discount);

      const [existingPayments] = await pool.execute(
        `SELECT id, amount, payment_kind, status, payment_status, is_partial, partial_amount, remaining_balance
         FROM payments
         WHERE member_id = ?`,
        [instUserId]
      );

      const batchPayment = existingPayments.find((p) => p.payment_kind === 'institution_batch_registration');
      const partialPayments = existingPayments.filter((p) => p.payment_kind === 'institution_partial_payment');
      const totalPartialPaid = partialPayments.reduce((s, p) => {
        const isVerifiedOrPaid = p.status === 'verified' || p.payment_status === 'paid' || p.payment_status === 'partial';
        return isVerifiedOrPaid ? s + (Number(p.amount || p.partial_amount) || 0) : s;
      }, 0);

      const billingBreakdown = {
        institutionName: instName,
        institutionEmail: inst.institution_email || '',
        totalHeads: heads,
        ratePerHead: rate,
        grossAmount: gross,
        freeSlots: free,
        discountAmount: discount,
        netAmount: net,
        totalPaid: totalPartialPaid,
      };

      if (!batchPayment) {
        const paidAmount = totalPartialPaid;
        const remaining = Math.max(0, net - paidAmount);
        const isPartial = remaining > 0 && paidAmount > 0;
        const status = (paidAmount >= net && net > 0) ? 'verified' : (paidAmount > 0 ? 'verified' : 'pending');
        const paymentStatus = (remaining === 0 && net > 0) ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');
        const processStatus = (remaining === 0 && net > 0) ? 'verified' : (paidAmount > 0 ? 'verified' : 'submitted');

        const refNum = `BATCH-REG-${instUserId}`;
        const createdAt = inst.first_created || new Date();

        const insertCols = [];
        const insertVals = [];
        const add = (col, val) => {
          if (colSet.has(col)) {
            insertCols.push('`' + col + '`');
            insertVals.push(val);
          }
        };

        add('member_id', instUserId);
        add('member_name', instName);
        add('event', `Institution Batch Member Registration (${heads} Members)`);
        add('amount', paidAmount > 0 ? paidAmount : net);
        add('payment_kind', 'institution_batch_registration');
        add('payment_method', 'through_officer');
        add('method', 'through_officer');
        add('reference_number', refNum);
        add('status', status);
        add('payment_status', paymentStatus);
        add('process_status', processStatus);
        add('total_heads', heads);
        add('rate_per_head', rate);
        add('free_slots', free);
        add('gross_amount', gross);
        add('discount_amount', discount);
        add('net_amount', net);
        add('partial_amount', paidAmount > 0 ? paidAmount : null);
        add('remaining_balance', remaining);
        add('is_partial', isPartial ? 1 : 0);
        add('billing_breakdown_json', JSON.stringify(billingBreakdown));
        add('created_at', createdAt);
        add('updated_at', new Date());

        const sql = `INSERT INTO payments (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')})`;
        await pool.execute(sql, insertVals);
      } else {
        const currentBatchPaid = (Number(batchPayment.partial_amount) || (batchPayment.status === 'verified' && !batchPayment.is_partial ? Number(batchPayment.amount) : 0));
        const effectivePaid = Math.max(totalPartialPaid, currentBatchPaid);
        const remaining = Math.max(0, net - effectivePaid);
        const isPartial = remaining > 0 && effectivePaid > 0;
        const status = (effectivePaid >= net && net > 0) ? 'verified' : (batchPayment.status === 'verified' ? 'verified' : (effectivePaid > 0 ? 'verified' : 'pending'));
        const paymentStatus = (remaining === 0 && net > 0) ? 'paid' : (effectivePaid > 0 ? 'partial' : batchPayment.payment_status || 'unpaid');
        const processStatus = (remaining === 0 && net > 0) ? 'verified' : (effectivePaid > 0 ? 'verified' : batchPayment.process_status || 'submitted');

        const updates = [];
        const updateParams = [];

        if (colSet.has('member_name')) { updates.push('member_name = ?'); updateParams.push(instName); }
        if (colSet.has('event')) { updates.push('event = ?'); updateParams.push(`Institution Batch Member Registration (${heads} Members)`); }
        if (colSet.has('total_heads')) { updates.push('total_heads = ?'); updateParams.push(heads); }
        if (colSet.has('gross_amount')) { updates.push('gross_amount = ?'); updateParams.push(gross); }
        if (colSet.has('discount_amount')) { updates.push('discount_amount = ?'); updateParams.push(discount); }
        if (colSet.has('net_amount')) { updates.push('net_amount = ?'); updateParams.push(net); }
        if (colSet.has('remaining_balance')) { updates.push('remaining_balance = ?'); updateParams.push(remaining); }
        if (colSet.has('is_partial')) { updates.push('is_partial = ?'); updateParams.push(isPartial ? 1 : 0); }
        if (colSet.has('partial_amount') && effectivePaid > 0) { updates.push('partial_amount = ?'); updateParams.push(effectivePaid); }
        if (colSet.has('status')) { updates.push('status = ?'); updateParams.push(status); }
        if (colSet.has('payment_status')) { updates.push('payment_status = ?'); updateParams.push(paymentStatus); }
        if (colSet.has('process_status')) { updates.push('process_status = ?'); updateParams.push(processStatus); }
        if (colSet.has('billing_breakdown_json')) { updates.push('billing_breakdown_json = ?'); updateParams.push(JSON.stringify(billingBreakdown)); }

        if (updates.length > 0) {
          updateParams.push(batchPayment.id);
          await pool.execute(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`, updateParams);
        }
      }
    }
  } catch (err) {
    console.error('ensureInstitutionBatchPayments error:', err);
  }
}

async function listPayments(req, res) {
  await ensureInstitutionBatchPayments();
  const status = req.query.status ? String(req.query.status) : null; // legacy verification status
  const paymentStatus = req.query.paymentStatus ? String(req.query.paymentStatus) : null;
  const processStatus = req.query.processStatus ? String(req.query.processStatus) : null;
  const method = req.query.method ? String(req.query.method) : null;
  const eventId = req.query.eventId ? Number(req.query.eventId) : null;
  const memberId = req.query.memberId ? Number(req.query.memberId) : null;
  const category = req.query.category ? String(req.query.category).toLowerCase() : null;
  const paymentKind = req.query.paymentKind ? String(req.query.paymentKind).toLowerCase() : null;
  const search = req.query.search ? String(req.query.search).trim() : null;
  const where = [];
  const params = [];

  const userRole = req.user?.role;
  const userMemberType = req.user?.member_type;
  const userSector = req.user?.sector;

  const isAdminOrOfficer = ['super_admin', 'admin', 'officer'].includes(userRole);
  const isInstitution = !isAdminOrOfficer && (
    userRole === 'institution' ||
    userMemberType === 'institution' ||
    (userSector === 'institution' && userMemberType !== 'individual')
  );
  const isIndustry = !isAdminOrOfficer && !isInstitution && (
    userRole === 'industry' ||
    userMemberType === 'industry' ||
    userSector === 'industry'
  );
  const isIndividual = !isAdminOrOfficer && !isInstitution && !isIndustry;

  if (isAdminOrOfficer) {
    // Admin and Officer: All transactions across all members, institutions, and industry partners are visible
  } else if (isInstitution) {
    // Institutional Member: Only their institution's transactions and delegate payments are visible
    const instName = req.user.sector_details || req.user.full_name || '';
    where.push(`(
      p.member_id = ?
      OR u.institution_owner_id = ?
      OR (u.sector_details IS NOT NULL AND LOWER(u.sector_details) = LOWER(?))
      OR u.email IN (SELECT email FROM institution_members WHERE institution_user_id = ?)
      OR (p.payment_kind LIKE '%institution%' AND (p.member_id = ? OR p.member_name LIKE ?))
    )`);
    params.push(req.user.id, req.user.id, instName, req.user.id, req.user.id, `%${instName}%`);
  } else if (isIndustry) {
    // Industry Partner: Only their corporate sponsorships and partner transactions are visible
    const compName = req.user.sector_details || req.user.full_name || '';
    where.push(`(
      p.member_id = ?
      OR (p.payment_kind = 'partner_sponsorship' AND (p.member_id = ? OR p.member_name LIKE ?))
      OR (u.member_type = 'industry' AND p.member_id = ?)
      OR (u.sector = 'industry' AND p.member_id = ?)
    )`);
    params.push(req.user.id, req.user.id, `%${compName}%`, req.user.id, req.user.id);
  } else if (isIndividual) {
    // Individual Member: Only their own personal transactions are visible
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

  if (paymentStatus && paymentStatus !== 'all' && ['unpaid', 'pending', 'paid', 'partial', 'rejected', 'refunded'].includes(paymentStatus)) {
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

  if (paymentKind && paymentKind !== 'all') {
    where.push('p.payment_kind = ?');
    params.push(paymentKind);
  }

  if (category && category !== 'all') {
    if (category === 'institution') {
      where.push("(p.payment_kind IN ('institution_batch_registration', 'institution_partial_payment') OR u.member_type = 'institution' OR p.payment_kind LIKE '%institution%' OR p.event LIKE '%institution%')");
    } else if (category === 'individual' || category === 'membership') {
      where.push("(p.payment_kind IN ('membership_registration', 'membership_renewal', 'membership') AND p.payment_kind NOT IN ('institution_batch_registration', 'institution_partial_payment') AND (u.member_type != 'institution' OR u.member_type IS NULL))");
    } else if (category === 'event') {
      where.push("(p.payment_kind = 'event' OR p.event_id IS NOT NULL)");
    } else if (category === 'sponsorship') {
      where.push("p.payment_kind = 'partner_sponsorship'");
    }
  }

  if (search) {
    const searchWildcard = `%${search}%`;
    where.push('(p.reference_number LIKE ? OR p.event LIKE ? OR p.member_name LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR u.sector_details LIKE ? OR inst_owner.sector_details LIKE ? OR inst_owner.full_name LIKE ?)');
    params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT p.id, p.member_id, p.event_id, p.event, p.amount, p.payment_method, p.method,
            p.payment_kind, p.reference_number, p.payment_status, p.process_status, p.status,
            p.proof_url, p.rejection_reason, p.verified_by, p.verified_at, p.total_heads,
            p.rate_per_head, p.free_slots, p.gross_amount, p.discount_amount, p.net_amount,
            p.partial_amount, p.remaining_balance, p.is_partial, p.billing_breakdown_json,
            p.created_at, p.updated_at,
            COALESCE(u.full_name, p.member_name, 'Member') AS member_name,
            u.email AS member_email,
            COALESCE(
              u.sector_details,
              inst_owner.sector_details,
              inst_owner.full_name,
              CASE WHEN u.member_type = 'institution' THEN u.full_name END,
              CASE WHEN p.payment_kind LIKE '%institution%' THEN p.member_name END,
              NULL
            ) AS institution_name,
            u.member_type,
            e.title AS event_title
     FROM payments p
     LEFT JOIN users u ON u.id = p.member_id
     LEFT JOIN users inst_owner ON inst_owner.id = u.institution_owner_id
     LEFT JOIN events e ON e.id = p.event_id
     ${sqlWhere}
     ORDER BY p.created_at DESC`,
    params
  );

  return res.json({ success: true, payments: rows.map(toPaymentDto) });
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

async function createPayment(req, res) {
  const body = req.body || {};
  const eventId = body.eventId ? Number(body.eventId) : null;
  let amount = Number(body.amount || 0);
  const method = String(body.paymentMethod || body.method || '').toLowerCase();
  const referenceNumber = body.referenceNumber ? String(body.referenceNumber).trim().slice(0, 64) : null;
  const paymentKind = body.paymentKind ? String(body.paymentKind).trim().toLowerCase() : 'event';
  const proofUrl = body.proofUrl ? String(body.proofUrl).trim() : null;

  if (!['gcash', 'paymaya', 'bank_transfer', 'cash_officer', 'through_officer', 'cheque', 'paymongo', 'paypal', 'card'].includes(method)) {
    return res.status(400).json({ success: false, message: 'Invalid payment method.' });
  }

  if (method === 'gcash' && !referenceNumber) {
    return res.status(400).json({ success: false, message: 'Reference number is required for GCash payments.' });
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

  const canManage = ['admin', 'super_admin', 'officer'].includes(req.user?.role);
  const targetMemberId = (canManage && body.memberId) ? Number(body.memberId) : req.user?.id;
  if (!targetMemberId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

  if (!proofUrl) {
    const isOfficerRecording = canManage && (Boolean(referenceNumber) || ['cash_officer', 'through_officer', 'cheque'].includes(method));
    if (!isOfficerRecording) {
      const proofMsg = (method === 'through_officer' || method === 'cash_officer')
        ? 'Official Receipt (OR) image is required for verification.'
        : 'Transaction receipt image is required for verification.';
      return res.status(400).json({ success: false, message: proofMsg });
    }
  }

  if (req.user?.status === 'suspended') {
    return res.status(403).json({
      success: false,
      message: 'Suspended accounts cannot submit payments or renewal requests. Please submit a reactivation appeal first.',
    });
  }

  if (eventId && Number.isFinite(eventId)) {
    const [paymentRows] = await pool.execute(
      "SELECT SUM(amount) AS total_paid FROM payments WHERE event_id = ? AND member_id = ? AND status = 'verified'",
      [eventId, targetMemberId]
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

  if (!['event', 'membership_renewal', 'membership_registration', 'membership', 'partner_sponsorship', 'institution_batch_registration', 'institution_partial_payment'].includes(paymentKind)) {
    return res.status(400).json({ success: false, message: 'Invalid payment kind.' });
  }

  // Ensure legacy members table row exists for FK compatibility.
  await ensureLegacyMemberRow(targetMemberId);

  // Legacy schema compatibility: build columns dynamically.
  const [columnRows] = await pool.execute('SHOW COLUMNS FROM payments');
  const columnSet = new Set(columnRows.map((row) => String(row.Field)));

  const [userRows] = await pool.execute(
    'SELECT full_name FROM users WHERE id = ? LIMIT 1',
    [targetMemberId]
  );
  const memberName = userRows[0]?.full_name || body.memberName || '';

  let eventTitle = '';
  if (eventId && Number.isFinite(eventId)) {
    const [eventRows] = await pool.execute('SELECT title FROM events WHERE id = ? LIMIT 1', [eventId]);
    eventTitle = eventRows[0]?.title || '';
  } else if ((paymentKind === 'institution_batch_registration' || paymentKind === 'institution_partial_payment') && body.eventTitle) {
    eventTitle = String(body.eventTitle).trim();
  } else if (paymentKind === 'institution_partial_payment') {
    eventTitle = body.institutionName ? `Institution Payment: ${body.institutionName}` : 'Institution Partial Payment';
  } else if (paymentKind === 'institution_batch_registration') {
    eventTitle = body.institutionName ? `Batch Registration: ${body.institutionName}` : 'Institution Batch Member Registration';
  }

  const isDirectlyVerified = canManage && (body.verified === true || body.isDirectlyVerified === true);
  const initialStatus = isDirectlyVerified ? 'verified' : 'pending';
  const initialPaymentStatus = body.isPartial ? 'partial' : (isDirectlyVerified ? 'paid' : 'pending');
  const initialProcessStatus = isDirectlyVerified ? 'verified' : 'submitted';

  const columns = [];
  const values = [];
  const add = (col, val) => {
    if (columnSet.has(col)) {
      columns.push(col);
      values.push(val);
    }
  };

  add('event_id', eventId && Number.isFinite(eventId) ? eventId : null);
  add('member_id', targetMemberId);
  add('member_name', memberName);
  add('event', eventTitle);
  add('amount', amount);
  add('payment_kind', paymentKind);
  add('payment_method', method);
  add('reference_number', referenceNumber);
  add('method', method); // legacy
  add('proof_url', proofUrl);
  add('status', initialStatus);
  add('payment_status', initialPaymentStatus);
  add('process_status', initialProcessStatus);

  if (isDirectlyVerified) {
    add('verified_by', req.user.id);
    add('verified_at', new Date());
  }

  // Billing calculation fields
  if (body.totalHeads !== undefined && body.totalHeads !== null) add('total_heads', Number(body.totalHeads));
  if (body.ratePerHead !== undefined && body.ratePerHead !== null) add('rate_per_head', Number(body.ratePerHead));
  if (body.freeSlots !== undefined && body.freeSlots !== null) add('free_slots', Number(body.freeSlots));
  if (body.grossAmount !== undefined && body.grossAmount !== null) add('gross_amount', Number(body.grossAmount));
  if (body.discountAmount !== undefined && body.discountAmount !== null) add('discount_amount', Number(body.discountAmount));
  if (body.netAmount !== undefined && body.netAmount !== null) add('net_amount', Number(body.netAmount));
  if (body.partialAmount !== undefined && body.partialAmount !== null) add('partial_amount', Number(body.partialAmount));
  if (body.remainingBalance !== undefined && body.remainingBalance !== null) add('remaining_balance', Number(body.remainingBalance));
  if (body.isPartial !== undefined) add('is_partial', body.isPartial ? 1 : 0);

  // Billing breakdown and institution name persistence
  let breakdownObj = null;
  if (body.billingBreakdown) {
    try {
      breakdownObj = typeof body.billingBreakdown === 'string'
        ? JSON.parse(body.billingBreakdown)
        : { ...body.billingBreakdown };
    } catch {
      breakdownObj = {};
    }
  } else if (body.institutionName) {
    breakdownObj = {};
  }
  if (body.institutionName && breakdownObj) {
    breakdownObj.institutionName = body.institutionName;
  }
  if (breakdownObj) {
    add('billing_breakdown_json', JSON.stringify(breakdownObj));
  }

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

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [beforeRows] = await conn.execute(
      'SELECT id, amount, status, member_id, payment_kind FROM payments WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!beforeRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }
    const paymentRow = beforeRows[0];
    const oldStatus = String(paymentRow.status || '');
    const paymentKind = String(paymentRow.payment_kind || 'event');
    const memberId = paymentRow.member_id ? Number(paymentRow.member_id) : null;
    const amount = Number(paymentRow.amount || 0);

    const [columnRows] = await conn.execute('SHOW COLUMNS FROM payments');
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
    await conn.execute(
      `UPDATE payments
       SET ${sets.join(', ')}
       WHERE id = ?`,
      params
    );

    // If this is a verified membership payment (registration, renewal, or membership fee), activate member & extend validity atomically
    if (status === 'verified' && ['membership_renewal', 'membership_registration', 'membership'].includes(paymentKind) && memberId && Number.isFinite(memberId)) {
      const [uRows] = await conn.execute(
        `SELECT id, status, member_type, membership_started_at, membership_expires_at
         FROM users
         WHERE id = ? AND role = 'member'
         LIMIT 1
         FOR UPDATE`,
        [memberId]
      );
      if (uRows.length) {
        await conn.execute(
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
    }

    if (oldStatus !== status) {
      await conn.execute(
        `INSERT INTO payment_status_logs (payment_id, old_status, new_status, remarks, changed_by)
         VALUES (?, ?, ?, ?, ?)`,
        [id, oldStatus, status, rejectionReason || null, req.user?.id || null]
      );
    }

    // In-app notification to member on status change
    if (memberId && Number.isFinite(memberId) && oldStatus !== status) {
      try {
        const notifTitle = status === 'verified' ? 'Payment Verified' : 'Payment Rejected';
        const formattedAmount = amount > 0 ? `₱${amount.toLocaleString()}` : 'dues';
        const notifMessage = status === 'verified'
          ? `Your payment of ${formattedAmount} has been verified and confirmed.`
          : `Your payment of ${formattedAmount} was rejected: ${rejectionReason || 'Please review your receipt and resubmit.'}`;
        await conn.execute(
          `INSERT INTO notifications (user_id, title, message, type, is_read)
           VALUES (?, ?, ?, ?, 0)`,
          [memberId, notifTitle, notifMessage, status === 'verified' ? 'payment' : 'warning']
        );
      } catch {
        // Notification is non-blocking for payment transaction
      }
    }

    await conn.commit();

    const [rows] = await pool.execute(
      `SELECT p.*, u.full_name AS member_name, e.title AS event_title
       FROM payments p
       JOIN users u ON u.id = p.member_id
       LEFT JOIN events e ON e.id = p.event_id
       WHERE p.id = ? LIMIT 1`,
      [id]
    );
    return res.json({ success: true, payment: toPaymentDto(rows[0]) });
  } catch (err) {
    await conn.rollback();
    console.error('verifyPayment transaction error:', err);
    return res.status(500).json({ success: false, message: 'Failed to verify payment.', error: err.message });
  } finally {
    conn.release();
  }
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

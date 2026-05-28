const { pool } = require('./db');
const { isDbError } = require('./isDbError');
const { sendRegistrationApprovedEmail } = require('./mailer');
const PASSWORD_RULES = {
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSpecial: true,
};

function json(res, status, body) {
  res.status(status).json(body);
}

function formatDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toMemberDto(row) {
  const birthdate = formatDateOnly(row.birthdate);

  return {
    id: String(row.id),
    fullName: row.full_name,
    email: row.email,
    sector: row.sector,
    memberType: row.member_type === 'school' ? 'student' : row.member_type,
    contactNumber: row.contact_number,
    birthdate,
    address: row.address,
    gender: row.gender,
    occupation: row.occupation,
    representativeName: row.representative_name,
    representativeName2: row.representative_name_2,
    position: row.position,
    representativePosition2: row.representative_position_2,
    companyEmail: row.company_email,
    website: row.website,
    membershipMode: row.membership_mode,
    status: row.status,
    bannedReason: row.banned_reason || null,
    suspendedReason: row.suspended_reason || null,
    archivedAt: row.archived_at || null,
    statusUpdatedAt: row.status_updated_at || null,
    statusUpdatedBy: row.status_updated_by ? String(row.status_updated_by) : null,
    membershipStartedAt: row.membership_started_at || null,
    membershipExpiresAt: row.membership_expires_at || null,
    approvalEmailStatus: row.approval_email_status || null,
    approvalEmailSentAt: row.approval_email_sent_at || null,
    approvalEmailError: row.approval_email_error || null,
    joinDate: row.created_at,
    events: 0,
  };
}

function validatePasswordRules(password) {
  const value = String(password || '');
  if (value.length < PASSWORD_RULES.minLength) {
    return `Password must be at least ${PASSWORD_RULES.minLength} characters long.`;
  }
  if (PASSWORD_RULES.requireUpper && !/[A-Z]/.test(value)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (PASSWORD_RULES.requireLower && !/[a-z]/.test(value)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(value)) {
    return 'Password must include at least one number.';
  }
  if (PASSWORD_RULES.requireSpecial && !/[^\w\s]/.test(value)) {
    return 'Password must include at least one special character.';
  }
  return null;
}

function parseDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    return new Date(`${trimmed}T00:00:00Z`);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  return null;
}

function getAgeYears(birthDate) {
  const now = new Date();
  const yearDiff = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = now.getUTCDate() - birthDate.getUTCDate();
  if (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0)) {
    return yearDiff;
  }
  return yearDiff - 1;
}

async function listMembers(req, res) {
  const status = req.query.status ? String(req.query.status) : null;
  const search = req.query.search ? String(req.query.search) : null;
  const memberType = req.query.memberType ? String(req.query.memberType) : null;
  const sector = req.query.sector ? String(req.query.sector) : null;
  const institution = req.query.institution ? String(req.query.institution) : null;
  const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : null;
  const dateTo = req.query.dateTo ? String(req.query.dateTo) : null;

  const where = [`role = 'member'`];
  const params = [];

  if (status && ['pending', 'active', 'inactive', 'suspended', 'banned', 'archived', 'rejected'].includes(status)) {
    where.push('status = ?');
    params.push(status);
  }

  if (memberType && ['student', 'individual', 'industry', 'institution'].includes(memberType)) {
    where.push('member_type = ?');
    params.push(memberType);
  }

  if (sector && ['school', 'industry', 'institution'].includes(sector)) {
    where.push('sector = ?');
    params.push(sector);
  }

  if (institution) {
    where.push('(sector_details LIKE ?)');
    params.push(`%${institution}%`);
  }

  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    where.push('DATE(created_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    where.push('DATE(created_at) <= ?');
    params.push(dateTo);
  }

  if (search) {
    where.push('(full_name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const [rows] = await pool.execute(
    `SELECT * FROM users
     WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC`,
    params
  );

  return json(res, 200, { success: true, members: rows.map(toMemberDto) });
}

async function listMemberStatusLogs(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid id.' });

  try {
    const [rows] = await pool.execute(
      `SELECT
         l.*,
         u.full_name AS changed_by_name,
         u.email AS changed_by_email
       FROM member_status_logs l
       LEFT JOIN users u ON u.id = l.changed_by
       WHERE l.member_id = ?
       ORDER BY l.created_at DESC`,
      [id]
    );

    const logs = rows.map((r) => ({
      id: String(r.id),
      memberId: String(r.member_id),
      oldStatus: r.old_status,
      newStatus: r.new_status,
      reason: r.reason || null,
      changedBy: r.changed_by ? String(r.changed_by) : null,
      changedByName: r.changed_by_name || null,
      changedByEmail: r.changed_by_email || null,
      createdAt: r.created_at,
    }));

    return json(res, 200, { success: true, logs });
  } catch (err) {
    if (isDbError(err)) throw err;
    return json(res, 200, { success: true, logs: [] });
  }
}

async function getMemberDetails(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid id.' });

  const [rows] = await pool.execute(
    `SELECT * FROM users WHERE id = ? AND role = 'member' LIMIT 1`,
    [id]
  );
  if (!rows.length) return json(res, 404, { success: false, message: 'Member not found.' });
  const member = rows[0];

  // Payment history (latest 30)
  let payments = [];
  try {
    const [payRows] = await pool.execute(
      `SELECT
         p.*,
         e.title AS event_title
       FROM payments p
       LEFT JOIN events e ON e.id = p.event_id
       WHERE p.member_id = ?
       ORDER BY p.created_at DESC
       LIMIT 30`,
      [id]
    );
    payments = payRows.map((p) => ({
      id: String(p.id),
      eventId: p.event_id ? String(p.event_id) : null,
      eventTitle: p.event_title || '',
      amount: Number(p.amount || 0),
      paymentMethod: p.payment_method || p.method || null,
      paymentStatus: p.payment_status || null,
      processStatus: p.process_status || null,
      status: p.status || null,
      referenceNumber: p.reference_number || null,
      proofUrl: p.proof_url || null,
      rejectionReason: p.rejection_reason || null,
      verifiedBy: p.verified_by ? String(p.verified_by) : null,
      verifiedAt: p.verified_at || null,
      createdAt: p.created_at,
    }));
  } catch {
    payments = [];
  }

  // Event participation (latest 30)
  let events = [];
  try {
    const [regRows] = await pool.execute(
      `SELECT
         er.*,
         e.title AS event_title,
         e.start_at,
         e.end_atFROM event_registrations er
       JOIN events e ON e.id = er.event_id
       WHERE er.member_id = ?
       ORDER BY er.created_at DESC
       LIMIT 30`,
      [id]
    );
    events = regRows.map((r) => ({
      registrationId: String(r.id),
      eventId: String(r.event_id),
      eventTitle: r.event_title || '',
      status: r.status,
      participantCount: Number(r.participant_count || 1),
      teamProfileUrl: r.team_profile_url || null,
      createdAt: r.created_at,
      eventStartAt: r.start_at,
      eventEndAt: r.end_at,
    }));
  } catch {
    events = [];
  }

  return json(res, 200, {
    success: true,
    member: toMemberDto(member),
    history: { payments, events },
  });
}

async function appendMemberStatusLog({ memberId, oldStatus, newStatus, reason, changedBy }) {
  try {
    await pool.execute(
      `INSERT INTO member_status_logs (member_id, old_status, new_status, reason, changed_by)
       VALUES (?, ?, ?, ?, ?)`,
      [memberId, oldStatus, newStatus, reason || null, changedBy || null]
    );
  } catch {
    // best effort
  }
}

async function changeMemberStatus(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid id.' });

  const body = req.body || {};
  const nextStatusRaw = String(body.status || '').trim().toLowerCase();
  const allowedStatus = ['pending', 'active', 'inactive', 'suspended', 'banned', 'archived', 'rejected'];
  if (!allowedStatus.includes(nextStatusRaw)) {
    return json(res, 400, { success: false, message: 'Invalid status.' });
  }

  const reason = body.reason ? String(body.reason).trim().slice(0, 255) : '';

  const [beforeRows] = await pool.execute(
    `SELECT id, full_name, email, status
     FROM users
     WHERE id = ? AND role = 'member'
     LIMIT 1`,
    [id]
  );
  if (!beforeRows.length) return json(res, 404, { success: false, message: 'Member not found.' });
  const before = beforeRows[0];

  const oldStatus = String(before.status || '');
  const newStatus = nextStatusRaw;
  if (oldStatus === newStatus) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? AND role = \'member\'', [id]);
    return json(res, 200, { success: true, member: toMemberDto(rows[0]) });
  }

  const sets = ['status = ?', 'status_updated_at = NOW()', 'status_updated_by = ?'];
  const updateParams = [newStatus, req.user?.id || null];

  if (newStatus === 'banned') {
    sets.push('banned_reason = ?');
    updateParams.push(reason || null);
  } else if (newStatus === 'suspended') {
    sets.push('suspended_reason = ?');
    updateParams.push(reason || null);
  } else if (newStatus === 'archived') {
    sets.push('archived_at = NOW()');
  } else {
    sets.push('banned_reason = NULL');
    sets.push('suspended_reason = NULL');
    sets.push('archived_at = NULL');
  }

  // When approving/activating an individual/institution account, set a 1-year validity window if missing.
  if (newStatus === 'active') {
    try {
      const [typeRows] = await pool.execute(
        `SELECT member_type, membership_started_at, membership_expires_at
         FROM users
         WHERE id = ? AND role = 'member'
         LIMIT 1`,
        [id]
      );
      const memberType = String(typeRows[0]?.member_type || '');
      const startedAt = typeRows[0]?.membership_started_at || null;
      const expiresAt = typeRows[0]?.membership_expires_at || null;
      const shouldExpire = true;
      if (shouldExpire && !expiresAt) {
        sets.push('membership_started_at = COALESCE(membership_started_at, NOW())');
        sets.push('membership_expires_at = DATE_ADD(COALESCE(membership_started_at, NOW()), INTERVAL 1 YEAR)');
      } else if (shouldExpire && expiresAt && !startedAt) {
        sets.push('membership_started_at = NOW()');
      }
    } catch {
      // ignore
    }
  }

  updateParams.push(id);
  await pool.execute(
    `UPDATE users
     SET ${sets.join(', ')}
     WHERE id = ? AND role = 'member'`,
    updateParams
  );

  const [rows] = await pool.execute(
    `SELECT * FROM users WHERE id = ? AND role = 'member'`,
    [id]
  );
  if (!rows.length) return json(res, 404, { success: false, message: 'Member not found.' });
  const updated = rows[0];

  await appendMemberStatusLog({
    memberId: id,
    oldStatus,
    newStatus,
    reason,
    changedBy: req.user?.id || null,
  });

  const becameActive = oldStatus !== 'active' && updated.status === 'active';
  let emailNotification = { sent: false, reason: '' };

  if (becameActive && updated.email) {
    try {
      emailNotification = await sendRegistrationApprovedEmail({
        to: updated.email,
        fullName: updated.full_name || 'Member',
        userId: updated.id,
      });
    } catch (err) {
      emailNotification = {
        sent: false,
        reason: err instanceof Error ? err.message : 'Failed to send email notification.',
      };
    }
  }

  return json(res, 200, {
    success: true,
    member: toMemberDto(updated),
    notification: {
      emailSent: emailNotification.sent,
      reason: emailNotification.reason || null,
    },
  });
}

async function createMember(req, res) {
  const body = req.body || {};
  const fullName = String(body.fullName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const username = String(body.username || email.split('@')[0] || '').trim();
  const password = String(body.password || '');

  if (!fullName || !email || !username || !password) {
    return json(res, 400, { success: false, message: 'Missing required fields.' });
  }

  const passwordError = validatePasswordRules(password);
  if (passwordError) {
    return json(res, 400, { success: false, message: passwordError });
  }

  const crypto = require('node:crypto');
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  const passwordHash = `s2:${salt.toString('hex')}:${hash.toString('hex')}`;

  const contactNumber = String(body.contactNumber || '').trim();
  const birthdateRaw = body.birthdate ?? body.birthDate;
  const birthdate = birthdateRaw === undefined || birthdateRaw === null || String(birthdateRaw).trim() === ''
    ? null
    : String(birthdateRaw).trim();
  if (birthdate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    return json(res, 400, { success: false, message: 'Birthdate must be in YYYY-MM-DD format.' });
  }

  const allowedSectors = ['school', 'industry', 'institution'];
  const sector = allowedSectors.includes(body.sector) ? body.sector : 'institution';
  const sectorDetails = body.sectorInfo ? String(body.sectorInfo).trim() : (body.sectorDetails ? String(body.sectorDetails).trim() : null);
  const allowedMemberTypes = ['student', 'school', 'individual', 'industry', 'institution'];
  let memberType = body.memberType ? String(body.memberType).trim() : null;
  if (memberType === 'school') memberType = 'student';
  if (memberType && !allowedMemberTypes.includes(memberType)) memberType = null;

  if (memberType === 'individual') {
    const birthDateObj = parseDateOnly(birthdate);
    if (!birthDateObj) {
      return json(res, 400, { success: false, message: 'Birthdate is required for individual members.' });
    }
    const age = getAgeYears(birthDateObj);
    if (age < 16) {
      return json(res, 400, { success: false, message: 'Individual membership requires age 16 or older.' });
    }
  }

  const address = body.address ? String(body.address).trim() : null;
  const gender = body.gender ? String(body.gender).trim() : null;
  const occupation = body.occupation ? String(body.occupation).trim() : null;
  const representativeName = body.representativeName ? String(body.representativeName).trim() : null;
  const representativeName2 = body.representativeName2 ? String(body.representativeName2).trim() : null;
  const position = body.position ? String(body.position).trim() : null;
  const representativePosition2 = body.representativePosition2 ? String(body.representativePosition2).trim() : null;
  const companyEmail = body.companyEmail ? String(body.companyEmail).trim() : null;
  const website = body.website ? String(body.website).trim() : null;
  const membershipMode = body.membershipMode ? String(body.membershipMode).trim() : null;

  try {
    const [result] = await pool.execute(
      `INSERT INTO users
        (email, username, full_name, password_hash, role, contact_number, sector, sector_details, member_type, terms_accepted, status, birthdate, address, gender, occupation, representative_name, representative_name_2, position, representative_position_2, company_email, website, membership_mode)
       VALUES
        (?, ?, ?, ?, 'member', ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, username, fullName, passwordHash, contactNumber, sector, sectorDetails, memberType, 1, birthdate, address, gender, occupation, representativeName, representativeName2, position, representativePosition2, companyEmail, website, membershipMode]
    );

    const insertedId = result.insertId;
    const [rows] = await pool.execute(
      `SELECT * FROM users WHERE id = ?`,
      [insertedId]
    );
    return json(res, 201, { success: true, member: toMemberDto(rows[0]) });
  } catch (err) {
    if (isDbError(err)) throw err;
    const message = err && err.code === 'ER_DUP_ENTRY'
      ? 'Email or username already exists.'
      : 'Create member failed.';
    return json(res, 400, { success: false, message });
  }
}

async function updateMember(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid id.' });

  const body = req.body || {};
  const allowedStatus = ['pending', 'active', 'inactive', 'suspended', 'banned', 'rejected'];
  const status = body.status && allowedStatus.includes(body.status) ? body.status : null;
  const fullName = body.fullName ? String(body.fullName).trim() : null;
  const contactNumber = body.contactNumber ? String(body.contactNumber).trim() : null;
  const allowedSectors = ['school', 'industry', 'institution'];
  const sector = body.sector && allowedSectors.includes(body.sector) ? String(body.sector) : null;
  const allowedMemberTypes = ['student', 'school', 'individual', 'industry', 'institution'];
  let memberType = body.memberType ? String(body.memberType) : null;
  if (memberType === 'school') memberType = 'student';
  if (memberType && !allowedMemberTypes.includes(memberType)) memberType = null;

  const address = body.address ? String(body.address).trim() : null;
  const gender = body.gender ? String(body.gender).trim() : null;
  const occupation = body.occupation ? String(body.occupation).trim() : null;
  const representativeName = body.representativeName ? String(body.representativeName).trim() : null;
  const representativeName2 = body.representativeName2 ? String(body.representativeName2).trim() : null;
  const position = body.position ? String(body.position).trim() : null;
  const representativePosition2 = body.representativePosition2 ? String(body.representativePosition2).trim() : null;
  const companyEmail = body.companyEmail ? String(body.companyEmail).trim() : null;
  const website = body.website ? String(body.website).trim() : null;
  const membershipMode = body.membershipMode ? String(body.membershipMode).trim() : null;
  const hasBirthdate = Object.prototype.hasOwnProperty.call(body, 'birthdate') || Object.prototype.hasOwnProperty.call(body, 'birthDate');
  const birthdateRaw = hasBirthdate ? (body.birthdate ?? body.birthDate) : null;
  const birthdate = hasBirthdate
    ? (birthdateRaw === null || String(birthdateRaw).trim() === '' ? null : String(birthdateRaw).trim())
    : null;
  if (hasBirthdate && birthdate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    return json(res, 400, { success: false, message: 'Birthdate must be in YYYY-MM-DD format.' });
  }

  const sets = [];
  const params = [];
  if (status) { sets.push('status = ?'); params.push(status); }
  if (fullName) { sets.push('full_name = ?'); params.push(fullName); }
  if (contactNumber) { sets.push('contact_number = ?'); params.push(contactNumber); }
  if (sector) { sets.push('sector = ?'); params.push(sector); }
  if (memberType) { sets.push('member_type = ?'); params.push(memberType); }
  if (address !== null) { sets.push('address = ?'); params.push(address); }
  if (gender !== null) { sets.push('gender = ?'); params.push(gender); }
  if (occupation !== null) { sets.push('occupation = ?'); params.push(occupation); }
  if (representativeName !== null) { sets.push('representative_name = ?'); params.push(representativeName); }
  if (representativeName2 !== null) { sets.push('representative_name_2 = ?'); params.push(representativeName2); }
  if (position !== null) { sets.push('position = ?'); params.push(position); }
  if (representativePosition2 !== null) { sets.push('representative_position_2 = ?'); params.push(representativePosition2); }
  if (companyEmail !== null) { sets.push('company_email = ?'); params.push(companyEmail); }
  if (website !== null) { sets.push('website = ?'); params.push(website); }
  if (membershipMode !== null) { sets.push('membership_mode = ?'); params.push(membershipMode); }
  if (hasBirthdate) { sets.push('birthdate = ?'); params.push(birthdate); }

  if (!sets.length) return json(res, 400, { success: false, message: 'No fields to update.' });
  params.push(id);

  const [beforeRows] = await pool.execute(
    `SELECT id, full_name, email, status
     FROM users
     WHERE id = ? AND role = 'member'
     LIMIT 1`,
    [id]
  );
  if (!beforeRows.length) return json(res, 404, { success: false, message: 'Member not found.' });
  const before = beforeRows[0];

  await pool.execute(
    `UPDATE users SET ${sets.join(', ')} WHERE id = ? AND role = 'member'`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT * FROM users WHERE id = ? AND role = 'member'`,
    [id]
  );
  if (!rows.length) return json(res, 404, { success: false, message: 'Member not found.' });
  const updated = rows[0];

  if (status && before.status !== updated.status) {
    await appendMemberStatusLog({
      memberId: id,
      oldStatus: String(before.status || ''),
      newStatus: String(updated.status || ''),
      reason: body.reason ? String(body.reason).trim().slice(0, 255) : '',
      changedBy: req.user?.id || null,
    });
  }

  const becameActive = before.status !== 'active' && updated.status === 'active';
  let emailNotification = { sent: false, reason: '' };

  if (becameActive && updated.email) {
    try {
      emailNotification = await sendRegistrationApprovedEmail({
        to: updated.email,
        fullName: updated.full_name || 'Member',
        userId: updated.id,
      });
    } catch (err) {
      emailNotification = {
        sent: false,
        reason: err instanceof Error ? err.message : 'Failed to send email notification.',
      };
    }
  }

  return json(res, 200, {
    success: true,
    member: toMemberDto(updated),
    notification: {
      emailSent: emailNotification.sent,
      reason: emailNotification.reason || null,
    },
  });
}

async function deleteMember(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid id.' });

  const [result] = await pool.execute('DELETE FROM users WHERE id = ? AND role = \'member\'', [id]);
  if (result.affectedRows === 0) return json(res, 404, { success: false, message: 'Member not found.' });
  return json(res, 200, { success: true });
}

async function resendApprovalEmail(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid id.' });

  const [rows] = await pool.execute(
    `SELECT id, full_name, email, role, status
     FROM users
     WHERE id = ? AND role = 'member'
     LIMIT 1`,
    [id]
  );
  if (!rows.length) return json(res, 404, { success: false, message: 'Member not found.' });
  const member = rows[0];
  if (member.status !== 'active') {
    return json(res, 400, { success: false, message: 'Approval email can only be resent for active members.' });
  }
  if (!member.email) {
    return json(res, 400, { success: false, message: 'Member has no email address.' });
  }

  try {
    const notification = await sendRegistrationApprovedEmail({
      to: member.email,
      fullName: member.full_name || 'Member',
      userId: member.id,
    });

    const [updatedRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    return json(res, 200, {
      success: true,
      member: toMemberDto(updatedRows[0]),
      notification: {
        emailSent: notification.sent,
        reason: notification.reason || null,
      },
    });
  } catch (err) {
    return json(res, 500, {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to send approval email.',
    });
  }
}

module.exports = {
  listMembers,
  listMemberStatusLogs,
  getMemberDetails,
  createMember,
  updateMember,
  changeMemberStatus,
  deleteMember,
  resendApprovalEmail,
};



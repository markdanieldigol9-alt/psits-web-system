const { pool } = require('./db');
const crypto = require('node:crypto');

function json(res, status, body) {
  res.status(status).json(body);
}

function toDto(row) {
  const createdAt = row.created_at ? new Date(row.created_at) : null;
  const date = createdAt ? createdAt.toISOString().slice(0, 10) : '';

  return {
    id: String(row.id),
    institutionUserId: String(row.institution_user_id),
    eventId: row.event_id ? String(row.event_id) : null,
    institutionName: row.institution_name || row.institution_full_name || '',
    institutionEmail: row.institution_email || '',
    fullName: row.full_name,
    email: row.email,
    contactNumber: row.contact_number,
    gender: row.gender,
    position: row.position,
    eventTitle: row.event_title,
    status: row.status || 'pending',
    approvedBy: row.approved_by_name || null,
    approvedAt: row.approved_at || null,
    rejectionReason: row.rejection_reason || null,
    notes: row.notes,
    uploadedBy: row.created_by_name || null,
    date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function canViewAll(role) {
  return role === 'super_admin' || role === 'admin' || role === 'officer';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function safeUsernameFromEmail(email) {
  const local = String(email || '').split('@')[0] || 'instmember';
  const cleaned = local.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return (cleaned || 'instmember').slice(0, 24);
}

async function ensureInstitutionParticipantUser({ email, fullName, contactNumber, institutionUserId }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
  if (existing.length) return String(existing[0].id);

  const [instRows] = await pool.execute(
    'SELECT password_hash, sector_details FROM users WHERE id = ? LIMIT 1',
    [institutionUserId]
  );
  if (!instRows.length) return null;

  const institutionPasswordHash = instRows[0].password_hash;
  const institutionName = instRows[0].sector_details || null;

  const base = safeUsernameFromEmail(normalizedEmail);
  let createdId = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = crypto.randomBytes(2).toString('hex');
    const username = `${base}_${suffix}`.slice(0, 64);
    try {
      const [result] = await pool.execute(
        `INSERT INTO users
          (email, username, full_name, password_hash, role, status, contact_number, sector, sector_details, member_type, institution_owner_id, terms_accepted)
         VALUES
          (?, ?, ?, ?, 'member', 'active', ?, 'institution', ?, 'student', ?, 1)`,
        [
          normalizedEmail,
          username,
          String(fullName || '').trim() || base,
          institutionPasswordHash,
          String(contactNumber || '').trim(),
          institutionName,
          institutionUserId,
        ]
      );
      createdId = String(result.insertId);
      break;
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        continue;
      }
      throw err;
    }
  }

  return createdId;
}

async function listInstitutionMembers(req, res) {
  const role = req.user?.role;
  const memberType = req.user?.member_type;
  const where = [];
  const params = [];
  const search = req.query.search ? String(req.query.search).trim() : '';
  const eventTitle = req.query.eventTitle ? String(req.query.eventTitle).trim() : '';
  const eventId = req.query.eventId ? Number(req.query.eventId) : null;
  const status = req.query.status ? String(req.query.status).trim().toLowerCase() : '';

  if (canViewAll(role)) {
    // no scope filter
  } else if (role === 'member' && memberType === 'institution') {
    where.push('im.institution_user_id = ?');
    params.push(req.user.id);
  } else {
    return json(res, 403, { success: false, message: 'Forbidden.' });
  }

  if (search) {
    where.push(`(
      im.full_name LIKE ? OR
      im.email LIKE ? OR
      im.contact_number LIKE ? OR
      im.position LIKE ? OR
      i.full_name LIKE ? OR
      i.sector_details LIKE ?
    )`);
    const token = `%${search}%`;
    params.push(token, token, token, token, token, token);
  }

  if (eventTitle) {
    where.push('im.event_title LIKE ?');
    params.push(`%${eventTitle}%`);
  }

  if (Number.isFinite(eventId)) {
    where.push('im.event_id = ?');
    params.push(eventId);
  }

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    where.push('im.status = ?');
    params.push(status);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT
       im.*,
       i.full_name AS institution_full_name,
       i.email AS institution_email,
       i.sector_details AS institution_name,
       approver.full_name AS approved_by_name,
       u.full_name AS created_by_name
     FROM institution_members im
     JOIN users i ON i.id = im.institution_user_id
     LEFT JOIN users approver ON approver.id = im.approved_by
     LEFT JOIN users u ON u.id = im.created_by
     ${sqlWhere}
     ORDER BY im.created_at DESC`,
    params
  );

  return json(res, 200, { success: true, members: rows.map(toDto) });
}

async function bulkCreateInstitutionMembers(req, res) {
  const role = req.user?.role;
  const memberType = req.user?.member_type;
  const body = req.body || {};
  const incoming = Array.isArray(body.members) ? body.members : [];

  if (!(role === 'member' && memberType === 'institution')) {
    return json(res, 403, { success: false, message: 'Only institutional members can upload participants.' });
  }

  if (!incoming.length) {
    return json(res, 400, { success: false, message: 'At least one participant is required.' });
  }

  if (incoming.length > 500) {
    return json(res, 400, { success: false, message: 'You can upload up to 500 participants per request.' });
  }

  const cleanRows = incoming
    .map((row) => ({
      eventId: row.eventId ? Number(row.eventId) : null,
      fullName: String(row.fullName || '').trim(),
      email: row.email ? String(row.email).trim().toLowerCase() : null,
      contactNumber: row.contactNumber ? String(row.contactNumber).trim() : null,
      gender: row.gender ? String(row.gender).trim() : null,
      position: row.position ? String(row.position).trim() : null,
      eventTitle: row.eventTitle ? String(row.eventTitle).trim() : null,
      notes: row.notes ? String(row.notes).trim() : null,
    }))
    .filter((row) => row.fullName);

  if (!cleanRows.length) {
    return json(res, 400, { success: false, message: 'No valid participants found. Each row needs at least fullName.' });
  }

  const institutionUserId = req.user.id;
  const createdBy = req.user.id;

  const values = cleanRows.map((row) => [
    institutionUserId,
    Number.isFinite(row.eventId) ? row.eventId : null,
    row.fullName,
    row.email,
    row.contactNumber,
    row.gender,
    row.position,
    row.eventTitle,
    'pending',
    null,
    null,
    null,
    row.notes,
    createdBy,
  ]);

  await pool.query(
    `INSERT INTO institution_members
      (institution_user_id, event_id, full_name, email, contact_number, gender, position, event_title, status, approved_by, approved_at, rejection_reason, notes, created_by)
     VALUES ?`,
    [values]
  );

  return json(res, 201, {
    success: true,
    inserted: cleanRows.length,
  });
}

async function approveInstitutionMember(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid id.' });

  const body = req.body || {};
  const status = String(body.status || '').toLowerCase();
  if (!['approved', 'rejected'].includes(status)) {
    return json(res, 400, { success: false, message: 'Status must be approved or rejected.' });
  }

  const rejectionReason = status === 'rejected'
    ? (body.rejectionReason ? String(body.rejectionReason).trim() : null)
    : null;

  await pool.execute(
    `UPDATE institution_members
     SET status = ?, approved_by = ?, approved_at = NOW(), rejection_reason = ?
     WHERE id = ?`,
    [status, req.user?.id || null, rejectionReason, id]
  );

  const [rows] = await pool.execute(
    `SELECT
       im.*,
       i.full_name AS institution_full_name,
       i.email AS institution_email,
       i.sector_details AS institution_name,
       approver.full_name AS approved_by_name,
       u.full_name AS created_by_name
     FROM institution_members im
     JOIN users i ON i.id = im.institution_user_id
     LEFT JOIN users approver ON approver.id = im.approved_by
     LEFT JOIN users u ON u.id = im.created_by
     WHERE im.id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows.length) return json(res, 404, { success: false, message: 'Participant not found.' });

  // Provision a login account for approved institutional participants (if an email is provided).
  // They can authenticate using the institution account password (password hash is copied + linked via institution_owner_id).
  if (status === 'approved' && rows[0].email) {
    try {
      await ensureInstitutionParticipantUser({
        email: rows[0].email,
        fullName: rows[0].full_name,
        contactNumber: rows[0].contact_number,
        institutionUserId: rows[0].institution_user_id,
      });
    } catch {
      // Keep approval successful even if account provisioning fails due to constraints.
    }
  }
  return json(res, 200, { success: true, member: toDto(rows[0]) });
}

module.exports = {
  listInstitutionMembers,
  bulkCreateInstitutionMembers,
  approveInstitutionMember,
};

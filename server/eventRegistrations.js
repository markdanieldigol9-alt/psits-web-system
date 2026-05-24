const { pool } = require('./db');

function json(res, status, body) {
  res.status(status).json(body);
}

function toDto(row) {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    eventTitle: row.event_title || '',
    memberId: String(row.member_id),
    memberName: row.member_name || '',
    memberEmail: row.member_email || '',
    participantCount: Number(row.participant_count || 1),
    status: row.status,
    teamProfileUrl: row.team_profile_url || null,
    notes: row.notes || null,
    approvedBy: row.approved_by_name || null,
    approvedAt: row.approved_at || null,
    rejectionReason: row.rejection_reason || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function registerForEvent(req, res) {
  const eventId = Number(req.params.id);
  if (!Number.isFinite(eventId)) return json(res, 400, { success: false, message: 'Invalid event id.' });

  const memberId = Number(req.user?.id);
  if (!Number.isFinite(memberId)) return json(res, 401, { success: false, message: 'Unauthorized.' });

  // Registration window enforcement (members cannot register outside allowed period)
  const [eventRows] = await pool.execute(
    `SELECT id, start_at, end_at, registration_start_at, registration_end_at, registration_override, status
     FROM events
     WHERE id = ?
     LIMIT 1`,
    [eventId]
  );
  if (!eventRows.length) return json(res, 404, { success: false, message: 'Event not found.' });

  const event = eventRows[0];
  const now = new Date();
  const startAt = event.start_at ? new Date(event.start_at) : null;
  const endAt = event.end_at ? new Date(event.end_at) : null;
  if (endAt && !Number.isNaN(endAt.getTime()) && endAt.getTime() <= now.getTime()) {
    return json(res, 400, { success: false, message: 'Event finished. Registration is closed.' });
  }

  const override = event.registration_override ? String(event.registration_override) : null;
  if (override === 'closed') {
    return json(res, 400, { success: false, message: 'Registration is closed for this event.' });
  }

  if (override !== 'open') {
    const regStart = event.registration_start_at ? new Date(event.registration_start_at) : null;
    const regEnd = event.registration_end_at ? new Date(event.registration_end_at) : null;

    if (regStart && !Number.isNaN(regStart.getTime()) && now < regStart) {
      return json(res, 400, { success: false, message: 'Registration is not yet open.' });
    }
    if (regEnd && !Number.isNaN(regEnd.getTime()) && now > regEnd) {
      return json(res, 400, { success: false, message: 'Registration is closed.' });
    }

    // If no explicit registration window is set, default to allowing registrations until event starts.
    if (!regStart && !regEnd && startAt && !Number.isNaN(startAt.getTime()) && now > startAt) {
      return json(res, 400, { success: false, message: 'Event already started. Registration is closed.' });
    }
  }

  const body = req.body || {};
  const participantCount = Math.max(1, Number(body.participantCount || 1));
  const notes = body.notes ? String(body.notes).trim() : null;
  const teamProfileUrl = body.teamProfileUrl ? String(body.teamProfileUrl).trim() : null;

  const [existing] = await pool.execute(
    `SELECT er.*, e.title AS event_title, u.full_name AS member_name, u.email AS member_email
     FROM event_registrations er
     JOIN events e ON e.id = er.event_id
     JOIN users u ON u.id = er.member_id
     WHERE er.event_id = ? AND er.member_id = ?
     LIMIT 1`,
    [eventId, memberId]
  );

  if (existing.length) {
    return json(res, 200, { success: true, registration: toDto(existing[0]) });
  }

  const [result] = await pool.execute(
    `INSERT INTO event_registrations (event_id, member_id, participant_count, status, team_profile_url, notes)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
    [eventId, memberId, participantCount, teamProfileUrl, notes]
  );

  const [rows] = await pool.execute(
    `SELECT er.*, e.title AS event_title, u.full_name AS member_name, u.email AS member_email
     FROM event_registrations er
     JOIN events e ON e.id = er.event_id
     JOIN users u ON u.id = er.member_id
     WHERE er.id = ?
     LIMIT 1`,
    [result.insertId]
  );
  return json(res, 201, { success: true, registration: toDto(rows[0]) });
}

async function listEventRegistrations(req, res) {
  const eventId = Number(req.params.id);
  if (!Number.isFinite(eventId)) return json(res, 400, { success: false, message: 'Invalid event id.' });

  const where = ['er.event_id = ?'];
  const params = [eventId];
  const status = req.query.status ? String(req.query.status) : null;

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    where.push('er.status = ?');
    params.push(status);
  }

  if (req.user?.role === 'member') {
    where.push('er.member_id = ?');
    params.push(req.user.id);
  }

  const [rows] = await pool.execute(
    `SELECT
       er.*,
       e.title AS event_title,
       u.full_name AS member_name,
       u.email AS member_email,
       approver.full_name AS approved_by_name
     FROM event_registrations er
     JOIN events e ON e.id = er.event_id
     JOIN users u ON u.id = er.member_id
     LEFT JOIN users approver ON approver.id = er.approved_by
     WHERE ${where.join(' AND ')}
     ORDER BY er.created_at DESC`,
    params
  );

  return json(res, 200, { success: true, registrations: rows.map(toDto) });
}

async function listMyRegistrations(req, res) {
  const memberId = Number(req.user?.id);
  if (!Number.isFinite(memberId)) return json(res, 401, { success: false, message: 'Unauthorized.' });

  const [rows] = await pool.execute(
    `SELECT
       er.*,
       e.title AS event_title,
       u.full_name AS member_name,
       u.email AS member_email,
       approver.full_name AS approved_by_name
     FROM event_registrations er
     JOIN events e ON e.id = er.event_id
     JOIN users u ON u.id = er.member_id
     LEFT JOIN users approver ON approver.id = er.approved_by
     WHERE er.member_id = ?
     ORDER BY er.created_at DESC`,
    [memberId]
  );

  return json(res, 200, { success: true, registrations: rows.map(toDto) });
}

async function approveEventRegistration(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid registration id.' });

  const body = req.body || {};
  const status = String(body.status || '').toLowerCase();
  if (!['approved', 'rejected'].includes(status)) {
    return json(res, 400, { success: false, message: 'Status must be approved or rejected.' });
  }

  const rejectionReason = status === 'rejected'
    ? (body.rejectionReason ? String(body.rejectionReason).trim() : null)
    : null;

  await pool.execute(
    `UPDATE event_registrations
     SET status = ?, approved_by = ?, approved_at = NOW(), rejection_reason = ?
     WHERE id = ?`,
    [status, req.user?.id || null, rejectionReason, id]
  );

  const [rows] = await pool.execute(
    `SELECT
       er.*,
       e.title AS event_title,
       u.full_name AS member_name,
       u.email AS member_email,
       approver.full_name AS approved_by_name
     FROM event_registrations er
     JOIN events e ON e.id = er.event_id
     JOIN users u ON u.id = er.member_id
     LEFT JOIN users approver ON approver.id = er.approved_by
     WHERE er.id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows.length) return json(res, 404, { success: false, message: 'Registration not found.' });
  return json(res, 200, { success: true, registration: toDto(rows[0]) });
}

module.exports = {
  registerForEvent,
  listEventRegistrations,
  listMyRegistrations,
  approveEventRegistration,
};

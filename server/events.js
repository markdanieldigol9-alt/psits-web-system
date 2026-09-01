const { pool } = require('./db');

function toEventDto(row) {
  const startAt = row.start_at ? new Date(row.start_at) : null;
  const date = startAt ? startAt.toISOString().slice(0, 10) : '';
  const time = startAt ? startAt.toTimeString().slice(0, 5) : '';
  const endAt = row.end_at ? new Date(row.end_at) : null;
  const endDate = endAt ? endAt.toISOString().slice(0, 10) : '';
  const endTime = endAt ? endAt.toTimeString().slice(0, 5) : '';

  const regStart = row.registration_start_at ? new Date(row.registration_start_at) : null;
  const regEnd = row.registration_end_at ? new Date(row.registration_end_at) : null;

  return {
    id: String(row.id),
    title: row.title,
    description: row.description || '',
    guidelines: row.guidelines || '',
    registrationMode: row.registration_mode === 'group' ? 'team' : (row.registration_mode || 'individual'),
    registrationStartAt: regStart && !Number.isNaN(regStart.getTime()) ? regStart.toISOString() : null,
    registrationEndAt: regEnd && !Number.isNaN(regEnd.getTime()) ? regEnd.toISOString() : null,
    registrationOverride: row.registration_override || null,
    eventType: row.event_type || 'seminar',
    date,
    time,
    endDate,
    endTime,
    location: row.location || '',
    fee: Number(row.registration_fee || 0),
    capacity: Number(row.capacity || 0),
    registrations: Number(row.registrations_count || 0),
    status: row.status,
    isEsports: Boolean(row.is_esports),
    esportsGame: row.esports_game || null,
    esportsBracketFormat: row.esports_bracket_format || null,
    bannerUrl: row.banner_url || null,
    themeColor: row.theme_color || '#2563eb',
    customBadge: row.custom_badge || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function computeAutoStatus(startAt, endAt) {
  if (!startAt) return 'draft';
  const now = new Date();
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;
  if (Number.isNaN(start.getTime())) return 'draft';
  if (start.getTime() > now.getTime()) return 'upcoming';
  if (end && !Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) return 'completed';
  return 'ongoing';
}

async function listEvents(req, res) {
  const status = req.query.status ? String(req.query.status) : null;
  const allowed = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'];

  const where = [];
  const params = [];

  if (status && status !== 'all' && allowed.includes(status)) {
    where.push('e.status = ?');
    params.push(status);
  } else if (req.user?.role === 'member') {
    // members only see upcoming/ongoing/completed (not drafts)
    where.push("e.status <> 'draft'");
  }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT
       e.*,
       (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) AS registrations_count
     FROM events e
     ${sqlWhere}
     ORDER BY e.start_at DESC`,
    params
  );

  // Auto-sync status for non-draft/cancelled events based on time.
  const now = new Date();
  const updates = [];
  for (const row of rows) {
    if (row.status === 'draft' || row.status === 'cancelled') continue;
    const nextStatus = computeAutoStatus(row.start_at, row.end_at);
    if (nextStatus !== row.status) {
      updates.push([nextStatus, row.id]);
      row.status = nextStatus;
    }
  }
  if (updates.length) {
    for (const [nextStatus, eventId] of updates) {
      await pool.execute('UPDATE events SET status = ? WHERE id = ?', [nextStatus, eventId]);
    }
  }

  return res.json({ success: true, events: rows.map(toEventDto) });
}

async function createEvent(req, res) {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const description = body.description ? String(body.description).trim() : null;
  const guidelines = body.guidelines ? String(body.guidelines).trim() : null;
  const registrationMode = body.registrationMode ? String(body.registrationMode).trim() : 'individual';
  const location = body.location ? String(body.location).trim() : '';
  const startAt = body.startAt ? new Date(body.startAt) : null;
  const endAt = body.endAt ? new Date(body.endAt) : null;
  const registrationStartAt = body.registrationStartAt ? new Date(body.registrationStartAt) : null;
  const registrationEndAt = body.registrationEndAt ? new Date(body.registrationEndAt) : null;
  const registrationOverride = body.registrationOverride ? String(body.registrationOverride).trim() : null;
  const fee = Number(body.fee ?? body.registrationFee ?? 0);
  const capacity = Number(body.capacity ?? 0);
  const status = body.status ? String(body.status) : 'draft';
  const isEsports = Boolean(body.isEsports);
  const esportsGame = body.esportsGame ? String(body.esportsGame).trim() : null;
  const esportsBracketFormat = body.esportsBracketFormat ? String(body.esportsBracketFormat).trim() : null;

  if (!title || !startAt || Number.isNaN(startAt.getTime())) {
    return res.status(400).json({ success: false, message: 'Title and start date/time are required.' });
  }
  if (!location) {
    return res.status(400).json({ success: false, message: 'Location is required.' });
  }
  if (!Number.isFinite(fee) || fee < 0) {
    return res.status(400).json({ success: false, message: 'Fee must be 0 or greater.' });
  }
  if (!Number.isFinite(capacity) || capacity < 0) {
    return res.status(400).json({ success: false, message: 'Capacity must be 0 or greater.' });
  }
  if (endAt && !Number.isNaN(endAt.getTime()) && endAt < startAt) {
    return res.status(400).json({ success: false, message: 'End date/time must be after start date/time.' });
  }

  const allowed = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'];
  let safeStatus = allowed.includes(status) ? status : 'draft';
  if (!['draft', 'cancelled'].includes(safeStatus)) {
    safeStatus = computeAutoStatus(startAt, endAt);
  }

  const allowedModes = ['individual', 'pair', 'team'];
  const safeMode = allowedModes.includes(registrationMode) ? registrationMode : 'individual';

  const eventType = body.eventType ? String(body.eventType).trim().toLowerCase() : 'seminar';
  const allowedEventTypes = ['seminar', 'conference', 'workshop', 'competition', 'contest', 'hackathon', 'webinar', 'training', 'assembly', 'meeting', 'other'];
  const safeEventType = allowedEventTypes.includes(eventType) ? eventType : 'seminar';

  const safeOverride = ['open', 'closed'].includes(registrationOverride) ? registrationOverride : null;
  if (registrationStartAt && Number.isNaN(registrationStartAt.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid registration start date/time.' });
  }
  if (registrationEndAt && Number.isNaN(registrationEndAt.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid registration end date/time.' });
  }
  if (registrationStartAt && registrationEndAt && registrationEndAt < registrationStartAt) {
    return res.status(400).json({ success: false, message: 'Registration end must be after registration start.' });
  }

  const bannerUrl = body.bannerUrl ? String(body.bannerUrl).trim() : null;
  const themeColor = body.themeColor ? String(body.themeColor).trim() : '#2563eb';
  const customBadge = body.customBadge ? String(body.customBadge).trim() : null;

  const [result] = await pool.execute(
    `INSERT INTO events (title, description, guidelines, registration_mode, registration_start_at, registration_end_at, registration_override, event_type, start_at, end_at, location, registration_fee, capacity, status, is_esports, esports_game, esports_bracket_format, banner_url, theme_color, custom_badge, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      description,
      guidelines,
      safeMode,
      registrationStartAt && !Number.isNaN(registrationStartAt.getTime()) ? registrationStartAt : null,
      registrationEndAt && !Number.isNaN(registrationEndAt.getTime()) ? registrationEndAt : null,
      safeOverride,
      safeEventType,
      startAt,
      endAt && !Number.isNaN(endAt.getTime()) ? endAt : null,
      location,
      Number.isFinite(fee) ? fee : 0,
      Number.isFinite(capacity) ? capacity : 0,
      safeStatus,
      isEsports ? 1 : 0,
      esportsGame,
      esportsBracketFormat,
      bannerUrl,
      themeColor,
      customBadge,
      req.user?.id || null,
    ]
  );

async function broadcastNewEventNotification(eventId, eventData) {
  try {
    const [users] = await pool.query(
      `SELECT id FROM users WHERE status = 'active'`
    );
    if (!users.length) return;

    const startDateStr = eventData.startAt ? new Date(eventData.startAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'Soon';
    const locStr = eventData.location ? ` at ${eventData.location}` : '';
    const feeStr = Number(eventData.fee || 0) > 0 ? ` (Fee: PHP ${Number(eventData.fee).toLocaleString()})` : ' (Free)';
    const title = `📅 New Event: ${eventData.title}`;
    const message = `A new event "${eventData.title}" is scheduled for ${startDateStr}${locStr}${feeStr}. View details and register now!`;
    const metaJson = JSON.stringify({
      eventId: String(eventId),
      title: eventData.title,
      eventType: eventData.eventType,
      url: '/events',
    });

    const values = users.map((u) => [
      u.id,
      title,
      message,
      'info',
      0,
      metaJson,
    ]);

    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const flatParams = values.flat();
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, is_read, meta_json)
       VALUES ${placeholders}`,
      flatParams
    );
  } catch (err) {
    console.warn('[Events] Failed to broadcast new event notification:', err.message);
  }
}

  const [rows] = await pool.execute(
    `SELECT
       e.*,
       (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) AS registrations_count
     FROM events e
     WHERE e.id = ?
     LIMIT 1`,
    [result.insertId]
  );

  const createdEvent = toEventDto(rows[0]);
  if (['upcoming', 'ongoing'].includes(safeStatus)) {
    void broadcastNewEventNotification(result.insertId, createdEvent);
  }

  return res.status(201).json({ success: true, event: createdEvent });
}

async function updateEvent(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const [currentRows] = await pool.execute(
    `SELECT id, start_at, end_at, status
     FROM events
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  if (!currentRows.length) return res.status(404).json({ success: false, message: 'Event not found.' });
  const current = currentRows[0];

  const body = req.body || {};
  const allowedStatus = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'];
  const allowedModes = ['individual', 'pair', 'team'];
  const allowedTypes = ['seminar', 'conference', 'workshop', 'competition', 'contest', 'hackathon', 'webinar', 'training', 'assembly', 'meeting', 'other'];

  const sets = [];
  const params = [];
  let nextStartAt = new Date(current.start_at);
  let nextEndAt = current.end_at ? new Date(current.end_at) : null;
  let startChanged = false;
  let endChanged = false;

  if (typeof body.title === 'string') {
    if (!body.title.trim()) return res.status(400).json({ success: false, message: 'Title is required.' });
    sets.push('title = ?'); params.push(body.title.trim());
  }
  if (typeof body.description === 'string') { sets.push('description = ?'); params.push(body.description.trim()); }
  if (typeof body.guidelines === 'string') { sets.push('guidelines = ?'); params.push(body.guidelines.trim()); }
  if (typeof body.registrationMode === 'string' && allowedModes.includes(body.registrationMode)) { sets.push('registration_mode = ?'); params.push(body.registrationMode); }
  if (typeof body.eventType === 'string') {
    const et = String(body.eventType).trim().toLowerCase();
    if (!allowedTypes.includes(et)) {
      return res.status(400).json({ success: false, message: 'Invalid eventType.' });
    }
    sets.push('event_type = ?'); params.push(et);
  }
  if (body.registrationStartAt !== undefined) {
    const value = body.registrationStartAt ? new Date(body.registrationStartAt) : null;
    if (value && Number.isNaN(value.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid registration start date/time.' });
    }
    sets.push('registration_start_at = ?'); params.push(value);
  }
  if (body.registrationEndAt !== undefined) {
    const value = body.registrationEndAt ? new Date(body.registrationEndAt) : null;
    if (value && Number.isNaN(value.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid registration end date/time.' });
    }
    sets.push('registration_end_at = ?'); params.push(value);
  }
  if (typeof body.registrationOverride === 'string') {
    const ov = String(body.registrationOverride).trim();
    if (!['open', 'closed', ''].includes(ov)) {
      return res.status(400).json({ success: false, message: 'Invalid registration override.' });
    }
    sets.push('registration_override = ?'); params.push(ov ? ov : null);
  }
  if (typeof body.location === 'string') {
    if (!body.location.trim()) return res.status(400).json({ success: false, message: 'Location is required.' });
    sets.push('location = ?'); params.push(body.location.trim());
  }
  if (body.startAt !== undefined) {
    const startAt = new Date(body.startAt);
    if (Number.isNaN(startAt.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid start date/time.' });
    }
    nextStartAt = startAt;
    sets.push('start_at = ?'); params.push(startAt);
    startChanged = true;
  }
  if (body.endAt !== undefined) {
    const endAt = body.endAt ? new Date(body.endAt) : null;
    if (endAt && Number.isNaN(endAt.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid end date/time.' });
    }
    const startCheck = body.startAt ? new Date(body.startAt) : nextStartAt;
    if (endAt && startCheck && !Number.isNaN(startCheck.getTime()) && endAt < startCheck) {
      return res.status(400).json({ success: false, message: 'End date/time must be after start date/time.' });
    }
    nextEndAt = endAt;
    sets.push('end_at = ?'); params.push(endAt);
    endChanged = true;
  }
  if (body.fee !== undefined) {
    const fee = Number(body.fee);
    if (!Number.isFinite(fee) || fee < 0) {
      return res.status(400).json({ success: false, message: 'Fee must be 0 or greater.' });
    }
    sets.push('registration_fee = ?'); params.push(fee);
  }
  if (body.capacity !== undefined) {
    const capacity = Number(body.capacity);
    if (!Number.isFinite(capacity) || capacity < 0) {
      return res.status(400).json({ success: false, message: 'Capacity must be 0 or greater.' });
    }
    sets.push('capacity = ?'); params.push(capacity);
  }
  if (body.isEsports !== undefined) {
    sets.push('is_esports = ?'); params.push(Boolean(body.isEsports) ? 1 : 0);
  }
  if (body.esportsGame !== undefined) {
    sets.push('esports_game = ?'); params.push(body.esportsGame ? String(body.esportsGame).trim() : null);
  }
  if (body.esportsBracketFormat !== undefined) {
    sets.push('esports_bracket_format = ?'); params.push(body.esportsBracketFormat ? String(body.esportsBracketFormat).trim() : null);
  }
  if (body.bannerUrl !== undefined) {
    sets.push('banner_url = ?'); params.push(body.bannerUrl ? String(body.bannerUrl).trim() : null);
  }
  if (body.themeColor !== undefined) {
    sets.push('theme_color = ?'); params.push(body.themeColor ? String(body.themeColor).trim() : '#2563eb');
  }
  if (body.customBadge !== undefined) {
    sets.push('custom_badge = ?'); params.push(body.customBadge ? String(body.customBadge).trim() : null);
  }

  const hasExplicitStatus = typeof body.status === 'string' && allowedStatus.includes(body.status);
  let statusMode = 'none';
  if (hasExplicitStatus) {
    if (body.status === 'draft' || body.status === 'cancelled') {
      statusMode = body.status;
    } else if (body.status === 'upcoming' && String(current.status) === 'cancelled') {
      statusMode = 'restore';
    }
  }

  if (statusMode === 'draft' || statusMode === 'cancelled') {
    sets.push('status = ?');
    params.push(statusMode);
  } else if (statusMode === 'restore') {
    const computed = computeAutoStatus(nextStartAt, nextEndAt);
    sets.push('status = ?');
    params.push(computed);
  }

  if (!sets.length) return res.status(400).json({ success: false, message: 'No fields to update.' });

  // Auto-update status when schedule changes and event isn't manually held in draft/cancelled.
  const canAutoSync = !sets.includes('status = ?') && !['draft', 'cancelled'].includes(String(current.status));
  if (canAutoSync && (startChanged || endChanged)) {
    const computed = computeAutoStatus(nextStartAt, nextEndAt);
    sets.push('status = ?');
    params.push(computed);
  }

  params.push(id);
  await pool.execute(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, params);

  const [rows] = await pool.execute(
    `SELECT
       e.*,
       (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) AS registrations_count
     FROM events e
     WHERE e.id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Event not found.' });
  const updatedDto = toEventDto(rows[0]);
  if (current.status === 'draft' && ['upcoming', 'ongoing'].includes(updatedDto.status)) {
    void broadcastNewEventNotification(id, updatedDto);
  }
  return res.json({ success: true, event: updatedDto });
}

async function deleteEvent(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const [result] = await pool.execute('DELETE FROM events WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Event not found.' });
  return res.json({ success: true });
}

module.exports = { listEvents, createEvent, updateEvent, deleteEvent };

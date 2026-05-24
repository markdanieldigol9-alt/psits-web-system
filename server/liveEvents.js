const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pool } = require('./db');

const SESSION_STATUSES = ['scheduled', 'live', 'ended', 'cancelled'];
const SESSION_TYPES = ['livestream'];
const SESSION_PRIVACY = ['public', 'private', 'event_registered_only'];
const MODERATOR_ROLES = new Set(['super_admin', 'admin', 'officer']);
const RECORDING_RETENTION_DAYS = 15;

function json(res, status, body) {
  res.status(status).json(body);
}

function toFlag(value, fallback = 0) {
  if (value === undefined || value === null) return fallback;
  return Number(value) ? 1 : 0;
}

function safeString(value, max = 255) {
  return String(value || '').trim().slice(0, max);
}

function sanitizeMessage(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);
}

function normalizeRoomCode(value) {
  const base = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, 64);
}

function generateRoomCode(title) {
  const prefix = normalizeRoomCode(title).replace(/-/g, '').slice(0, 8) || 'PSITS';
  return `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function generateSessionIdentifier(title) {
  const prefix = normalizeRoomCode(title).replace(/-/g, '').slice(0, 6) || 'PSITS';
  return `LS-${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function generateSessionToken() {
  return crypto.randomBytes(24).toString('hex');
}

function buildInternalJoinLink(identifier) {
  return `/live-events?session=${encodeURIComponent(String(identifier || '').trim())}`;
}

function normalizeDateTime(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'invalid';
  return date;
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function safeFilename(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 191);
}

function guessExtensionFromMime(mimeType) {
  const mt = String(mimeType || '').toLowerCase();
  if (mt.includes('mp4')) return 'mp4';
  if (mt.includes('webm')) return 'webm';
  if (mt.includes('quicktime') || mt.includes('mov')) return 'mov';
  if (mt.includes('mpeg')) return 'mpeg';
  return 'bin';
}

function resolveUploadPath(relativePosixPath) {
  const cleaned = String(relativePosixPath || '').replace(/\\/g, '/').replace(/^\//, '');
  const full = path.join(__dirname, cleaned);
  const normalizedBase = path.normalize(path.join(__dirname, 'uploads'));
  const normalizedFull = path.normalize(full);
  if (!normalizedFull.startsWith(normalizedBase)) return null;
  return normalizedFull;
}

function isModerator(user) {
  return MODERATOR_ROLES.has(String(user?.role || ''));
}

function toLiveEventDto(row) {
  return {
    id: String(row.id),
    sessionId: row.session_identifier || String(row.id),
    eventId: row.event_id ? String(row.event_id) : null,
    eventTitle: row.event_title || '',
    title: row.title,
    description: row.description || '',
    hostLabel: row.host_label || '',
    startAt: row.start_at || null,
    endAt: row.end_at || null,
    durationMinutes: Number(row.duration_minutes || 60),
    sessionType: row.session_type === 'livestream' ? 'livestream' : 'livestream',
    privacy: row.privacy || 'public',
    status: row.status,
    meetingUrl: row.meeting_url || '',
    joinLink: row.join_link || null,
    streamUrl: row.stream_url || null,
    streamSource: row.stream_source || 'external',
    recordingUrl: row.recording_url || null,
    recordingPath: row.recording_path || null,
    recordingExpiresAt: row.recording_expires_at || null,
    roomCode: row.room_code || null,
    sessionToken: row.session_token || null,
    chatEnabled: Boolean(row.chat_enabled),
    allowParticipantMic: Boolean(row.allow_participant_mic),
    allowParticipantCamera: Boolean(row.allow_participant_camera),
    allowParticipantScreenshare: Boolean(row.allow_participant_screenshare),
    waitingRoomEnabled: Boolean(row.waiting_room_enabled),
    allowRaiseHand: Boolean(row.allow_raise_hand),
    allowReactions: Boolean(row.allow_reactions),
    recordingEnabled: Boolean(row.recording_enabled),
    recordingVisibility: row.recording_visibility || 'host_only',
    viewersCount: Number(row.viewers_count || 0),
    participantCount: Number(row.participant_count || 0),
    activeViewerCount: Number(row.active_viewer_count || 0),
    createdBy: row.created_by ? String(row.created_by) : null,
    createdByName: row.created_by_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toParticipantDto(row) {
  return {
    id: String(row.id),
    liveEventId: String(row.live_event_id),
    userId: String(row.user_id),
    name: row.user_name || '',
    email: row.user_email || '',
    role: row.user_role || 'member',
    roleInSession: row.role_in_session,
    joinStatus: row.join_status,
    micEnabled: Boolean(row.mic_enabled),
    cameraEnabled: Boolean(row.camera_enabled),
    screenShareEnabled: Boolean(row.screen_share_enabled),
    handRaised: Boolean(row.hand_raised),
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    permissions: {
      canJoin: row.can_join === null ? null : Boolean(row.can_join),
      canChat: row.can_chat === null ? null : Boolean(row.can_chat),
      canMic: row.can_mic === null ? null : Boolean(row.can_mic),
      canCamera: row.can_camera === null ? null : Boolean(row.can_camera),
      canScreenshare: row.can_screenshare === null ? null : Boolean(row.can_screenshare),
      canRaiseHand: row.can_raise_hand === null ? null : Boolean(row.can_raise_hand),
      canReact: row.can_react === null ? null : Boolean(row.can_react),
      canModerate: row.can_moderate === null ? null : Boolean(row.can_moderate),
    },
  };
}

function toMessageDto(row) {
  return {
    id: String(row.id),
    liveEventId: String(row.live_event_id),
    message: row.message,
    createdAt: row.created_at,
    user: {
      id: String(row.user_id),
      name: row.full_name || row.username || 'PSITS User',
      role: row.role || 'member',
    },
  };
}

async function getLiveEventRowById(id) {
  const [rows] = await pool.execute(
    `SELECT
       le.*,
       e.title AS event_title,
       creator.full_name AS created_by_name,
       COALESCE(participants.participant_count, 0) AS participant_count,
       COALESCE(participants.active_viewer_count, 0) AS active_viewer_count
     FROM live_events le
     LEFT JOIN events e ON e.id = le.event_id
     LEFT JOIN users creator ON creator.id = le.created_by
     LEFT JOIN (
       SELECT
         live_event_id,
         SUM(CASE WHEN join_status = 'joined' AND role_in_session <> 'viewer' THEN 1 ELSE 0 END) AS participant_count,
         SUM(CASE WHEN join_status = 'joined' AND role_in_session = 'viewer' THEN 1 ELSE 0 END) AS active_viewer_count
       FROM live_session_participants
       GROUP BY live_event_id
     ) participants ON participants.live_event_id = le.id
     WHERE le.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function ensureEventExists(eventId) {
  if (!eventId) return null;
  const [rows] = await pool.execute('SELECT id, title FROM events WHERE id = ? LIMIT 1', [eventId]);
  return rows[0] || null;
}

async function hasApprovedEventRegistration(eventId, userId) {
  if (!eventId || !userId) return false;
  const [rows] = await pool.execute(
    `SELECT id
     FROM event_registrations
     WHERE event_id = ? AND member_id = ? AND status = 'approved'
     LIMIT 1`,
    [eventId, userId]
  );
  return rows.length > 0;
}

async function getPermissionOverride(liveEventId, userId) {
  const [rows] = await pool.execute(
    `SELECT *
     FROM live_session_permissions
     WHERE live_event_id = ? AND user_id = ?
     LIMIT 1`,
    [liveEventId, userId]
  );
  return rows[0] || null;
}

async function getParticipantRow(liveEventId, userId) {
  const [rows] = await pool.execute(
    `SELECT *
     FROM live_session_participants
     WHERE live_event_id = ? AND user_id = ?
     LIMIT 1`,
    [liveEventId, userId]
  );
  return rows[0] || null;
}

async function getEffectivePermission(session, user) {
  const moderator = isModerator(user) || String(session.created_by || '') === String(user?.id || '');
  const override = await getPermissionOverride(session.id, user?.id);

  const base = {
    canJoin: true,
    canChat: moderator ? true : Boolean(session.chat_enabled),
    canMic: moderator ? true : Boolean(session.allow_participant_mic),
    canCamera: moderator ? true : Boolean(session.allow_participant_camera),
    canScreenshare: moderator ? true : Boolean(session.allow_participant_screenshare),
    canRaiseHand: moderator ? true : Boolean(session.allow_raise_hand),
    canReact: moderator ? true : Boolean(session.allow_reactions),
    canModerate: moderator,
  };

  if (!override) return base;

  return {
    canJoin: Boolean(override.can_join),
    canChat: Boolean(override.can_chat),
    canMic: Boolean(override.can_mic),
    canCamera: Boolean(override.can_camera),
    canScreenshare: Boolean(override.can_screenshare),
    canRaiseHand: Boolean(override.can_raise_hand),
    canReact: Boolean(override.can_react),
    canModerate: Boolean(override.can_moderate),
  };
}

async function assertSessionAccess(session, user) {
  if (!session) return { ok: false, status: 404, message: 'Live session not found.' };
  if (!user?.id) return { ok: false, status: 401, message: 'Unauthorized.' };

  if (isModerator(user) || String(session.created_by || '') === String(user.id)) {
    return { ok: true };
  }

  if (session.status === 'cancelled') {
    return { ok: false, status: 403, message: 'This session has been cancelled.' };
  }

  if (session.privacy === 'public') {
    return { ok: true };
  }

  if (session.privacy === 'event_registered_only') {
    const approved = await hasApprovedEventRegistration(session.event_id, user.id);
    if (approved) return { ok: true };
    return { ok: false, status: 403, message: 'This session is only available to approved event registrants.' };
  }

  const participant = await getParticipantRow(session.id, user.id);
  if (participant && participant.join_status !== 'removed') return { ok: true };

  const permission = await getPermissionOverride(session.id, user.id);
  if (permission && permission.can_join) return { ok: true };

  return { ok: false, status: 403, message: 'You do not have access to this private session.' };
}

async function syncViewerCount(liveEventId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM live_session_participants
     WHERE live_event_id = ? AND join_status = 'joined' AND role_in_session = 'viewer'`,
    [liveEventId]
  );
  const total = Number(rows[0]?.total || 0);
  await pool.execute('UPDATE live_events SET viewers_count = ? WHERE id = ?', [total, liveEventId]);
  return total;
}

async function upsertSessionRecording(liveEventId, recordingUrl, recordingPath, userId) {
  const [rows] = await pool.execute(
    `SELECT id
     FROM live_session_recordings
     WHERE live_event_id = ?
     ORDER BY id ASC
     LIMIT 1`,
    [liveEventId]
  );

  if (!rows.length) {
    if (!recordingUrl && !recordingPath) return;
    await pool.execute(
      `INSERT INTO live_session_recordings (live_event_id, recording_url, recording_path, created_by)
       VALUES (?, ?, ?, ?)`,
      [liveEventId, recordingUrl || null, recordingPath || null, userId || null]
    );
    return;
  }

  await pool.execute(
    `UPDATE live_session_recordings
     SET recording_url = ?, recording_path = ?, created_by = ?
     WHERE id = ?`,
    [recordingUrl || null, recordingPath || null, userId || null, rows[0].id]
  );
}

async function upsertSessionRecordingMetadata({
  liveEventId,
  recordingUrl,
  recordingPath,
  expiresAt,
  originalFilename,
  sizeBytes,
  mimeType,
  userId,
}) {
  const [rows] = await pool.execute(
    `SELECT id
     FROM live_session_recordings
     WHERE live_event_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [liveEventId]
  );

  if (!rows.length) {
    await pool.execute(
      `INSERT INTO live_session_recordings
        (live_event_id, recording_url, recording_path, expires_at, original_filename, size_bytes, mime_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        liveEventId,
        recordingUrl || null,
        recordingPath || null,
        expiresAt || null,
        originalFilename || null,
        sizeBytes || null,
        mimeType || null,
        userId || null,
      ]
    );
    return;
  }

  await pool.execute(
    `UPDATE live_session_recordings
     SET recording_url = ?, recording_path = ?, expires_at = ?, original_filename = ?, size_bytes = ?, mime_type = ?, created_by = ?
     WHERE id = ?`,
    [
      recordingUrl || null,
      recordingPath || null,
      expiresAt || null,
      originalFilename || null,
      sizeBytes || null,
      mimeType || null,
      userId || null,
      rows[0].id,
    ]
  );
}

async function ensureSessionParticipant(session, user, roleInSession) {
  const existing = await getParticipantRow(session.id, user.id);

  if (existing) {
    await pool.execute(
      `UPDATE live_session_participants
       SET role_in_session = ?, join_status = 'joined', left_at = NULL
       WHERE id = ?`,
      [roleInSession, existing.id]
    );
  } else {
    await pool.execute(
      `INSERT INTO live_session_participants
        (live_event_id, user_id, role_in_session, join_status, mic_enabled, camera_enabled, screen_share_enabled, hand_raised, joined_at)
       VALUES (?, ?, ?, 'joined', ?, ?, 0, 0, NOW())`,
      [
        session.id,
        user.id,
        roleInSession,
        roleInSession === 'viewer' ? 0 : toFlag(session.allow_participant_mic, 1),
        roleInSession === 'viewer' ? 0 : toFlag(session.allow_participant_camera, 1),
      ]
    );
  }

  const existingPermission = await getPermissionOverride(session.id, user.id);
  if (!existingPermission) {
    await pool.execute(
      `INSERT INTO live_session_permissions
        (live_event_id, user_id, can_join, can_chat, can_mic, can_camera, can_screenshare, can_raise_hand, can_react, can_moderate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        user.id,
        1,
        toFlag(session.chat_enabled, 1),
        roleInSession === 'viewer' ? 0 : toFlag(session.allow_participant_mic, 1),
        roleInSession === 'viewer' ? 0 : toFlag(session.allow_participant_camera, 1),
        roleInSession === 'viewer' ? 0 : toFlag(session.allow_participant_screenshare, 1),
        roleInSession === 'viewer' ? 0 : toFlag(session.allow_raise_hand, 1),
        toFlag(session.allow_reactions, 1),
        roleInSession === 'host' || roleInSession === 'moderator' ? 1 : 0,
      ]
    );
  }

  await syncViewerCount(session.id);
}

async function listLiveEvents(req, res) {
  const eventId = req.query.eventId ? Number(req.query.eventId) : null;
  const status = req.query.status ? safeString(req.query.status, 32) : '';
  const sessionType = req.query.sessionType ? safeString(req.query.sessionType, 32) : '';

  const where = [];
  const params = [];

  // Only return livestream sessions.
  where.push("le.session_type = 'livestream'");

  if (Number.isFinite(eventId)) {
    where.push('le.event_id = ?');
    params.push(eventId);
  }
  if (SESSION_STATUSES.includes(status)) {
    where.push('le.status = ?');
    params.push(status);
  }
  if (SESSION_TYPES.includes(sessionType)) {
    where.push('le.session_type = ?');
    params.push(sessionType);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT
       le.*,
       e.title AS event_title,
       creator.full_name AS created_by_name,
       COALESCE(participants.participant_count, 0) AS participant_count,
       COALESCE(participants.active_viewer_count, 0) AS active_viewer_count
     FROM live_events le
     LEFT JOIN events e ON e.id = le.event_id
     LEFT JOIN users creator ON creator.id = le.created_by
     LEFT JOIN (
       SELECT
         live_event_id,
         SUM(CASE WHEN join_status = 'joined' AND role_in_session <> 'viewer' THEN 1 ELSE 0 END) AS participant_count,
         SUM(CASE WHEN join_status = 'joined' AND role_in_session = 'viewer' THEN 1 ELSE 0 END) AS active_viewer_count
       FROM live_session_participants
       GROUP BY live_event_id
     ) participants ON participants.live_event_id = le.id
     ${sqlWhere}
     ORDER BY
       CASE le.status
         WHEN 'live' THEN 0
         WHEN 'scheduled' THEN 1
         WHEN 'ended' THEN 2
         ELSE 3
       END,
       le.start_at DESC,
       le.created_at DESC`,
    params
  );

  const accessible = [];
  for (const row of rows) {
    const access = await assertSessionAccess(row, req.user);
    if (access.ok || isModerator(req.user)) {
      accessible.push(toLiveEventDto(row));
    }
  }

  return json(res, 200, { success: true, liveEvents: accessible });
}

async function listLiveEventsByEvent(req, res) {
  req.query = { ...(req.query || {}), eventId: req.params.id };
  return listLiveEvents(req, res);
}

async function getLiveEventById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid live session id.' });

  const row = await getLiveEventRowById(id);
  if (row?.session_type !== 'livestream') return json(res, 404, { success: false, message: 'Live session not found.' });
  const access = await assertSessionAccess(row, req.user);
  if (!access.ok) return json(res, access.status, { success: false, message: access.message });

  const permissions = await getEffectivePermission(row, req.user);
  return json(res, 200, {
    success: true,
    liveEvent: toLiveEventDto(row),
    permissions,
  });
}

async function createLiveEvent(req, res) {
  const body = req.body || {};
  const title = safeString(body.title, 191);
  const description = safeString(body.description, 4000) || null;
  const hostLabel = safeString(body.hostLabel || req.user?.fullName, 191);
  const eventId = body.eventId ? Number(body.eventId) : null;
  const durationMinutes = Math.max(15, Number(body.durationMinutes || 60));
  const sessionType = 'livestream';
  const privacy = SESSION_PRIVACY.includes(String(body.privacy)) ? String(body.privacy) : 'public';
  const status = SESSION_STATUSES.includes(String(body.status)) ? String(body.status) : 'scheduled';
  const startAt = normalizeDateTime(body.startAt);
  const endAt = normalizeDateTime(body.endAt);
  const roomCode = normalizeRoomCode(body.roomCode || generateRoomCode(title));
  const sessionIdentifier = safeString(body.sessionId || body.sessionIdentifier, 64) || generateSessionIdentifier(title);
  const sessionToken = safeString(body.sessionToken, 96) || generateSessionToken();
  const joinLink = safeString(body.joinLink, 255) || buildInternalJoinLink(sessionIdentifier);
  const streamSource = ['external', 'built_in'].includes(body.streamSource) ? String(body.streamSource) : 'external';
  let streamUrl = safeString(body.streamUrl || body.meetingUrl, 255) || null;
  let meetingUrl = safeString(body.meetingUrl, 255) || streamUrl;

  if (streamSource === 'external') {
    if (!streamUrl) return json(res, 400, { success: false, message: 'Stream URL is required for external streams.' });
    meetingUrl = meetingUrl || streamUrl;
  } else {
    streamUrl = streamUrl || joinLink;
    meetingUrl = meetingUrl || joinLink;
  }

  const recordingEnabled = toFlag(body.recordingEnabled, 0);
  const recordingVisibility = ['host_only', 'registered_members', 'public_replay'].includes(String(body.recordingVisibility))
    ? String(body.recordingVisibility)
    : 'host_only';
  const recordingUrl = recordingEnabled ? (safeString(body.recordingUrl, 255) || null) : null;
  const recordingPath = safeString(body.recordingPath, 255) || null;
  const recordingExpiresAt = null;
  const waitingRoomEnabled = toFlag(body.waitingRoomEnabled, 0);

  if (!title) return json(res, 400, { success: false, message: 'Session title is required.' });
  if (!Number.isFinite(eventId)) return json(res, 400, { success: false, message: 'Linked event is required.' });
  if (startAt === 'invalid') return json(res, 400, { success: false, message: 'Invalid scheduled date/time.' });
  if (endAt === 'invalid') return json(res, 400, { success: false, message: 'Invalid end date/time.' });
  if (!startAt) return json(res, 400, { success: false, message: 'Start date/time is required.' });
  if (endAt && endAt < startAt) return json(res, 400, { success: false, message: 'End time must not be earlier than start time.' });
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
    return json(res, 400, { success: false, message: 'Duration must be at least 15 minutes.' });
  }
  const event = await ensureEventExists(eventId);
  if (!event) return json(res, 404, { success: false, message: 'Linked event not found.' });

  const [result] = await pool.execute(
      `INSERT INTO live_events
        (event_id, session_identifier, title, description, host_label, start_at, end_at, duration_minutes, session_type, privacy, status, meeting_url, join_link, stream_url, stream_source,
         chat_enabled, allow_participant_mic, allow_participant_camera, allow_participant_screenshare, waiting_room_enabled, allow_raise_hand, allow_reactions, session_token,
         recording_enabled, recording_visibility, recording_url, recording_path, recording_expires_at, viewers_count, room_code, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        sessionIdentifier,
        title,
        description,
        hostLabel,
        startAt || null,
        endAt || null,
        durationMinutes,
        sessionType,
        privacy,
        status,
        meetingUrl,
        joinLink,
        streamUrl,
        streamSource,
        toFlag(body.chatEnabled, 1),
      toFlag(body.allowParticipantMic, 1),
      toFlag(body.allowParticipantCamera, 1),
      toFlag(body.allowParticipantScreenshare, 1),
      waitingRoomEnabled,
      toFlag(body.allowRaiseHand, 1),
      toFlag(body.allowReactions, 1),
      sessionToken,
      recordingEnabled,
      recordingVisibility,
      recordingUrl,
      recordingPath,
      recordingExpiresAt,
      0,
      roomCode || null,
      req.user?.id || null,
    ]
  );

  await upsertSessionRecording(result.insertId, recordingUrl, recordingPath, req.user?.id || null);
  const created = await getLiveEventRowById(result.insertId);
  if (created) await ensureSessionParticipant(created, req.user, 'host');

  const row = await getLiveEventRowById(result.insertId);
  return json(res, 201, { success: true, liveEvent: toLiveEventDto(row) });
}

async function updateLiveEvent(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid live session id.' });

  const existing = await getLiveEventRowById(id);
  if (!existing) return json(res, 404, { success: false, message: 'Live session not found.' });
  if (!(isModerator(req.user) || String(existing.created_by || '') === String(req.user?.id || ''))) {
    return json(res, 403, { success: false, message: 'You do not have permission to update this session.' });
  }

  const body = req.body || {};
  const sets = [];
  const params = [];

  const stringFields = [
    ['sessionId', 'session_identifier', 64],
    ['title', 'title', 191],
    ['description', 'description', 4000],
    ['hostLabel', 'host_label', 191],
    ['joinLink', 'join_link', 255],
    ['streamUrl', 'stream_url', 255],
    ['sessionToken', 'session_token', 96],
    ['recordingUrl', 'recording_url', 255],
    ['recordingPath', 'recording_path', 255],
  ];

  for (const [inputKey, column, max] of stringFields) {
    if (body[inputKey] !== undefined) {
      const value = safeString(body[inputKey], max) || null;
      if (inputKey === 'title' && !value) return json(res, 400, { success: false, message: 'Session title is required.' });
      sets.push(`${column} = ?`);
      params.push(value);
    }
  }

  // Keep url columns aligned for livestream sessions.
  if (body.streamSource !== undefined) {
    const streamSource = ['external', 'built_in'].includes(body.streamSource) ? String(body.streamSource) : null;
    if (!streamSource) return json(res, 400, { success: false, message: 'Invalid stream source.' });
    sets.push('stream_source = ?');
    params.push(streamSource);
  }

  if (body.streamUrl !== undefined && body.meetingUrl === undefined) {
    const value = safeString(body.streamUrl, 255) || null;
    const currentSource = body.streamSource !== undefined ? body.streamSource : existing.stream_source;
    if (currentSource === 'external' && !value) return json(res, 400, { success: false, message: 'Stream URL is required.' });
    sets.push('meeting_url = ?');
    params.push(value || existing.join_link || '');
  }

  if (body.eventId !== undefined) {
    const eventId = body.eventId ? Number(body.eventId) : null;
    if (eventId) {
      const event = await ensureEventExists(eventId);
      if (!event) return json(res, 404, { success: false, message: 'Linked event not found.' });
    }
    sets.push('event_id = ?');
    params.push(eventId);
  }
  if (body.startAt !== undefined) {
    const startAt = normalizeDateTime(body.startAt);
    if (startAt === 'invalid') return json(res, 400, { success: false, message: 'Invalid scheduled date/time.' });
    sets.push('start_at = ?');
    params.push(startAt);
  }
  if (body.endAt !== undefined) {
    const endAt = normalizeDateTime(body.endAt);
    if (endAt === 'invalid') return json(res, 400, { success: false, message: 'Invalid end date/time.' });
    sets.push('end_at = ?');
    params.push(endAt);
  }
  if (body.durationMinutes !== undefined) {
    const durationMinutes = Math.max(15, Number(body.durationMinutes || 0));
    if (!Number.isFinite(durationMinutes)) return json(res, 400, { success: false, message: 'Invalid duration.' });
    sets.push('duration_minutes = ?');
    params.push(durationMinutes);
  }
  if (body.sessionType !== undefined) {
    const sessionType = String(body.sessionType);
    if (sessionType !== 'livestream') return json(res, 400, { success: false, message: 'Only livestream sessions are supported.' });
  }
  if (body.privacy !== undefined) {
    const privacy = SESSION_PRIVACY.includes(String(body.privacy)) ? String(body.privacy) : null;
    if (!privacy) return json(res, 400, { success: false, message: 'Invalid session privacy.' });
    sets.push('privacy = ?');
    params.push(privacy);
  }
  if (body.status !== undefined) {
    const status = SESSION_STATUSES.includes(String(body.status)) ? String(body.status) : null;
    if (!status) return json(res, 400, { success: false, message: 'Invalid session status.' });
    sets.push('status = ?');
    params.push(status);
  }

  const toggleFields = [
    ['chatEnabled', 'chat_enabled'],
    ['allowParticipantMic', 'allow_participant_mic'],
    ['allowParticipantCamera', 'allow_participant_camera'],
    ['allowParticipantScreenshare', 'allow_participant_screenshare'],
    ['waitingRoomEnabled', 'waiting_room_enabled'],
    ['allowRaiseHand', 'allow_raise_hand'],
    ['allowReactions', 'allow_reactions'],
    ['recordingEnabled', 'recording_enabled'],
  ];
  for (const [inputKey, column] of toggleFields) {
    if (body[inputKey] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(toFlag(body[inputKey], 0));
    }
  }
  if (body.viewersCount !== undefined) {
    sets.push('viewers_count = ?');
    params.push(Math.max(0, Number(body.viewersCount || 0)));
  }
  if (body.roomCode !== undefined) {
    sets.push('room_code = ?');
    params.push(normalizeRoomCode(body.roomCode) || null);
  }
  if (body.recordingVisibility !== undefined) {
    const recordingVisibility = ['host_only', 'registered_members', 'public_replay'].includes(String(body.recordingVisibility))
      ? String(body.recordingVisibility)
      : null;
    if (!recordingVisibility) return json(res, 400, { success: false, message: 'Invalid recording visibility.' });
    sets.push('recording_visibility = ?');
    params.push(recordingVisibility);
  }

  if (!sets.length) return json(res, 400, { success: false, message: 'No fields to update.' });

  const nextStartAt = body.startAt !== undefined
    ? normalizeDateTime(body.startAt)
    : existing.start_at;
  const nextEndAt = body.endAt !== undefined
    ? normalizeDateTime(body.endAt)
    : existing.end_at;
  if (nextStartAt === 'invalid' || nextEndAt === 'invalid') {
    return json(res, 400, { success: false, message: 'Invalid session schedule.' });
  }
  if (nextStartAt && nextEndAt && new Date(nextEndAt) < new Date(nextStartAt)) {
    return json(res, 400, { success: false, message: 'End time must not be earlier than start time.' });
  }

  params.push(id);
  await pool.execute(`UPDATE live_events SET ${sets.join(', ')} WHERE id = ?`, params);

  if (body.recordingUrl !== undefined || body.recordingPath !== undefined) {
    await upsertSessionRecording(
      id,
      body.recordingUrl !== undefined ? safeString(body.recordingUrl, 255) || null : existing.recording_url || null,
      body.recordingPath !== undefined ? safeString(body.recordingPath, 255) || null : existing.recording_path || null,
      req.user?.id || null
    );
  }

  const row = await getLiveEventRowById(id);
  return json(res, 200, { success: true, liveEvent: toLiveEventDto(row) });
}

async function deleteLiveEvent(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid live session id.' });

  const existing = await getLiveEventRowById(id);
  if (!existing) return json(res, 404, { success: false, message: 'Live session not found.' });
  if (!(isModerator(req.user) || String(existing.created_by || '') === String(req.user?.id || ''))) {
    return json(res, 403, { success: false, message: 'You do not have permission to delete this session.' });
  }

  await pool.execute('DELETE FROM live_events WHERE id = ?', [id]);
  return json(res, 200, { success: true });
}

async function startLiveEvent(req, res) {
  req.body = { ...(req.body || {}), status: 'live' };
  return updateLiveEvent(req, res);
}

async function endLiveEvent(req, res) {
  req.body = { ...(req.body || {}), status: 'ended' };
  return updateLiveEvent(req, res);
}

async function cancelLiveEvent(req, res) {
  req.body = { ...(req.body || {}), status: 'cancelled' };
  return updateLiveEvent(req, res);
}

async function joinLiveEvent(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid live session id.' });

  const session = await getLiveEventRowById(id);
  const access = await assertSessionAccess(session, req.user);
  if (!access.ok) return json(res, access.status, { success: false, message: access.message });
  if (session.status === 'ended') return json(res, 409, { success: false, message: 'This session has already ended.' });

  const roleInSession = isModerator(req.user)
    ? 'host'
    : session.session_type === 'livestream'
      ? 'viewer'
      : 'participant';

  await ensureSessionParticipant(session, req.user, roleInSession);

  const updated = await getLiveEventRowById(id);
  const participant = await getParticipantRow(id, req.user.id);
  const permissions = await getEffectivePermission(updated, req.user);

  return json(res, 200, {
    success: true,
    liveEvent: toLiveEventDto(updated),
    participant: participant
      ? {
          id: String(participant.id),
          roleInSession: participant.role_in_session,
          joinStatus: participant.join_status,
          micEnabled: Boolean(participant.mic_enabled),
          cameraEnabled: Boolean(participant.camera_enabled),
          screenShareEnabled: Boolean(participant.screen_share_enabled),
          handRaised: Boolean(participant.hand_raised),
        }
      : null,
    permissions,
  });
}

async function leaveLiveEvent(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid live session id.' });

  const session = await getLiveEventRowById(id);
  const access = await assertSessionAccess(session, req.user);
  if (!access.ok) return json(res, access.status, { success: false, message: access.message });

  await pool.execute(
    `UPDATE live_session_participants
     SET join_status = 'left', left_at = NOW()
     WHERE live_event_id = ? AND user_id = ?`,
    [id, req.user.id]
  );
  const viewersCount = await syncViewerCount(id);

  return json(res, 200, { success: true, counts: { viewersCount } });
}

async function listLiveEventParticipants(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid live session id.' });

  const session = await getLiveEventRowById(id);
  const access = await assertSessionAccess(session, req.user);
  if (!access.ok) return json(res, access.status, { success: false, message: access.message });

  const [rows] = await pool.execute(
    `SELECT
       p.*,
       u.full_name AS user_name,
       u.email AS user_email,
       u.role AS user_role,
       perms.can_join,
       perms.can_chat,
       perms.can_mic,
       perms.can_camera,
       perms.can_screenshare,
       perms.can_raise_hand,
       perms.can_react,
       perms.can_moderate
     FROM live_session_participants p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN live_session_permissions perms
       ON perms.live_event_id = p.live_event_id
      AND perms.user_id = p.user_id
     WHERE p.live_event_id = ?
     ORDER BY
       CASE p.join_status WHEN 'joined' THEN 0 WHEN 'left' THEN 1 ELSE 2 END,
       CASE p.role_in_session WHEN 'host' THEN 0 WHEN 'moderator' THEN 1 WHEN 'participant' THEN 2 ELSE 3 END,
       p.joined_at ASC`,
    [id]
  );

  return json(res, 200, { success: true, participants: rows.map(toParticipantDto) });
}

async function updateLiveEventParticipant(req, res) {
  const id = Number(req.params.id);
  const participantUserId = Number(req.params.userId);
  if (!Number.isFinite(id) || !Number.isFinite(participantUserId)) {
    return json(res, 400, { success: false, message: 'Invalid participant request.' });
  }

  const session = await getLiveEventRowById(id);
  if (!session) return json(res, 404, { success: false, message: 'Live session not found.' });
  if (!(isModerator(req.user) || String(session.created_by || '') === String(req.user?.id || ''))) {
    return json(res, 403, { success: false, message: 'You do not have permission to moderate this session.' });
  }

  const body = req.body || {};
  const participant = await getParticipantRow(id, participantUserId);
  if (!participant) return json(res, 404, { success: false, message: 'Participant not found in this session.' });

  const participantSets = [];
  const participantParams = [];

  if (body.roleInSession !== undefined) {
    const roleInSession = ['host', 'moderator', 'participant', 'viewer'].includes(String(body.roleInSession))
      ? String(body.roleInSession)
      : null;
    if (!roleInSession) return json(res, 400, { success: false, message: 'Invalid session role.' });
    participantSets.push('role_in_session = ?');
    participantParams.push(roleInSession);
  }
  if (body.joinStatus !== undefined) {
    const joinStatus = ['joined', 'left', 'removed'].includes(String(body.joinStatus))
      ? String(body.joinStatus)
      : null;
    if (!joinStatus) return json(res, 400, { success: false, message: 'Invalid join status.' });
    participantSets.push('join_status = ?');
    participantParams.push(joinStatus);
    participantSets.push(joinStatus === 'joined' ? 'left_at = NULL' : 'left_at = NOW()');
  }
  if (body.micEnabled !== undefined) {
    participantSets.push('mic_enabled = ?');
    participantParams.push(toFlag(body.micEnabled, 0));
  }
  if (body.cameraEnabled !== undefined) {
    participantSets.push('camera_enabled = ?');
    participantParams.push(toFlag(body.cameraEnabled, 0));
  }
  if (body.screenShareEnabled !== undefined) {
    participantSets.push('screen_share_enabled = ?');
    participantParams.push(toFlag(body.screenShareEnabled, 0));
  }
  if (body.handRaised !== undefined) {
    participantSets.push('hand_raised = ?');
    participantParams.push(toFlag(body.handRaised, 0));
  }

  if (participantSets.length) {
    participantParams.push(participant.id);
    await pool.execute(`UPDATE live_session_participants SET ${participantSets.join(', ')} WHERE id = ?`, participantParams);
  }

  const permissionFields = [
    ['canJoin', 'can_join'],
    ['canChat', 'can_chat'],
    ['canMic', 'can_mic'],
    ['canCamera', 'can_camera'],
    ['canScreenshare', 'can_screenshare'],
    ['canRaiseHand', 'can_raise_hand'],
    ['canReact', 'can_react'],
    ['canModerate', 'can_moderate'],
  ];
  const permissionSet = [];
  const permissionParams = [];
  for (const [inputKey, column] of permissionFields) {
    if (body[inputKey] !== undefined) {
      permissionSet.push(`${column} = ?`);
      permissionParams.push(toFlag(body[inputKey], 0));
    }
  }

  if (permissionSet.length) {
    const existingPermission = await getPermissionOverride(id, participantUserId);
    if (existingPermission) {
      permissionParams.push(existingPermission.id);
      await pool.execute(`UPDATE live_session_permissions SET ${permissionSet.join(', ')} WHERE id = ?`, permissionParams);
    } else {
      const values = {
        canJoin: body.canJoin !== undefined ? toFlag(body.canJoin, 0) : 1,
        canChat: body.canChat !== undefined ? toFlag(body.canChat, 0) : toFlag(session.chat_enabled, 1),
        canMic: body.canMic !== undefined ? toFlag(body.canMic, 0) : toFlag(session.allow_participant_mic, 1),
        canCamera: body.canCamera !== undefined ? toFlag(body.canCamera, 0) : toFlag(session.allow_participant_camera, 1),
        canScreenshare: body.canScreenshare !== undefined ? toFlag(body.canScreenshare, 0) : toFlag(session.allow_participant_screenshare, 1),
        canRaiseHand: body.canRaiseHand !== undefined ? toFlag(body.canRaiseHand, 0) : toFlag(session.allow_raise_hand, 1),
        canReact: body.canReact !== undefined ? toFlag(body.canReact, 0) : toFlag(session.allow_reactions, 1),
        canModerate: body.canModerate !== undefined ? toFlag(body.canModerate, 0) : 0,
      };

      await pool.execute(
        `INSERT INTO live_session_permissions
          (live_event_id, user_id, can_join, can_chat, can_mic, can_camera, can_screenshare, can_raise_hand, can_react, can_moderate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          participantUserId,
          values.canJoin,
          values.canChat,
          values.canMic,
          values.canCamera,
          values.canScreenshare,
          values.canRaiseHand,
          values.canReact,
          values.canModerate,
        ]
      );
    }
  }

  await syncViewerCount(id);
  return listLiveEventParticipants(req, res);
}

async function updateLiveEventPermissions(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid live session id.' });

  const session = await getLiveEventRowById(id);
  if (!session) return json(res, 404, { success: false, message: 'Live session not found.' });
  if (!(isModerator(req.user) || String(session.created_by || '') === String(req.user?.id || ''))) {
    return json(res, 403, { success: false, message: 'You do not have permission to update session permissions.' });
  }

  const body = req.body || {};
  const mapping = [
    ['chatEnabled', 'chat_enabled'],
    ['allowParticipantMic', 'allow_participant_mic'],
    ['allowParticipantCamera', 'allow_participant_camera'],
    ['allowParticipantScreenshare', 'allow_participant_screenshare'],
    ['allowRaiseHand', 'allow_raise_hand'],
    ['allowReactions', 'allow_reactions'],
  ];

  const sets = [];
  const params = [];
  for (const [inputKey, column] of mapping) {
    if (body[inputKey] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(toFlag(body[inputKey], 0));
    }
  }

  if (!sets.length) return json(res, 400, { success: false, message: 'No session permissions to update.' });
  params.push(id);
  await pool.execute(`UPDATE live_events SET ${sets.join(', ')} WHERE id = ?`, params);

  const row = await getLiveEventRowById(id);
  return json(res, 200, { success: true, liveEvent: toLiveEventDto(row) });
}

async function listLiveEventChatMessages(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid live session id.' });

  const session = await getLiveEventRowById(id);
  const access = await assertSessionAccess(session, req.user);
  if (!access.ok) return json(res, access.status, { success: false, message: access.message });

  const [rows] = await pool.execute(
    `SELECT m.*, u.full_name, u.username, u.role
     FROM live_event_chat_messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.live_event_id = ?
     ORDER BY m.created_at ASC
     LIMIT 300`,
    [id]
  );

  return json(res, 200, { success: true, messages: rows.map(toMessageDto) });
}

async function createLiveEventChatMessage(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid live session id.' });

  const session = await getLiveEventRowById(id);
  const access = await assertSessionAccess(session, req.user);
  if (!access.ok) return json(res, access.status, { success: false, message: access.message });

  const permissions = await getEffectivePermission(session, req.user);
  if (!permissions.canChat) return json(res, 403, { success: false, message: 'Chat is disabled for this session.' });

  const message = sanitizeMessage(req.body?.message);
  if (!message) return json(res, 400, { success: false, message: 'Message is required.' });

  await ensureSessionParticipant(
    session,
    req.user,
    isModerator(req.user) ? 'host' : session.session_type === 'livestream' ? 'viewer' : 'participant'
  );

  const [result] = await pool.execute(
    `INSERT INTO live_event_chat_messages (live_event_id, user_id, message)
     VALUES (?, ?, ?)`,
    [id, req.user.id, message]
  );

  const [rows] = await pool.execute(
    `SELECT m.*, u.full_name, u.username, u.role
     FROM live_event_chat_messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.id = ?
     LIMIT 1`,
    [result.insertId]
  );

  return json(res, 201, { success: true, message: toMessageDto(rows[0]) });
}

async function validateLiveEventRoomCode(req, res) {
  const roomCode = normalizeRoomCode(req.body?.roomCode);
  if (!roomCode) return json(res, 400, { success: false, message: 'Room code is required.' });

  const [rows] = await pool.execute(
    `SELECT
       le.*,
       e.title AS event_title,
       creator.full_name AS created_by_name,
       COALESCE(participants.participant_count, 0) AS participant_count,
       COALESCE(participants.active_viewer_count, 0) AS active_viewer_count
     FROM live_events le
     LEFT JOIN events e ON e.id = le.event_id
     LEFT JOIN users creator ON creator.id = le.created_by
     LEFT JOIN (
       SELECT
         live_event_id,
         SUM(CASE WHEN join_status = 'joined' AND role_in_session <> 'viewer' THEN 1 ELSE 0 END) AS participant_count,
         SUM(CASE WHEN join_status = 'joined' AND role_in_session = 'viewer' THEN 1 ELSE 0 END) AS active_viewer_count
       FROM live_session_participants
       GROUP BY live_event_id
     ) participants ON participants.live_event_id = le.id
     WHERE le.room_code = ?
     ORDER BY le.created_at DESC
     LIMIT 1`,
    [roomCode]
  );

  const session = rows[0] || null;
  const access = await assertSessionAccess(session, req.user);
  if (!access.ok) return json(res, access.status, { success: false, message: access.message });

  return json(res, 200, { success: true, liveEvent: toLiveEventDto(session) });
}

async function getLiveEventCounts(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid live session id.' });

  const session = await getLiveEventRowById(id);
  const access = await assertSessionAccess(session, req.user);
  if (!access.ok) return json(res, access.status, { success: false, message: access.message });

  const [rows] = await pool.execute(
    `SELECT
       SUM(CASE WHEN join_status = 'joined' AND role_in_session <> 'viewer' THEN 1 ELSE 0 END) AS participantCount,
       SUM(CASE WHEN join_status = 'joined' AND role_in_session = 'viewer' THEN 1 ELSE 0 END) AS viewerCount
     FROM live_session_participants
     WHERE live_event_id = ?`,
    [id]
  );

  const counts = {
    participantCount: Number(rows[0]?.participantCount || 0),
    viewerCount: Number(rows[0]?.viewerCount || 0),
  };

  await pool.execute('UPDATE live_events SET viewers_count = ? WHERE id = ?', [counts.viewerCount, id]);
  return json(res, 200, { success: true, counts });
}

async function uploadLiveEventRecording(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid live session id.' });

  const existing = await getLiveEventRowById(id);
  if (!existing || existing.session_type !== 'livestream') return json(res, 404, { success: false, message: 'Live session not found.' });
  if (!(isModerator(req.user) || String(existing.created_by || '') === String(req.user?.id || ''))) {
    return json(res, 403, { success: false, message: 'You do not have permission to upload a recording for this session.' });
  }

  const contentType = String(req.headers['content-type'] || 'application/octet-stream').trim();
  const originalFilename = safeFilename(req.headers['x-filename'] || req.query.filename);
  const ext = guessExtensionFromMime(contentType);

  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  if (!buffer.length) return json(res, 400, { success: false, message: 'Recording upload body is empty.' });

  const uploadsDir = path.join(__dirname, 'uploads', 'live-recordings');
  await fs.mkdir(uploadsDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeBase = `${id}-${stamp}-${crypto.randomBytes(4).toString('hex')}`;
  const base = originalFilename ? `${safeBase}-${originalFilename}` : `live-session-${safeBase}.${ext}`;
  const baseSafe = String(base).replace(/\s+/g, '_').slice(0, 180);
  const finalFilename = baseSafe.includes('.') ? baseSafe : `${baseSafe}.${ext}`;

  const fullPath = path.join(uploadsDir, finalFilename);
  await fs.writeFile(fullPath, buffer);

  const relativePosixPath = `uploads/live-recordings/${finalFilename}`;
  const expiresAt = addDays(new Date(), RECORDING_RETENTION_DAYS);
  const downloadUrl = `/api/live-events/${id}/recording/download`;

  await pool.execute(
    `UPDATE live_events
     SET recording_enabled = 1,
         recording_url = ?,
         recording_path = ?,
         recording_expires_at = ?
     WHERE id = ?`,
    [downloadUrl, relativePosixPath, expiresAt, id]
  );

  await upsertSessionRecordingMetadata({
    liveEventId: id,
    recordingUrl: downloadUrl,
    recordingPath: relativePosixPath,
    expiresAt,
    originalFilename: originalFilename || null,
    sizeBytes: buffer.length,
    mimeType: contentType,
    userId: req.user?.id || null,
  });

  const updated = await getLiveEventRowById(id);
  return json(res, 200, { success: true, liveEvent: toLiveEventDto(updated) });
}

async function downloadLiveEventRecording(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid live session id.' });

  const row = await getLiveEventRowById(id);
  if (!row || row.session_type !== 'livestream') return json(res, 404, { success: false, message: 'Live session not found.' });

  const access = await assertSessionAccess(row, req.user);
  if (!access.ok) return json(res, access.status, { success: false, message: access.message });

  if (!row.recording_path) return json(res, 404, { success: false, message: 'Recording not available.' });
  if (row.recording_expires_at && new Date(row.recording_expires_at).getTime() <= Date.now()) {
    return json(res, 410, { success: false, message: 'Recording expired.' });
  }

  const fullPath = resolveUploadPath(row.recording_path);
  if (!fullPath) return json(res, 404, { success: false, message: 'Recording not available.' });

  try {
    await fs.stat(fullPath);
  } catch {
    return json(res, 404, { success: false, message: 'Recording not available.' });
  }

  const name = safeFilename(row.title) || `live-session-${id}`;
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.mp4"`);
  res.sendFile(fullPath);
}

async function cleanupExpiredLiveEventRecordings() {
  const [rows] = await pool.execute(
    `SELECT id, recording_path
     FROM live_events
     WHERE recording_path IS NOT NULL
       AND recording_expires_at IS NOT NULL
       AND recording_expires_at <= NOW()`
  );

  for (const row of rows) {
    const fullPath = resolveUploadPath(row.recording_path);
    if (fullPath) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await fs.unlink(fullPath);
      } catch {
        // ignore
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await pool.execute(
      `UPDATE live_events
       SET recording_enabled = 0,
           recording_url = NULL,
           recording_path = NULL,
           recording_expires_at = NULL
       WHERE id = ?`,
      [row.id]
    );

    // eslint-disable-next-line no-await-in-loop
    await pool.execute(
      `DELETE FROM live_session_recordings
       WHERE live_event_id = ? AND expires_at IS NOT NULL AND expires_at <= NOW()`,
      [row.id]
    );
  }

  return rows.length;
}

module.exports = {
  listLiveEvents,
  listLiveEventsByEvent,
  getLiveEventById,
  createLiveEvent,
  updateLiveEvent,
  deleteLiveEvent,
  startLiveEvent,
  endLiveEvent,
  cancelLiveEvent,
  joinLiveEvent,
  leaveLiveEvent,
  listLiveEventParticipants,
  updateLiveEventParticipant,
  updateLiveEventPermissions,
  listLiveEventChatMessages,
  createLiveEventChatMessage,
  validateLiveEventRoomCode,
  getLiveEventCounts,
  uploadLiveEventRecording,
  downloadLiveEventRecording,
  cleanupExpiredLiveEventRecordings,
  getLiveEventRowById,
  assertSessionAccess,
  ensureSessionParticipant,
  getEffectivePermission,
  getParticipantRow,
  syncViewerCount,
  toParticipantDto,
  toMessageDto,
};

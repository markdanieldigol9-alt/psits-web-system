const { pool } = require('./db');

function json(res, status, body) {
  return res.status(status).json(body);
}

/**
 * Schedule rules for venue attendance (time in / time out).
 * - Time-in opens TIME_IN_OPENS_BEFORE_MIN minutes before the scheduled start
 *   and closes at the scheduled end.
 * - Arrivals later than LATE_GRACE_MIN after the start are flagged as "Late".
 * - Departures before the scheduled end are flagged as "Left Early".
 * - After the event ends, officers may auto time-out everyone still in venue
 *   at the scheduled end time.
 */
const TIME_IN_OPENS_BEFORE_MIN = 120;
const LATE_GRACE_MIN = 15;

const toIso = (value) => (value ? new Date(value).toISOString() : null);

/**
 * Resolve the effective schedule window of an event.
 * If no end time is configured, the event is assumed to end at 23:59:59 of its start day.
 */
function resolveSchedule(eventRow) {
  const startAt = eventRow.start_at ? new Date(eventRow.start_at) : null;
  let endAt = eventRow.end_at ? new Date(eventRow.end_at) : null;
  if (startAt && (!endAt || endAt.getTime() < startAt.getTime())) {
    endAt = new Date(startAt);
    endAt.setHours(23, 59, 59, 0);
  }
  const timeInOpensAt = startAt ? new Date(startAt.getTime() - TIME_IN_OPENS_BEFORE_MIN * 60000) : null;
  return { startAt, endAt, timeInOpensAt };
}

function formatScheduleTime(date) {
  if (!date) return 'TBA';
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Split participant keys (reg-#, inst-#) into numeric id buckets. */
function parseParticipantKeys(keys) {
  const instIds = [];
  const regIds = [];
  for (const key of keys) {
    if (typeof key !== 'string') continue;
    if (key.startsWith('inst-')) {
      const id = Number(key.slice(5));
      if (Number.isInteger(id) && id > 0) instIds.push(id);
    } else if (key.startsWith('reg-')) {
      const id = Number(key.slice(4));
      if (Number.isInteger(id) && id > 0) regIds.push(id);
    }
  }
  return { instIds, regIds };
}

async function loadEvent(eventId) {
  const [rows] = await pool.execute(
    `SELECT id, title, start_at, end_at, location, status, capacity, theme_color
     FROM events
     WHERE id = ? LIMIT 1`,
    [eventId]
  );
  return rows[0] || null;
}

/**
 * Get unified attendance sheet (time in / time out) for an event.
 * Aggregates individual self-registrations and institution batch rosters.
 */
async function getEventAttendance(req, res) {
  try {
    const eventId = Number(req.params.id);
    if (!eventId || Number.isNaN(eventId)) {
      return json(res, 400, { success: false, message: 'Valid event ID is required.' });
    }

    const event = await loadEvent(eventId);
    if (!event) {
      return json(res, 404, { success: false, message: 'Event not found.' });
    }

    const schedule = resolveSchedule(event);

    const [participants] = await pool.query(
      `SELECT
         CONCAT('reg-', er.id) AS participant_key,
         'Individual Registration' AS registration_source,
         er.id AS record_id,
         u.full_name,
         u.email,
         u.contact_number,
         COALESCE(u.sector_details, CASE WHEN u.member_type = 'institution' THEN u.full_name ELSE 'PSITS Individual Member' END) AS institution_name,
         COALESCE(u.occupation, u.sector, u.member_type, 'Member') AS position,
         er.status AS registration_status,
         (er.is_checked_in = 1 OR er.checked_in_count > 0) AS is_checked_in,
         er.checked_in_at,
         er.checked_out_at,
         er.created_at AS registered_at
       FROM event_registrations er
       JOIN users u ON u.id = er.member_id
       WHERE er.event_id = ? AND er.status <> 'rejected'

       UNION ALL

       SELECT
         CONCAT('inst-', im.id) AS participant_key,
         'Institution Roster' AS registration_source,
         im.id AS record_id,
         im.full_name,
         im.email,
         im.contact_number,
         COALESCE(u.sector_details, u.full_name, 'Institution Member') AS institution_name,
         COALESCE(im.position, 'Participant') AS position,
         im.status AS registration_status,
         (im.checked_in = 1) AS is_checked_in,
         im.checked_in_at,
         im.checked_out_at,
         im.created_at AS registered_at
       FROM institution_members im
       JOIN users u ON u.id = im.institution_user_id
       WHERE (im.event_id = ? OR (im.event_id IS NULL AND im.event_title = ?)) AND im.status <> 'rejected'
       ORDER BY institution_name ASC, full_name ASC`,
      [eventId, eventId, event.title]
    );

    let totalCheckedIn = 0;
    let totalTimedOut = 0;
    let totalLate = 0;
    const lateThreshold = schedule.startAt ? schedule.startAt.getTime() + LATE_GRACE_MIN * 60000 : null;
    const instMap = new Map();

    for (const p of participants) {
      const isChecked = Boolean(p.is_checked_in);
      if (isChecked) {
        totalCheckedIn++;
        if (p.checked_out_at) totalTimedOut++;
        if (lateThreshold && p.checked_in_at && new Date(p.checked_in_at).getTime() > lateThreshold) totalLate++;
      }

      const instName = p.institution_name || 'Individual Members';
      if (!instMap.has(instName)) {
        instMap.set(instName, { institutionName: instName, registeredCount: 0, checkedInCount: 0 });
      }
      const entry = instMap.get(instName);
      entry.registeredCount++;
      if (isChecked) entry.checkedInCount++;
    }

    const institutionBreakdown = Array.from(instMap.values())
      .map((item) => ({
        ...item,
        attendanceRate: item.registeredCount > 0 ? Number(((item.checkedInCount / item.registeredCount) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.checkedInCount - a.checkedInCount || b.registeredCount - a.registeredCount);

    const totalRegistered = participants.length;
    const attendanceRate = totalRegistered > 0 ? Number(((totalCheckedIn / totalRegistered) * 100).toFixed(1)) : 0;

    return json(res, 200, {
      success: true,
      event: {
        id: String(event.id),
        title: event.title,
        status: event.status,
        location: event.location,
        startAt: toIso(schedule.startAt),
        endAt: toIso(schedule.endAt),
        capacity: event.capacity,
        themeColor: event.theme_color,
      },
      schedule: {
        startAt: toIso(schedule.startAt),
        endAt: toIso(schedule.endAt),
        timeInOpensAt: toIso(schedule.timeInOpensAt),
        timeInOpensBeforeMinutes: TIME_IN_OPENS_BEFORE_MIN,
        lateGraceMinutes: LATE_GRACE_MIN,
      },
      summary: {
        totalRegistered,
        totalCheckedIn,
        notCheckedIn: Math.max(0, totalRegistered - totalCheckedIn),
        currentlyInVenue: Math.max(0, totalCheckedIn - totalTimedOut),
        totalTimedOut,
        totalLate,
        attendanceRate,
        totalInstitutions: institutionBreakdown.length,
      },
      institutionBreakdown,
      participants: participants.map((p) => ({
        participantKey: p.participant_key,
        registrationSource: p.registration_source,
        recordId: p.record_id,
        fullName: p.full_name,
        email: p.email || '',
        contactNumber: p.contact_number || '',
        institutionName: p.institution_name,
        position: p.position,
        registrationStatus: p.registration_status,
        isCheckedIn: Boolean(p.is_checked_in),
        checkedInAt: toIso(p.checked_in_at),
        checkedOutAt: p.is_checked_in ? toIso(p.checked_out_at) : null,
        registeredAt: toIso(p.registered_at),
      })),
    });
  } catch (err) {
    console.error('getEventAttendance error:', err);
    return json(res, 500, { success: false, message: 'Failed to load event attendance.', error: err.message });
  }
}

/**
 * Record schedule-based venue attendance for one or many participants.
 * Body: { participantKeys: string[] (or participantKey), action }
 *   action = 'time_in' | 'time_out' | 'undo_time_out' | 'auto_time_out' | 'reset'
 * Restricted to admins & officers at the route level.
 */
async function recordAttendanceTime(req, res) {
  try {
    const eventId = Number(req.params.id);
    if (!eventId || Number.isNaN(eventId)) {
      return json(res, 400, { success: false, message: 'Valid event ID is required.' });
    }

    const { action } = req.body || {};
    const allowedActions = ['time_in', 'time_out', 'undo_time_out', 'auto_time_out', 'reset'];
    if (!allowedActions.includes(action)) {
      return json(res, 400, { success: false, message: `action must be one of: ${allowedActions.join(', ')}.` });
    }

    const rawKeys = Array.isArray(req.body.participantKeys)
      ? req.body.participantKeys
      : req.body.participantKey
      ? [req.body.participantKey]
      : [];
    const { instIds, regIds } = parseParticipantKeys(rawKeys);
    if (instIds.length === 0 && regIds.length === 0) {
      return json(res, 400, { success: false, message: 'At least one valid participant key (reg-# or inst-#) is required.' });
    }

    const event = await loadEvent(eventId);
    if (!event) {
      return json(res, 404, { success: false, message: 'Event not found.' });
    }
    if (event.status === 'cancelled') {
      return json(res, 400, { success: false, message: 'Attendance cannot be recorded for a cancelled event.' });
    }

    const { startAt, endAt, timeInOpensAt } = resolveSchedule(event);
    const now = new Date();

    // ── Schedule enforcement ──────────────────────────────
    if (action === 'time_in') {
      if (timeInOpensAt && now < timeInOpensAt) {
        return json(res, 400, {
          success: false,
          message: `Time-in is not open yet. It opens at ${formatScheduleTime(timeInOpensAt)} (${TIME_IN_OPENS_BEFORE_MIN / 60}h before the event starts).`,
        });
      }
      if (endAt && now > endAt) {
        return json(res, 400, {
          success: false,
          message: `Time-in is closed. The event schedule ended at ${formatScheduleTime(endAt)}.`,
        });
      }
    }
    if (action === 'auto_time_out' && endAt && now < endAt) {
      return json(res, 400, {
        success: false,
        message: `Auto time-out is available once the event ends at ${formatScheduleTime(endAt)}.`,
      });
    }

    // ── Build per-table SET / guard clauses ───────────────
    // auto_time_out stamps the scheduled end (never earlier than the participant's time in).
    const outStamp = action === 'auto_time_out' ? (endAt || now) : now;

    const instSql = {
      time_in: { set: 'checked_in = 1, checked_in_at = ?, checked_out_at = NULL', guard: 'checked_in = 0', params: [now] },
      time_out: { set: 'checked_out_at = GREATEST(checked_in_at, CAST(? AS DATETIME))', guard: 'checked_in = 1 AND checked_in_at IS NOT NULL AND checked_out_at IS NULL', params: [outStamp] },
      auto_time_out: { set: 'checked_out_at = GREATEST(checked_in_at, CAST(? AS DATETIME))', guard: 'checked_in = 1 AND checked_in_at IS NOT NULL AND checked_out_at IS NULL', params: [outStamp] },
      undo_time_out: { set: 'checked_out_at = NULL', guard: 'checked_out_at IS NOT NULL', params: [] },
      reset: { set: 'checked_in = 0, checked_in_at = NULL, checked_out_at = NULL', guard: '1 = 1', params: [] },
    }[action];

    const regSql = {
      time_in: {
        set: 'is_checked_in = 1, checked_in_count = GREATEST(1, participant_count), checked_in_at = ?, checked_out_at = NULL',
        guard: '(is_checked_in = 0 AND checked_in_count = 0)',
        params: [now],
      },
      time_out: { set: 'checked_out_at = GREATEST(checked_in_at, CAST(? AS DATETIME))', guard: '(is_checked_in = 1 OR checked_in_count > 0) AND checked_in_at IS NOT NULL AND checked_out_at IS NULL', params: [outStamp] },
      auto_time_out: { set: 'checked_out_at = GREATEST(checked_in_at, CAST(? AS DATETIME))', guard: '(is_checked_in = 1 OR checked_in_count > 0) AND checked_in_at IS NOT NULL AND checked_out_at IS NULL', params: [outStamp] },
      undo_time_out: { set: 'checked_out_at = NULL', guard: 'checked_out_at IS NOT NULL', params: [] },
      reset: { set: 'is_checked_in = 0, checked_in_count = 0, checked_in_at = NULL, checked_out_at = NULL', guard: '1 = 1', params: [] },
    }[action];

    let updatedCount = 0;

    if (instIds.length > 0) {
      const placeholders = instIds.map(() => '?').join(',');
      const [r1] = await pool.query(
        `UPDATE institution_members
         SET ${instSql.set}
         WHERE id IN (${placeholders})
           AND (event_id = ? OR (event_id IS NULL AND event_title = ?))
           AND ${instSql.guard}`,
        [...instSql.params, ...instIds, eventId, event.title]
      );
      updatedCount += r1.affectedRows || 0;
    }

    if (regIds.length > 0) {
      const placeholders = regIds.map(() => '?').join(',');
      const [r2] = await pool.query(
        `UPDATE event_registrations
         SET ${regSql.set}
         WHERE id IN (${placeholders})
           AND event_id = ?
           AND ${regSql.guard}`,
        [...regSql.params, ...regIds, eventId]
      );
      updatedCount += r2.affectedRows || 0;
    }

    const messages = {
      time_in: `Time in recorded for ${updatedCount} participant(s).`,
      time_out: `Time out recorded for ${updatedCount} participant(s).`,
      auto_time_out: `Auto time-out at schedule end applied to ${updatedCount} participant(s).`,
      undo_time_out: `Time out cleared for ${updatedCount} participant(s).`,
      reset: `Attendance reset for ${updatedCount} participant(s).`,
    };

    return json(res, 200, {
      success: true,
      action,
      updatedCount,
      skippedCount: Math.max(0, instIds.length + regIds.length - updatedCount),
      recordedAt: action === 'time_in' ? now.toISOString() : ['time_out', 'auto_time_out'].includes(action) ? outStamp.toISOString() : null,
      message: messages[action],
      startAt: toIso(startAt),
      endAt: toIso(endAt),
    });
  } catch (err) {
    console.error('recordAttendanceTime error:', err);
    return json(res, 500, { success: false, message: 'Failed to record attendance time.', error: err.message });
  }
}

/**
 * Toggle or update in-venue check-in status for a participant (legacy endpoint).
 * Checking in stamps a fresh time in; reverting also clears the time out.
 */
async function toggleParticipantAttendance(req, res) {
  try {
    const eventId = Number(req.params.id);
    const participantKey = req.body.participantKey || req.params.participantKey;
    const { checkedIn } = req.body;

    if (!participantKey || typeof participantKey !== 'string') {
      return json(res, 400, { success: false, message: 'participantKey is required (e.g. reg-1 or inst-1).' });
    }

    const isCheckIn = checkedIn !== undefined ? Boolean(checkedIn) : true;
    const now = isCheckIn ? new Date() : null;

    if (participantKey.startsWith('inst-')) {
      const instMemberId = Number(participantKey.replace('inst-', ''));
      if (!instMemberId || Number.isNaN(instMemberId)) {
        return json(res, 400, { success: false, message: 'Invalid institution participant ID.' });
      }

      const [resUpdate] = await pool.execute(
        `UPDATE institution_members
         SET checked_in = ?, checked_in_at = ?, checked_out_at = NULL
         WHERE id = ?`,
        [isCheckIn ? 1 : 0, now, instMemberId]
      );

      if (resUpdate.affectedRows === 0) {
        return json(res, 404, { success: false, message: 'Participant record not found.' });
      }
    } else if (participantKey.startsWith('reg-')) {
      const regId = Number(participantKey.replace('reg-', ''));
      if (!regId || Number.isNaN(regId)) {
        return json(res, 400, { success: false, message: 'Invalid registration ID.' });
      }

      const [resUpdate] = await pool.execute(
        `UPDATE event_registrations
         SET is_checked_in = ?,
             checked_in_count = CASE WHEN ? = 1 THEN GREATEST(1, participant_count) ELSE 0 END,
             checked_in_at = ?,
             checked_out_at = NULL
         WHERE id = ? AND event_id = ?`,
        [isCheckIn ? 1 : 0, isCheckIn ? 1 : 0, now, regId, eventId]
      );

      if (resUpdate.affectedRows === 0) {
        return json(res, 404, { success: false, message: 'Registration record not found.' });
      }
    } else {
      return json(res, 400, { success: false, message: 'Unknown participant key format.' });
    }

    return json(res, 200, {
      success: true,
      message: isCheckIn ? 'Participant checked in to venue.' : 'Check-in status reverted.',
      participantKey,
      isCheckedIn: isCheckIn,
      checkedInAt: now ? now.toISOString() : null,
    });
  } catch (err) {
    console.error('toggleParticipantAttendance error:', err);
    return json(res, 500, { success: false, message: 'Failed to update attendance.', error: err.message });
  }
}

/**
 * Bulk check in participants by array of keys (legacy endpoint).
 */
async function bulkCheckInParticipants(req, res) {
  try {
    const eventId = Number(req.params.id);
    const { participantKeys, checkedIn } = req.body;
    if (!Array.isArray(participantKeys) || participantKeys.length === 0) {
      return json(res, 400, { success: false, message: 'participantKeys array is required.' });
    }

    const isCheckIn = checkedIn !== false;
    const now = isCheckIn ? new Date() : null;
    const { instIds, regIds } = parseParticipantKeys(participantKeys);

    let updatedCount = 0;

    if (instIds.length > 0) {
      const placeholders = instIds.map(() => '?').join(',');
      const [r1] = await pool.query(
        `UPDATE institution_members
         SET checked_in = ?, checked_in_at = ?, checked_out_at = NULL
         WHERE id IN (${placeholders})`,
        [isCheckIn ? 1 : 0, now, ...instIds]
      );
      updatedCount += r1.affectedRows || 0;
    }

    if (regIds.length > 0) {
      const placeholders = regIds.map(() => '?').join(',');
      const [r2] = await pool.query(
        `UPDATE event_registrations
         SET is_checked_in = ?,
             checked_in_count = CASE WHEN ? = 1 THEN GREATEST(1, participant_count) ELSE 0 END,
             checked_in_at = ?,
             checked_out_at = NULL
         WHERE id IN (${placeholders}) AND event_id = ?`,
        [isCheckIn ? 1 : 0, isCheckIn ? 1 : 0, now, ...regIds, eventId]
      );
      updatedCount += r2.affectedRows || 0;
    }

    return json(res, 200, {
      success: true,
      message: `Successfully updated attendance for ${updatedCount} participant(s).`,
      updatedCount,
      isCheckedIn: isCheckIn,
    });
  } catch (err) {
    console.error('bulkCheckInParticipants error:', err);
    return json(res, 500, { success: false, message: 'Failed to process bulk attendance.', error: err.message });
  }
}

module.exports = {
  getEventAttendance,
  recordAttendanceTime,
  toggleParticipantAttendance,
  bulkCheckInParticipants,
};

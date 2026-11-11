const { pool } = require('./db');

function json(res, status, body) {
  return res.status(status).json(body);
}

/**
 * Get unified attendance roster and participation metrics for an event
 */
async function getEventAttendance(req, res) {
  try {
    const eventId = Number(req.params.id);
    if (!eventId || Number.isNaN(eventId)) {
      return json(res, 400, { success: false, message: 'Valid event ID is required.' });
    }

    // 1. Fetch event
    const [eventRows] = await pool.execute(
      `SELECT id, title, start_at, end_at, location, status, capacity, registration_fee, event_type, is_esports, banner_url, theme_color
       FROM events
       WHERE id = ? LIMIT 1`,
      [eventId]
    );

    if (!eventRows.length) {
      return json(res, 404, { success: false, message: 'Event not found.' });
    }

    const event = eventRows[0];

    // 2. Unified participant query (both individual registrations and institution members)
    const [participants] = await pool.query(
      `SELECT
         CONCAT('reg-', er.id) AS participant_key,
         'Individual Registration' AS registration_source,
         er.id AS record_id,
         er.event_id,
         e.title AS event_title,
         u.id AS user_id,
         u.full_name,
         u.email,
         u.contact_number,
         COALESCE(u.sector_details, CASE WHEN u.member_type = 'institution' THEN u.full_name ELSE 'PSITS Individual Member' END) AS institution_name,
         COALESCE(u.occupation, u.sector, u.member_type, 'Member') AS position,
         er.status AS registration_status,
         (er.is_checked_in = 1 OR er.checked_in_count > 0) AS is_checked_in,
         er.checked_in_at,
         er.created_at AS registered_at
       FROM event_registrations er
       JOIN events e ON e.id = er.event_id
       JOIN users u ON u.id = er.member_id
       WHERE er.event_id = ? AND er.status <> 'rejected'

       UNION ALL

       SELECT
         CONCAT('inst-', im.id) AS participant_key,
         'Institution Roster' AS registration_source,
         im.id AS record_id,
         e.id AS event_id,
         e.title AS event_title,
         u.id AS user_id,
         im.full_name,
         im.email,
         im.contact_number,
         COALESCE(u.sector_details, u.full_name, 'Institution Member') AS institution_name,
         COALESCE(im.position, 'Participant') AS position,
         im.status AS registration_status,
         (im.checked_in = 1) AS is_checked_in,
         im.checked_in_at,
         im.created_at AS registered_at
       FROM institution_members im
       JOIN users u ON u.id = im.institution_user_id
       JOIN events e ON (e.id = im.event_id OR (im.event_id IS NULL AND e.title = im.event_title))
       WHERE (im.event_id = ? OR (im.event_id IS NULL AND e.id = ?)) AND im.status <> 'rejected'
       ORDER BY registered_at DESC`,
      [eventId, eventId, eventId]
    );

    // 3. Compute metrics & institution breakdown
    let totalRegistered = participants.length;
    let totalCheckedIn = 0;
    const instMap = new Map();

    for (const p of participants) {
      const isChecked = Boolean(p.is_checked_in);
      if (isChecked) totalCheckedIn++;

      const instName = p.institution_name || 'Individual Members';
      if (!instMap.has(instName)) {
        instMap.set(instName, {
          institutionName: instName,
          registeredCount: 0,
          checkedInCount: 0,
        });
      }
      const entry = instMap.get(instName);
      entry.registeredCount++;
      if (isChecked) entry.checkedInCount++;
    }

    const institutionBreakdown = Array.from(instMap.values()).map((item) => ({
      ...item,
      attendanceRate: item.registeredCount > 0 ? Number(((item.checkedInCount / item.registeredCount) * 100).toFixed(1)) : 0,
    }));

    // Sort by checked-in count DESC, then registered count DESC
    institutionBreakdown.sort((a, b) => {
      if (b.checkedInCount !== a.checkedInCount) return b.checkedInCount - a.checkedInCount;
      return b.registeredCount - a.registeredCount;
    });

    const attendanceRate = totalRegistered > 0 ? Number(((totalCheckedIn / totalRegistered) * 100).toFixed(1)) : 0;

    return json(res, 200, {
      success: true,
      event: {
        id: String(event.id),
        title: event.title,
        status: event.status,
        location: event.location,
        startAt: event.start_at,
        endAt: event.end_at,
        capacity: event.capacity,
        themeColor: event.theme_color,
      },
      summary: {
        totalRegistered,
        totalCheckedIn,
        notCheckedIn: Math.max(0, totalRegistered - totalCheckedIn),
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
        checkedInAt: p.checked_in_at ? new Date(p.checked_in_at).toISOString() : null,
        registeredAt: p.registered_at ? new Date(p.registered_at).toISOString() : null,
      })),
    });
  } catch (err) {
    console.error('getEventAttendance error:', err);
    return json(res, 500, { success: false, message: 'Failed to load event attendance.', error: err.message });
  }
}

/**
 * Toggle or update in-venue check-in status for a participant
 */
async function toggleParticipantAttendance(req, res) {
  try {
    const eventId = Number(req.params.id);
    const { participantKey, checkedIn } = req.body;

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
         SET checked_in = ?, checked_in_at = ?
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
             checked_in_at = ?
         WHERE id = ?`,
        [isCheckIn ? 1 : 0, isCheckIn ? 1 : 0, now, regId]
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
 * Bulk check in participants by array of keys
 */
async function bulkCheckInParticipants(req, res) {
  try {
    const { participantKeys, checkedIn } = req.body;
    if (!Array.isArray(participantKeys) || participantKeys.length === 0) {
      return json(res, 400, { success: false, message: 'participantKeys array is required.' });
    }

    const isCheckIn = checkedIn !== false;
    const now = isCheckIn ? new Date() : null;

    const instIds = [];
    const regIds = [];

    for (const key of participantKeys) {
      if (typeof key === 'string' && key.startsWith('inst-')) {
        const id = Number(key.replace('inst-', ''));
        if (id) instIds.push(id);
      } else if (typeof key === 'string' && key.startsWith('reg-')) {
        const id = Number(key.replace('reg-', ''));
        if (id) regIds.push(id);
      }
    }

    let updatedCount = 0;

    if (instIds.length > 0) {
      const placeholders = instIds.map(() => '?').join(',');
      const [r1] = await pool.query(
        `UPDATE institution_members
         SET checked_in = ?, checked_in_at = ?
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
             checked_in_at = ?
         WHERE id IN (${placeholders})`,
        [isCheckIn ? 1 : 0, isCheckIn ? 1 : 0, now, ...regIds]
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
  toggleParticipantAttendance,
  bulkCheckInParticipants,
};

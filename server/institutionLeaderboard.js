const { pool } = require('./db');

function json(res, status, body) {
  return res.status(status).json(body);
}

function canManageAttendance(role) {
  return role === 'super_admin' || role === 'admin' || role === 'officer';
}

/**
 * Fetch events list & leaderboard data for a specific event
 */
async function getInstitutionLeaderboard(req, res) {
  try {
    // 1. Fetch available events for the selector
    const [eventRows] = await pool.execute(
      `SELECT id, title, start_at, end_at, location, status
       FROM events
       WHERE status <> 'draft'
       ORDER BY
         CASE status
           WHEN 'ongoing' THEN 1
           WHEN 'upcoming' THEN 2
           WHEN 'completed' THEN 3
           ELSE 4
         END,
         start_at DESC`
    );

    if (!eventRows.length) {
      return json(res, 200, {
        success: true,
        events: [],
        selectedEvent: null,
        summary: {
          totalInstitutions: 0,
          totalRegisteredParticipants: 0,
          totalInVenue: 0,
          overallAttendanceRate: 0,
          fullyPresentInstitutions: 0,
        },
        leaderboard: [],
      });
    }

    const events = eventRows.map((e) => {
      const startAt = e.start_at ? new Date(e.start_at) : null;
      return {
        id: String(e.id),
        title: e.title,
        date: startAt ? startAt.toISOString().slice(0, 10) : '',
        time: startAt ? startAt.toTimeString().slice(0, 5) : '',
        location: e.location || 'Venue TBA',
        status: e.status,
      };
    });

    const requestedEventId = req.query.eventId ? Number(req.query.eventId) : null;
    let selectedEventRow = null;

    if (requestedEventId && Number.isFinite(requestedEventId)) {
      selectedEventRow = eventRows.find((e) => e.id === requestedEventId) || null;
    }
    if (!selectedEventRow) {
      // Pick ongoing first, otherwise upcoming, otherwise first event
      selectedEventRow =
        eventRows.find((e) => e.status === 'ongoing') ||
        eventRows.find((e) => e.status === 'upcoming') ||
        eventRows[0];
    }

    const selectedEventId = selectedEventRow.id;
    const selectedEventTitle = selectedEventRow.title;
    const selectedStartAt = selectedEventRow.start_at ? new Date(selectedEventRow.start_at) : null;

    const selectedEvent = {
      id: String(selectedEventRow.id),
      title: selectedEventRow.title,
      date: selectedStartAt ? selectedStartAt.toISOString().slice(0, 10) : '',
      time: selectedStartAt ? selectedStartAt.toTimeString().slice(0, 5) : '',
      location: selectedEventRow.location || 'Venue TBA',
      status: selectedEventRow.status,
    };

    // 2. Fetch institution participants from institution_members
    const [partRows] = await pool.execute(
      `SELECT
         im.id AS participant_id,
         im.institution_user_id,
         im.event_id,
         im.event_title,
         im.full_name,
         im.email,
         im.contact_number,
         im.gender,
         im.position,
         im.status AS participant_status,
         COALESCE(im.checked_in, 0) AS checked_in,
         im.checked_in_at,
         u.full_name AS inst_full_name,
         u.sector_details AS inst_sector_details,
         u.avatar_url AS inst_avatar,
         u.email AS inst_email
       FROM institution_members im
       JOIN users u ON u.id = im.institution_user_id
       WHERE (im.event_id = ? OR (im.event_id IS NULL AND im.event_title = ?))
         AND im.status <> 'rejected'
       ORDER BY im.institution_user_id ASC, im.full_name ASC`,
      [selectedEventId, selectedEventTitle]
    );

    // 3. Fetch institution registrations from event_registrations
    const [regRows] = await pool.execute(
      `SELECT
         er.id AS registration_id,
         er.event_id,
         er.member_id,
         er.participant_count,
         COALESCE(er.checked_in_count, 0) AS checked_in_count,
         er.status AS registration_status,
         u.full_name,
         u.sector_details,
         u.member_type,
         u.avatar_url,
         u.email
       FROM event_registrations er
       JOIN users u ON u.id = er.member_id
       WHERE er.event_id = ?
         AND er.status <> 'rejected'
         AND (u.member_type = 'institution' OR u.sector = 'institution' OR er.participant_count > 1)`,
      [selectedEventId]
    );

    // 4. Group data by institution
    const institutionMap = new Map();

    // Add from institution_members
    for (const row of partRows) {
      const instId = String(row.institution_user_id);
      if (!institutionMap.has(instId)) {
        institutionMap.set(instId, {
          institutionId: instId,
          institutionName: row.inst_sector_details || row.inst_full_name || 'Institution',
          institutionEmail: row.inst_email || '',
          institutionAvatar: row.inst_avatar || null,
          registrationId: null,
          participants: [],
          registeredCount: 0,
          inVenueCount: 0,
        });
      }

      const inst = institutionMap.get(instId);
      const isCheckedIn = Boolean(row.checked_in);
      inst.participants.push({
        id: String(row.participant_id),
        fullName: row.full_name,
        email: row.email || '',
        contactNumber: row.contact_number || '',
        gender: row.gender || '',
        position: row.position || 'Participant',
        checkedIn: isCheckedIn,
        checkedInAt: row.checked_in_at ? new Date(row.checked_in_at).toISOString() : null,
        status: row.participant_status || 'approved',
      });
      inst.registeredCount += 1;
      if (isCheckedIn) {
        inst.inVenueCount += 1;
      }
    }

    // Merge or add from event_registrations
    for (const row of regRows) {
      const instId = String(row.member_id);
      if (!institutionMap.has(instId)) {
        institutionMap.set(instId, {
          institutionId: instId,
          institutionName: row.sector_details || row.full_name || 'Institution',
          institutionEmail: row.email || '',
          institutionAvatar: row.avatar_url || null,
          registrationId: String(row.registration_id),
          participants: [],
          registeredCount: Math.max(1, Number(row.participant_count || 1)),
          inVenueCount: Math.max(0, Number(row.checked_in_count || 0)),
        });
      } else {
        const inst = institutionMap.get(instId);
        inst.registrationId = String(row.registration_id);
        const regCount = Math.max(1, Number(row.participant_count || 1));
        if (regCount > inst.registeredCount) {
          inst.registeredCount = regCount;
        }
        const regInVenue = Math.max(0, Number(row.checked_in_count || 0));
        if (regInVenue > inst.inVenueCount) {
          inst.inVenueCount = regInVenue;
        }
      }
    }

    // 5. Finalize calculations for each institution
    const rawList = Array.from(institutionMap.values()).map((inst) => {
      const reg = Math.max(1, inst.registeredCount);
      const inVenue = Math.min(reg, Math.max(0, inst.inVenueCount));
      const rate = reg > 0 ? Math.round((inVenue / reg) * 100) : 0;
      const allInVenue = reg > 0 && inVenue >= reg;

      let statusLabel = 'Not in Venue';
      if (allInVenue) {
        statusLabel = 'All in Venue';
      } else if (inVenue > 0) {
        statusLabel = `Arriving (${inVenue}/${reg})`;
      }

      return {
        institutionId: inst.institutionId,
        institutionName: inst.institutionName,
        institutionEmail: inst.institutionEmail,
        institutionAvatar: inst.institutionAvatar,
        registrationId: inst.registrationId,
        registeredCount: reg,
        inVenueCount: inVenue,
        attendanceRate: rate,
        allInVenue,
        status: statusLabel,
        participants: inst.participants,
      };
    });

    // 6. Sort by inVenueCount DESC, attendanceRate DESC, registeredCount DESC, name ASC
    rawList.sort((a, b) => {
      if (b.inVenueCount !== a.inVenueCount) return b.inVenueCount - a.inVenueCount;
      if (b.attendanceRate !== a.attendanceRate) return b.attendanceRate - a.attendanceRate;
      if (b.registeredCount !== a.registeredCount) return b.registeredCount - a.registeredCount;
      return a.institutionName.localeCompare(b.institutionName);
    });

    // Assign rank numbers
    const leaderboard = rawList.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    // 7. Calculate overall summary
    const totalInstitutions = leaderboard.length;
    const totalRegisteredParticipants = leaderboard.reduce((acc, cur) => acc + cur.registeredCount, 0);
    const totalInVenue = leaderboard.reduce((acc, cur) => acc + cur.inVenueCount, 0);
    const overallAttendanceRate =
      totalRegisteredParticipants > 0 ? Math.round((totalInVenue / totalRegisteredParticipants) * 100) : 0;
    const fullyPresentInstitutions = leaderboard.filter((item) => item.allInVenue).length;

    return json(res, 200, {
      success: true,
      events,
      selectedEvent,
      summary: {
        totalInstitutions,
        totalRegisteredParticipants,
        totalInVenue,
        overallAttendanceRate,
        fullyPresentInstitutions,
      },
      leaderboard,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getInstitutionLeaderboard error:', err);
    return json(res, 500, {
      success: false,
      message: 'Failed to load institution leaderboard.',
      error: err.message,
    });
  }
}

/**
 * Toggle check-in status for an individual participant or update registration count
 */
async function toggleParticipantAttendance(req, res) {
  try {
    const userRole = req.user?.role;
    const userId = Number(req.user?.id);
    const body = req.body || {};
    const participantId = body.participantId ? Number(body.participantId) : null;
    const registrationId = body.registrationId ? Number(body.registrationId) : null;
    const isCheckedIn = Boolean(body.checkedIn);

    if (participantId && Number.isFinite(participantId)) {
      // Fetch participant to check permission
      const [rows] = await pool.execute(
        `SELECT id, institution_user_id, event_id FROM institution_members WHERE id = ? LIMIT 1`,
        [participantId]
      );
      if (!rows.length) {
        return json(res, 404, { success: false, message: 'Participant not found.' });
      }

      const participant = rows[0];
      const isOwner = Number(participant.institution_user_id) === userId;
      if (!canManageAttendance(userRole) && !isOwner) {
        return json(res, 403, { success: false, message: 'You do not have permission to check in this participant.' });
      }

      await pool.execute(
        `UPDATE institution_members
         SET checked_in = ?, checked_in_at = ?
         WHERE id = ?`,
        [isCheckedIn ? 1 : 0, isCheckedIn ? new Date() : null, participantId]
      );

      // Sync event_registrations.checked_in_count if event_id is linked
      if (participant.event_id) {
        await pool.execute(
          `UPDATE event_registrations
           SET checked_in_count = (
             SELECT COUNT(*) FROM institution_members
             WHERE institution_user_id = ? AND event_id = ? AND checked_in = 1
           )
           WHERE member_id = ? AND event_id = ?`,
          [
            participant.institution_user_id,
            participant.event_id,
            participant.institution_user_id,
            participant.event_id,
          ]
        );
      }

      return json(res, 200, {
        success: true,
        message: isCheckedIn ? 'Participant marked as in venue.' : 'Participant check-in removed.',
        checkedIn: isCheckedIn,
      });
    }

    if (registrationId && Number.isFinite(registrationId)) {
      const [regRows] = await pool.execute(
        `SELECT id, member_id, participant_count, checked_in_count FROM event_registrations WHERE id = ? LIMIT 1`,
        [registrationId]
      );
      if (!regRows.length) {
        return json(res, 404, { success: false, message: 'Registration not found.' });
      }

      const reg = regRows[0];
      const isOwner = Number(reg.member_id) === userId;
      if (!canManageAttendance(userRole) && !isOwner) {
        return json(res, 403, { success: false, message: 'Permission denied.' });
      }

      let newCount = Number(body.count ?? 0);
      if (body.count === undefined) {
        newCount = isCheckedIn ? Math.min(reg.participant_count, reg.checked_in_count + 1) : Math.max(0, reg.checked_in_count - 1);
      }
      newCount = Math.max(0, Math.min(reg.participant_count, newCount));

      await pool.execute(
        `UPDATE event_registrations SET checked_in_count = ? WHERE id = ?`,
        [newCount, registrationId]
      );

      return json(res, 200, {
        success: true,
        message: 'Registration attendance updated.',
        checkedInCount: newCount,
      });
    }

    return json(res, 400, { success: false, message: 'Missing participantId or registrationId.' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('toggleParticipantAttendance error:', err);
    return json(res, 500, { success: false, message: 'Failed to update attendance.', error: err.message });
  }
}

/**
 * Bulk check-in/out all participants for an institution for an event
 */
async function checkAllInstitutionParticipants(req, res) {
  try {
    const userRole = req.user?.role;
    const userId = Number(req.user?.id);
    const body = req.body || {};
    const eventId = Number(body.eventId);
    const institutionUserId = Number(body.institutionUserId);
    const isCheckedIn = Boolean(body.checkedIn);

    if (!Number.isFinite(eventId) || !Number.isFinite(institutionUserId)) {
      return json(res, 400, { success: false, message: 'Invalid eventId or institutionUserId.' });
    }

    const isOwner = institutionUserId === userId;
    if (!canManageAttendance(userRole) && !isOwner) {
      return json(res, 403, { success: false, message: 'Permission denied.' });
    }

    // Get event title to catch matching event_title
    const [evtRows] = await pool.execute(`SELECT title FROM events WHERE id = ? LIMIT 1`, [eventId]);
    const eventTitle = evtRows.length ? evtRows[0].title : '';

    await pool.execute(
      `UPDATE institution_members
       SET checked_in = ?, checked_in_at = ?
       WHERE institution_user_id = ?
         AND (event_id = ? OR (event_id IS NULL AND event_title = ?))
         AND status <> 'rejected'`,
      [isCheckedIn ? 1 : 0, isCheckedIn ? new Date() : null, institutionUserId, eventId, eventTitle]
    );

    // Sync event_registrations.checked_in_count
    const [cntRows] = await pool.execute(
      `SELECT COUNT(*) as in_venue_cnt, COUNT(*) as total_cnt
       FROM institution_members
       WHERE institution_user_id = ?
         AND (event_id = ? OR (event_id IS NULL AND event_title = ?))
         AND checked_in = 1`,
      [institutionUserId, eventId, eventTitle]
    );

    const inVenueCnt = cntRows[0]?.in_venue_cnt || 0;
    await pool.execute(
      `UPDATE event_registrations
       SET checked_in_count = ?
       WHERE member_id = ? AND event_id = ?`,
      [inVenueCnt, institutionUserId, eventId]
    );

    return json(res, 200, {
      success: true,
      message: isCheckedIn
        ? 'All institution participants marked as in venue.'
        : 'All institution participants marked as not in venue.',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('checkAllInstitutionParticipants error:', err);
    return json(res, 500, { success: false, message: 'Failed to update bulk attendance.', error: err.message });
  }
}

module.exports = {
  getInstitutionLeaderboard,
  toggleParticipantAttendance,
  checkAllInstitutionParticipants,
};

const { pool } = require('./db');

function json(res, status, body) {
  return res.status(status).json(body);
}

/**
 * Fetch events list & delegation leaderboard data for a specific event
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
        });
      }

      const inst = institutionMap.get(instId);
      inst.participants.push({
        id: String(row.participant_id),
        fullName: row.full_name,
        email: row.email || '',
        contactNumber: row.contact_number || '',
        gender: row.gender || '',
        position: row.position || 'Participant',
        status: row.participant_status || 'approved',
      });
      inst.registeredCount += 1;
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
        });
      } else {
        const inst = institutionMap.get(instId);
        inst.registrationId = String(row.registration_id);
        const regCount = Math.max(1, Number(row.participant_count || 1));
        if (regCount > inst.registeredCount) {
          inst.registeredCount = regCount;
        }
      }
    }

    // 5. Finalize calculations for each institution
    const rawList = Array.from(institutionMap.values()).map((inst) => {
      const reg = Math.max(1, inst.registeredCount);

      return {
        institutionId: inst.institutionId,
        institutionName: inst.institutionName,
        institutionEmail: inst.institutionEmail,
        institutionAvatar: inst.institutionAvatar,
        registrationId: inst.registrationId,
        registeredCount: reg,
        participants: inst.participants,
      };
    });

    // 6. Sort by registeredCount DESC, name ASC
    rawList.sort((a, b) => {
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

    return json(res, 200, {
      success: true,
      events,
      selectedEvent,
      summary: {
        totalInstitutions,
        totalRegisteredParticipants,
      },
      leaderboard,
    });
  } catch (err) {
    console.error('getInstitutionLeaderboard error:', err);
    return json(res, 500, {
      success: false,
      message: 'Failed to load institution leaderboard.',
      error: err.message,
    });
  }
}

module.exports = {
  getInstitutionLeaderboard,
};

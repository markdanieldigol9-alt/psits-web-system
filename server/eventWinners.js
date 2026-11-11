const { pool } = require('./db');

function json(res, status, body) {
  return res.status(status).json(body);
}

const DEFAULT_POINTS_BY_RANK = {
  1: 10, // Champion / 1st Place (Gold)
  2: 7,  // 1st Runner Up / 2nd Place (Silver)
  3: 5,  // 2nd Runner Up / 3rd Place (Bronze)
  4: 3,  // 3rd Runner Up / Finalist
  5: 2,  // Finalist
};

/**
 * Get all ranked winners for a specific event
 */
async function getEventWinners(req, res) {
  try {
    const eventId = Number(req.params.id);
    if (!eventId || Number.isNaN(eventId)) {
      return json(res, 400, { success: false, message: 'Valid event ID is required.' });
    }

    const [eventRows] = await pool.execute(
      `SELECT id, title, event_type, status, location, start_at FROM events WHERE id = ? LIMIT 1`,
      [eventId]
    );
    if (!eventRows.length) {
      return json(res, 404, { success: false, message: 'Event not found.' });
    }

    const [winners] = await pool.execute(
      `SELECT
         id,
         event_id,
         rank_position,
         award_title,
         institution_name,
         participant_name,
         points,
         score_or_notes,
         created_at,
         updated_at
       FROM event_competition_winners
       WHERE event_id = ?
       ORDER BY rank_position ASC, points DESC, id ASC`,
      [eventId]
    );

    return json(res, 200, {
      success: true,
      event: eventRows[0],
      winners: winners.map((w) => ({
        id: String(w.id),
        eventId: String(w.event_id),
        rankPosition: Number(w.rank_position),
        awardTitle: w.award_title,
        institutionName: w.institution_name,
        participantName: w.participant_name,
        points: Number(w.points || 0),
        scoreOrNotes: w.score_or_notes || '',
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      })),
    });
  } catch (err) {
    console.error('getEventWinners error:', err);
    return json(res, 500, { success: false, message: 'Failed to load event winners.', error: err.message });
  }
}

/**
 * Add or award a winner to an event
 */
async function createEventWinner(req, res) {
  try {
    const eventId = Number(req.params.id);
    const user = req.user;
    const {
      rankPosition,
      awardTitle,
      institutionName,
      participantName,
      points,
      scoreOrNotes,
    } = req.body;

    if (!eventId || Number.isNaN(eventId)) {
      return json(res, 400, { success: false, message: 'Valid event ID is required.' });
    }
    if (!institutionName || !institutionName.trim()) {
      return json(res, 400, { success: false, message: 'School/Institution name is required.' });
    }
    if (!participantName || !participantName.trim()) {
      return json(res, 400, { success: false, message: 'Participant or Team name is required.' });
    }

    const rank = Number(rankPosition) >= 1 ? Number(rankPosition) : 1;
    let computedPoints = points !== undefined && points !== null && points !== ''
      ? Number(points)
      : (DEFAULT_POINTS_BY_RANK[rank] || 1);

    const defaultTitle =
      rank === 1 ? 'Champion' :
      rank === 2 ? '1st Runner Up' :
      rank === 3 ? '2nd Runner Up' :
      `${rank}th Place`;

    const finalTitle = (awardTitle && awardTitle.trim()) ? awardTitle.trim() : defaultTitle;

    const [insertResult] = await pool.execute(
      `INSERT INTO event_competition_winners
       (event_id, rank_position, award_title, institution_name, participant_name, points, score_or_notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        rank,
        finalTitle,
        institutionName.trim(),
        participantName.trim(),
        computedPoints,
        scoreOrNotes ? scoreOrNotes.trim() : null,
        user?.id || null,
      ]
    );

    const winnerId = insertResult.insertId;

    return json(res, 201, {
      success: true,
      message: 'Winner awarded successfully.',
      winner: {
        id: String(winnerId),
        eventId: String(eventId),
        rankPosition: rank,
        awardTitle: finalTitle,
        institutionName: institutionName.trim(),
        participantName: participantName.trim(),
        points: computedPoints,
        scoreOrNotes: scoreOrNotes ? scoreOrNotes.trim() : '',
      },
    });
  } catch (err) {
    console.error('createEventWinner error:', err);
    return json(res, 500, { success: false, message: 'Failed to record event winner.', error: err.message });
  }
}

/**
 * Update an existing event winner entry
 */
async function updateEventWinner(req, res) {
  try {
    const eventId = Number(req.params.id);
    const winnerId = Number(req.params.winnerId);
    const {
      rankPosition,
      awardTitle,
      institutionName,
      participantName,
      points,
      scoreOrNotes,
    } = req.body;

    if (!winnerId || Number.isNaN(winnerId)) {
      return json(res, 400, { success: false, message: 'Valid winner ID is required.' });
    }

    const rank = Number(rankPosition) >= 1 ? Number(rankPosition) : 1;
    const computedPoints = points !== undefined && points !== null && points !== ''
      ? Number(points)
      : (DEFAULT_POINTS_BY_RANK[rank] || 1);

    const [updateRes] = await pool.execute(
      `UPDATE event_competition_winners
       SET rank_position = ?,
           award_title = ?,
           institution_name = ?,
           participant_name = ?,
           points = ?,
           score_or_notes = ?
       WHERE id = ? AND event_id = ?`,
      [
        rank,
        awardTitle ? awardTitle.trim() : 'Winner',
        institutionName ? institutionName.trim() : 'Institution',
        participantName ? participantName.trim() : 'Participant',
        computedPoints,
        scoreOrNotes ? scoreOrNotes.trim() : null,
        winnerId,
        eventId,
      ]
    );

    if (updateRes.affectedRows === 0) {
      return json(res, 404, { success: false, message: 'Winner record not found for this event.' });
    }

    return json(res, 200, {
      success: true,
      message: 'Winner updated successfully.',
      winner: {
        id: String(winnerId),
        eventId: String(eventId),
        rankPosition: rank,
        awardTitle: awardTitle ? awardTitle.trim() : 'Winner',
        institutionName: institutionName ? institutionName.trim() : 'Institution',
        participantName: participantName ? participantName.trim() : 'Participant',
        points: computedPoints,
        scoreOrNotes: scoreOrNotes ? scoreOrNotes.trim() : '',
      },
    });
  } catch (err) {
    console.error('updateEventWinner error:', err);
    return json(res, 500, { success: false, message: 'Failed to update winner.', error: err.message });
  }
}

/**
 * Remove an event winner
 */
async function deleteEventWinner(req, res) {
  try {
    const eventId = Number(req.params.id);
    const winnerId = Number(req.params.winnerId);

    if (!winnerId || Number.isNaN(winnerId)) {
      return json(res, 400, { success: false, message: 'Valid winner ID is required.' });
    }

    const [delRes] = await pool.execute(
      `DELETE FROM event_competition_winners WHERE id = ? AND event_id = ?`,
      [winnerId, eventId]
    );

    if (delRes.affectedRows === 0) {
      return json(res, 404, { success: false, message: 'Winner record not found.' });
    }

    return json(res, 200, {
      success: true,
      message: 'Winner entry removed successfully.',
    });
  } catch (err) {
    console.error('deleteEventWinner error:', err);
    return json(res, 500, { success: false, message: 'Failed to delete winner.', error: err.message });
  }
}

/**
 * Compute the Overall Competition Leaderboard across all events
 * Shows who is the OVERALL WINNER / Overall Champion institution!
 */
async function getOverallCompetitionStandings(req, res) {
  try {
    // 1. Fetch all winners across events
    const [winnerRows] = await pool.query(
      `SELECT
         w.id,
         w.event_id,
         e.title AS event_title,
         e.event_type,
         e.status AS event_status,
         w.rank_position,
         w.award_title,
         w.institution_name,
         w.participant_name,
         w.points,
         w.score_or_notes
       FROM event_competition_winners w
       JOIN events e ON e.id = w.event_id
       WHERE e.status <> 'cancelled'
       ORDER BY w.rank_position ASC, w.points DESC`
    );

    // 2. Fetch verified in-venue attendance count per institution across all events
    const [attendanceRows] = await pool.query(
      `SELECT
         COALESCE(u.sector_details, u.full_name, 'Institution Member') AS institution_name,
         COUNT(*) AS checked_in_count
       FROM institution_members im
       JOIN users u ON u.id = im.institution_user_id
       WHERE im.checked_in = 1
       GROUP BY institution_name

       UNION ALL

       SELECT
         COALESCE(u.sector_details, CASE WHEN u.member_type = 'institution' THEN u.full_name ELSE 'PSITS Individual Member' END) AS institution_name,
         SUM(CASE WHEN er.checked_in_count > 0 THEN er.checked_in_count ELSE (er.is_checked_in = 1) END) AS checked_in_count
       FROM event_registrations er
       JOIN users u ON u.id = er.member_id
       WHERE (er.is_checked_in = 1 OR er.checked_in_count > 0)
       GROUP BY institution_name`
    );

    const attendanceByInst = new Map();
    for (const r of attendanceRows) {
      const name = r.institution_name || 'Individual';
      const prev = attendanceByInst.get(name) || 0;
      attendanceByInst.set(name, prev + Number(r.checked_in_count || 0));
    }

    // 3. Group by institution
    const institutionMap = new Map();

    for (const row of winnerRows) {
      const instName = row.institution_name.trim();
      if (!institutionMap.has(instName)) {
        institutionMap.set(instName, {
          institutionName: instName,
          goldCount: 0,
          silverCount: 0,
          bronzeCount: 0,
          totalMedals: 0,
          totalPoints: 0,
          eventsWonCount: 0,
          inVenueAttendees: attendanceByInst.get(instName) || 0,
          awards: [],
        });
      }

      const inst = institutionMap.get(instName);
      const rank = Number(row.rank_position);
      const pts = Number(row.points || 0);

      if (rank === 1) inst.goldCount++;
      else if (rank === 2) inst.silverCount++;
      else if (rank === 3) inst.bronzeCount++;

      inst.totalMedals = inst.goldCount + inst.silverCount + inst.bronzeCount;
      inst.totalPoints += pts;
      inst.eventsWonCount++;

      inst.awards.push({
        id: String(row.id),
        eventId: String(row.event_id),
        eventTitle: row.event_title,
        eventType: row.event_type,
        rankPosition: rank,
        awardTitle: row.award_title,
        participantName: row.participant_name,
        points: pts,
        scoreOrNotes: row.score_or_notes || '',
      });
    }

    const standings = Array.from(institutionMap.values());

    // 4. Sort institutions by: totalPoints DESC, goldCount DESC, silverCount DESC, bronzeCount DESC, totalMedals DESC
    standings.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.goldCount !== a.goldCount) return b.goldCount - a.goldCount;
      if (b.silverCount !== a.silverCount) return b.silverCount - a.silverCount;
      if (b.bronzeCount !== a.bronzeCount) return b.bronzeCount - a.bronzeCount;
      return b.totalMedals - a.totalMedals;
    });

    // Assign overall rank
    const rankedStandings = standings.map((item, idx) => ({
      ...item,
      rank: idx + 1,
      isOverallChampion: idx === 0,
    }));

    // Count distinct events that have winners
    const distinctEventsSet = new Set(winnerRows.map((w) => String(w.event_id)));

    return json(res, 200, {
      success: true,
      totalCompetitiveEventsWithWinners: distinctEventsSet.size,
      totalInstitutionsRanked: rankedStandings.length,
      overallChampion: rankedStandings[0] || null,
      standings: rankedStandings,
    });
  } catch (err) {
    console.error('getOverallCompetitionStandings error:', err);
    return json(res, 500, { success: false, message: 'Failed to compute overall competition standings.', error: err.message });
  }
}

module.exports = {
  getEventWinners,
  createEventWinner,
  updateEventWinner,
  deleteEventWinner,
  getOverallCompetitionStandings,
};

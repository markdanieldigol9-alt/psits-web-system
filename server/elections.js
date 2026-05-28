const { pool } = require('./db');
function json(res, status, body) {
  res.status(status).json(body);
}

function formatDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toElectionDto(row) {
  let allowedPositions = [];
  try {
    if (row.allowed_positions) {
      allowedPositions = JSON.parse(row.allowed_positions);
    }
  } catch (e) {
    // ignore
  }
  return {
    id: String(row.id),
    title: row.title,
    description: row.description || '',
    startDate: formatDateOnly(row.start_date),
    endDate: formatDateOnly(row.end_date),
    status: row.status,
    allowedPositions,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCandidateDto(row) {
  return {
    id: String(row.id),
    electionId: String(row.election_id),
    memberId: String(row.member_id),
    memberName: row.member_name || '',
    memberEmail: row.member_email || '',
    position: row.position,
    platform: row.platform || '',
    status: row.status,
    votesCount: Number(row.votes_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listElections(req, res) {
  const status = req.query.status ? String(req.query.status) : null;
  const where = [];
  const params = [];
  if (status && status !== 'all' && ['draft', 'open', 'closed', 'archived'].includes(status)) {
    where.push('e.status = ?');
    params.push(status);
  }

  // Members can view open, closed, and archived elections (history).
  if (req.user?.role === 'member') {
    where.push("e.status IN ('open', 'closed', 'archived')");
  }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT e.*
     FROM elections e
     ${sqlWhere}
     ORDER BY e.start_date DESC, e.id DESC`,
    params
  );
  return json(res, 200, { success: true, elections: rows.map(toElectionDto) });
}

async function getElectionDetails(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid id.' });

  const [rows] = await pool.execute('SELECT * FROM elections WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) return json(res, 404, { success: false, message: 'Election not found.' });

  // For members, allow open, closed, and archived elections.
  if (req.user?.role === 'member' && !['open', 'closed', 'archived'].includes(String(rows[0].status))) {
    return json(res, 403, { success: false, message: 'Forbidden.' });
  }

  const [candRows] = await pool.execute(
    `SELECT
       c.*,
       u.full_name AS member_name,
       u.email AS member_email
     FROM election_candidates c
     JOIN users u ON u.id = c.member_id
     WHERE c.election_id = ?
     ORDER BY c.position ASC, c.created_at ASC`,
    [id]
  );

  return json(res, 200, { success: true, election: toElectionDto(rows[0]), candidates: candRows.map(toCandidateDto) });
}

async function createElection(req, res) {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const description = body.description ? String(body.description).trim() : null;
  const startDate = String(body.startDate || '').trim();
  const endDate = String(body.endDate || '').trim();
  const status = body.status ? String(body.status).trim() : 'draft';
  const allowedPositions = Array.isArray(body.allowedPositions) 
    ? JSON.stringify(body.allowedPositions) 
    : JSON.stringify(['President', 'Vice President', 'Treasurer', 'Secretary', 'Member']);

  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return json(res, 400, { success: false, message: 'Title, startDate, and endDate are required.' });
  }
  if (!['draft', 'open', 'closed', 'archived'].includes(status)) {
    return json(res, 400, { success: false, message: 'Invalid status.' });
  }
  if (new Date(endDate) < new Date(startDate)) {
    return json(res, 400, { success: false, message: 'endDate must be after startDate.' });
  }

  const [result] = await pool.execute(
    `INSERT INTO elections (title, description, start_date, end_date, status, allowed_positions, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, description, startDate, endDate, status, allowedPositions, req.user?.id || null]
  );

  const [rows] = await pool.execute('SELECT * FROM elections WHERE id = ? LIMIT 1', [result.insertId]);
  return json(res, 201, { success: true, election: toElectionDto(rows[0]) });
}

async function updateElection(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid id.' });
  const body = req.body || {};

  const sets = [];
  const params = [];

  if (typeof body.title === 'string') {
    if (!body.title.trim()) return json(res, 400, { success: false, message: 'Title is required.' });
    sets.push('title = ?'); params.push(body.title.trim());
  }
  if (typeof body.description === 'string') { sets.push('description = ?'); params.push(body.description.trim()); }
  if (typeof body.startDate === 'string') {
    const v = body.startDate.trim();
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return json(res, 400, { success: false, message: 'Invalid startDate.' });
    sets.push('start_date = ?'); params.push(v);
  }
  if (typeof body.endDate === 'string') {
    const v = body.endDate.trim();
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return json(res, 400, { success: false, message: 'Invalid endDate.' });
    sets.push('end_date = ?'); params.push(v);
  }
  if (typeof body.status === 'string') {
    const s = body.status.trim();
    if (!['draft', 'open', 'closed', 'archived'].includes(s)) return json(res, 400, { success: false, message: 'Invalid status.' });
    sets.push('status = ?'); params.push(s);
  }
  if (Array.isArray(body.allowedPositions)) {
    sets.push('allowed_positions = ?');
    params.push(JSON.stringify(body.allowedPositions));
  }

  if (!sets.length) return json(res, 400, { success: false, message: 'No fields to update.' });

  params.push(id);
  await pool.execute(`UPDATE elections SET ${sets.join(', ')} WHERE id = ?`, params);

  const [rows] = await pool.execute('SELECT * FROM elections WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) return json(res, 404, { success: false, message: 'Election not found.' });
  return json(res, 200, { success: true, election: toElectionDto(rows[0]) });
}


async function addCandidate(req, res) {
  const electionId = Number(req.params.id);
  if (!Number.isFinite(electionId)) return json(res, 400, { success: false, message: 'Invalid election id.' });
  const body = req.body || {};
  const memberId = Number(body.memberId);
  const position = String(body.position || '').trim();
  const platform = body.platform ? String(body.platform).trim() : null;

  if (!Number.isFinite(memberId) || !position) {
    return json(res, 400, { success: false, message: 'memberId and position are required.' });
  }

  // Only approved members can be candidates
  const [mrows] = await pool.execute(
    `SELECT id FROM users WHERE id = ? AND role = 'member' AND status = 'active' LIMIT 1`,
    [memberId]
  );
  if (!mrows.length) return json(res, 400, { success: false, message: 'Candidate must be an approved (active) member.' });

  try {
    const [result] = await pool.execute(
      `INSERT INTO election_candidates (election_id, member_id, position, platform, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [electionId, memberId, position, platform]
    );
  } catch (err) {
    const message = err && err.code === 'ER_DUP_ENTRY'
      ? 'Candidate already added for this position.'
      : 'Failed to add candidate.';
    return json(res, 400, { success: false, message });
  }

  const [candRows] = await pool.execute(
    `SELECT
       c.*,
       u.full_name AS member_name,
       u.email AS member_email
     FROM election_candidates c
     JOIN users u ON u.id = c.member_id
     WHERE c.election_id = ?
     ORDER BY c.position ASC, c.created_at ASC`,
    [electionId]
  );

  return json(res, 201, { success: true, candidates: candRows.map(toCandidateDto) });
}

async function updateCandidate(req, res) {
  const electionId = Number(req.params.id);
  const candidateId = Number(req.params.candidateId);
  if (!Number.isFinite(electionId) || !Number.isFinite(candidateId)) return json(res, 400, { success: false, message: 'Invalid id.' });
  const body = req.body || {};

  const sets = [];
  const params = [];

  if (typeof body.position === 'string') { sets.push('position = ?'); params.push(body.position.trim()); }
  if (typeof body.platform === 'string') { sets.push('platform = ?'); params.push(body.platform.trim()); }
  if (typeof body.status === 'string') {
    const s = String(body.status).trim();
    if (!['pending', 'approved', 'disqualified', 'winner'].includes(s)) return json(res, 400, { success: false, message: 'Invalid status.' });
    sets.push('status = ?'); params.push(s);
  }
  if (body.votesCount !== undefined) {
    const v = Number(body.votesCount);
    if (!Number.isFinite(v) || v < 0) return json(res, 400, { success: false, message: 'Invalid votesCount.' });
    sets.push('votes_count = ?'); params.push(v);
  }

  if (!sets.length) return json(res, 400, { success: false, message: 'No fields to update.' });

  params.push(electionId, candidateId);
  await pool.execute(
    `UPDATE election_candidates
     SET ${sets.join(', ')}
     WHERE election_id = ? AND id = ?`,
    params
  );

  const [candRows] = await pool.execute(
    `SELECT
       c.*,
       u.full_name AS member_name,
       u.email AS member_email
     FROM election_candidates c
     JOIN users u ON u.id = c.member_id
     WHERE c.election_id = ?
     ORDER BY c.position ASC, c.created_at ASC`,
    [electionId]
  );

  return json(res, 200, { success: true, candidates: candRows.map(toCandidateDto) });
}

async function markWinner(req, res) {
  const electionId = Number(req.params.id);
  const candidateId = Number(req.params.candidateId);
  if (!Number.isFinite(electionId) || !Number.isFinite(candidateId)) return json(res, 400, { success: false, message: 'Invalid id.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [candRows] = await conn.execute(
      'SELECT * FROM election_candidates WHERE id = ? AND election_id = ? LIMIT 1',
      [candidateId, electionId]
    );
    if (!candRows.length) {
      await conn.rollback();
      return json(res, 404, { success: false, message: 'Candidate not found.' });
    }

    const candidate = candRows[0];
    const memberId = Number(candidate.member_id);
    const position = String(candidate.position || '').trim();
    if (!position) {
      await conn.rollback();
      return json(res, 400, { success: false, message: 'Candidate position is required.' });
    }

    // Mark all candidates for that position as not-winner (keep statuses), then set winner.
    await conn.execute(
      `UPDATE election_candidates
       SET status = CASE WHEN status = 'winner' THEN 'approved' ELSE status END
       WHERE election_id = ? AND position = ?`,
      [electionId, position]
    );
    await conn.execute(
      `UPDATE election_candidates
       SET status = 'winner'
       WHERE id = ? AND election_id = ?`,
      [candidateId, electionId]
    );

    // Convert winning candidate into officer (term = election end date + 1 year default)
    const [eRows] = await conn.execute('SELECT * FROM elections WHERE id = ? LIMIT 1', [electionId]);
    const election = eRows[0];
    const termStart = formatDateOnly(election.end_date) || new Date().toISOString().slice(0, 10);
    const termEndDate = new Date(`${termStart}T00:00:00Z`);
    termEndDate.setFullYear(termEndDate.getFullYear() + 1);
    const termEnd = formatDateOnly(termEndDate) || null;

    const [mRows] = await conn.execute(
      `SELECT id, role, status FROM users WHERE id = ? LIMIT 1`,
      [memberId]
    );
    if (!mRows.length || String(mRows[0].status) !== 'active') {
      await conn.rollback();
      return json(res, 400, { success: false, message: 'Winner must be an active member.' });
    }

    if (String(mRows[0].role) !== 'officer') {
      await conn.execute("UPDATE users SET role = 'officer', status = 'active' WHERE id = ?", [memberId]);
    }

    // Officers table (best-effort upsert)
    const [offCols] = await conn.execute('SHOW COLUMNS FROM officers');
    const columnSet = new Set(offCols.map((c) => String(c.Field)));

    const [existingOfficer] = await conn.execute('SELECT user_id FROM officers WHERE user_id = ? LIMIT 1', [memberId]);
    if (existingOfficer.length) {
      const sets = ['position = ?', 'start_date = ?', 'end_date = ?'];
      const params = [position, termStart, termEnd];
      if (columnSet.has('term_start')) { sets.push('term_start = ?'); params.push(termStart); }
      if (columnSet.has('term_end')) { sets.push('term_end = ?'); params.push(termEnd); }
      if (columnSet.has('officer_status')) { sets.push('officer_status = ?'); params.push('active'); }
      params.push(memberId);
      await conn.execute(`UPDATE officers SET ${sets.join(', ')} WHERE user_id = ?`, params);
    } else {
      await conn.execute(
        `INSERT INTO officers (user_id, position, start_date, end_date${columnSet.has('term_start') ? ', term_start' : ''}${columnSet.has('term_end') ? ', term_end' : ''}${columnSet.has('officer_status') ? ', officer_status' : ''})
         VALUES (?, ?, ?, ?${columnSet.has('term_start') ? ', ?' : ''}${columnSet.has('term_end') ? ', ?' : ''}${columnSet.has('officer_status') ? ', ?' : ''})`,
        [memberId, position, termStart, termEnd]
          .concat(columnSet.has('term_start') ? [termStart] : [])
          .concat(columnSet.has('term_end') ? [termEnd] : [])
          .concat(columnSet.has('officer_status') ? ['active'] : [])
      );
    }

    await conn.commit();
    return json(res, 200, { success: true });
  } catch (err) {
    await conn.rollback();
    return json(res, 500, { success: false, message: err instanceof Error ? err.message : 'Failed to mark winner.' });
  } finally {
    conn.release();
  }
}

async function castVote(req, res) {
  const electionId = Number(req.params.id);
  const userId = req.user?.id;

  if (!Number.isFinite(electionId)) {
    return json(res, 400, { success: false, message: 'Invalid election id.' });
  }
  if (!userId) {
    return json(res, 401, { success: false, message: 'Unauthorized.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check if the election exists and is open
    const [eRows] = await conn.execute(
      'SELECT status, start_date, end_date FROM elections WHERE id = ? LIMIT 1',
      [electionId]
    );
    if (!eRows.length) {
      await conn.rollback();
      return json(res, 404, { success: false, message: 'Election not found.' });
    }

    const election = eRows[0];
    if (election.status !== 'open') {
      await conn.rollback();
      return json(res, 400, { success: false, message: 'Voting is only allowed for open elections.' });
    }

    // Verify user is a member
    if (req.user?.role !== 'member') {
      await conn.rollback();
      return json(res, 403, { success: false, message: 'Only members can vote.' });
    }

    // Check if already voted
    const [vRows] = await conn.execute(
      'SELECT election_id FROM election_votes WHERE election_id = ? AND user_id = ? LIMIT 1',
      [electionId, userId]
    );
    if (vRows.length) {
      await conn.rollback();
      return json(res, 400, { success: false, message: 'You have already voted in this election.' });
    }

    // Expecting body to contain an object where keys are positions and values are candidateIds:
    // e.g. { votes: { "President": 12, "Vice President": 15 } }
    const votes = req.body?.votes;
    if (!votes || typeof votes !== 'object') {
      await conn.rollback();
      return json(res, 400, { success: false, message: 'Votes selection is required.' });
    }

    const positionVotes = Object.entries(votes);
    if (positionVotes.length === 0) {
      await conn.rollback();
      return json(res, 400, { success: false, message: 'At least one vote is required.' });
    }

    // Loop through the selected candidates, verify they match the position/election, and increment votes_count
    for (const [position, candidateIdStr] of positionVotes) {
      const candidateId = Number(candidateIdStr);
      if (!Number.isFinite(candidateId)) {
        await conn.rollback();
        return json(res, 400, { success: false, message: `Invalid candidate selected for position ${position}.` });
      }

      const [candRows] = await conn.execute(
        "SELECT id FROM election_candidates WHERE id = ? AND election_id = ? AND position = ? AND status IN ('pending', 'approved', 'winner') LIMIT 1",
        [candidateId, electionId, position]
      );
      if (!candRows.length) {
        await conn.rollback();
        return json(res, 400, { success: false, message: `Selected candidate for position ${position} is not valid.` });
      }

      // Increment votes_count
      await conn.execute(
        'UPDATE election_candidates SET votes_count = votes_count + 1 WHERE id = ?',
        [candidateId]
      );
    }

    // Record that the user has voted
    await conn.execute(
      'INSERT INTO election_votes (election_id, user_id) VALUES (?, ?)',
      [electionId, userId]
    );

    await conn.commit();
    return json(res, 200, { success: true, message: 'Vote cast successfully.' });
  } catch (err) {
    await conn.rollback();
    return json(res, 500, { success: false, message: err instanceof Error ? err.message : 'Failed to cast vote.' });
  } finally {
    conn.release();
  }
}

async function checkVotedStatus(req, res) {
  const electionId = Number(req.params.id);
  const userId = req.user?.id;

  if (!Number.isFinite(electionId)) {
    return json(res, 400, { success: false, message: 'Invalid election id.' });
  }
  if (!userId) {
    return json(res, 401, { success: false, message: 'Unauthorized.' });
  }

  const [rows] = await pool.execute(
    'SELECT election_id FROM election_votes WHERE election_id = ? AND user_id = ? LIMIT 1',
    [electionId, userId]
  );
  return json(res, 200, { success: true, voted: rows.length > 0 });
}

async function deleteCandidate(req, res) {
  const electionId = Number(req.params.id);
  const candidateId = Number(req.params.candidateId);
  if (!Number.isFinite(electionId) || !Number.isFinite(candidateId)) {
    return json(res, 400, { success: false, message: 'Invalid id.' });
  }

  await pool.execute(
    'DELETE FROM election_candidates WHERE election_id = ? AND id = ?',
    [electionId, candidateId]
  );

  const [candRows] = await pool.execute(
    `SELECT
       c.*,
       u.full_name AS member_name,
       u.email AS member_email
     FROM election_candidates c
     JOIN users u ON u.id = c.member_id
     WHERE c.election_id = ?
     ORDER BY c.position ASC, c.created_at ASC`,
    [electionId]
  );

  return json(res, 200, { success: true, candidates: candRows.map(toCandidateDto) });
}

async function deleteElection(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid id.' });

  await pool.execute('DELETE FROM elections WHERE id = ?', [id]);
  return json(res, 200, { success: true, message: 'Election deleted successfully.' });
}

module.exports = {
  listElections,
  getElectionDetails,
  createElection,
  updateElection,
  addCandidate,
  updateCandidate,
  markWinner,
  castVote,
  checkVotedStatus,
  deleteCandidate,
  deleteElection,
};


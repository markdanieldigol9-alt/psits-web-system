const crypto = require('node:crypto');
const { pool } = require('./db');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `s2:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function addYears(dateValue, years) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setFullYear(date.getFullYear() + years);
  return date;
}

function formatDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toOfficerDto(row) {
  return {
    id: String(row.user_id),
    fullName: row.full_name,
    email: row.email,
    contactNumber: row.contact_number,
    sector: row.sector,
    sectorDetails: row.sector_details,
    position: row.position,
    termStart: row.term_start || row.start_date,
    termEnd: row.term_end || row.end_date,
    officerStatus: row.officer_status || (row.status === 'active' ? 'active' : 'inactive'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Returns a numerical rank for an officer position title where President is the highest rank (lowest numerical value, e.g. 10).
 * Hierarchy order:
 * 1. President
 * 2. Vice President
 * 3. Secretary / Assistant Secretary
 * 4. Treasurer / Assistant Treasurer
 * 5. Auditor / Assistant Auditor
 * 6. Business Manager
 * 7. Public Information Officer / Press Relations Officer (PIO / PRO)
 * 8. Protocol Officer
 * 9. Sergeant-at-Arms / Peace Officer / Marshal
 * 10. Representative
 * 11. Member / Committee
 */
function getPositionRank(positionName) {
  if (!positionName) return 999;
  const pos = String(positionName).trim().toLowerCase();

  // 1. President (must not be Vice President or VP)
  if (pos.includes('president') && !pos.includes('vice') && !/\bvp\b/.test(pos)) return 10;

  // 2. Vice President
  if (
    pos.includes('vice president') ||
    pos.includes('vice-president') ||
    /\bvp\b/.test(pos) ||
    pos.includes('v-pres')
  ) {
    return 20;
  }

  // 3. Secretary
  if (pos.includes('assistant secretary') || pos.includes('asst secretary') || pos.includes('asst. secretary')) return 35;
  if (pos.includes('secretary')) return 30;

  // 4. Treasurer / Finance
  if (pos.includes('assistant treasurer') || pos.includes('asst treasurer') || pos.includes('asst. treasurer')) return 45;
  if (pos.includes('treasurer') || pos.includes('finance')) return 40;

  // 5. Auditor
  if (pos.includes('assistant auditor') || pos.includes('asst auditor') || pos.includes('asst. auditor')) return 55;
  if (pos.includes('auditor')) return 50;

  // 6. Business Manager
  if (pos.includes('business')) return 60;

  // 7. Public Information Officer / Press Relations Officer (PIO / PRO)
  if (pos.includes('public information') || /\bpio\b/.test(pos)) return 70;
  if (pos.includes('press relations') || pos.includes('public relations') || /\bpro\b/.test(pos)) return 75;
  if ((pos.includes('information') || pos.includes('relations')) && !pos.includes('protocol')) return 78;

  // 8. Protocol Officer
  if (pos.includes('protocol')) return 80;

  // 9. Sergeant-at-Arms / Peace Officer / Marshal
  if (
    pos.includes('sergeant') ||
    pos.includes('sgt') ||
    pos.includes('peace') ||
    pos.includes('marshal') ||
    pos.includes('arms')
  ) {
    return 90;
  }

  // 10. Representative
  if (pos.includes('representative') || pos.includes('rep')) return 100;

  // 11. Board / Committee / Member
  if (pos.includes('member') || pos.includes('committee')) return 110;

  return 200;
}

async function getOfficerColumnSet(conn) {
  const [columnRows] = await conn.execute('SHOW COLUMNS FROM officers');
  return new Set(columnRows.map((r) => String(r.Field)));
}

/**
 * Helper: Check if an officer position title is currently assigned to an active officer user.
 * @param {import('mysql2/promise').Connection|import('mysql2/promise').Pool} conn Database connection pool
 * @param {string} position Position title to check (case-insensitive)
 * @param {number|null} [excludeUserId=null] Optional user ID to exclude (used when updating an existing officer)
 * @returns {Promise<boolean>} True if position is already assigned to another active officer
 */
async function positionInUse(conn, position, excludeUserId = null) {
  const params = [position];
  let sql = `
    SELECT o.user_id
    FROM officers o
    JOIN users u ON u.id = o.user_id
    WHERE o.position = ?
      AND u.role = 'officer'
      AND u.status = 'active'
      AND (o.officer_status = 'active' OR o.officer_status IS NULL)`;
  if (excludeUserId) {
    sql += ' AND o.user_id <> ?';
    params.push(excludeUserId);
  }
  const [rows] = await conn.execute(sql, params);
  return rows.length > 0;
}

/**
 * Controller: GET /api/officers
 * Purpose: List organization officers filtered by status (active, inactive, past, all).
 * Debugging: Logs filter query params and respects caller permissions (members see active only).
 */
async function listOfficers(req, res) {
  const status = req.query.status ? String(req.query.status).trim().toLowerCase() : 'all';
  const role = String(req.user?.role || '').toLowerCase();
  const isMemberViewer = role === 'member';

  const where = [];
  const params = [];

  if (status === 'active') {
    where.push("u.role = 'officer' AND (o.officer_status = 'active' OR (o.officer_status IS NULL AND u.status = 'active'))");
  } else if (status === 'inactive') {
    where.push("u.role = 'officer' AND (o.officer_status = 'inactive' OR (o.officer_status IS NULL AND u.status = 'inactive'))");
  } else if (status === 'past') {
    where.push("o.officer_status = 'past'");
  } else {
    where.push("(u.role = 'officer' OR o.officer_status = 'past')");
  }

  if (isMemberViewer) {
    where.push("u.status = 'active'");
  }

  const [rows] = await pool.execute(
    `SELECT
       u.id AS user_id,
       u.full_name,
       u.email,
       u.contact_number,
       u.sector,
       u.sector_details,
       u.status,
       o.position,
       o.start_date,
       o.end_date,
       o.term_start,
       o.term_end,
       o.officer_status,
       u.created_at,
       u.updated_at
     FROM users u
     JOIN officers o ON o.user_id = u.id
     WHERE ${where.join(' AND ')}
     ORDER BY
       CASE
         WHEN LOWER(o.position) LIKE '%president%' AND LOWER(o.position) NOT LIKE '%vice%' AND LOWER(o.position) NOT LIKE '%vp%' THEN 10
         WHEN LOWER(o.position) LIKE '%vice president%' OR LOWER(o.position) LIKE '%vice-president%' OR LOWER(o.position) LIKE 'vp%' OR LOWER(o.position) LIKE '% vp%' THEN 20
         WHEN LOWER(o.position) LIKE '%assistant secretary%' OR LOWER(o.position) LIKE '%asst%secretary%' THEN 35
         WHEN LOWER(o.position) LIKE '%secretary%' THEN 30
         WHEN LOWER(o.position) LIKE '%assistant treasurer%' OR LOWER(o.position) LIKE '%asst%treasurer%' THEN 45
         WHEN LOWER(o.position) LIKE '%treasurer%' OR LOWER(o.position) LIKE '%finance%' THEN 40
         WHEN LOWER(o.position) LIKE '%assistant auditor%' OR LOWER(o.position) LIKE '%asst%auditor%' THEN 55
         WHEN LOWER(o.position) LIKE '%auditor%' THEN 50
         WHEN LOWER(o.position) LIKE '%business%' THEN 60
         WHEN LOWER(o.position) LIKE '%public information%' OR LOWER(o.position) LIKE '%pio%' THEN 70
         WHEN LOWER(o.position) LIKE '%press relations%' OR LOWER(o.position) LIKE '%public relations%' OR LOWER(o.position) LIKE '%pro%' THEN 75
         WHEN LOWER(o.position) LIKE '%information%' OR LOWER(o.position) LIKE '%relations%' THEN 78
         WHEN LOWER(o.position) LIKE '%protocol%' THEN 80
         WHEN LOWER(o.position) LIKE '%sergeant%' OR LOWER(o.position) LIKE '%sgt%' OR LOWER(o.position) LIKE '%peace%' OR LOWER(o.position) LIKE '%marshal%' OR LOWER(o.position) LIKE '%arms%' THEN 90
         WHEN LOWER(o.position) LIKE '%representative%' OR LOWER(o.position) LIKE '%rep%' THEN 100
         WHEN LOWER(o.position) LIKE '%member%' OR LOWER(o.position) LIKE '%committee%' THEN 110
         ELSE 200
       END ASC,
       o.start_date DESC,
       u.full_name ASC`
    ,
    params
  );

  const officers = rows.map(toOfficerDto);
  officers.sort((a, b) => {
    const rankA = getPositionRank(a.position);
    const rankB = getPositionRank(b.position);
    if (rankA !== rankB) return rankA - rankB;
    const dateA = a.termStart ? new Date(a.termStart).getTime() : 0;
    const dateB = b.termStart ? new Date(b.termStart).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return String(a.fullName || '').localeCompare(String(b.fullName || ''));
  });

  return res.json({ success: true, officers });
}

async function createOfficer(req, res) {
  const body = req.body || {};
  const fullName = String(body.fullName || '').trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const position = String(body.position || '').trim();

  const contactNumber = String(body.contactNumber || '').trim();
  const sector = body.sector;
  const sectorDetails = typeof body.sectorDetails === 'string' ? body.sectorDetails.trim() : null;

  if (!fullName || !email || !password || !position) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }
  if (!['school', 'industry', 'institution'].includes(sector)) {
    return res.status(400).json({ success: false, message: 'Invalid sector.' });
  }
  if (!sectorDetails) {
    return res.status(400).json({ success: false, message: 'Sector details are required.' });
  }

  const startDate = body.startDate ? String(body.startDate).trim() : null;
  const start = startDate || new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const endDate = body.endDate ? String(body.endDate).trim() : null;
  const end = endDate || formatDateOnly(addYears(start, 5));

  const passwordHash = hashPassword(password);

  // Generate a username from email prefix, and avoid collisions.
  const baseUsername = String(body.username || email.split('@')[0] || 'officer').trim().slice(0, 64) || 'officer';
  let username = baseUsername;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const officerColumnSet = await getOfficerColumnSet(conn);

    // Ensure unique username
    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      const [urows] = await conn.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
      if (!urows.length) break;
      username = `${baseUsername.slice(0, 55)}${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const [result] = await conn.execute(
      `INSERT INTO users
        (email, username, full_name, password_hash, role, status, contact_number, sector, sector_details)
       VALUES
        (?, ?, ?, ?, 'officer', 'active', ?, ?, ?)`,
      [email, username, fullName, passwordHash, contactNumber, sector, sectorDetails]
    );

    const userId = result.insertId;

    if (await positionInUse(conn, position)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Position already assigned to another active officer.' });
    }

    await conn.execute(
      `INSERT INTO officers (${['user_id', 'position', 'start_date', 'end_date']
        .concat(officerColumnSet.has('term_start') ? ['term_start'] : [])
        .concat(officerColumnSet.has('term_end') ? ['term_end'] : [])
        .concat(officerColumnSet.has('officer_status') ? ['officer_status'] : [])
        .join(', ')})
       VALUES (${['?', '?', '?', '?']
         .concat(officerColumnSet.has('term_start') ? ['?'] : [])
         .concat(officerColumnSet.has('term_end') ? ['?'] : [])
         .concat(officerColumnSet.has('officer_status') ? ['?'] : [])
         .join(', ')})`,
      [userId, position, start, end]
        .concat(officerColumnSet.has('term_start') ? [start] : [])
        .concat(officerColumnSet.has('term_end') ? [end] : [])
        .concat(officerColumnSet.has('officer_status') ? ['active'] : [])
    );

    const [rows] = await conn.execute(
      `SELECT
         u.id AS user_id,
         u.full_name,
         u.email,
         u.contact_number,
         u.sector,
         u.sector_details,
         u.status,
       o.position,
       o.start_date,
       o.end_date,
       o.term_start,
       o.term_end,
       o.officer_status,
       u.created_at,
       u.updated_at
     FROM users u
     JOIN officers o ON o.user_id = u.id
     WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );

    await conn.commit();
    return res.status(201).json({ success: true, officer: toOfficerDto(rows[0]) });
  } catch (err) {
    await conn.rollback();
    const message = err && err.code === 'ER_DUP_ENTRY'
      ? 'Email or username already exists.'
      : 'Create officer failed.';
    return res.status(400).json({ success: false, message });
  } finally {
    conn.release();
  }
}

/**
 * Controller: POST /api/officers/assign
 * Purpose: Promote an existing active member user to an officer with a designated position and term.
 * Debugging: Validates user eligibility (role must be member, status active) and position availability.
 */
async function assignOfficer(req, res) {
  const body = req.body || {};
  const userId = Number(body.userId);
  const position = String(body.position || '').trim();

  if (!Number.isFinite(userId)) {
    return res.status(400).json({ success: false, message: 'Invalid userId.' });
  }
  if (!position) {
    return res.status(400).json({ success: false, message: 'Position is required.' });
  }

  const startDate = body.startDate ? String(body.startDate).trim() : null;
  const start = startDate || new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const endDate = body.endDate ? String(body.endDate).trim() : null;
  const end = endDate || formatDateOnly(addYears(start, 5));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const officerColumnSet = await getOfficerColumnSet(conn);

    const [urows] = await conn.execute(
      'SELECT id, role, status FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!urows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const role = urows[0].role;
    if (role === 'officer') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'User is already an officer.' });
    }
    if (role !== 'member') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Only members can be assigned as officers.' });
    }
    if (String(urows[0].status) !== 'active') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Only approved (active) members can be assigned as officers.' });
    }

    if (await positionInUse(conn, position)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Position already assigned to another active officer.' });
    }

    await conn.execute(
      "UPDATE users SET role = 'officer', status = 'active' WHERE id = ?",
      [userId]
    );

    const [existingOfficer] = await conn.execute(
      'SELECT user_id FROM officers WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (existingOfficer.length) {
      const sets = ['position = ?', 'start_date = ?', 'end_date = ?'];
      const params = [position, start, end];
      if (officerColumnSet.has('term_start')) { sets.push('term_start = ?'); params.push(start); }
      if (officerColumnSet.has('term_end')) { sets.push('term_end = ?'); params.push(end); }
      if (officerColumnSet.has('officer_status')) { sets.push('officer_status = ?'); params.push('active'); }
      params.push(userId);
      await conn.execute(`UPDATE officers SET ${sets.join(', ')} WHERE user_id = ?`, params);
    } else {
      await conn.execute(
        `INSERT INTO officers (${['user_id', 'position', 'start_date', 'end_date']
          .concat(officerColumnSet.has('term_start') ? ['term_start'] : [])
          .concat(officerColumnSet.has('term_end') ? ['term_end'] : [])
          .concat(officerColumnSet.has('officer_status') ? ['officer_status'] : [])
          .join(', ')})
         VALUES (${['?', '?', '?', '?']
           .concat(officerColumnSet.has('term_start') ? ['?'] : [])
           .concat(officerColumnSet.has('term_end') ? ['?'] : [])
           .concat(officerColumnSet.has('officer_status') ? ['?'] : [])
           .join(', ')})`,
        [userId, position, start, end]
          .concat(officerColumnSet.has('term_start') ? [start] : [])
          .concat(officerColumnSet.has('term_end') ? [end] : [])
          .concat(officerColumnSet.has('officer_status') ? ['active'] : [])
      );
    }

    const [rows] = await conn.execute(
      `SELECT
         u.id AS user_id,
         u.full_name,
         u.email,
         u.contact_number,
         u.sector,
         u.sector_details,
         u.status,
         o.position,
         o.start_date,
         o.end_date,
         u.created_at,
         u.updated_at
       FROM users u
       JOIN officers o ON o.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );

    await conn.commit();
    return res.status(201).json({ success: true, officer: toOfficerDto(rows[0]) });
  } catch (err) {
    await conn.rollback();
    const message = err && err.code === 'ER_DUP_ENTRY'
      ? 'Officer record already exists.'
      : 'Assign officer failed.';
    return res.status(400).json({ success: false, message });
  } finally {
    conn.release();
  }
}

async function updateOfficer(req, res) {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const body = req.body || {};

  const userSets = [];
  const userParams = [];
  if (typeof body.fullName === 'string' && body.fullName.trim()) { userSets.push('full_name = ?'); userParams.push(body.fullName.trim()); }
  if (typeof body.email === 'string' && body.email.trim()) { userSets.push('email = ?'); userParams.push(normalizeEmail(body.email)); }
  if (typeof body.contactNumber === 'string') { userSets.push('contact_number = ?'); userParams.push(body.contactNumber.trim()); }
  if (typeof body.sector === 'string' && ['school', 'industry', 'institution'].includes(body.sector)) { userSets.push('sector = ?'); userParams.push(body.sector); }
  if (typeof body.sectorDetails === 'string') { userSets.push('sector_details = ?'); userParams.push(body.sectorDetails.trim() || null); }

  const officerSets = [];
  const officerParams = [];
  if (typeof body.position === 'string') { officerSets.push('position = ?'); officerParams.push(body.position.trim()); }
  if (body.startDate !== undefined) { officerSets.push('start_date = ?'); officerParams.push(body.startDate ? String(body.startDate).trim() : null); }
  if (body.endDate !== undefined) { officerSets.push('end_date = ?'); officerParams.push(body.endDate ? String(body.endDate).trim() : null); }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const officerColumnSet = await getOfficerColumnSet(conn);

    const statusInput = body.officerStatus || body.status;
    if (typeof statusInput === 'string' && ['active', 'inactive', 'past'].includes(statusInput.toLowerCase())) {
      const s = statusInput.toLowerCase();
      userSets.push('status = ?');
      userParams.push(s === 'past' ? 'active' : s);
      if (officerColumnSet.has('officer_status')) {
        officerSets.push('officer_status = ?');
        officerParams.push(s);
      }
    }

    if (!userSets.length && !officerSets.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    const [exists] = await conn.execute("SELECT id FROM users WHERE id = ? AND role = 'officer' LIMIT 1", [userId]);
    if (!exists.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Officer not found.' });
    }

    if (userSets.length) {
      userParams.push(userId);
      await conn.execute(`UPDATE users SET ${userSets.join(', ')} WHERE id = ?`, userParams);
    }

    let swappedWith = null;
    if (officerSets.length) {
      if (typeof body.position === 'string') {
        const nextPosition = body.position.trim();
        
        // Fetch current officer's existing position
        const [currRows] = await conn.execute(
          'SELECT position FROM officers WHERE user_id = ? LIMIT 1',
          [userId]
        );
        const currentPosition = currRows[0]?.position || '';

        // If changing to a different position
        if (nextPosition && nextPosition.toLowerCase() !== currentPosition.toLowerCase()) {
          // Check if another active officer is occupying this position
          const [occupiedRows] = await conn.execute(
            `SELECT o.user_id, o.position, u.full_name, u.email
             FROM officers o
             JOIN users u ON u.id = o.user_id
             WHERE LOWER(TRIM(o.position)) = LOWER(?)
               AND (o.officer_status = 'active' OR o.officer_status IS NULL)
               AND o.user_id <> ?
             LIMIT 1`,
            [nextPosition, userId]
          );

          if (occupiedRows.length > 0) {
            // Swap positions: Assign other officer to this officer's current position
            const otherOfficer = occupiedRows[0];
            await conn.execute(
              'UPDATE officers SET position = ? WHERE user_id = ?',
              [currentPosition || 'Member', otherOfficer.user_id]
            );
            swappedWith = {
              userId: otherOfficer.user_id,
              name: otherOfficer.full_name,
              previousPosition: nextPosition,
              newPosition: currentPosition || 'Member',
            };
          }
        }
      }
      officerParams.push(userId);
      await conn.execute(`UPDATE officers SET ${officerSets.join(', ')} WHERE user_id = ?`, officerParams);
    }

    const [rows] = await conn.execute(
      `SELECT
         u.id AS user_id,
         u.full_name,
         u.email,
         u.contact_number,
         u.sector,
         u.sector_details,
         u.status,
         o.position,
         o.start_date,
         o.end_date,
         u.created_at,
         u.updated_at
       FROM users u
       JOIN officers o ON o.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );

    await conn.commit();
    return res.json({
      success: true,
      officer: toOfficerDto(rows[0]),
      swappedWith,
      message: swappedWith
        ? `Position updated to "${rows[0].position}" and swapped with ${swappedWith.name} (who is now ${swappedWith.newPosition}).`
        : 'Officer updated successfully.',
    });
  } catch (err) {
    await conn.rollback();
    const message = err && err.code === 'ER_DUP_ENTRY'
      ? 'Email already exists.'
      : 'Update officer failed.';
    return res.status(400).json({ success: false, message });
  } finally {
    conn.release();
  }
}

/**
 * Controller: POST /api/officers/swap
 * Purpose: Directly swap positions between two officers (Admin / Super Admin / Officer)
 */
async function swapOfficers(req, res) {
  const { officerId1, officerId2 } = req.body || {};
  const id1 = Number(officerId1);
  const id2 = Number(officerId2);

  if (!Number.isFinite(id1) || !Number.isFinite(id2) || id1 === id2) {
    return res.status(400).json({ success: false, message: 'Please provide two distinct valid officer IDs to swap.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows1] = await conn.execute(
      `SELECT o.user_id, o.position, u.full_name, u.email
       FROM officers o
       JOIN users u ON u.id = o.user_id
       WHERE o.user_id = ?
       LIMIT 1`,
      [id1]
    );

    const [rows2] = await conn.execute(
      `SELECT o.user_id, o.position, u.full_name, u.email
       FROM officers o
       JOIN users u ON u.id = o.user_id
       WHERE o.user_id = ?
       LIMIT 1`,
      [id2]
    );

    if (!rows1.length || !rows2.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'One or both officers could not be found.' });
    }

    const officer1 = rows1[0];
    const officer2 = rows2[0];
    const pos1 = officer1.position;
    const pos2 = officer2.position;

    // Swap positions
    await conn.execute('UPDATE officers SET position = ? WHERE user_id = ?', [pos2, id1]);
    await conn.execute('UPDATE officers SET position = ? WHERE user_id = ?', [pos1, id2]);

    await conn.commit();

    return res.json({
      success: true,
      message: `Successfully swapped positions: ${officer1.full_name} is now ${pos2}, and ${officer2.full_name} is now ${pos1}.`,
      officer1: { id: id1, name: officer1.full_name, position: pos2 },
      officer2: { id: id2, name: officer2.full_name, position: pos1 },
    });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ success: false, message: 'Failed to swap officer positions.', error: err.message });
  } finally {
    conn.release();
  }
}

async function deleteOfficer(req, res) {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [exists] = await conn.execute("SELECT id FROM users WHERE id = ? AND role = 'officer' LIMIT 1", [userId]);
    if (!exists.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Officer not found.' });
    }

    const officerColumnSet = await getOfficerColumnSet(conn);
    const endDate = new Date().toISOString().slice(0, 10);
    const sets = ['end_date = COALESCE(end_date, ?)'];
    const params = [endDate];
    if (officerColumnSet.has('term_end')) {
      sets.push('term_end = COALESCE(term_end, ?)');
      params.push(endDate);
    }
    if (officerColumnSet.has('officer_status')) {
      sets.push("officer_status = 'past'");
    }
    params.push(userId);
    await conn.execute(
      `UPDATE officers SET ${sets.join(', ')} WHERE user_id = ?`,
      params
    );
    await conn.execute("UPDATE users SET role = 'member', status = 'active' WHERE id = ?", [userId]);

    await conn.commit();
    return res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(400).json({ success: false, message: 'Remove officer failed.' });
  } finally {
    conn.release();
  }
}

/**
 * Controller: GET /api/officer-positions
 * Purpose: Fetch all dynamic officer positions (both default and custom created by admin).
 * Debugging: Returns position items ordered by ID ascending. Used by officer assignment and election forms.
 */
async function listOfficerPositions(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, description, is_default AS isDefault, created_at AS createdAt
       FROM officer_positions
       ORDER BY
         CASE
           WHEN LOWER(name) LIKE '%president%' AND LOWER(name) NOT LIKE '%vice%' AND LOWER(name) NOT LIKE '%vp%' THEN 10
           WHEN LOWER(name) LIKE '%vice president%' OR LOWER(name) LIKE '%vice-president%' OR LOWER(name) LIKE 'vp%' OR LOWER(name) LIKE '% vp%' THEN 20
           WHEN LOWER(name) LIKE '%assistant secretary%' OR LOWER(name) LIKE '%asst%secretary%' THEN 35
           WHEN LOWER(name) LIKE '%secretary%' THEN 30
           WHEN LOWER(name) LIKE '%assistant treasurer%' OR LOWER(name) LIKE '%asst%treasurer%' THEN 45
           WHEN LOWER(name) LIKE '%treasurer%' OR LOWER(name) LIKE '%finance%' THEN 40
           WHEN LOWER(name) LIKE '%assistant auditor%' OR LOWER(name) LIKE '%asst%auditor%' THEN 55
           WHEN LOWER(name) LIKE '%auditor%' THEN 50
           WHEN LOWER(name) LIKE '%business%' THEN 60
           WHEN LOWER(name) LIKE '%public information%' OR LOWER(name) LIKE '%pio%' THEN 70
           WHEN LOWER(name) LIKE '%press relations%' OR LOWER(name) LIKE '%public relations%' OR LOWER(name) LIKE '%pro%' THEN 75
           WHEN LOWER(name) LIKE '%information%' OR LOWER(name) LIKE '%relations%' THEN 78
           WHEN LOWER(name) LIKE '%protocol%' THEN 80
           WHEN LOWER(name) LIKE '%sergeant%' OR LOWER(name) LIKE '%sgt%' OR LOWER(name) LIKE '%peace%' OR LOWER(name) LIKE '%marshal%' OR LOWER(name) LIKE '%arms%' THEN 90
           WHEN LOWER(name) LIKE '%representative%' OR LOWER(name) LIKE '%rep%' THEN 100
           WHEN LOWER(name) LIKE '%member%' OR LOWER(name) LIKE '%committee%' THEN 110
           ELSE 200
         END ASC,
         id ASC`
    );
    const positions = rows.map(r => ({ ...r, id: String(r.id), isDefault: Boolean(r.isDefault) }));
    positions.sort((a, b) => {
      const rankA = getPositionRank(a.name);
      const rankB = getPositionRank(b.name);
      if (rankA !== rankB) return rankA - rankB;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return res.json({ success: true, positions });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch officer positions.' });
  }
}

/**
 * Controller: POST /api/officer-positions
 * Purpose: Create a new custom officer position title (Admin / Super Admin only).
 * Debugging: Checks case-insensitive title uniqueness before inserting into `officer_positions`.
 */
async function createOfficerPosition(req, res) {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();

  if (!name) {
    return res.status(400).json({ success: false, message: 'Position name is required.' });
  }

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM officer_positions WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [name]
    );
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'Position name already exists.' });
    }

    const [result] = await pool.execute(
      'INSERT INTO officer_positions (name, description, is_default) VALUES (?, ?, 0)',
      [name, description || null]
    );

    return res.status(201).json({
      success: true,
      position: {
        id: String(result.insertId),
        name,
        description: description || null,
        isDefault: false,
      },
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Failed to create officer position.' });
  }
}

/**
 * Controller: DELETE /api/officer-positions/:id
 * Purpose: Delete a custom officer position (Admin / Super Admin only).
 * Debugging: Rejects deletion if position is currently assigned to an active officer. Default roles cannot be deleted.
 */
async function deleteOfficerPosition(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: 'Invalid position ID.' });
  }

  try {
    const [rows] = await pool.execute('SELECT id, name, is_default FROM officer_positions WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Position not found.' });
    }

    const pos = rows[0];

    const [assigned] = await pool.execute(
      `SELECT o.user_id
       FROM officers o
       JOIN users u ON u.id = o.user_id
       WHERE LOWER(o.position) = LOWER(?)
         AND u.role = 'officer'
         AND u.status = 'active'
       LIMIT 1`,
      [pos.name]
    );

    if (assigned.length) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete position "${pos.name}" because it is currently assigned to an active officer.`,
      });
    }

    await pool.execute('DELETE FROM officer_positions WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Position deleted successfully.' });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Failed to delete position.' });
  }
}

module.exports = {
  getPositionRank,
  listOfficers,
  createOfficer,
  assignOfficer,
  updateOfficer,
  swapOfficers,
  deleteOfficer,
  listOfficerPositions,
  createOfficerPosition,
  deleteOfficerPosition,
};


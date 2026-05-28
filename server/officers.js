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

async function getOfficerColumnSet(conn) {
  const [columnRows] = await conn.execute('SHOW COLUMNS FROM officers');
  return new Set(columnRows.map((r) => String(r.Field)));
}

async function positionInUse(conn, position, excludeUserId = null) {
  const params = [position];
  let sql = `
    SELECT o.user_id
    FROM officers o
    JOIN users u ON u.id = o.user_id
    WHERE o.position = ?
      AND u.role = 'officer'
      AND u.status = 'active'`;
  if (excludeUserId) {
    sql += ' AND o.user_id <> ?';
    params.push(excludeUserId);
  }
  const [rows] = await conn.execute(sql, params);
  return rows.length > 0;
}

async function listOfficers(req, res) {
  const where = ["u.role = 'officer'"];
  const params = [];
  const role = String(req.user?.role || '').toLowerCase();
  const isMemberViewer = role === 'member' || role.startsWith('member_');

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
     ORDER BY u.created_at DESC`
    ,
    params
  );

  return res.json({ success: true, officers: rows.map(toOfficerDto) });
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
  if (typeof body.status === 'string' && ['active', 'inactive'].includes(body.status)) { userSets.push('status = ?'); userParams.push(body.status); }

  const officerSets = [];
  const officerParams = [];
  if (typeof body.position === 'string') { officerSets.push('position = ?'); officerParams.push(body.position.trim()); }
  if (body.startDate !== undefined) { officerSets.push('start_date = ?'); officerParams.push(body.startDate ? String(body.startDate).trim() : null); }
  if (body.endDate !== undefined) { officerSets.push('end_date = ?'); officerParams.push(body.endDate ? String(body.endDate).trim() : null); }

  if (!userSets.length && !officerSets.length) {
    return res.status(400).json({ success: false, message: 'No fields to update.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [exists] = await conn.execute("SELECT id FROM users WHERE id = ? AND role = 'officer' LIMIT 1", [userId]);
    if (!exists.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Officer not found.' });
    }

    if (userSets.length) {
      userParams.push(userId);
      await conn.execute(`UPDATE users SET ${userSets.join(', ')} WHERE id = ?`, userParams);
    }

    if (officerSets.length) {
      if (typeof body.position === 'string') {
        const nextPosition = body.position.trim();
        if (await positionInUse(conn, nextPosition, userId)) {
          await conn.rollback();
          return res.status(400).json({ success: false, message: 'Position already assigned to another active officer.' });
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
    return res.json({ success: true, officer: toOfficerDto(rows[0]) });
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

    const endDate = new Date().toISOString().slice(0, 10);
    await conn.execute(
      'UPDATE officers SET end_date = COALESCE(end_date, ?) WHERE user_id = ?',
      [endDate, userId]
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

module.exports = { listOfficers, createOfficer, assignOfficer, updateOfficer, deleteOfficer };

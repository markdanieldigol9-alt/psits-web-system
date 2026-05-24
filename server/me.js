const { pool } = require('./db');

function formatDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toUserDto(row) {
  const birthdate = formatDateOnly(row.birthdate);

  return {
    id: String(row.id),
    email: row.email,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    contactNumber: row.contact_number,
    sector: row.sector,
    sectorDetails: row.sector_details,
    memberType: row.member_type === 'school' ? 'student' : row.member_type,
    birthdate,
    address: row.address,
    gender: row.gender,
    occupation: row.occupation,
    representativeName: row.representative_name,
    representativeName2: row.representative_name_2,
    position: row.position,
    representativePosition2: row.representative_position_2,
    companyEmail: row.company_email,
    website: row.website,
    membershipMode: row.membership_mode,
    membershipStartedAt: row.membership_started_at || null,
    membershipExpiresAt: row.membership_expires_at || null,
    status: row.status,
    isActive: row.status === 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getMe(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'User not found.' });

  return res.json({ success: true, user: toUserDto(rows[0]) });
}

async function updateMe(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

  const body = req.body || {};
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : null;
  const contactNumber = typeof body.contactNumber === 'string' ? body.contactNumber.trim() : null;
  const sectorDetails = typeof body.sectorDetails === 'string' ? body.sectorDetails.trim() : null;
  const hasBirthdate = Object.prototype.hasOwnProperty.call(body, 'birthdate');
  const birthdate = hasBirthdate
    ? (body.birthdate === null || String(body.birthdate).trim() === '' ? null : String(body.birthdate).trim())
    : null;
  if (hasBirthdate && birthdate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    return res.status(400).json({ success: false, message: 'Birthdate must be in YYYY-MM-DD format.' });
  }

  let memberType = typeof body.memberType === 'string' ? body.memberType.trim() : null;
  if (memberType === 'school') memberType = 'student';

  const sets = [];
  const params = [];
  if (fullName) { sets.push('full_name = ?'); params.push(fullName); }
  if (contactNumber !== null) { sets.push('contact_number = ?'); params.push(contactNumber); }
  if (sectorDetails !== null) { sets.push('sector_details = ?'); params.push(sectorDetails); }
  if (hasBirthdate) { sets.push('birthdate = ?'); params.push(birthdate); }
  if (memberType) { sets.push('member_type = ?'); params.push(memberType); }

  if (!sets.length) {
    return res.status(400).json({ success: false, message: 'No fields to update.' });
  }

  params.push(userId);
  await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);

  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  return res.json({ success: true, user: toUserDto(rows[0]) });
}

module.exports = { getMe, updateMe };


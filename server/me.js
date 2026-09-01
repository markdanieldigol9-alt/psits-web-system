const crypto = require('crypto');
const { pool } = require('./db');

function formatDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `s2:${salt.toString('hex')}:${hash.toString('hex')}`;
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
    avatarUrl: row.avatar_url || null,
    suspendedReason: row.suspended_reason || null,
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
  const sets = [];
  const params = [];

  const addField = (col, val) => {
    sets.push(`${col} = ?`);
    params.push(val);
  };

  if (body.avatarUrl !== undefined) addField('avatar_url', typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() || null : null);
  if (body.fullName !== undefined) addField('full_name', typeof body.fullName === 'string' ? body.fullName.trim() : null);
  if (body.contactNumber !== undefined) addField('contact_number', typeof body.contactNumber === 'string' ? body.contactNumber.trim() : null);
  if (body.sectorDetails !== undefined) addField('sector_details', typeof body.sectorDetails === 'string' ? body.sectorDetails.trim() : null);
  if (body.memberType !== undefined) {
    let mt = typeof body.memberType === 'string' ? body.memberType.trim() : null;
    if (mt === 'school') mt = 'student';
    addField('member_type', mt);
  }
  
  if (body.birthdate !== undefined || body.birthDate !== undefined) {
    const bdate = body.birthdate !== undefined ? body.birthdate : body.birthDate;
    const birthdateStr = (bdate === null || String(bdate).trim() === '') ? null : String(bdate).trim();
    if (birthdateStr !== null && !/^\d{4}-\d{2}-\d{2}$/.test(birthdateStr)) {
      return res.status(400).json({ success: false, message: 'Birthdate must be in YYYY-MM-DD format.' });
    }
    addField('birthdate', birthdateStr);
  }

  if (body.address !== undefined) addField('address', typeof body.address === 'string' ? body.address.trim() : null);
  if (body.gender !== undefined) addField('gender', typeof body.gender === 'string' ? body.gender.trim() : null);
  if (body.occupation !== undefined) addField('occupation', typeof body.occupation === 'string' ? body.occupation.trim() : null);
  if (body.representativeName !== undefined) addField('representative_name', typeof body.representativeName === 'string' ? body.representativeName.trim() : null);
  if (body.representativeName2 !== undefined) addField('representative_name_2', typeof body.representativeName2 === 'string' ? body.representativeName2.trim() : null);
  if (body.position !== undefined) addField('position', typeof body.position === 'string' ? body.position.trim() : null);
  if (body.representativePosition2 !== undefined) addField('representative_position_2', typeof body.representativePosition2 === 'string' ? body.representativePosition2.trim() : null);
  if (body.companyEmail !== undefined) addField('company_email', typeof body.companyEmail === 'string' ? body.companyEmail.trim() : null);
  if (body.website !== undefined) addField('website', typeof body.website === 'string' ? body.website.trim() : null);

  if (typeof body.password === 'string' && body.password.trim()) {
    const pw = body.password.trim();
    if (pw.length < 10) {
      return res.status(400).json({ success: false, message: 'Password must be at least 10 characters long.' });
    }
    addField('password_hash', hashPassword(pw));
  }

  if (!sets.length) {
    return res.status(400).json({ success: false, message: 'No fields to update.' });
  }

  params.push(userId);
  await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);

  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  return res.json({ success: true, user: toUserDto(rows[0]) });
}

module.exports = { getMe, updateMe };


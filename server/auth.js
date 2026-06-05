const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pool } = require('./db');
const { isDbError } = require('./isDbError');
const { sendRegistrationSubmittedEmail } = require('./mailer');

const PASSWORD_RULES = {
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSpecial: true,
};

function json(res, status, body) {
  res.status(status).json(body);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validatePasswordRules(password) {
  const value = String(password || '');
  if (value.length < PASSWORD_RULES.minLength) {
    return `Password must be at least ${PASSWORD_RULES.minLength} characters long.`;
  }
  if (PASSWORD_RULES.requireUpper && !/[A-Z]/.test(value)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (PASSWORD_RULES.requireLower && !/[a-z]/.test(value)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(value)) {
    return 'Password must include at least one number.';
  }
  if (PASSWORD_RULES.requireSpecial && !/[^\w\s]/.test(value)) {
    return 'Password must include at least one special character.';
  }
  return null;
}

function parseDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    return new Date(`${trimmed}T00:00:00Z`);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  return null;
}

function getAgeYears(birthDate) {
  const now = new Date();
  const yearDiff = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = now.getUTCDate() - birthDate.getUTCDate();
  if (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0)) {
    return yearDiff;
  }
  return yearDiff - 1;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `s2:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, passwordHash) {
  const parts = String(passwordHash || '').split(':');
  if (parts.length !== 3 || parts[0] !== 's2') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(String(password), salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

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
    status: row.status,
    approvalEmailStatus: row.approval_email_status || null,
    approvalEmailSentAt: row.approval_email_sent_at || null,
    approvalEmailError: row.approval_email_error || null,
    membershipExpiresAt: row.membership_expires_at || null,
    isActive: row.status === 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function register(req, res) {
  const body = req.body || {};
  const fullName = String(body.fullName || '').trim();
  const email = normalizeEmail(body.email);
  const username = String(body.username || email.split('@')[0] || '').trim();
  const password = String(body.password || '').trim();
  const renewAccountId = body.renewAccountId ? String(body.renewAccountId).trim() : '';
  const termsAccepted =
    body.termsAccepted === true || body.termsAccepted === 1 || body.termsAccepted === '1';

  if (!fullName || !email || !username || !password) {
    return json(res, 400, { success: false, message: 'Missing required fields.' });
  }

  const passwordError = validatePasswordRules(password);
  if (passwordError) {
    return json(res, 400, { success: false, message: passwordError });
  }

  if (!termsAccepted) {
    return json(res, 400, { success: false, message: 'Terms and conditions must be accepted.' });
  }

  const contactNumber = String(body.contactNumber || '').trim();
  const birthdateRaw = body.birthdate ?? body.birthDate;
  const birthdate = birthdateRaw === undefined || birthdateRaw === null || String(birthdateRaw).trim() === ''
    ? null
    : String(birthdateRaw).trim();
  if (birthdate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    return json(res, 400, { success: false, message: 'Birthdate must be in YYYY-MM-DD format.' });
  }

  const allowedSectors = ['school', 'industry', 'institution'];
  const sector = allowedSectors.includes(body.sector) ? body.sector : 'institution';
  const sectorDetails = body.sectorDetails ? String(body.sectorDetails).trim() : null;
  const allowedMemberTypes = ['student', 'school', 'individual', 'industry', 'institution'];
  let memberType = body.memberType ? String(body.memberType).trim() : null;
  if (memberType === 'school') memberType = 'student';
  if (memberType && !allowedMemberTypes.includes(memberType)) memberType = null;

  if (memberType === 'individual') {
    const birthDateObj = parseDateOnly(birthdate);
    if (!birthDateObj) {
      return json(res, 400, { success: false, message: 'Birthdate is required for individual members.' });
    }
    const age = getAgeYears(birthDateObj);
    if (age < 16) {
      return json(res, 400, { success: false, message: 'Individual membership requires age 16 or older.' });
    }
  }

  const address = body.address ? String(body.address).trim() : null;
  const gender = body.gender ? String(body.gender).trim() : null;
  const occupation = body.occupation ? String(body.occupation).trim() : null;
  const representativeName = body.representativeName ? String(body.representativeName).trim() : null;
  const representativeName2 = body.representativeName2 ? String(body.representativeName2).trim() : null;
  const position = body.position ? String(body.position).trim() : null;
  const representativePosition2 = body.representativePosition2 ? String(body.representativePosition2).trim() : null;
  const companyEmail = body.companyEmail ? String(body.companyEmail).trim() : null;
  const website = body.website ? String(body.website).trim() : null;
  const membershipMode = body.membershipMode ? String(body.membershipMode).trim() : 'new';
  const paymentProof = body.paymentProof ? String(body.paymentProof) : null;

  if (memberType === 'industry') {
    if (!sectorDetails) return json(res, 400, { success: false, message: 'Company name is required.' });
    if (!representativeName) return json(res, 400, { success: false, message: 'Representative name is required.' });
    if (!position) return json(res, 400, { success: false, message: 'Position is required.' });
    if (!companyEmail) return json(res, 400, { success: false, message: 'Company email is required.' });
  }

  if (memberType === 'institution') {
    if (!sectorDetails) return json(res, 400, { success: false, message: 'Institution name is required.' });
    if (!representativeName) return json(res, 400, { success: false, message: 'Representative name is required.' });
    if (!representativeName2) return json(res, 400, { success: false, message: 'Second representative is required.' });
    if (!position) return json(res, 400, { success: false, message: 'Representative position is required.' });
    if (!representativePosition2) return json(res, 400, { success: false, message: 'Second representative position is required.' });
    if (!companyEmail) return json(res, 400, { success: false, message: 'Institution email is required.' });
  }

  try {
    const passwordHash = hashPassword(password);

    const [columnRows] = await pool.execute('SHOW COLUMNS FROM users');
    const columnSet = new Set(columnRows.map((row) => String(row.Field)));

    const requiredColumns = ['email', 'username', 'full_name', 'password_hash'];
    const missingRequired = requiredColumns.filter((col) => !columnSet.has(col));
    if (missingRequired.length) {
      return json(res, 500, {
        success: false,
        message: `Database schema missing required columns: ${missingRequired.join(', ')}.`,
      });
    }

    const columns = [];
    const values = [];
    const add = (col, val) => {
      if (columnSet.has(col)) {
        columns.push(col);
        values.push(val);
      }
    };

    let renewReferenceId = null;
    if (membershipMode === 'renew' && renewAccountId) {
      const lookupId = Number(renewAccountId);
      const lookupValue = Number.isFinite(lookupId) ? lookupId : normalizeEmail(renewAccountId);
      const [renewRows] = await pool.execute(
        `SELECT * FROM users WHERE ${Number.isFinite(lookupId) ? 'id = ?' : 'email = ?'} LIMIT 1`,
        [lookupValue]
      );
      if (renewRows.length) {
        const prev = renewRows[0];
        renewReferenceId = prev.id;
        if (!memberType && prev.member_type) {
          memberType = prev.member_type === 'school' ? 'student' : prev.member_type;
        }
        if (!sectorDetails && prev.sector_details) {
          add('sector_details', prev.sector_details);
        }
        if (!address && prev.address) {
          add('address', prev.address);
        }
        if (!gender && prev.gender) {
          add('gender', prev.gender);
        }
        if (!occupation && prev.occupation) {
          add('occupation', prev.occupation);
        }
        if (!representativeName && prev.representative_name) {
          add('representative_name', prev.representative_name);
        }
        if (!representativeName2 && prev.representative_name_2) {
          add('representative_name_2', prev.representative_name_2);
        }
        if (!position && prev.position) {
          add('position', prev.position);
        }
        if (!representativePosition2 && prev.representative_position_2) {
          add('representative_position_2', prev.representative_position_2);
        }
        if (!companyEmail && prev.company_email) {
          add('company_email', prev.company_email);
        }
        if (!website && prev.website) {
          add('website', prev.website);
        }
      }
    }

    add('email', email);
    add('username', username);
    add('full_name', fullName);
    add('password_hash', passwordHash);
    add('role', 'member');
    add('contact_number', contactNumber);
    add('sector', sector);
    add('sector_details', sectorDetails);
    add('member_type', memberType);
    add('terms_accepted', termsAccepted ? 1 : 0);
    add('status', 'pending');
    add('birthdate', birthdate);
    add('address', address);
    add('gender', gender);
    add('occupation', occupation);
    add('representative_name', representativeName);
    add('representative_name_2', representativeName2);
    add('position', position);
    add('representative_position_2', representativePosition2);
    add('company_email', companyEmail);
    add('website', website);
    add('membership_mode', membershipMode);
    add('renew_reference_id', renewReferenceId);

    const placeholders = columns.map(() => '?').join(', ');
    const columnSql = columns.map((c) => `\`${c}\``).join(', ');
    const [result] = await pool.execute(
      `INSERT INTO users (${columnSql}) VALUES (${placeholders})`,
      values
    );

    const insertedId = result.insertId;

    if (paymentProof) {
      const match = paymentProof.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const base64 = match[3];
        const buffer = Buffer.from(base64, 'base64');
        const maxBytes = 8 * 1024 * 1024;
        
        if (buffer.length && buffer.length <= maxBytes) {
          try {
            const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
            const dir = path.join(__dirname, 'uploads', 'payment-proofs');
            await fs.mkdir(dir, { recursive: true });
            const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
            await fs.writeFile(path.join(dir, filename), buffer);

            await pool.execute(
              `INSERT INTO payments (member_id, amount, method, proof_url, status) VALUES (?, 0, 'gcash', ?, 'pending')`,
              [insertedId, `/uploads/payment-proofs/${filename}`]
            );
          } catch (err) {
            // Don't block registration if optional payment proof storage fails.
            // eslint-disable-next-line no-console
            console.error('Payment proof save failed:', err);
          }
        }
      }
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [insertedId]);
    if (rows[0]?.email) {
      await sendRegistrationSubmittedEmail({
        to: rows[0].email,
        fullName: rows[0].full_name || 'Member',
        userId: rows[0].id,
      });
    }
    return json(res, 201, { success: true, user: toUserDto(rows[0]) });
  } catch (err) {
    if (isDbError(err)) throw err;
    const message = err && err.code === 'ER_DUP_ENTRY'
      ? 'Email or username already exists.'
      : 'Registration failed.';
    return json(res, 400, { success: false, message });
  }
}

async function login(req, res) {
  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const password = String(body.password || '').trim();

  if (!email || !password) {
    return json(res, 400, { success: false, message: 'Email and password are required.' });
  }

  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  let user = rows[0] || null;

  // Allow approved institutional participants (from institution_members) to log in using their institution account password.
  if (!user) {
    const [participantRows] = await pool.execute(
      `SELECT
         im.institution_user_id,
         im.full_name,
         im.contact_number,
         i.password_hash AS institution_password_hash,
         i.sector_details AS institution_name
       FROM institution_members im
       JOIN users i ON i.id = im.institution_user_id
       WHERE im.email = ? AND im.status = 'approved'
       ORDER BY im.updated_at DESC, im.id DESC
       LIMIT 1`,
      [email]
    );

    if (!participantRows.length) {
      return json(res, 401, { success: false, message: 'Invalid email or password.' });
    }

    const participant = participantRows[0];
    if (!verifyPassword(password, participant.institution_password_hash)) {
      return json(res, 401, { success: false, message: 'Invalid email or password.' });
    }

    // Provision user on first login (password hash copied from institution + link stored in institution_owner_id).
    const base = String(email.split('@')[0] || 'instmember')
      .replace(/[^a-zA-Z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'instmember';

    let createdId = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = crypto.randomBytes(2).toString('hex');
      const username = `${base}_${suffix}`.slice(0, 64);
      try {
        const [result] = await pool.execute(
          `INSERT INTO users
            (email, username, full_name, password_hash, role, status, contact_number, sector, sector_details, member_type, institution_owner_id, terms_accepted)
           VALUES
            (?, ?, ?, ?, 'member', 'active', ?, 'institution', ?, 'student', ?, 1)`,
          [
            email,
            username,
            String(participant.full_name || '').trim() || base,
            participant.institution_password_hash,
            String(participant.contact_number || '').trim(),
            participant.institution_name || null,
            participant.institution_user_id,
          ]
        );
        createdId = result.insertId;
        break;
      } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') continue;
        throw err;
      }
    }

    if (!createdId) {
      const [retry] = await pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
      user = retry[0] || null;
    } else {
      const [created] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [createdId]);
      user = created[0] || null;
    }
  }

  if (!user) return json(res, 401, { success: false, message: 'Invalid email or password.' });

  if (user.lock_until && new Date(user.lock_until).getTime() > Date.now()) {
    return json(res, 423, { success: false, message: 'Account temporarily locked. Please try again later.' });
  }

  let matchedInstitutionPassword = false;
  if (!verifyPassword(password, user.password_hash)) {
    // If this is a provisioned institutional participant, allow the institution owner's password too.
    if (user.institution_owner_id) {
      const [instRows] = await pool.execute(
        'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
        [user.institution_owner_id]
      );
      const instHash = instRows[0]?.password_hash || null;
      if (instHash && verifyPassword(password, instHash)) {
        matchedInstitutionPassword = true;
        // Sync participant password hash to current institution hash for future logins.
        try {
          await pool.execute(
            `UPDATE users
             SET password_hash = ?, failed_login_count = 0, lock_until = NULL
             WHERE id = ?`,
            [instHash, user.id]
          );
          user.password_hash = instHash;
        } catch {
          // ignore
        }
      }
    }
  }

  if (!matchedInstitutionPassword && !verifyPassword(password, user.password_hash)) {
    const [result] = await pool.execute(
      `UPDATE users
       SET failed_login_count = failed_login_count + 1
       WHERE id = ?`,
      [user.id]
    );
    const [updatedRows] = await pool.execute(
      'SELECT failed_login_count FROM users WHERE id = ? LIMIT 1',
      [user.id]
    );
    const failures = updatedRows[0]?.failed_login_count || 0;
    if (failures >= 5) {
      await pool.execute(
        `UPDATE users
         SET lock_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE), failed_login_count = 0
         WHERE id = ?`,
        [user.id]
      );
      return json(res, 423, { success: false, message: 'Account temporarily locked. Please try again later.' });
    }
    return json(res, 401, { success: false, message: 'Invalid email or password.' });
  }

  await pool.execute(
    `UPDATE users
     SET failed_login_count = 0, lock_until = NULL
     WHERE id = ?`,
    [user.id]
  );

  if (user.role === 'member' && user.status !== 'active') {
    return json(res, 403, { success: false, message: 'Account pending approval. Please wait for an admin to activate your account.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresDays = 7;
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  await pool.execute(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    [token, user.id, expiresAt]
  );

  return json(res, 200, { success: true, token, user: toUserDto(user) });
}

async function authMiddleware(req, res, next) {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) return json(res, 401, { success: false, message: 'Missing token.' });

  const [rows] = await pool.execute(
    `SELECT u.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [token]
  );

  if (!rows.length) return json(res, 401, { success: false, message: 'Invalid or expired token.' });
  req.user = rows[0];
  next();
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return json(res, 403, { success: false, message: 'Forbidden.' });
    }
    next();
  };
}

async function createAdmin(req, res) {
  const body = req.body || {};
  const fullName = String(body.fullName || '').trim();
  const email = normalizeEmail(body.email);
  const username = String(body.username || body.email || '').split('@')[0].trim();
  const password = String(body.password || '').trim();
  const role = body.role || 'admin';

  if (!fullName || !email || !password) {
    return json(res, 400, { success: false, message: 'Missing required fields.' });
  }

  const passwordError = validatePasswordRules(password);
  if (passwordError) {
    return json(res, 400, { success: false, message: passwordError });
  }

  if (!['admin', 'officer', 'super_admin'].includes(role)) {
    return json(res, 400, { success: false, message: 'Invalid role.' });
  }

  try {
    const passwordHash = hashPassword(password);
    const [result] = await pool.execute(
      `INSERT INTO users
        (email, username, full_name, password_hash, role, status)
       VALUES
        (?, ?, ?, ?, ?, 'active')`,
      [email, username, fullName, passwordHash, role]
    );

    const insertedId = result.insertId;
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [insertedId]);
    return json(res, 201, { success: true, user: toUserDto(rows[0]) });
  } catch (err) {
    if (isDbError(err)) throw err;
    const message = err && err.code === 'ER_DUP_ENTRY'
      ? 'Email or username already exists.'
      : 'Create admin failed.';
    return json(res, 400, { success: false, message });
  }
}

async function verifyCurrentPassword(req, res) {
  const body = req.body || {};
  const password = String(body.password || '').trim();
  if (!password) return json(res, 400, { success: false, message: 'Password is required.' });

  const user = req.user;
  if (!user || !user.password_hash) return json(res, 401, { success: false, message: 'Unauthorized.' });

  const ok = verifyPassword(password, user.password_hash);
  if (!ok) return json(res, 401, { success: false, message: 'Invalid password.' });

  return json(res, 200, { success: true });
}

async function renewLookup(req, res) {
  const body = req.body || {};
  const renewAccountId = String(body.renewAccountId || '').trim();
  const contactNumber = String(body.contactNumber || '').trim();
  if (!renewAccountId) {
    return json(res, 400, { success: false, message: 'Renew account ID or email is required.' });
  }

  // Check if request is from an authenticated admin or officer
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  let isPrivileged = false;
  if (token) {
    try {
      const [callerRows] = await pool.execute(
        `SELECT role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > NOW() LIMIT 1`,
        [token]
      );
      if (callerRows.length && ['super_admin', 'admin', 'officer'].includes(callerRows[0].role)) {
        isPrivileged = true;
      }
    } catch (e) {
      // ignore token validation error, treat as non-privileged
    }
  }

  if (!isPrivileged && !contactNumber) {
    return json(res, 400, { success: false, message: 'Contact number is required.' });
  }

  const lookupId = Number(renewAccountId);
  const lookupValue = Number.isFinite(lookupId) ? lookupId : normalizeEmail(renewAccountId);

  let query = `SELECT
       id, email, full_name, contact_number, sector, sector_details, member_type,
       address, gender, occupation, representative_name, representative_name_2,
       position, representative_position_2, company_email, website
     FROM users
     WHERE ${Number.isFinite(lookupId) ? 'id = ?' : 'email = ?'}`;
  
  const queryParams = [lookupValue];

  if (!isPrivileged) {
    query += ` AND contact_number = ?`;
    queryParams.push(contactNumber);
  }

  query += ` LIMIT 1`;

  const [rows] = await pool.execute(query, queryParams);

  if (!rows.length) {
    return json(res, 404, { success: false, message: 'No matching account found.' });
  }

  const row = rows[0];
  return json(res, 200, {
    success: true,
    member: {
      id: String(row.id),
      email: row.email,
      fullName: row.full_name,
      contactNumber: row.contact_number,
      sector: row.sector,
      sectorDetails: row.sector_details,
      memberType: row.member_type === 'school' ? 'student' : row.member_type,
      address: row.address,
      gender: row.gender,
      occupation: row.occupation,
      representativeName: row.representative_name,
      representativeName2: row.representative_name_2,
      position: row.position,
      representativePosition2: row.representative_position_2,
      companyEmail: row.company_email,
      website: row.website,
    },
  });
}

async function logout(req, res) {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) return json(res, 200, { success: true });
  await pool.execute('DELETE FROM sessions WHERE token = ?', [token]);
  return json(res, 200, { success: true });
}

module.exports = {
  authMiddleware,
  requireRole,
  register,
  login,
  createAdmin,
  verifyCurrentPassword,
  logout,
  renewLookup,
};






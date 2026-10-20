# PHILIPPINE SOCIETY OF INFORMATION TECHNOLOGY STUDENTS (PSITS)
## REGION XII - SOCCSKSARGEN CHAPTER

### PROJECT TITLE: WEB-BASED MANAGEMENT SYSTEM FOR PSITS REGION XII
#### APPENDIX: RELEVANT SOURCE CODE
**Core Functional Modules, Algorithms & Database Logic**

---

| Technical Specification | Details |
| :--- | :--- |
| **System Architecture** | Multi-tier Architecture (Node.js Express REST API, MySQL Relational Database, React Vite Frontend) |
| **Database Engine** | MySQL 8.0 via `mysql2/promise` connection pooling with ACID transaction support |
| **Security Standards** | Salted Scrypt Cryptographic Key Derivation, Constant-time equality checks, Role-Based Access Control (RBAC) |
| **Scope of Document** | Four (4) primary backend functional engines powering organization workflows |

---

## 1. Feature 1: User Authentication, Scrypt Cryptography & Membership Onboarding Engine

### 1.1 Technical Objective & Architecture
The User Authentication and Membership Onboarding Module handles identity verification, secure credential hashing, multi-category membership registration, and session token lifecycle enforcement. 

To defend against rainbow table attacks and side-channel timing exploits, user passwords undergo salted Scrypt key derivation using a cryptographically secure 16-byte random salt and a 64-byte derived key. Password verification executes through constant-time comparison (`crypto.timingSafeEqual`), preventing timing side-channel attacks. The module also implements automated 15-minute account lockouts after five (5) consecutive failed login attempts, sliding-window rate limiters, and session-based Role-Based Access Control (`authMiddleware` and `requireRole`).

### 1.2 Functional Workflow
1. **Input Validation**: Verifies mandatory fields, normalizes email addresses, and checks password complexity (minimum 10 characters with uppercase, lowercase, numeric, and special symbols).
2. **Cryptographic Key Derivation**: Invokes `crypto.scryptSync` with a 16-byte random salt.
3. **Multi-Sector Onboarding**: Accommodates Students, Schools, Individuals, Industry Partners, and Academic Institutions with category-specific attributes and dynamic parameter binding.
4. **Payment Record Association**: Automatically links uploaded registration fee receipts to the payment ledger.
5. **Session Management**: Issues 32-byte cryptographically secure session tokens stored with 7-day server-side expiration timestamps.

### 1.3 Production Source Code
*Source File: `server/auth.js`*

```javascript
const crypto = require('node:crypto');
const { pool } = require('./db');

const PASSWORD_RULES = {
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSpecial: true,
};

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

async function register(req, res) {
  const body = req.body || {};
  const fullName = String(body.fullName || '').trim();
  const email = normalizeEmail(body.email);
  const username = String(body.username || email.split('@')[0] || '').trim();
  const password = String(body.password || '').trim();
  const termsAccepted = body.termsAccepted === true || body.termsAccepted === 1 || body.termsAccepted === '1';

  if (!fullName || !email || !username || !password) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  const passwordError = validatePasswordRules(password);
  if (passwordError) {
    return res.status(400).json({ success: false, message: passwordError });
  }

  if (!termsAccepted) {
    return res.status(400).json({ success: false, message: 'Terms and conditions must be accepted.' });
  }

  const contactNumber = String(body.contactNumber || '').trim();
  const birthdateRaw = body.birthdate ?? body.birthDate;
  const birthdate = birthdateRaw && String(birthdateRaw).trim() !== '' ? String(birthdateRaw).trim() : null;

  const allowedMemberTypes = ['student', 'school', 'individual', 'industry', 'institution'];
  let memberType = body.memberType ? String(body.memberType).trim() : null;
  if (memberType === 'school') memberType = 'student';
  if (memberType && !allowedMemberTypes.includes(memberType)) memberType = null;

  const sector = body.sector || (memberType === 'industry' ? 'industry' : (memberType === 'institution' ? 'institution' : 'school'));
  const sectorDetails = body.sectorDetails ? String(body.sectorDetails).trim() : null;
  const paymentProof = body.paymentProof ? String(body.paymentProof) : null;
  const referenceNumber = body.referenceNumber ? String(body.referenceNumber).trim() : null;
  const paymentMethod = (body.paymentMethod || body.method) ? String(body.paymentMethod || body.method).trim().toLowerCase() : 'gcash';

  if (paymentProof && paymentMethod === 'gcash' && !referenceNumber) {
    return res.status(400).json({ success: false, message: 'Reference number is required for GCash payments.' });
  }

  try {
    const passwordHash = hashPassword(password);
    const [result] = await pool.execute(
      `INSERT INTO users
        (email, username, full_name, password_hash, role, status, contact_number, sector, sector_details, member_type, birthdate, terms_accepted)
       VALUES
        (?, ?, ?, ?, 'member', 'pending', ?, ?, ?, ?, ?, 1)`,
      [email, username, fullName, passwordHash, contactNumber, sector, sectorDetails, memberType || 'individual', birthdate]
    );

    const newUserId = result.insertId;

    if (paymentProof) {
      await pool.execute(
        `INSERT INTO payments
          (member_id, member_name, event, amount, payment_kind, payment_method, reference_number, proof_url, status)
         VALUES
          (?, ?, 'Membership Registration Fee', 250, 'membership_registration', ?, ?, ?, 'pending')`,
        [newUserId, fullName, paymentMethod, referenceNumber, paymentProof]
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Account submitted for administrator review.',
      userId: newUserId,
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email or username already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Registration failed due to a server error.' });
  }
}

async function authMiddleware(req, res, next) {
  const header = req.header('authorization') || '';
  const token = (header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '') || String(req.query?.token || '').trim();
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing authentication token.' });
  }

  const [rows] = await pool.execute(
    `SELECT u.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [token]
  );

  if (!rows.length) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
  }

  req.user = rows[0];
  next();
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ success: false, message: 'Access forbidden. Insufficient permissions.' });
    }
    next();
  };
}
```

---

## 2. Feature 2: Multi-Channel Financial Payment Verification & Audit Ledger Engine

### 2.1 Technical Objective & Architecture
The Financial Verification and Transaction Audit Engine processes multi-channel organization collections, including GCash electronic payments, bank deposits, cheques, and official receipt (OR) cash collections handled by authorized officers.

The module provides structured billing calculations for institutional bulk member rosters (with automatic scholarship discounts for faculty advisers), manages installment payments with remaining balances, and executes automated membership validity extension upon audit verification.

### 2.2 Functional Workflow
1. **Payment Intake & Validation**: Enforces mandatory verification artifacts (reference numbers for GCash, receipt uploads for officer collections).
2. **Billing Breakdown Logic**: Calculates gross amounts based on delegation size, subtracts scholarship allowances, and logs net receivables.
3. **Audit Verification Workflow**: Authorizes designated officers to verify or reject transactions with timestamped audit marks and rejection reasons.
4. **Automated Validity Extension**: Upon approval of membership dues, automatically promotes members to `active` status and extends validity by 365 days.

### 2.3 Production Source Code
*Source File: `server/payments.js`*

```javascript
const { pool } = require('./db');

async function createPayment(req, res) {
  const body = req.body || {};
  const eventId = body.eventId ? Number(body.eventId) : null;
  const amount = Number(body.amount || 0);
  const method = String(body.paymentMethod || body.method || '').toLowerCase();
  const referenceNumber = body.referenceNumber ? String(body.referenceNumber).trim().slice(0, 64) : null;
  const paymentKind = body.paymentKind ? String(body.paymentKind).trim().toLowerCase() : 'event';
  const proofUrl = body.proofUrl ? String(body.proofUrl).trim() : null;

  const validMethods = ['gcash', 'paymaya', 'bank_transfer', 'cash_officer', 'through_officer', 'cheque'];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ success: false, message: 'Invalid payment method selected.' });
  }

  if (method === 'gcash' && !referenceNumber) {
    return res.status(400).json({ success: false, message: 'Reference number is mandatory for GCash transactions.' });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
  }

  const canManage = ['admin', 'super_admin', 'officer'].includes(req.user?.role);
  const targetMemberId = (canManage && body.memberId) ? Number(body.memberId) : req.user?.id;
  if (!targetMemberId) return res.status(401).json({ success: false, message: 'Unauthorized operation.' });

  if (!proofUrl) {
    const isOfficerOffline = canManage && (Boolean(referenceNumber) || ['cash_officer', 'through_officer', 'cheque'].includes(method));
    if (!isOfficerOffline) {
      const msg = (method === 'through_officer' || method === 'cash_officer')
        ? 'Official Receipt (OR) document image is required.'
        : 'Transaction receipt proof document is required.';
      return res.status(400).json({ success: false, message: msg });
    }
  }

  const isDirectlyVerified = canManage && (body.verified === true || body.isDirectlyVerified === true);
  const initialStatus = isDirectlyVerified ? 'verified' : 'pending';
  const initialPaymentStatus = body.isPartial ? 'partial' : (isDirectlyVerified ? 'paid' : 'pending');

  const [result] = await pool.execute(
    `INSERT INTO payments
      (member_id, event_id, event, amount, payment_kind, payment_method, reference_number, proof_url, status,
       payment_status, is_partial, partial_amount, remaining_balance, verified_by, verified_at)
     VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      targetMemberId,
      eventId,
      body.eventTitle || 'General Organization Fee',
      amount,
      paymentKind,
      method,
      referenceNumber,
      proofUrl,
      initialStatus,
      initialPaymentStatus,
      body.isPartial ? 1 : 0,
      body.isPartial ? amount : null,
      body.isPartial ? Number(body.remainingBalance || 0) : null,
      isDirectlyVerified ? req.user.id : null,
      isDirectlyVerified ? new Date() : null,
    ]
  );

  return res.status(201).json({
    success: true,
    message: 'Payment recorded successfully.',
    paymentId: result.insertId,
  });
}

async function verifyPayment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid payment identifier.' });

  const body = req.body || {};
  const status = String(body.status || '').toLowerCase();
  if (!['verified', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be verified or rejected.' });
  }

  const rejectionReason = status === 'rejected' ? (body.rejectionReason ? String(body.rejectionReason).trim() : 'Unspecified') : null;

  const [beforeRows] = await pool.execute(
    'SELECT id, status, member_id, payment_kind, is_partial, remaining_balance FROM payments WHERE id = ? LIMIT 1',
    [id]
  );
  if (!beforeRows.length) return res.status(404).json({ success: false, message: 'Payment record not found.' });
  const payment = beforeRows[0];
  const memberId = payment.member_id ? Number(payment.member_id) : null;

  const paymentStatusValue = status === 'verified'
    ? (payment.is_partial && Number(payment.remaining_balance || 0) > 0 ? 'partial' : 'paid')
    : 'rejected';

  await pool.execute(
    `UPDATE payments
     SET status = ?,
         payment_status = ?,
         verified_by = ?,
         verified_at = NOW(),
         rejection_reason = ?
     WHERE id = ?`,
    [status, paymentStatusValue, req.user?.id || null, rejectionReason, id]
  );

  // Synchronize User Membership status on approval
  if (status === 'verified' && memberId && ['membership_registration', 'membership_renewal', 'membership'].includes(payment.payment_kind)) {
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    await pool.execute(
      `UPDATE users
       SET status = 'active',
           membership_expires_at = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [oneYearLater, memberId]
    );
  }

  return res.json({
    success: true,
    message: `Payment successfully marked as ${status}.`,
    paymentId: id,
    status,
  });
}
```

---

## 3. Feature 3: Institution Event Delegation Leaderboard & Dual-Sourced Registration Engine

### 3.1 Technical Objective & Architecture
The Institution Event Delegation Leaderboard Module tracks and ranks academic institution delegations participating in regional events, summits, seminars, and academic competitions. 

It features **dual-sourced participant roster aggregation**—unifying individual student self-registrations (`event_registrations`) with bulk institutional rosters (`institution_members`). The module calculates total registered institutions, aggregates total participant headcounts, ranks participating schools in descending order of delegation size, and provides administrators and institution advisers with an interactive delegation roster breakdown.

### 3.2 Functional Workflow
1. **Event Selection & Schedule Resolution**: Queries active non-draft events, prioritizing ongoing and upcoming activities.
2. **Dual-Sourced Delegation Aggregation**: Simultaneously queries batch institution rosters (`institution_members`) and self-registered individual participants (`event_registrations`), ensuring comprehensive delegation totals without duplication.
3. **Delegation Roster Normalization**: Maps individual participant attributes (full name, email, contact number, gender, position/role) grouped under their academic institution.
4. **Ranking & Metrics Compilation**: Computes total participating institutions, aggregates total participant delegation count, and sorts institutions descending by registered delegation size with rank indicators.

### 3.3 Production Source Code
*Source File: `server/institutionLeaderboard.js`*

```javascript
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
```

---

## 4. Feature 4: Commission on Elections (COMELEC) Digital Ballot Canvassing Engine

### 4.1 Technical Objective & Architecture
The COMELEC Electoral Engine automates student leadership elections across regional chapters. 

The module guarantees electoral integrity by executing ballot casting within an **ACID database transaction** (`conn.beginTransaction()`). It enforces single-ballot casting rules per verified member, guarantees that each voter selects no more than one candidate per contested executive seat, and updates live vote counts and tally percentages atomically.

### 4.2 Functional Workflow
1. **Transaction Boundary Initiation**: Obtains a dedicated MySQL connection pool client and begins transaction isolation.
2. **Election Lifecycle Validation**: Verifies active voting window and automatically transitions expired elections to `closed`.
3. **Voter Anti-Duplication Check**: Validates that no prior vote records exist for the authenticated user in `election_votes`.
4. **Position Constraint Enforcement**: Prevents multiple selections under the same position using a unique constraint set.
5. **Atomic Ballot Recording & Canvassing**: Inserts ballot rows and increments `votes_count` on `election_candidates`, followed by transaction commit.

### 4.3 Production Source Code
*Source File: `server/elections.js`*

```javascript
const { pool } = require('./db');

async function castVote(req, res) {
  const electionId = Number(req.params.id);
  const userId = req.user?.id;
  const votes = req.body?.votes; // Array of candidate IDs: [candidateId1, candidateId2, ...]

  if (!Number.isFinite(electionId)) {
    return res.status(400).json({ success: false, message: 'Invalid election identifier.' });
  }
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required to cast ballot.' });
  }
  if (!Array.isArray(votes) || votes.length === 0) {
    return res.status(400).json({ success: false, message: 'Ballot must contain at least one candidate selection.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Verify election status and date validity
    const [eRows] = await conn.execute(
      'SELECT status, start_date, end_date FROM elections WHERE id = ? LIMIT 1',
      [electionId]
    );
    if (!eRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Election record not found.' });
    }

    const election = eRows[0];
    const today = new Date().toISOString().slice(0, 10);
    const endStr = election.end_date ? new Date(election.end_date).toISOString().slice(0, 10) : null;
    const isExpired = endStr && endStr < today;

    if (election.status !== 'open' || isExpired) {
      if (election.status === 'open' && isExpired) {
        await conn.execute("UPDATE elections SET status = 'closed' WHERE id = ?", [electionId]);
      }
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Election poll is closed. Voting has concluded.' });
    }

    // 2. Prevent duplicate voting
    const [votedRows] = await conn.execute(
      'SELECT id FROM election_votes WHERE election_id = ? AND voter_id = ? LIMIT 1',
      [electionId, userId]
    );
    if (votedRows.length > 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Duplicate ballot detected. You have already voted.' });
    }

    // 3. Verify candidate validity and prevent multiple selections for same position
    const candidateIds = votes.map(Number).filter(Number.isFinite);
    if (candidateIds.length !== votes.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Invalid candidate selections in ballot.' });
    }

    const placeholders = candidateIds.map(() => '?').join(', ');
    const [candidateRows] = await conn.execute(
      `SELECT id, position FROM election_candidates WHERE id IN (${placeholders}) AND election_id = ?`,
      [...candidateIds, electionId]
    );

    if (candidateRows.length !== candidateIds.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'One or more candidates are invalid for this election.' });
    }

    const positionsVoted = new Set();
    for (const cand of candidateRows) {
      if (positionsVoted.has(cand.position)) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Multiple selections detected for position: ${cand.position}. Only one vote permitted per seat.`,
        });
      }
      positionsVoted.add(cand.position);
    }

    // 4. Record ballot votes and increment candidate vote counts
    for (const candId of candidateIds) {
      await conn.execute(
        `INSERT INTO election_votes (election_id, candidate_id, voter_id, created_at)
         VALUES (?, ?, ?, NOW())`,
        [electionId, candId, userId]
      );

      await conn.execute(
        `UPDATE election_candidates
         SET votes_count = votes_count + 1,
             updated_at = NOW()
         WHERE id = ?`,
        [candId]
      );
    }

    // Commit atomic transaction
    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Official ballot successfully cast and recorded.',
      votedCount: candidateIds.length,
    });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ success: false, message: 'Transaction error during ballot casting.' });
  } finally {
    conn.release();
  }
}
```

---

## Technical Summary
The selected source code modules represent the core architectural foundations of the **Web-Based Management System for PSITS Region XII**. By implementing hardened Scrypt cryptographic security, atomic database transactions for digital elections, automated financial verification workflows, and dual-sourced event attendance aggregation, the system achieves enterprise-grade operational reliability and compliance with organizational governance standards.

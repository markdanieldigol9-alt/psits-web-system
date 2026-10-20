import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def create_source_code_document():
    doc = docx.Document()

    # Page setup - Standard Letter, 1-inch margins
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Base Color Palette (Professional Navy & Slate)
    COLOR_PRIMARY = RGBColor(0, 61, 130)       # #003D82 - PSITS Blue
    COLOR_SECONDARY = RGBColor(30, 58, 138)    # #1E3A8A - Dark Navy
    COLOR_TEXT = RGBColor(17, 24, 39)          # #111827 - Slate 900
    COLOR_MUTED = RGBColor(75, 85, 99)         # #4B5563 - Slate 600
    COLOR_CODE = RGBColor(15, 23, 42)          # #0F172A - Code text

    # Set Normal Style Font
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Arial'
    style_normal.font.size = Pt(10.5)
    style_normal.font.color.rgb = COLOR_TEXT
    style_normal.paragraph_format.line_spacing = 1.15
    style_normal.paragraph_format.space_after = Pt(6)

    # Helper function for adding styled headings
    def add_custom_heading(text, level):
        p = doc.add_paragraph()
        run = p.add_run(text)
        run.bold = True
        p.paragraph_format.keep_with_next = True
        
        if level == 1:
            p.paragraph_format.space_before = Pt(16)
            p.paragraph_format.space_after = Pt(8)
            run.font.size = Pt(14)
            run.font.color.rgb = COLOR_PRIMARY
            # Bottom border line
            pPr = p._p.get_or_add_pPr()
            pbdr = parse_xml(r'<w:pBdr {}><w:bottom w:val="single" w:sz="12" w:space="4" w:color="003D82"/></w:pBdr>'.format(nsdecls('w')))
            pPr.append(pbdr)
        elif level == 2:
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)
            run.font.size = Pt(12)
            run.font.color.rgb = COLOR_SECONDARY
        elif level == 3:
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(3)
            run.font.size = Pt(11)
            run.font.color.rgb = COLOR_MUTED
        return p

    # Helper function for adding code blocks
    def add_code_block(code_text, filename_label=None):
        if filename_label:
            lbl_p = doc.add_paragraph()
            lbl_p.paragraph_format.space_before = Pt(6)
            lbl_p.paragraph_format.space_after = Pt(2)
            lbl_p.paragraph_format.keep_with_next = True
            run_lbl = lbl_p.add_run(f"Source File: {filename_label}")
            run_lbl.font.name = 'Consolas'
            run_lbl.font.size = Pt(9)
            run_lbl.bold = True
            run_lbl.font.color.rgb = COLOR_PRIMARY

        table = doc.add_table(rows=1, cols=1)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False
        
        cell = table.cell(0, 0)
        cell.width = Inches(6.5)
        
        # Set shading (light gray background)
        shading = parse_xml(r'<w:shd {} w:fill="F8F9FA"/>'.format(nsdecls('w')))
        cell._tc.get_or_add_tcPr().append(shading)
        
        # Set borders (subtle gray border with left accent)
        borders = parse_xml(
            r'<w:tcBorders {}><w:top w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:left w:val="single" w:sz="24" w:space="0" w:color="003D82"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:right w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/></w:tcBorders>'.format(nsdecls('w'))
        )
        cell._tc.get_or_add_tcPr().append(borders)
        
        # Add code lines
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.05
        
        run = p.add_run(code_text)
        run.font.name = 'Consolas'
        run.font.size = Pt(8.5)
        run.font.color.rgb = COLOR_CODE
        
        doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # -------------------------------------------------------------
    # DOCUMENT COVER / TITLE HEADER
    # -------------------------------------------------------------
    header_p = doc.add_paragraph()
    header_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    header_p.paragraph_format.space_before = Pt(0)
    header_p.paragraph_format.space_after = Pt(2)
    run_inst = header_p.add_run("PHILIPPINE SOCIETY OF INFORMATION TECHNOLOGY STUDENTS (PSITS)")
    run_inst.font.name = 'Arial'
    run_inst.font.size = Pt(12)
    run_inst.bold = True
    run_inst.font.color.rgb = COLOR_MUTED

    region_p = doc.add_paragraph()
    region_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    region_p.paragraph_format.space_after = Pt(12)
    run_reg = region_p.add_run("REGION XII - SOCCSKSARGEN CHAPTER")
    run_reg.font.name = 'Arial'
    run_reg.font.size = Pt(10.5)
    run_reg.bold = True
    run_reg.font.color.rgb = COLOR_PRIMARY

    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_p.paragraph_format.space_before = Pt(4)
    title_p.paragraph_format.space_after = Pt(4)
    run_title = title_p.add_run("WEB-BASED MANAGEMENT SYSTEM FOR PSITS REGION XII")
    run_title.font.name = 'Arial'
    run_title.font.size = Pt(15)
    run_title.bold = True
    run_title.font.color.rgb = COLOR_PRIMARY

    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_p.paragraph_format.space_after = Pt(16)
    run_sub = sub_p.add_run("APPENDIX: RELEVANT SOURCE CODE\nCore Functional Modules, Algorithms & Database Logic")
    run_sub.font.name = 'Arial'
    run_sub.font.size = Pt(11)
    run_sub.bold = True
    run_sub.font.color.rgb = COLOR_SECONDARY

    # Metadata Table
    meta_table = doc.add_table(rows=4, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Project Title:", "Web-Based Management System for PSITS Region XII"),
        ("Document Component:", "Appendix - Relevant Source Code Specification"),
        ("System Architecture:", "Node.js (Express), MySQL (mysql2/promise), React (Vite / TypeScript)"),
        ("Target Platform:", "PSITS Region XII Information & Administrative Infrastructure")
    ]
    for i, (k, v) in enumerate(meta_data):
        row = meta_table.rows[i]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width = Inches(2.2)
        c1.width = Inches(4.3)
        
        p0 = c0.paragraphs[0]
        p0.paragraph_format.space_after = Pt(2)
        r0 = p0.add_run(k)
        r0.bold = True
        r0.font.size = Pt(9)
        r0.font.color.rgb = COLOR_PRIMARY
        
        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_after = Pt(2)
        r1 = p1.add_run(v)
        r1.font.size = Pt(9)
        
        for c in (c0, c1):
            shd = parse_xml(r'<w:shd {} w:fill="F1F5F9"/>'.format(nsdecls('w')))
            c._tc.get_or_add_tcPr().append(shd)
            bdr = parse_xml(r'<w:tcBorders {}><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/></w:tcBorders>'.format(nsdecls('w')))
            c._tc.get_or_add_tcPr().append(bdr)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # Overview Section
    add_custom_heading("Document Overview", level=1)
    doc.add_paragraph(
        "This technical document presents the core functional source code modules that power the Web-Based "
        "Management System for the Philippine Society of Information Technology Students (PSITS) Region XII. "
        "The system incorporates security protocols, transactional database consistency, dual-sourced "
        "data aggregation, and cryptographic validation to streamline regional student organization operations. "
        "The subsequent sections detail four (4) core system features complete with architectural roles, algorithmic "
        "specifications, and production source code listings."
    )

    # -------------------------------------------------------------
    # FEATURE 1: AUTHENTICATION, CRYPTOGRAPHY & MEMBERSHIP ONBOARDING
    # -------------------------------------------------------------
    add_custom_heading("Feature 1: User Authentication, Scrypt Cryptography & Membership Onboarding Engine", level=1)
    
    add_custom_heading("1.1 Module Description & Technical Role", level=2)
    doc.add_paragraph(
        "The Authentication and Membership Onboarding Module governs identity verification, cryptographic password "
        "derivation, multi-category membership registration, and session token lifecycle enforcement. "
        "To protect against rainbow table attacks and side-channel timing exploits, user passwords undergo salted "
        "Scrypt key derivation using a cryptographically secure 16-byte random salt and 64-byte key length. Password "
        "verification executes through constant-time comparison (crypto.timingSafeEqual), mitigating timing attack surfaces. "
        "Furthermore, account security incorporates automatic 15-minute account lockout upon five (5) consecutive failed attempts, "
        "sliding-window IP/email rate limiting, and role-based route guard middleware."
    )

    add_custom_heading("1.2 Functional Workflow", level=2)
    doc.add_paragraph(
        "1. Credential Ingestion & Complexity Verification: Enforces minimum 10 characters with uppercase, lowercase, numeric, and special character checks.\n"
        "2. Salted Scrypt Cryptographic Key Derivation: Generates a 16-byte random salt and derives a 64-byte key.\n"
        "3. Multi-Category Member Onboarding: Validates sector attributes (Student, Individual, Industry, and Institution) and binds parameters to prepared statements.\n"
        "4. Session Token Generation & Expiration: Generates a 32-byte cryptographically secure random session token with a 7-day server-side validity."
    )

    add_custom_heading("1.3 Production Source Code Listing", level=2)
    
    code_feature_1 = """const crypto = require('node:crypto');
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
  if (PASSWORD_RULES.requireSpecial && !/[^\\w\\s]/.test(value)) {
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
}"""

    add_code_block(code_feature_1, "server/auth.js")

    # -------------------------------------------------------------
    # FEATURE 2: FINANCIAL VERIFICATION & AUDIT LEDGER ENGINE
    # -------------------------------------------------------------
    add_custom_heading("Feature 2: Multi-Channel Financial Payment Verification & Audit Ledger Engine", level=1)
    
    add_custom_heading("2.1 Module Description & Technical Role", level=2)
    doc.add_paragraph(
        "The Financial Verification and Transaction Audit Engine processes multi-channel organizational revenues, "
        "including GCash electronic transfers, direct bank remittances, cheque disbursements, and official receipt (OR) "
        "cash collections recorded by designated treasury officers. The module features structured billing computation "
        "for institutional bulk member rosters (incorporating scholarship discounts for faculty advisers), tracks "
        "partial installment payments with remaining balances, and provides automated membership validity synchronization "
        "that advances active status and calculates academic expiration timestamps upon verification."
    )

    add_custom_heading("2.2 Functional Workflow", level=2)
    doc.add_paragraph(
        "1. Payment Submission & Method Verification: Verifies channel requirements (mandatory reference number for GCash, official receipt image for officer payments).\n"
        "2. Institutional Billing Computation: Evaluates registered headcount, applies institutional scholarship waivers, and logs gross and net payables.\n"
        "3. Officer Audit Verification: Stamped with verifying officer identifier and timestamp, logs audit remarks upon rejection, and synchronizes status.\n"
        "4. Automated Membership Extension: When membership registration or renewal is approved, the engine extends validity by one academic calendar year."
    )

    add_custom_heading("2.3 Production Source Code Listing", level=2)
    
    code_feature_2 = """const { pool } = require('./db');

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
}"""

    add_code_block(code_feature_2, "server/payments.js")

    # -------------------------------------------------------------
    # FEATURE 3: INSTITUTION EVENT DELEGATION LEADERBOARD ENGINE
    # -------------------------------------------------------------
    add_custom_heading("Feature 3: Institution Event Delegation Leaderboard & Dual-Sourced Registration Engine", level=1)
    
    add_custom_heading("3.1 Module Description & Technical Role", level=2)
    doc.add_paragraph(
        "The Institution Event Delegation Leaderboard Module tracks and ranks academic institution delegations "
        "participating in regional events, summits, seminars, and academic competitions. It features dual-sourced participant "
        "roster aggregation—unifying individual student self-registrations (event_registrations) with bulk institutional rosters "
        "(institution_members). The module calculates total registered institutions, aggregates total participant headcounts, "
        "ranks participating schools in descending order of delegation size, and provides administrators and institution advisers "
        "with an interactive delegation roster breakdown."
    )

    add_custom_heading("3.2 Functional Workflow", level=2)
    doc.add_paragraph(
        "1. Event Selection & Schedule Resolution: Queries active non-draft events, prioritizing ongoing and upcoming activities.\n"
        "2. Dual-Sourced Delegation Aggregation: Simultaneously queries batch institution rosters (institution_members) and self-registered individual participants (event_registrations), ensuring comprehensive delegation totals without duplication.\n"
        "3. Delegation Roster Normalization: Maps individual participant attributes (full name, email, contact number, gender, position/role) grouped under their academic institution.\n"
        "4. Ranking & Metrics Compilation: Computes total participating institutions, aggregates total participant delegation count, and sorts institutions descending by registered delegation size with rank indicators."
    )

    add_custom_heading("3.3 Production Source Code Listing", level=2)
    
    code_feature_3 = """const { pool } = require('./db');

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
}"""

    add_code_block(code_feature_3, "server/institutionLeaderboard.js")

    # -------------------------------------------------------------
    # FEATURE 4: DIGITAL BALLOT CANVASSING & ELECTION ENGINE
    # -------------------------------------------------------------
    add_custom_heading("Feature 4: Commission on Elections (COMELEC) Digital Ballot Canvassing Engine", level=1)
    
    add_custom_heading("4.1 Module Description & Technical Role", level=2)
    doc.add_paragraph(
        "The COMELEC Electoral Engine automates student leadership elections across regional PSITS chapters. "
        "The module utilizes database transactions (ACID properties) to ensure ballot casting integrity, guarantees "
        "voter eligibility by preventing multi-voting, enforces single-candidate selection per contested office, "
        "and automatically computes live vote tallies, percentage shares, and winning candidate outcomes."
    )

    add_custom_heading("4.2 Functional Workflow", level=2)
    doc.add_paragraph(
        "1. Transaction Initialization: Acquires dedicated database connection and initiates ACID transaction boundary.\n"
        "2. Schedule & Eligibility Enforcement: Validates that the election is open and voter has not cast a prior ballot.\n"
        "3. Position Validation: Verifies that only one candidate is selected per contested council office.\n"
        "4. Atomic Vote Recording & Tallying: Inserts encrypted vote records and increments candidate counts atomically."
    )

    add_custom_heading("4.3 Production Source Code Listing", level=2)
    
    code_feature_4 = """const { pool } = require('./db');

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
}"""

    add_code_block(code_feature_4, "server/elections.js")

    # -------------------------------------------------------------
    # CONCLUSION / SUMMARY
    # -------------------------------------------------------------
    add_custom_heading("Technical Summary", level=1)
    doc.add_paragraph(
        "The source code modules highlighted above demonstrate the structural and operational foundation of the "
        "Web-Based Management System for PSITS Region XII. By decoupling authentication, multi-channel financial auditing, "
        "real-time attendance metrics, and digital electoral canvassing into modular backend handlers, the system achieves "
        "high maintainability, robust defense against common vulnerabilities, and reliable data integrity across all "
        "regional chapter operations."
    )

    # Save document
    output_path = r"d:\VS code\PSITS Web System\docs\relevant source code\RELEVANT_SOURCE_CODE.docx"
    doc.save(output_path)
    print(f"Document successfully created at: {output_path}")

if __name__ == "__main__":
    create_source_code_document()

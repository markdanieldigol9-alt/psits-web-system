const nodemailer = require('nodemailer');
const { pool } = require('./db');

const smtpHost = String(process.env.SMTP_HOST || '').trim();
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const smtpUser = String(process.env.SMTP_USER || '').trim();
const smtpPass = String(process.env.SMTP_PASS || '').trim();
const smtpFrom = String(process.env.SMTP_FROM || '').trim();

let transporter = null;

function hasSmtpConfig() {
  return Boolean(smtpHost && smtpPort && smtpFrom);
}

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });
  return transporter;
}

async function canSendMail() {
  if (!hasSmtpConfig()) return false;
  try {
    await getTransporter().verify();
    return true;
  } catch {
    return false;
  }
}

async function updateApprovalEmailStatus(userId, status, errorMessage) {
  if (!userId) return;
  await pool.execute(
    `UPDATE users
     SET approval_email_sent_at = NOW(),
         approval_email_status = ?,
         approval_email_error = ?
     WHERE id = ?`,
    [status, errorMessage || null, userId]
  );
}

async function sendRegistrationApprovedEmail({ to, fullName, userId }) {
  if (!hasSmtpConfig()) {
    await updateApprovalEmailStatus(userId, 'failed', 'SMTP not configured');
    return { sent: false, reason: 'SMTP not configured' };
  }

  const subject = 'Registration Approved - PSITS Region XII';
  const text = `Dear ${fullName},

Your registration has been approved by the administrator.

You can now log in to your account using your registered email and password.

If you have any questions or encounter any problems, please contact the administrator.

Thank you.

Best regards,
PSITS Region XII`;

  try {
    await getTransporter().sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
    });
    await updateApprovalEmailStatus(userId, 'sent', null);
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed';
    await updateApprovalEmailStatus(userId, 'failed', message);
    return { sent: false, reason: message };
  }
}

async function resendFailedApprovalEmails({ limit = 20 } = {}) {
  if (!(await canSendMail())) return { attempted: 0, sent: 0, reason: 'SMTP not ready' };

  const [rows] = await pool.execute(
    `SELECT id, email, full_name
     FROM users
     WHERE status = 'active'
       AND approval_email_status = 'failed'
       AND email IS NOT NULL
       AND email <> ''
       AND (approval_email_sent_at IS NULL OR approval_email_sent_at <= DATE_SUB(NOW(), INTERVAL 5 MINUTE))
     ORDER BY approval_email_sent_at ASC
     LIMIT ?`,
    [Number(limit) || 20]
  );

  let sent = 0;
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const result = await sendRegistrationApprovedEmail({
      to: row.email,
      fullName: row.full_name || 'Member',
      userId: row.id,
    });
    if (result?.sent) sent += 1;
  }

  return { attempted: rows.length, sent };
}

async function sendRegistrationSubmittedEmail({ to, fullName, userId }) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const subject = 'Registration Submitted - PSITS Region XII';
  const text = `Dear ${fullName},

We received your registration. Your account is now pending approval by the administrator.

You will receive another email once your account has been approved.

Thank you.

Best regards,
PSITS Region XII`;

  try {
    await getTransporter().sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed';
    return { sent: false, reason: message };
  }
}

async function sendSmtpTestEmail({ to, userId }) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const subject = 'SMTP Test - PSITS Region XII';
  const text = `Hello,

This is a test email from PSITS Region XII.

If you received this message, SMTP is configured correctly.
`;

  try {
    await getTransporter().sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed';
    return { sent: false, reason: message };
  }
}

async function sendMembershipExpirationEmail({ to, fullName, daysRemaining, expiryDate }) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const formattedDate = expiryDate ? new Date(expiryDate).toLocaleDateString() : 'N/A';
  const subject = 'Membership Expiration Warning - PSITS Region XII';
  const text = `Dear ${fullName},

This is an automated notification that your PSITS Region XII membership will expire in ${daysRemaining} days (on ${formattedDate}).

Please renew your membership through the system's Payments portal soon to maintain uninterrupted access to all organizational features, events, and activities.

Thank you.

Best regards,
PSITS Region XII`;

  try {
    await getTransporter().sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed';
    return { sent: false, reason: message };
  }
}

module.exports = {
  sendRegistrationApprovedEmail,
  sendRegistrationSubmittedEmail,
  sendSmtpTestEmail,
  resendFailedApprovalEmails,
  sendMembershipExpirationEmail,
};

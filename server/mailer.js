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

async function sendReactivationRequestEmail({ adminEmails, memberName, memberEmail, memberId, message, suspendedReason }) {
  if (!hasSmtpConfig() || !adminEmails || !adminEmails.length) {
    return { sent: false, reason: 'SMTP not configured or no recipient emails' };
  }

  const subject = `Account Reactivation Request - ${memberName} (${memberEmail})`;
  const text = `Dear PSITS Officer / Administrator,

Member ${memberName} (${memberEmail}, ID: ${memberId}) has submitted a request for account reactivation.

Current Status: Suspended
${suspendedReason ? `Reason on Record: ${suspendedReason}\n` : ''}
Member Message / Appeal:
"${message ? message : 'No additional message provided.'}"

Please log in to the PSITS Admin Portal (Membership module) to review this member's details and reactivate their account if appropriate.

Thank you.

Best regards,
PSITS Region XII System`;

  try {
    await getTransporter().sendMail({
      from: smtpFrom,
      to: adminEmails.join(', '),
      subject,
      text,
    });
    return { sent: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Email send failed';
    return { sent: false, reason: errorMsg };
  }
}

async function sendPasswordResetEmail({ to, fullName, resetUrl, resetToken }) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const subject = 'Password Reset Request - PSITS Region XII';
  const text = `Dear ${fullName},

We received a request to reset the password for your PSITS Region XII account.

To reset your password, please click the link below (valid for 1 hour):
${resetUrl}

If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
PSITS Region XII Team`;

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: #2563eb; margin: 0; font-size: 22px; font-weight: 700;">PSITS Region XII</h2>
      <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Philippine Society of Information Technology Students</p>
    </div>
    
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h3 style="margin-top: 0; color: #0f172a; font-size: 17px;">Password Reset Request</h3>
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 16px;">
        Hello <strong>${fullName}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        We received a request to reset your password. Click the button below to set a new password for your account:
      </p>
      
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
          Reset Password
        </a>
      </div>
      
      <p style="font-size: 12px; color: #64748b; margin-bottom: 6px;">
        This password reset link will expire in <strong>1 hour</strong>.
      </p>
      <p style="font-size: 12px; color: #64748b; word-break: break-all;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
      </p>
    </div>
    
    <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
      If you did not request this password reset, please ignore this email or contact support if you suspect unauthorized activity. Your current password remains secure.
    </p>
  </div>
  `;

  try {
    await getTransporter().sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed';
    return { sent: false, reason: message };
  }
}

async function sendPasswordResetSuccessEmail({ to, fullName }) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const subject = 'Password Changed Successfully - PSITS Region XII';
  const text = `Dear ${fullName},

Your password for your PSITS Region XII account was successfully changed.

You can now log in using your new password.

If you did not make this change, please contact a PSITS administrator immediately.

Best regards,
PSITS Region XII Team`;

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: #2563eb; margin: 0; font-size: 22px; font-weight: 700;">PSITS Region XII</h2>
      <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Philippine Society of Information Technology Students</p>
    </div>
    
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h3 style="margin-top: 0; color: #166534; font-size: 17px;">Password Successfully Changed</h3>
      <p style="font-size: 14px; line-height: 1.6; color: #1e293b; margin-bottom: 12px;">
        Hello <strong>${fullName}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #1e293b;">
        Your password has been successfully updated. You can now log into your account using your new password.
      </p>
    </div>
    
    <p style="font-size: 12px; color: #dc2626; line-height: 1.5; margin-top: 20px;">
      If you did not perform this change, please contact PSITS administrators immediately to secure your account.
    </p>
  </div>
  `;

  try {
    await getTransporter().sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
      html,
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
  sendReactivationRequestEmail,
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
};

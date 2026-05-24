const { sendSmtpTestEmail } = require('./mailer');

function getUserId(req) {
  const raw = req.user?.id;
  return Number.isFinite(Number(raw)) ? Number(raw) : null;
}

async function sendSmtpTest(req, res) {
  const to = String(req.body?.to || '').trim();
  if (!to) {
    return res.status(400).json({ success: false, message: 'Recipient email is required.' });
  }

  try {
    const notification = await sendSmtpTestEmail({ to, userId: getUserId(req) });
    if (!notification.sent) {
      return res.status(500).json({ success: false, message: notification.reason || 'SMTP test failed.' });
    }
    return res.json({ success: true, message: 'SMTP test email sent.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SMTP test failed.';
    return res.status(500).json({ success: false, message });
  }
}

module.exports = {
  sendSmtpTest,
};

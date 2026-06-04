const { pool } = require('../db');
const { sendMembershipExpirationEmail } = require('../mailer');

async function checkExpiringMemberships() {
  try {
    // 1. Find members whose expiration is 30, 14, or 7 days away.
    const [members] = await pool.execute(
      `SELECT id, email, full_name, membership_expires_at, DATEDIFF(membership_expires_at, NOW()) AS days_left
       FROM users
       WHERE role = 'member'
         AND status = 'active'
         AND membership_expires_at IS NOT NULL
         AND DATEDIFF(membership_expires_at, NOW()) IN (30, 14, 7)`
    );

    let sentCount = 0;
    for (const member of members) {
      const userId = member.id;
      const email = member.email;
      const fullName = member.full_name;
      const daysRemaining = member.days_left;
      const expiryDate = member.membership_expires_at;

      if (!email) continue;

      // 2. Check if an alert was already sent for this specific interval within the last 20 hours.
      const [logs] = await pool.execute(
        `SELECT id FROM audit_logs
         WHERE entity_type = 'user'
           AND entity_id = ?
           AND action = 'expiration_alert_sent'
           AND created_at >= DATE_SUB(NOW(), INTERVAL 20 HOUR)
           AND JSON_UNQUOTE(JSON_EXTRACT(meta_json, '$.daysRemaining')) = ?`,
        [String(userId), String(daysRemaining)]
      );

      if (logs.length > 0) {
        continue;
      }

      // 3. Send email warning
      const res = await sendMembershipExpirationEmail({
        to: email,
        fullName,
        daysRemaining,
        expiryDate,
      });

      if (res.sent) {
        sentCount++;
        // 4. Log the sent action in audit logs for idempotency
        await pool.execute(
          `INSERT INTO audit_logs (actor_id, entity_type, entity_id, action, meta_json)
           VALUES (NULL, 'user', ?, 'expiration_alert_sent', ?)`,
          [String(userId), JSON.stringify({ daysRemaining, expiryDate })]
        );
      }
    }

    return { success: true, processed: members.length, sent: sentCount };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Expiration check job error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

module.exports = { checkExpiringMemberships };

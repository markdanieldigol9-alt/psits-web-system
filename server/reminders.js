const { pool } = require('./db');

let reminderServiceRunning = false;

function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Checks for:
 * 1. 24h event reminders for registered participants
 * 2. 1h event starting soon reminders for registered participants
 * 3. 24h registration closing deadline reminders for active members
 */
async function processEventReminders() {
  if (reminderServiceRunning) return;
  reminderServiceRunning = true;

  try {
    // 1. 24-HOUR EVENT REMINDER (for events starting within next 24 hours)
    try {
      const [events24h] = await pool.query(
        `SELECT id, title, start_at, location, is_esports
         FROM events
         WHERE status IN ('upcoming', 'ongoing')
           AND start_at >= NOW()
           AND start_at <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
           AND (reminder_24h_sent IS NULL OR reminder_24h_sent = 0)`
      );

      for (const ev of events24h) {
        // Find registered & approved participants
        const [registrations] = await pool.execute(
          `SELECT DISTINCT member_id
           FROM event_registrations
           WHERE event_id = ? AND status = 'approved'`,
          [ev.id]
        );

        if (registrations.length > 0) {
          const formattedStart = formatDateTime(ev.start_at);
          const title = `⏰ Reminder: "${ev.title}" is tomorrow!`;
          const loc = ev.location ? ` at ${ev.location}` : '';
          const message = `Your registered event "${ev.title}" is starting tomorrow (${formattedStart})${loc}. Don't miss it!`;
          const metaJson = JSON.stringify({
            eventId: String(ev.id),
            reminderType: '24h',
            url: '/events',
          });

          const values = registrations.map((r) => [
            r.member_id,
            title,
            message,
            'info',
            0,
            metaJson,
          ]);

          const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
          const flatParams = values.flat();
          await pool.execute(
            `INSERT INTO notifications (user_id, title, message, type, is_read, meta_json)
             VALUES ${placeholders}`,
            flatParams
          );
        }

        // Mark 24h reminder sent
        await pool.execute('UPDATE events SET reminder_24h_sent = 1 WHERE id = ?', [ev.id]);
      }
    } catch (err24) {
      console.warn('[Reminders] Error checking 24h event reminders:', err24.message);
    }

    // 2. 1-HOUR EVENT STARTING SOON REMINDER (for events starting within next 75 minutes)
    try {
      const [events1h] = await pool.query(
        `SELECT id, title, start_at, location, is_esports
         FROM events
         WHERE status IN ('upcoming', 'ongoing')
           AND start_at >= NOW()
           AND start_at <= DATE_ADD(NOW(), INTERVAL 75 MINUTE)
           AND (reminder_1h_sent IS NULL OR reminder_1h_sent = 0)`
      );

      for (const ev of events1h) {
        const [registrations] = await pool.execute(
          `SELECT DISTINCT member_id
           FROM event_registrations
           WHERE event_id = ? AND status = 'approved'`,
          [ev.id]
        );

        if (registrations.length > 0) {
          const formattedStart = formatDateTime(ev.start_at);
          const title = `🚨 Starting Soon: "${ev.title}"`;
          const loc = ev.location ? ` at ${ev.location}` : '';
          const message = `"${ev.title}" is starting in less than an hour (${formattedStart})${loc}. Get ready to participate!`;
          const metaJson = JSON.stringify({
            eventId: String(ev.id),
            reminderType: '1h',
            url: '/events',
          });

          const values = registrations.map((r) => [
            r.member_id,
            title,
            message,
            'warning',
            0,
            metaJson,
          ]);

          const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
          const flatParams = values.flat();
          await pool.execute(
            `INSERT INTO notifications (user_id, title, message, type, is_read, meta_json)
             VALUES ${placeholders}`,
            flatParams
          );
        }

        // Mark 1h reminder sent
        await pool.execute('UPDATE events SET reminder_1h_sent = 1 WHERE id = ?', [ev.id]);
      }
    } catch (err1h) {
      console.warn('[Reminders] Error checking 1h event reminders:', err1h.message);
    }

    // 3. REGISTRATION DEADLINE REMINDER (closing within 24 hours)
    try {
      const [eventsRegClosing] = await pool.query(
        `SELECT id, title, registration_end_at, location
         FROM events
         WHERE status = 'upcoming'
           AND registration_end_at IS NOT NULL
           AND registration_end_at >= NOW()
           AND registration_end_at <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
           AND (registration_override IS NULL OR registration_override != 'closed')
           AND (reminder_reg_closing_sent IS NULL OR reminder_reg_closing_sent = 0)`
      );

      for (const ev of eventsRegClosing) {
        // Find active members who haven't registered yet
        const [unregisteredMembers] = await pool.execute(
          `SELECT u.id
           FROM users u
           WHERE u.status = 'active'
             AND u.role = 'member'
             AND u.id NOT IN (
               SELECT er.member_id FROM event_registrations er WHERE er.event_id = ?
             )
           LIMIT 200`,
          [ev.id]
        );

        if (unregisteredMembers.length > 0) {
          const formattedDeadline = formatDateTime(ev.registration_end_at);
          const title = `⏳ Registration Closing Soon: "${ev.title}"`;
          const message = `Registration for "${ev.title}" closes in less than 24 hours (Deadline: ${formattedDeadline}). Don't forget to register!`;
          const metaJson = JSON.stringify({
            eventId: String(ev.id),
            reminderType: 'reg_closing',
            url: '/events',
          });

          const values = unregisteredMembers.map((m) => [
            m.id,
            title,
            message,
            'warning',
            0,
            metaJson,
          ]);

          const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
          const flatParams = values.flat();
          await pool.execute(
            `INSERT INTO notifications (user_id, title, message, type, is_read, meta_json)
             VALUES ${placeholders}`,
            flatParams
          );
        }

        // Mark registration deadline reminder sent
        await pool.execute('UPDATE events SET reminder_reg_closing_sent = 1 WHERE id = ?', [ev.id]);
      }
    } catch (errReg) {
      console.warn('[Reminders] Error checking registration closing reminders:', errReg.message);
    }
  } catch (err) {
    console.warn('[Reminders] General reminder service error:', err.message);
  } finally {
    reminderServiceRunning = false;
  }
}

function startReminderService() {
  // Run once immediately on startup
  setTimeout(() => {
    void processEventReminders();
  }, 5000);

  // Run periodically every 2 minutes
  setInterval(() => {
    void processEventReminders();
  }, 2 * 60 * 1000);
}

module.exports = {
  startReminderService,
  processEventReminders,
};

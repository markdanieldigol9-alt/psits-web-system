const crypto = require('node:crypto');
const { pool } = require('./db');

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

async function migrate() {
  if (process.env.SKIP_MIGRATION === 'true') {
    console.log('Skipping migration as SKIP_MIGRATION=true');
    return;
  }
  const getColumnType = async (tableName, columnName, fallback) => {
    try {
      const [rows] = await pool.execute(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName]
      );
      return rows[0]?.COLUMN_TYPE || fallback;
    } catch {
      return fallback;
    }
  };

  // Core tables needed by the current UI (auth + members)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(191) NOT NULL,
      username VARCHAR(64) NOT NULL,
      full_name VARCHAR(191) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('super_admin','admin','officer','member') NOT NULL DEFAULT 'member',
      contact_number VARCHAR(32) NOT NULL DEFAULT '',
      sector ENUM('school','industry','institution') NOT NULL DEFAULT 'institution',
      sector_details VARCHAR(191) NULL,
      member_type ENUM('student','school','individual','industry','institution') NULL,
      institution_owner_id INT UNSIGNED NULL,
      birthdate DATE NULL,
      address VARCHAR(255) NULL,
      gender VARCHAR(32) NULL,
      occupation VARCHAR(191) NULL,
      representative_name VARCHAR(191) NULL,
      representative_name_2 VARCHAR(191) NULL,
      position VARCHAR(191) NULL,
      representative_position_2 VARCHAR(191) NULL,
      company_email VARCHAR(191) NULL,
      website VARCHAR(255) NULL,
      membership_mode ENUM('new','renew') NULL,
      terms_accepted TINYINT(1) NOT NULL DEFAULT 0,
      failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
      lock_until DATETIME NULL,
      approval_email_sent_at DATETIME NULL,
      approval_email_status ENUM('sent','failed') NULL,
      approval_email_error VARCHAR(255) NULL,
      renew_reference_id INT UNSIGNED NULL,
      status ENUM('pending','active','inactive') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_users_email (email),
      UNIQUE KEY uniq_users_username (username),
      KEY idx_users_role (role),
      KEY idx_users_status (status),
      KEY idx_users_institution_owner_id (institution_owner_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token CHAR(64) NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (token),
      KEY idx_sessions_user_id (user_id),
      KEY idx_sessions_expires_at (expires_at),
      CONSTRAINT fk_sessions_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // If the table already existed, ensure the enum includes 'student' (keep 'school' for backwards compatibility).
  try {
    await pool.query(
      "ALTER TABLE users MODIFY member_type ENUM('student','school','individual','industry','institution') NULL"
    );
  } catch {
    // Ignore (permissions / older MySQL). If it fails, the server may reject 'student' inserts.
  }

  // Expand member status enum for richer lifecycle (panel requirement).
  try {
    await pool.query(
      "ALTER TABLE users MODIFY status ENUM('pending','active','inactive','suspended','banned','archived','rejected') NOT NULL DEFAULT 'pending'"
    );
  } catch {
    // Ignore (permissions / older MySQL). If it fails, the server may reject suspended/banned/rejected updates.
  }

  // Membership validity window (1-year for individual/institution).
  try { await pool.query('ALTER TABLE users ADD COLUMN membership_started_at DATETIME NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE users ADD COLUMN membership_expires_at DATETIME NULL'); } catch { /* ignore */ }

  // Membership lifecycle metadata (panel requirement). Best-effort adds for existing DBs.
  try {
    const membershipColumns = [
      'banned_reason VARCHAR(255) NULL',
      'suspended_reason VARCHAR(255) NULL',
      'archived_at DATETIME NULL',
      'status_updated_at DATETIME NULL',
      'status_updated_by INT UNSIGNED NULL',
    ];

    for (const col of membershipColumns) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await pool.query(`ALTER TABLE users ADD COLUMN ${col}`);
      } catch {
        // ignore if column already exists
      }
    }
  } catch {
    // ignore
  }

  // Optional FK to track who updated member status.
  try {
    await pool.query(
      `ALTER TABLE users
       ADD CONSTRAINT fk_users_status_updated_by
       FOREIGN KEY (status_updated_by) REFERENCES users(id)
       ON DELETE SET NULL`
    );
  } catch {
    // ignore if already exists / no privileges
  }

  // Member status change history
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_status_logs (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      member_id INT UNSIGNED NOT NULL,
      old_status VARCHAR(32) NOT NULL,
      new_status VARCHAR(32) NOT NULL,
      reason VARCHAR(255) NULL,
      changed_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_member_status_logs_member_id (member_id),
      KEY idx_member_status_logs_created_at (created_at),
      CONSTRAINT fk_member_status_logs_member_id
        FOREIGN KEY (member_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_member_status_logs_changed_by
        FOREIGN KEY (changed_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Lightweight audit trail (used by key actions; can be expanded later)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      actor_id INT UNSIGNED NULL,
      entity_type VARCHAR(64) NOT NULL,
      entity_id VARCHAR(64) NULL,
      action VARCHAR(64) NOT NULL,
      meta_json TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_audit_logs_entity (entity_type, entity_id),
      KEY idx_audit_logs_actor_id (actor_id),
      KEY idx_audit_logs_created_at (created_at),
      CONSTRAINT fk_audit_logs_actor_id
        FOREIGN KEY (actor_id) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Ensure sector enum includes industry/institution for older schemas.
  try {
    await pool.query(
      "ALTER TABLE users MODIFY sector ENUM('school','industry','institution') NOT NULL DEFAULT 'institution'"
    );
  } catch {
    // Ignore (permissions / older MySQL). If it fails, the server may reject industry/institution inserts.
  }

  // Backwards compatible column add for new member types
  try {
    const newColumns = [
      'address VARCHAR(255) NULL',
      'birthdate DATE NULL',
      'gender VARCHAR(32) NULL',
      'occupation VARCHAR(191) NULL',
      'representative_name VARCHAR(191) NULL',
      'representative_name_2 VARCHAR(191) NULL',
      'position VARCHAR(191) NULL',
      'representative_position_2 VARCHAR(191) NULL',
      'company_email VARCHAR(191) NULL',
      'website VARCHAR(255) NULL',
      "membership_mode ENUM('new','renew') NULL",
      'terms_accepted TINYINT(1) NOT NULL DEFAULT 0',
      'failed_login_count INT UNSIGNED NOT NULL DEFAULT 0',
      'lock_until DATETIME NULL',
      'institution_owner_id INT UNSIGNED NULL',
      'approval_email_sent_at DATETIME NULL',
      "approval_email_status ENUM('sent','failed') NULL",
      'approval_email_error VARCHAR(255) NULL',
      'renew_reference_id INT UNSIGNED NULL'
    ];

    for (const col of newColumns) {
      try {
        await pool.query(`ALTER TABLE users ADD COLUMN ${col}`);
      } catch {
        // ignore if column already exists
      }
    }
  } catch {
    // ignore
  }

  // Optional FK (safe to ignore if permissions/engine differ).
  try {
    await pool.query(
      `ALTER TABLE users
       ADD CONSTRAINT fk_users_institution_owner_id
       FOREIGN KEY (institution_owner_id) REFERENCES users(id)
       ON DELETE SET NULL`
    );
  } catch {
    // ignore if already exists / no privileges
  }

  // Events
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      title VARCHAR(191) NOT NULL,
      description TEXT NULL,
      guidelines TEXT NULL,
      registration_mode ENUM('individual','pair','group','team') NOT NULL DEFAULT 'individual',
      registration_start_at DATETIME NULL,
      registration_end_at DATETIME NULL,
      registration_override ENUM('open','closed') NULL,
      event_type ENUM('competition','seminar') NOT NULL DEFAULT 'seminar',
      start_at DATETIME NOT NULL,
      end_at DATETIME NULL,
      location VARCHAR(191) NOT NULL DEFAULT '',
      registration_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
      capacity INT UNSIGNED NOT NULL DEFAULT 0,
      status ENUM('draft','upcoming','ongoing','completed','cancelled') NOT NULL DEFAULT 'draft',
      created_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_events_status (status),
      KEY idx_events_start_at (start_at),
      CONSTRAINT fk_events_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // eSports features
  try { await pool.query('ALTER TABLE events ADD COLUMN is_esports TINYINT(1) NOT NULL DEFAULT 0'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE events ADD COLUMN esports_game VARCHAR(191) NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE events ADD COLUMN esports_bracket_format VARCHAR(191) NULL'); } catch { /* ignore */ }

  // Event registrations (member joins an event)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_registrations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_id INT UNSIGNED NOT NULL,
      member_id INT UNSIGNED NOT NULL,
      participant_count INT UNSIGNED NOT NULL DEFAULT 1,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      team_profile_url VARCHAR(255) NULL,
      notes VARCHAR(255) NULL,
      approved_by INT UNSIGNED NULL,
      approved_at DATETIME NULL,
      rejection_reason VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_event_member_registration (event_id, member_id),
      KEY idx_event_reg_status (status),
      KEY idx_event_reg_event_id (event_id),
      KEY idx_event_reg_member_id (member_id),
      CONSTRAINT fk_event_reg_event
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_event_reg_member
        FOREIGN KEY (member_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_event_reg_approved_by
        FOREIGN KEY (approved_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Backwards compatible add for team profile upload
  try { await pool.query('ALTER TABLE event_registrations ADD COLUMN team_profile_url VARCHAR(255) NULL'); } catch { /* ignore */ }

  // Event details (type-specific fields; flexible schema)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_details (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_id INT UNSIGNED NOT NULL,
      team_name VARCHAR(191) NULL,
      team_logo VARCHAR(255) NULL,
      speaker_name VARCHAR(191) NULL,
      speaker_profile TEXT NULL,
      meeting_link VARCHAR(255) NULL,
      livestream_link VARCHAR(255) NULL,
      recording_link VARCHAR(255) NULL,
      rules TEXT NULL,
      extra_json TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_event_details_event_id (event_id),
      CONSTRAINT fk_event_details_event_id
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Backwards compatible column add (older DBs created before guidelines).
  try {
    await pool.query('ALTER TABLE events ADD COLUMN guidelines TEXT NULL');
  } catch {
    // ignore if column already exists / insufficient permissions
  }



  // Registration open/close controls
  try { await pool.query('ALTER TABLE events ADD COLUMN registration_start_at DATETIME NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE events ADD COLUMN registration_end_at DATETIME NULL'); } catch { /* ignore */ }
  try { await pool.query("ALTER TABLE events ADD COLUMN registration_override ENUM('open','closed') NULL"); } catch { /* ignore */ }

  // Backwards compatible column add (older DBs created before registration mode).
  try {
    await pool.query("ALTER TABLE events ADD COLUMN registration_mode ENUM('individual','pair','group','team') NOT NULL DEFAULT 'individual'");
  } catch {
    // ignore if column already exists / insufficient permissions
  }

  // Backwards compatible column add for event_type enum (competition/seminar)
  try {
    await pool.query("ALTER TABLE events ADD COLUMN event_type ENUM('competition','seminar') NOT NULL DEFAULT 'seminar'");
  } catch {
    // ignore if column already exists / insufficient permissions
  }

  // Announcements
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      title VARCHAR(191) NOT NULL,
      content TEXT NOT NULL,
      image_url VARCHAR(255) NULL,
      audience_json TEXT NOT NULL,
      status ENUM('draft','published') NOT NULL DEFAULT 'draft',
      schedule_at DATETIME NULL,
      created_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_announcements_status (status),
      KEY idx_announcements_created_at (created_at),
      CONSTRAINT fk_announcements_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  const announcementIdColumnType = await getColumnType('announcements', 'id', 'int(10) unsigned');
  const userIdColumnType = await getColumnType('users', 'id', 'int(10) unsigned');

  // Announcement interactions: comments + likes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcement_comments (
      id ${userIdColumnType} NOT NULL AUTO_INCREMENT,
      announcement_id ${announcementIdColumnType} NOT NULL,
      user_id ${userIdColumnType} NOT NULL,
      content TEXT NOT NULL,
      deleted_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_announcement_comments_announcement (announcement_id),
      KEY idx_announcement_comments_user (user_id),
      CONSTRAINT fk_announcement_comments_announcement
        FOREIGN KEY (announcement_id) REFERENCES announcements(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_announcement_comments_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcement_likes (
      announcement_id ${announcementIdColumnType} NOT NULL,
      user_id ${userIdColumnType} NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (announcement_id, user_id),
      KEY idx_announcement_likes_user (user_id),
      CONSTRAINT fk_announcement_likes_announcement
        FOREIGN KEY (announcement_id) REFERENCES announcements(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_announcement_likes_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Backwards compatible column add for legacy announcements tables.
  try { await pool.query('ALTER TABLE announcements ADD COLUMN audience_json TEXT NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE announcements ADD COLUMN schedule_at DATETIME NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE announcements ADD COLUMN created_by INT UNSIGNED NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE announcements ADD COLUMN image_url VARCHAR(255) NULL'); } catch { /* ignore */ }

  // Backfill audience_json from legacy "audience" column if needed.
  try {
    const [rows] = await pool.execute('SELECT id, audience, audience_json FROM announcements');
    const normalizeAudience = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      const raw = String(value).trim();
      if (!raw) return [];
      return raw
        .split(/[,\s]+/g)
        .map((v) => v.trim())
        .filter(Boolean);
    };

    for (const row of rows) {
      const existing = row.audience_json ? String(row.audience_json).trim() : '';
      if (existing) continue;
      const normalized = normalizeAudience(row.audience);
      await pool.execute(
        'UPDATE announcements SET audience_json = ? WHERE id = ?',
        [JSON.stringify(normalized), row.id]
      );
    }
  } catch {
    // ignore if legacy columns are missing
  }

  // Partners
  await pool.query(`
    CREATE TABLE IF NOT EXISTS partners (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      company VARCHAR(191) NOT NULL,
      type VARCHAR(64) NOT NULL DEFAULT '',
      contact_person VARCHAR(191) NOT NULL DEFAULT '',
      location VARCHAR(191) NOT NULL DEFAULT '',
      email VARCHAR(191) NOT NULL DEFAULT '',
      phone VARCHAR(64) NOT NULL DEFAULT '',
      website VARCHAR(255) NULL,
      logo_url VARCHAR(255) NULL,
      partnership_status VARCHAR(64) NOT NULL DEFAULT 'active',
      description TEXT NULL,
      archived_at DATETIME NULL,
      created_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_partners_company (company),
      CONSTRAINT fk_partners_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Backwards compatible partner columns
  try { await pool.query('ALTER TABLE partners ADD COLUMN logo_url VARCHAR(255) NULL'); } catch { /* ignore */ }
  try { await pool.query("ALTER TABLE partners ADD COLUMN partnership_status VARCHAR(64) NOT NULL DEFAULT 'active'"); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE partners ADD COLUMN description TEXT NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE partners ADD COLUMN archived_at DATETIME NULL'); } catch { /* ignore */ }

  // Partner Contributions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS partner_contributions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      partner_id INT UNSIGNED NOT NULL,
      event_id INT UNSIGNED NULL,
      deal_title VARCHAR(191) NOT NULL,
      contribution_type ENUM('funds', 'prizes', 'equipment', 'venue', 'services', 'other') NOT NULL,
      value_amount DECIMAL(10,2) NULL,
      description TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_contributions_partner
        FOREIGN KEY (partner_id) REFERENCES partners(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_contributions_event
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Payments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_id INT UNSIGNED NULL,
      member_id INT UNSIGNED NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_kind ENUM('event','membership_renewal') NOT NULL DEFAULT 'event',
      payment_method ENUM('gcash','paymaya','bank_transfer','cash_officer','paymongo') NOT NULL DEFAULT 'gcash',
      reference_number VARCHAR(64) NULL,
      method ENUM('gcash','paypal','paymaya','card') NOT NULL,
      proof_url VARCHAR(255) NULL,
      payment_status ENUM('unpaid','pending','paid','rejected','refunded') NOT NULL DEFAULT 'pending',
      process_status ENUM('submitted','under_review','verified','rejected','completed') NOT NULL DEFAULT 'submitted',
      status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
      verified_by INT UNSIGNED NULL,
      verified_at DATETIME NULL,
      rejection_reason VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_payments_status (status),
      KEY idx_payments_method (payment_method),
      KEY idx_payments_payment_status (payment_status),
      KEY idx_payments_process_status (process_status),
      KEY idx_payments_kind (payment_kind),
      KEY idx_payments_member_id (member_id),
      CONSTRAINT fk_payments_event_id
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON DELETE SET NULL,
      CONSTRAINT fk_payments_member_id
        FOREIGN KEY (member_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_payments_verified_by
        FOREIGN KEY (verified_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Backwards compatible column add for legacy payments tables.
  try { await pool.query('ALTER TABLE payments ADD COLUMN event_id INT UNSIGNED NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE payments ADD COLUMN verified_at DATETIME NULL'); } catch { /* ignore */ }
  try { await pool.query("ALTER TABLE payments ADD COLUMN payment_kind ENUM('event','membership_renewal') NOT NULL DEFAULT 'event'"); } catch { /* ignore */ }
  try { await pool.query("ALTER TABLE payments ADD COLUMN payment_method ENUM('gcash','paymaya','bank_transfer','cash_officer','paymongo') NOT NULL DEFAULT 'gcash'"); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE payments ADD COLUMN reference_number VARCHAR(64) NULL'); } catch { /* ignore */ }
  try { await pool.query("ALTER TABLE payments ADD COLUMN payment_status ENUM('unpaid','pending','paid','rejected','refunded') NOT NULL DEFAULT 'pending'"); } catch { /* ignore */ }
  try { await pool.query("ALTER TABLE payments ADD COLUMN process_status ENUM('submitted','under_review','verified','rejected','completed') NOT NULL DEFAULT 'submitted'"); } catch { /* ignore */ }

  // Expand legacy method enum if present (best-effort).
  try {
    await pool.query("ALTER TABLE payments MODIFY method ENUM('gcash','paypal','paymaya','card','bank_transfer','cash_officer','paymongo') NOT NULL");
  } catch {
    // ignore
  }

  // Payment status change history (verification/rejection)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_status_logs (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        payment_id INT UNSIGNED NOT NULL,
        old_status VARCHAR(32) NOT NULL,
        new_status VARCHAR(32) NOT NULL,
        remarks VARCHAR(255) NULL,
        changed_by INT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_payment_status_logs_payment_id (payment_id),
        KEY idx_payment_status_logs_created_at (created_at),
        CONSTRAINT fk_payment_status_logs_payment_id
          FOREIGN KEY (payment_id) REFERENCES payments(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_payment_status_logs_changed_by
          FOREIGN KEY (changed_by) REFERENCES users(id)
          ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
  } catch {
    // Fallback for legacy schemas where payments.id type/engine doesn't match FK requirements.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_status_logs (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        payment_id VARCHAR(64) NOT NULL,
        old_status VARCHAR(32) NOT NULL,
        new_status VARCHAR(32) NOT NULL,
        remarks VARCHAR(255) NULL,
        changed_by INT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_payment_status_logs_payment_id (payment_id),
        KEY idx_payment_status_logs_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
  }

  // Live Events
  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_events (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_id INT UNSIGNED NULL,
      session_identifier VARCHAR(64) NULL,
      title VARCHAR(191) NOT NULL,
      description TEXT NULL,
      host_label VARCHAR(191) NOT NULL DEFAULT '',
      start_at DATETIME NULL,
      end_at DATETIME NULL,
      duration_minutes INT UNSIGNED NOT NULL DEFAULT 60,
      session_type ENUM('livestream') NOT NULL DEFAULT 'livestream',
      privacy ENUM('public','private','event_registered_only') NOT NULL DEFAULT 'public',
      status ENUM('scheduled','live','ended','cancelled') NOT NULL DEFAULT 'scheduled',
      meeting_url VARCHAR(255) NOT NULL,
      join_link VARCHAR(255) NULL,
      stream_url VARCHAR(255) NULL,
      stream_source ENUM('external', 'built_in') NOT NULL DEFAULT 'built_in',
      chat_enabled TINYINT(1) NOT NULL DEFAULT 1,
      allow_participant_mic TINYINT(1) NOT NULL DEFAULT 1,
      allow_participant_camera TINYINT(1) NOT NULL DEFAULT 1,
      allow_participant_screenshare TINYINT(1) NOT NULL DEFAULT 1,
      waiting_room_enabled TINYINT(1) NOT NULL DEFAULT 0,
      allow_raise_hand TINYINT(1) NOT NULL DEFAULT 1,
      allow_reactions TINYINT(1) NOT NULL DEFAULT 1,
      session_token VARCHAR(96) NULL,
      recording_enabled TINYINT(1) NOT NULL DEFAULT 0,
      recording_visibility ENUM('host_only','registered_members','public_replay') NOT NULL DEFAULT 'host_only',
      recording_url VARCHAR(255) NULL,
      recording_path VARCHAR(255) NULL,
      recording_expires_at DATETIME NULL,
      viewers_count INT UNSIGNED NOT NULL DEFAULT 0,
      room_code VARCHAR(64) NULL,
      created_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_live_events_event_id (event_id),
      KEY idx_live_events_status (status),
      KEY idx_live_events_start_at (start_at),
      CONSTRAINT fk_live_events_event_id
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON DELETE SET NULL,
      CONSTRAINT fk_live_events_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Backwards compatible column add (older DBs created before stream support).
  try {
    await pool.query('ALTER TABLE live_events ADD COLUMN stream_url VARCHAR(255) NULL');
  } catch {
    // ignore if column already exists / insufficient permissions
  }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN event_id INT UNSIGNED NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN session_identifier VARCHAR(64) NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN duration_minutes INT UNSIGNED NOT NULL DEFAULT 60'); } catch { /* ignore */ }
  try { await pool.query("ALTER TABLE live_events ADD COLUMN session_type ENUM('livestream') NOT NULL DEFAULT 'livestream'"); } catch { /* ignore */ }
  try { await pool.query("ALTER TABLE live_events ADD COLUMN privacy ENUM('public','private','event_registered_only') NOT NULL DEFAULT 'public'"); } catch { /* ignore */ }
  try { await pool.query("ALTER TABLE live_events MODIFY status ENUM('scheduled','live','ended','cancelled') NOT NULL DEFAULT 'scheduled'"); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN end_at DATETIME NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN join_link VARCHAR(255) NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN chat_enabled TINYINT(1) NOT NULL DEFAULT 1'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN allow_participant_mic TINYINT(1) NOT NULL DEFAULT 1'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN allow_participant_camera TINYINT(1) NOT NULL DEFAULT 1'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN allow_participant_screenshare TINYINT(1) NOT NULL DEFAULT 1'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN waiting_room_enabled TINYINT(1) NOT NULL DEFAULT 0'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN allow_raise_hand TINYINT(1) NOT NULL DEFAULT 1'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN allow_reactions TINYINT(1) NOT NULL DEFAULT 1'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN session_token VARCHAR(96) NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN recording_enabled TINYINT(1) NOT NULL DEFAULT 0'); } catch { /* ignore */ }
  try { await pool.query("ALTER TABLE live_events ADD COLUMN recording_visibility ENUM('host_only','registered_members','public_replay') NOT NULL DEFAULT 'host_only'"); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN recording_path VARCHAR(255) NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_events ADD COLUMN recording_expires_at DATETIME NULL'); } catch { /* ignore */ }
  try {
    await pool.query('ALTER TABLE live_events ADD COLUMN room_code VARCHAR(64) NULL');
  } catch {
    // ignore if column already exists / insufficient permissions
  }
  try { await pool.query("ALTER TABLE live_events ADD COLUMN stream_source ENUM('external','built_in') NOT NULL DEFAULT 'built_in'"); } catch { /* ignore */ }
  try {
    await pool.query('ALTER TABLE live_events ADD CONSTRAINT fk_live_events_event_id FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL');
  } catch {
    // ignore if already exists / insufficient permissions
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_event_chat_messages (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      live_event_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_live_event_chat_event (live_event_id),
      KEY idx_live_event_chat_user (user_id),
      CONSTRAINT fk_live_event_chat_event
        FOREIGN KEY (live_event_id) REFERENCES live_events(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_live_event_chat_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_session_participants (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      live_event_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      role_in_session ENUM('host','moderator','participant','viewer') NOT NULL DEFAULT 'participant',
      join_status ENUM('joined','left','removed') NOT NULL DEFAULT 'joined',
      mic_enabled TINYINT(1) NOT NULL DEFAULT 1,
      camera_enabled TINYINT(1) NOT NULL DEFAULT 1,
      screen_share_enabled TINYINT(1) NOT NULL DEFAULT 0,
      hand_raised TINYINT(1) NOT NULL DEFAULT 0,
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      left_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_live_session_participant (live_event_id, user_id),
      KEY idx_live_session_participants_event (live_event_id),
      KEY idx_live_session_participants_user (user_id),
      CONSTRAINT fk_live_session_participants_event
        FOREIGN KEY (live_event_id) REFERENCES live_events(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_live_session_participants_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_session_permissions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      live_event_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      can_join TINYINT(1) NOT NULL DEFAULT 1,
      can_chat TINYINT(1) NOT NULL DEFAULT 1,
      can_mic TINYINT(1) NOT NULL DEFAULT 1,
      can_camera TINYINT(1) NOT NULL DEFAULT 1,
      can_screenshare TINYINT(1) NOT NULL DEFAULT 1,
      can_raise_hand TINYINT(1) NOT NULL DEFAULT 1,
      can_react TINYINT(1) NOT NULL DEFAULT 1,
      can_moderate TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_live_session_permission (live_event_id, user_id),
      KEY idx_live_session_permissions_event (live_event_id),
      KEY idx_live_session_permissions_user (user_id),
      CONSTRAINT fk_live_session_permissions_event
        FOREIGN KEY (live_event_id) REFERENCES live_events(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_live_session_permissions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_session_recordings (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      live_event_id INT UNSIGNED NOT NULL,
      recording_url VARCHAR(255) NULL,
      recording_path VARCHAR(255) NULL,
      expires_at DATETIME NULL,
      original_filename VARCHAR(191) NULL,
      size_bytes BIGINT UNSIGNED NULL,
      mime_type VARCHAR(64) NULL,
      created_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_live_session_recordings_event (live_event_id),
      CONSTRAINT fk_live_session_recordings_event
        FOREIGN KEY (live_event_id) REFERENCES live_events(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_live_session_recordings_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Backwards compatible recording metadata
  try { await pool.query('ALTER TABLE live_session_recordings ADD COLUMN expires_at DATETIME NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_session_recordings ADD COLUMN original_filename VARCHAR(191) NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_session_recordings ADD COLUMN size_bytes BIGINT UNSIGNED NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE live_session_recordings ADD COLUMN mime_type VARCHAR(64) NULL'); } catch { /* ignore */ }

  // Officers (extra info attached to an officer user account)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS officers (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      position VARCHAR(64) NOT NULL DEFAULT '',
      start_date DATE NOT NULL,
      end_date DATE NULL,
      term_start DATE NULL,
      term_end DATE NULL,
      officer_status ENUM('active','inactive','past') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_officers_user_id (user_id),
      KEY idx_officers_position (position),
      KEY idx_officers_start_date (start_date),
      CONSTRAINT fk_officers_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Backwards compatible officer columns
  try { await pool.query('ALTER TABLE officers ADD COLUMN term_start DATE NULL'); } catch { /* ignore */ }
  try { await pool.query('ALTER TABLE officers ADD COLUMN term_end DATE NULL'); } catch { /* ignore */ }
  try { await pool.query("ALTER TABLE officers ADD COLUMN officer_status ENUM('active','inactive','past') NOT NULL DEFAULT 'active'"); } catch { /* ignore */ }

  // Officer elections
  await pool.query(`
    CREATE TABLE IF NOT EXISTS elections (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      title VARCHAR(191) NOT NULL,
      description TEXT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status ENUM('draft','open','closed','archived') NOT NULL DEFAULT 'draft',
      created_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_elections_status (status),
      KEY idx_elections_start_date (start_date),
      CONSTRAINT fk_elections_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  try { await pool.query('ALTER TABLE elections ADD COLUMN allowed_positions TEXT NULL'); } catch { /* ignore */ }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS election_candidates (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      election_id INT UNSIGNED NOT NULL,
      member_id INT UNSIGNED NOT NULL,
      position VARCHAR(64) NOT NULL,
      platform TEXT NULL,
      status ENUM('pending','approved','disqualified','winner') NOT NULL DEFAULT 'pending',
      votes_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_election_candidate (election_id, member_id, position),
      KEY idx_election_candidates_election_id (election_id),
      KEY idx_election_candidates_position (position),
      KEY idx_election_candidates_status (status),
      CONSTRAINT fk_election_candidates_election
        FOREIGN KEY (election_id) REFERENCES elections(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_election_candidates_member
        FOREIGN KEY (member_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS election_votes (
      election_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (election_id, user_id),
      CONSTRAINT fk_election_votes_election
        FOREIGN KEY (election_id) REFERENCES elections(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_election_votes_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Community forum (posts/comments/likes)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      author_id INT UNSIGNED NOT NULL,
      type ENUM('announcement','news','story','blog','discussion','question') NOT NULL DEFAULT 'discussion',
      title VARCHAR(191) NOT NULL,
      content TEXT NOT NULL,
      image_url VARCHAR(255) NULL,
      video_url VARCHAR(255) NULL,
      is_pinned TINYINT(1) NOT NULL DEFAULT 0,
      status ENUM('published','hidden','archived') NOT NULL DEFAULT 'published',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_forum_posts_type (type),
      KEY idx_forum_posts_status (status),
      KEY idx_forum_posts_pinned (is_pinned),
      KEY idx_forum_posts_created_at (created_at),
      CONSTRAINT fk_forum_posts_author
        FOREIGN KEY (author_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  try { await pool.query('ALTER TABLE forum_posts ADD COLUMN video_url VARCHAR(255) NULL'); } catch { /* ignore */ }
  try {
    await pool.query(
      "ALTER TABLE forum_posts MODIFY type ENUM('announcement','news','story','blog','discussion','question') NOT NULL DEFAULT 'discussion'"
    );
  } catch {
    // ignore
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS forum_comments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      post_id INT UNSIGNED NOT NULL,
      author_id INT UNSIGNED NOT NULL,
      content TEXT NOT NULL,
      status ENUM('published','hidden','archived') NOT NULL DEFAULT 'published',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_forum_comments_post_id (post_id),
      KEY idx_forum_comments_created_at (created_at),
      CONSTRAINT fk_forum_comments_post
        FOREIGN KEY (post_id) REFERENCES forum_posts(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_forum_comments_author
        FOREIGN KEY (author_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS forum_likes (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      post_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_forum_like (post_id, user_id),
      KEY idx_forum_likes_user_id (user_id),
      CONSTRAINT fk_forum_likes_post
        FOREIGN KEY (post_id) REFERENCES forum_posts(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_forum_likes_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Institution uploaded participants (for institutional member event participation)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS institution_members (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      institution_user_id INT UNSIGNED NOT NULL,
      event_id INT UNSIGNED NULL,
      full_name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NULL,
      contact_number VARCHAR(32) NULL,
      gender VARCHAR(32) NULL,
      position VARCHAR(191) NULL,
      event_title VARCHAR(191) NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      approved_by INT UNSIGNED NULL,
      approved_at DATETIME NULL,
      rejection_reason VARCHAR(255) NULL,
      notes VARCHAR(255) NULL,
      created_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_inst_members_inst_user (institution_user_id),
      KEY idx_inst_members_email (email),
      KEY idx_inst_members_event (event_title),
      KEY idx_inst_members_status (status),
      CONSTRAINT fk_inst_members_inst_user
        FOREIGN KEY (institution_user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_inst_members_event
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON DELETE SET NULL,
      CONSTRAINT fk_inst_members_approved_by
        FOREIGN KEY (approved_by) REFERENCES users(id)
        ON DELETE SET NULL,
      CONSTRAINT fk_inst_members_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Backwards-compatible adds for existing institution_members tables
  try {
    const instColumns = [
      'event_id INT UNSIGNED NULL',
      "status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'",
      'approved_by INT UNSIGNED NULL',
      'approved_at DATETIME NULL',
      'rejection_reason VARCHAR(255) NULL'
    ];
    for (const col of instColumns) {
      try {
        await pool.query(`ALTER TABLE institution_members ADD COLUMN ${col}`);
      } catch {
        // ignore if already exists
      }
    }
  } catch {
    // ignore
  }

  // Seed initial Super Admin if missing (matches credentials in PSITS/README)
  const adminEmail = 'admin@psits.com';
  const [existingAdmins] = await pool.execute(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [adminEmail]
  );

  if (!existingAdmins.length) {
    const passwordHash = hashPassword('AdminPsits@123');

    await pool.execute(
      `INSERT INTO users (email, username, full_name, password_hash, role, status, contact_number, sector)
       VALUES (?, 'admin', 'Super Admin / Head', ?, 'super_admin', 'active', '09123456789', 'institution')`,
      [adminEmail, passwordHash]
    );
  }

  // Remove legacy demo accounts if they exist in the database.
  // This prevents bypassing real registration/approval flows.
  try {
    const demoEmails = [
      'individual.demo@psitsxii.com',
      'institution.demo@psitsxii.com',
      'industry.demo@psitsxii.com',
    ];

    const [idRows] = await pool.execute(
      `SELECT id FROM users WHERE email IN (${demoEmails.map(() => '?').join(',')})`,
      demoEmails
    );

    const ids = idRows.map((r) => Number(r.id)).filter(Number.isFinite);
    if (!ids.length) return;

    const placeholders = ids.map(() => '?').join(',');
    const safeDelete = async (sql, params) => {
      try {
        await pool.execute(sql, params);
      } catch {
        // ignore missing tables/columns in older schemas
      }
    };

    await safeDelete(`DELETE FROM payments WHERE member_id IN (${placeholders})`, ids);
    await safeDelete(`DELETE FROM event_registrations WHERE member_id IN (${placeholders})`, ids);
    await safeDelete(`DELETE FROM institution_members WHERE institution_user_id IN (${placeholders})`, ids);
    await safeDelete(`DELETE FROM sessions WHERE user_id IN (${placeholders})`, ids);
    await safeDelete(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
  } catch {
    // ignore
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('Migration complete');
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { migrate };

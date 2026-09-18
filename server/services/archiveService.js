const { pool } = require('../db');

/**
 * Automatically archives announcements, forum posts, and comments older than 3 months (90 days).
 */
async function archiveExpiredContent() {
  try {
    const stats = {
      archivedAnnouncements: 0,
      archivedAnnouncementComments: 0,
      archivedForumPosts: 0,
      archivedForumComments: 0,
    };

    // 1. Archive published announcements older than 3 months
    try {
      const [annResult] = await pool.execute(`
        UPDATE announcements
        SET status = 'archived', archived_at = NOW()
        WHERE status = 'published'
          AND created_at <= DATE_SUB(NOW(), INTERVAL 3 MONTH)
      `);
      stats.archivedAnnouncements = annResult.affectedRows || 0;
    } catch (err) {
      console.warn('[ArchiveService] Failed to archive announcements:', err.message);
    }

    // 2. Archive announcement comments older than 3 months OR on archived announcements
    try {
      const [acResult1] = await pool.execute(`
        UPDATE announcement_comments
        SET deleted_at = COALESCE(deleted_at, NOW()), archived_at = NOW()
        WHERE archived_at IS NULL
          AND created_at <= DATE_SUB(NOW(), INTERVAL 3 MONTH)
      `);
      const [acResult2] = await pool.execute(`
        UPDATE announcement_comments c
        JOIN announcements a ON a.id = c.announcement_id
        SET c.deleted_at = COALESCE(c.deleted_at, NOW()), c.archived_at = NOW()
        WHERE a.status = 'archived' AND c.archived_at IS NULL
      `);
      stats.archivedAnnouncementComments = (acResult1.affectedRows || 0) + (acResult2.affectedRows || 0);
    } catch (err) {
      console.warn('[ArchiveService] Failed to archive announcement comments:', err.message);
    }

    // 3. Archive published forum posts older than 3 months
    try {
      const [fpResult] = await pool.execute(`
        UPDATE forum_posts
        SET status = 'archived', archived_at = NOW()
        WHERE status = 'published'
          AND created_at <= DATE_SUB(NOW(), INTERVAL 3 MONTH)
      `);
      stats.archivedForumPosts = fpResult.affectedRows || 0;
    } catch (err) {
      console.warn('[ArchiveService] Failed to archive forum posts:', err.message);
    }

    // 4. Archive published forum comments older than 3 months OR on archived posts
    try {
      const [fcResult1] = await pool.execute(`
        UPDATE forum_comments
        SET status = 'archived', archived_at = NOW()
        WHERE status = 'published'
          AND created_at <= DATE_SUB(NOW(), INTERVAL 3 MONTH)
      `);
      const [fcResult2] = await pool.execute(`
        UPDATE forum_comments c
        JOIN forum_posts p ON p.id = c.post_id
        SET c.status = 'archived', c.archived_at = NOW()
        WHERE p.status = 'archived' AND c.status = 'published'
      `);
      stats.archivedForumComments = (fcResult1.affectedRows || 0) + (fcResult2.affectedRows || 0);
    } catch (err) {
      console.warn('[ArchiveService] Failed to archive forum comments:', err.message);
    }

    return { success: true, stats };
  } catch (err) {
    console.error('[ArchiveService] Archive job failed:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Permanently purges archived announcements.
 */
async function purgeArchivedAnnouncements(ids = null) {
  if (Array.isArray(ids) && ids.length) {
    const placeholders = ids.map(() => '?').join(', ');
    const [result] = await pool.execute(
      `DELETE FROM announcements WHERE status = 'archived' AND id IN (${placeholders})`,
      ids
    );
    return { success: true, deletedCount: result.affectedRows || 0 };
  }

  const [result] = await pool.execute(
    `DELETE FROM announcements WHERE status = 'archived'`
  );
  return { success: true, deletedCount: result.affectedRows || 0 };
}

/**
 * Permanently purges archived forum posts.
 */
async function purgeArchivedForumPosts(ids = null) {
  if (Array.isArray(ids) && ids.length) {
    const placeholders = ids.map(() => '?').join(', ');
    const [result] = await pool.execute(
      `DELETE FROM forum_posts WHERE status = 'archived' AND id IN (${placeholders})`,
      ids
    );
    return { success: true, deletedCount: result.affectedRows || 0 };
  }

  const [result] = await pool.execute(
    `DELETE FROM forum_posts WHERE status = 'archived'`
  );
  return { success: true, deletedCount: result.affectedRows || 0 };
}

module.exports = {
  archiveExpiredContent,
  purgeArchivedAnnouncements,
  purgeArchivedForumPosts,
};

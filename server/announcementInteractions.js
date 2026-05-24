const { pool } = require('./db');

function json(res, status, body) {
  res.status(status).json(body);
}

function canDeleteComment(user, commentRow) {
  if (!user) return false;
  if (String(commentRow.user_id) === String(user.id)) return true;
  return ['super_admin', 'admin', 'officer'].includes(String(user.role || ''));
}

function toCommentDto(row) {
  return {
    id: String(row.id),
    announcementId: String(row.announcement_id),
    content: row.content,
    isDeleted: Boolean(row.deleted_at),
    createdAt: row.created_at,
    user: row.user_id ? { id: String(row.user_id), name: row.user_name || null } : null,
  };
}

async function listAnnouncementComments(req, res) {
  const announcementId = Number(req.params.id);
  if (!Number.isFinite(announcementId)) return json(res, 400, { success: false, message: 'Invalid announcement id.' });

  const [rows] = await pool.execute(
    `SELECT
       c.*,
       u.full_name AS user_name
     FROM announcement_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.announcement_id = ? AND c.deleted_at IS NULL
     ORDER BY c.created_at ASC
     LIMIT 200`,
    [announcementId]
  );

  return json(res, 200, { success: true, comments: rows.map(toCommentDto) });
}

async function createAnnouncementComment(req, res) {
  const announcementId = Number(req.params.id);
  if (!Number.isFinite(announcementId)) return json(res, 400, { success: false, message: 'Invalid announcement id.' });

  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId)) return json(res, 401, { success: false, message: 'Unauthorized.' });

  const body = req.body || {};
  const content = String(body.content || '').trim();
  if (!content) return json(res, 400, { success: false, message: 'Comment is required.' });
  if (content.length > 2000) return json(res, 400, { success: false, message: 'Comment is too long.' });

  // Ensure announcement exists
  const [ann] = await pool.execute('SELECT id FROM announcements WHERE id = ? LIMIT 1', [announcementId]);
  if (!ann.length) return json(res, 404, { success: false, message: 'Announcement not found.' });

  const [result] = await pool.execute(
    `INSERT INTO announcement_comments (announcement_id, user_id, content)
     VALUES (?, ?, ?)`,
    [announcementId, userId, content]
  );

  const [rows] = await pool.execute(
    `SELECT c.*, u.full_name AS user_name
     FROM announcement_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.id = ?
     LIMIT 1`,
    [result.insertId]
  );

  return json(res, 201, { success: true, comment: toCommentDto(rows[0]) });
}

async function deleteAnnouncementComment(req, res) {
  const announcementId = Number(req.params.id);
  const commentId = Number(req.params.commentId);
  if (!Number.isFinite(announcementId)) return json(res, 400, { success: false, message: 'Invalid announcement id.' });
  if (!Number.isFinite(commentId)) return json(res, 400, { success: false, message: 'Invalid comment id.' });

  const [rows] = await pool.execute(
    'SELECT * FROM announcement_comments WHERE id = ? AND announcement_id = ? LIMIT 1',
    [commentId, announcementId]
  );
  if (!rows.length) return json(res, 404, { success: false, message: 'Comment not found.' });

  if (!canDeleteComment(req.user, rows[0])) {
    return json(res, 403, { success: false, message: 'Not allowed to delete this comment.' });
  }

  await pool.execute(
    'UPDATE announcement_comments SET deleted_at = NOW() WHERE id = ?',
    [commentId]
  );
  return json(res, 200, { success: true });
}

async function getAnnouncementLikes(req, res) {
  const announcementId = Number(req.params.id);
  if (!Number.isFinite(announcementId)) return json(res, 400, { success: false, message: 'Invalid announcement id.' });

  const userId = Number(req.user?.id);
  const [[{ likeCount }]] = await pool.query(
    'SELECT COUNT(*) AS likeCount FROM announcement_likes WHERE announcement_id = ?',
    [announcementId]
  );

  let likedByMe = false;
  if (Number.isFinite(userId)) {
    const [likedRows] = await pool.execute(
      'SELECT 1 FROM announcement_likes WHERE announcement_id = ? AND user_id = ? LIMIT 1',
      [announcementId, userId]
    );
    likedByMe = Boolean(likedRows.length);
  }

  return json(res, 200, { success: true, likes: { count: Number(likeCount) || 0, likedByMe } });
}

async function setAnnouncementLike(req, res) {
  const announcementId = Number(req.params.id);
  if (!Number.isFinite(announcementId)) return json(res, 400, { success: false, message: 'Invalid announcement id.' });

  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId)) return json(res, 401, { success: false, message: 'Unauthorized.' });

  const body = req.body || {};
  const like = body.like === undefined ? true : Boolean(body.like);

  // Ensure announcement exists
  const [ann] = await pool.execute('SELECT id FROM announcements WHERE id = ? LIMIT 1', [announcementId]);
  if (!ann.length) return json(res, 404, { success: false, message: 'Announcement not found.' });

  if (like) {
    await pool.execute(
      'INSERT IGNORE INTO announcement_likes (announcement_id, user_id) VALUES (?, ?)',
      [announcementId, userId]
    );
  } else {
    await pool.execute(
      'DELETE FROM announcement_likes WHERE announcement_id = ? AND user_id = ?',
      [announcementId, userId]
    );
  }

  return getAnnouncementLikes(req, res);
}

module.exports = {
  listAnnouncementComments,
  createAnnouncementComment,
  deleteAnnouncementComment,
  getAnnouncementLikes,
  setAnnouncementLike,
};


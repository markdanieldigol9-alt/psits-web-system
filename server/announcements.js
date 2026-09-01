const { pool } = require('./db');

function parseAudience(audienceJson) {
  if (audienceJson === null || audienceJson === undefined) return [];
  if (Array.isArray(audienceJson)) return audienceJson;
  if (typeof audienceJson !== 'string') return [];

  const trimmed = audienceJson.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()];
  } catch {
    // Fall through to a forgiving parser below.
  }

  // Support legacy plain strings or comma/space-delimited values.
  return trimmed
    .split(/[,\s]+/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

function toAnnouncementDto(row) {
  const audience = parseAudience(row.audience_json);
  const createdAt = row.created_at ? new Date(row.created_at) : null;
  const date = createdAt ? createdAt.toISOString().slice(0, 10) : '';

  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    status: row.status,
    date,
    imageUrl: row.image_url || null,
    audience,
    commentCount: Number(row.comment_count || 0),
    likeCount: Number(row.like_count || 0),
    likedByMe: Boolean(row.liked_by_me),
    postedBy: row.created_by
      ? {
          id: String(row.created_by),
          name: row.created_by_name || null,
          role: row.created_by_role || null,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function canMemberSee(audience, memberType) {
  const values = Array.isArray(audience) ? audience.map((x) => String(x).toLowerCase()) : [];
  if (values.includes('all') || values.includes('member') || values.includes('members')) return true;

  if (memberType) {
    const type = String(memberType).toLowerCase();
    if (values.includes(type)) return true;
    // Common aliases
    if (type === 'individual' && values.includes('member_individual')) return true;
    if (type === 'institution' && values.includes('member_institutional')) return true;
    if (type === 'industry' && values.includes('member_industry')) return true;
  }

  return false;
}

async function listAnnouncements(req, res) {
  const status = req.query.status ? String(req.query.status) : null;
  const where = [];
  const params = [Number(req.user?.id || 0)];

  if (req.user?.role === 'member') {
    where.push("a.status = 'published'");
  } else if (status && status !== 'all' && ['draft', 'published'].includes(status)) {
    where.push('a.status = ?');
    params.push(status);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT
       a.*,
       u.full_name AS created_by_name,
       u.role AS created_by_role,
       COALESCE(c.comment_count, 0) AS comment_count,
       COALESCE(l.like_count, 0) AS like_count,
       CASE WHEN me.user_id IS NULL THEN 0 ELSE 1 END AS liked_by_me
     FROM announcements a
     LEFT JOIN users u ON u.id = a.created_by
     LEFT JOIN (
       SELECT announcement_id, COUNT(*) AS comment_count
       FROM announcement_comments
       WHERE deleted_at IS NULL
       GROUP BY announcement_id
     ) c ON c.announcement_id = a.id
     LEFT JOIN (
       SELECT announcement_id, COUNT(*) AS like_count
       FROM announcement_likes
       GROUP BY announcement_id
     ) l ON l.announcement_id = a.id
     LEFT JOIN announcement_likes me ON me.announcement_id = a.id AND me.user_id = ?
     ${sqlWhere}
     ORDER BY a.created_at DESC`,
    params
  );

  const mapped = rows.map(toAnnouncementDto);
  const announcements = req.user?.role === 'member'
    ? mapped.filter((x) => canMemberSee(x.audience, req.user?.member_type))
    : mapped;

  return res.json({ success: true, announcements });
}

async function broadcastAnnouncementNotification(announcementId, title, content, audience) {
  try {
    const [users] = await pool.query(
      `SELECT id, role, member_type FROM users WHERE status = 'active'`
    );
    if (!users.length) return;

    const targetUsers = users.filter((u) => canMemberSee(audience, u.member_type) || u.role === 'super_admin' || u.role === 'admin' || u.role === 'officer');
    if (!targetUsers.length) return;

    const previewMessage = content.length > 140 ? `${content.slice(0, 137)}...` : content;
    const metaJson = JSON.stringify({
      announcementId: String(announcementId),
      title,
      url: '/announcements',
    });

    const values = targetUsers.map((u) => [
      u.id,
      `📢 New Announcement: ${title}`,
      previewMessage,
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
  } catch (err) {
    console.warn('[Announcements] Failed to broadcast notification:', err.message);
  }
}

async function createAnnouncement(req, res) {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const status = body.status === 'draft' ? 'draft' : 'published';
  const audience = Array.isArray(body.audience) ? body.audience : (body.targetAudience ? body.targetAudience : []);
  const audienceJson = JSON.stringify(audience);
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;

  if (!title || !content) {
    return res.status(400).json({ success: false, message: 'Title and content are required.' });
  }

  const [result] = await pool.execute(
    `INSERT INTO announcements (title, content, audience_json, status, created_by, image_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, content, audienceJson, status, req.user?.id || null, imageUrl]
  );

  if (status === 'published') {
    void broadcastAnnouncementNotification(result.insertId, title, content, audience);
  }

  const [rows] = await pool.execute(
    `SELECT
       a.*,
       u.full_name AS created_by_name,
       u.role AS created_by_role,
       0 AS comment_count,
       0 AS like_count,
       0 AS liked_by_me
     FROM announcements a
     LEFT JOIN users u ON u.id = a.created_by
     WHERE a.id = ?
     LIMIT 1`,
    [result.insertId]
  );
  return res.status(201).json({ success: true, announcement: toAnnouncementDto(rows[0]) });
}

async function updateAnnouncement(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const body = req.body || {};
  const sets = [];
  const params = [];

  if (typeof body.title === 'string' && body.title.trim()) { sets.push('title = ?'); params.push(body.title.trim()); }
  if (typeof body.content === 'string') { sets.push('content = ?'); params.push(body.content.trim()); }
  if (typeof body.status === 'string' && ['draft', 'published'].includes(body.status)) { sets.push('status = ?'); params.push(body.status); }
  if (body.audience !== undefined) { sets.push('audience_json = ?'); params.push(JSON.stringify(Array.isArray(body.audience) ? body.audience : [])); }
  if (body.imageUrl !== undefined) { sets.push('image_url = ?'); params.push(body.imageUrl ? String(body.imageUrl).trim() : null); }

  if (!sets.length) return res.status(400).json({ success: false, message: 'No fields to update.' });
  params.push(id);

  await pool.execute(`UPDATE announcements SET ${sets.join(', ')} WHERE id = ?`, params);
  const [rows] = await pool.execute(
    `SELECT
       a.*,
       u.full_name AS created_by_name,
       u.role AS created_by_role,
       COALESCE(c.comment_count, 0) AS comment_count,
       COALESCE(l.like_count, 0) AS like_count,
       0 AS liked_by_me
     FROM announcements a
     LEFT JOIN users u ON u.id = a.created_by
     LEFT JOIN (
       SELECT announcement_id, COUNT(*) AS comment_count
       FROM announcement_comments
       WHERE deleted_at IS NULL
       GROUP BY announcement_id
     ) c ON c.announcement_id = a.id
     LEFT JOIN (
       SELECT announcement_id, COUNT(*) AS like_count
       FROM announcement_likes
       GROUP BY announcement_id
     ) l ON l.announcement_id = a.id
     WHERE a.id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Announcement not found.' });

  const updatedAnnouncement = rows[0];
  if (body.status === 'published') {
    const aud = parseAudience(updatedAnnouncement.audience_json);
    void broadcastAnnouncementNotification(id, updatedAnnouncement.title, updatedAnnouncement.content, aud);
  }

  return res.json({ success: true, announcement: toAnnouncementDto(updatedAnnouncement) });
}

async function deleteAnnouncement(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const [result] = await pool.execute('DELETE FROM announcements WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Announcement not found.' });
  return res.json({ success: true });
}

module.exports = { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement };

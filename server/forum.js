const { pool } = require('./db');
function json(res, status, body) {
  res.status(status).json(body);
}

function toPostDto(row) {
  return {
    id: String(row.id),
    authorId: String(row.author_id),
    authorName: row.author_name || '',
    type: row.type,
    title: row.title,
    content: row.content,
    imageUrl: row.image_url || null,
    videoUrl: row.video_url || null,
    isPinned: Boolean(row.is_pinned),
    status: row.status,
    likesCount: Number(row.likes_count || 0),
    commentsCount: Number(row.comments_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCommentDto(row) {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    authorId: String(row.author_id),
    authorName: row.author_name || '',
    parentId: row.parent_id ? String(row.parent_id) : null,
    parentAuthorName: row.parent_author_name || null,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function canCreateType(user, type) {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin' || role === 'super_admin' || role === 'officer') return true;
  if (role === 'member') return ['discussion', 'question', 'story', 'blog'].includes(type);
  return false;
}

async function listPosts(req, res) {
  const type = req.query.type ? String(req.query.type) : null;
  const where = ["p.status <> 'hidden'"];
  const params = [];

  if (type && type !== 'all' && ['announcement', 'news', 'story', 'blog', 'discussion', 'question'].includes(type)) {
    where.push('p.type = ?');
    params.push(type);
  }

  // Members cannot see archived posts by default.
  if (req.user?.role === 'member') {
    where.push("p.status = 'published'");
  }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT
       p.*,
       u.full_name AS author_name,
       (SELECT COUNT(*) FROM forum_likes l WHERE l.post_id = p.id) AS likes_count,
       (SELECT COUNT(*) FROM forum_comments c WHERE c.post_id = p.id AND c.status = 'published') AS comments_count
     FROM forum_posts p
     JOIN users u ON u.id = p.author_id
     ${sqlWhere}
     ORDER BY p.is_pinned DESC, p.created_at DESC
     LIMIT 200`,
    params
  );

  return json(res, 200, { success: true, posts: rows.map(toPostDto) });
}

async function createPost(req, res) {
  const body = req.body || {};
  const type = String(body.type || 'discussion').trim();
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
  const videoUrl = body.videoUrl ? String(body.videoUrl).trim() : null;

  if (!['announcement', 'news', 'story', 'blog', 'discussion', 'question'].includes(type)) {
    return json(res, 400, { success: false, message: 'Invalid post type.' });
  }
  if (!canCreateType(req.user, type)) {
    return json(res, 403, { success: false, message: 'Forbidden.' });
  }
  if (!title || !content) {
    return json(res, 400, { success: false, message: 'Title and content are required.' });
  }

  const [result] = await pool.execute(
    `INSERT INTO forum_posts (author_id, type, title, content, image_url, video_url, is_pinned, status)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'published')`,
    [req.user?.id || null, type, title, content, imageUrl, videoUrl]
  );

  return json(res, 201, { success: true, id: String(result.insertId) });
}

async function updatePost(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid id.' });
  const body = req.body || {};

  const [rows] = await pool.execute('SELECT * FROM forum_posts WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) return json(res, 404, { success: false, message: 'Post not found.' });
  const post = rows[0];

  const role = String(req.user?.role || '').toLowerCase();
  const isOwner = Number(post.author_id) === Number(req.user?.id);
  const canModerate = ['super_admin', 'admin', 'officer'].includes(role);
  if (!canModerate && !isOwner) return json(res, 403, { success: false, message: 'Forbidden.' });

  const sets = [];
  const params = [];
  if (typeof body.title === 'string') { sets.push('title = ?'); params.push(body.title.trim()); }
  if (typeof body.content === 'string') { sets.push('content = ?'); params.push(body.content.trim()); }
  if (typeof body.imageUrl === 'string') { sets.push('image_url = ?'); params.push(body.imageUrl.trim() || null); }
  if (typeof body.videoUrl === 'string') { sets.push('video_url = ?'); params.push(body.videoUrl.trim() || null); }
  if (canModerate && typeof body.status === 'string') {
    const s = body.status.trim();
    if (!['published', 'hidden', 'archived'].includes(s)) return json(res, 400, { success: false, message: 'Invalid status.' });
    sets.push('status = ?'); params.push(s);
  }
  if (canModerate && body.isPinned !== undefined) {
    sets.push('is_pinned = ?'); params.push(body.isPinned ? 1 : 0);
  }

  if (!sets.length) return json(res, 400, { success: false, message: 'No fields to update.' });
  params.push(id);
  await pool.execute(`UPDATE forum_posts SET ${sets.join(', ')} WHERE id = ?`, params);

  return json(res, 200, { success: true });
}

async function deletePost(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return json(res, 400, { success: false, message: 'Invalid id.' });

  const [rows] = await pool.execute('SELECT * FROM forum_posts WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) return json(res, 404, { success: false, message: 'Post not found.' });
  const post = rows[0];

  const role = String(req.user?.role || '').toLowerCase();
  const isOwner = Number(post.author_id) === Number(req.user?.id);
  const canModerate = ['super_admin', 'admin', 'officer'].includes(role);
  if (!canModerate && !isOwner) return json(res, 403, { success: false, message: 'Forbidden.' });

  await pool.execute('DELETE FROM forum_posts WHERE id = ?', [id]);
  return json(res, 200, { success: true });
}

async function listComments(req, res) {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) return json(res, 400, { success: false, message: 'Invalid post id.' });

  const where = ['c.post_id = ?'];
  const params = [postId];
  if (req.user?.role === 'member') {
    where.push("c.status = 'published'");
  }

  const [rows] = await pool.execute(
    `SELECT c.*, u.full_name AS author_name, pu.full_name AS parent_author_name
     FROM forum_comments c
     JOIN users u ON u.id = c.author_id
     LEFT JOIN forum_comments pc ON pc.id = c.parent_id
     LEFT JOIN users pu ON pu.id = pc.author_id
     WHERE ${where.join(' AND ')}
     ORDER BY c.created_at ASC
     LIMIT 500`,
    params
  );
  return json(res, 200, { success: true, comments: rows.map(toCommentDto) });
}

async function addComment(req, res) {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) return json(res, 400, { success: false, message: 'Invalid post id.' });
  const body = req.body || {};
  const content = String(body.content || '').trim();
  const parentId = body.parentId && Number.isFinite(Number(body.parentId)) ? Number(body.parentId) : null;
  if (!content) return json(res, 400, { success: false, message: 'Content is required.' });

  const [result] = await pool.execute(
    `INSERT INTO forum_comments (post_id, author_id, parent_id, content, status)
     VALUES (?, ?, ?, ?, 'published')`,
    [postId, req.user?.id || null, parentId, content]
  );

  // Notify parent comment author if this is a reply
  if (parentId) {
    try {
      const [pRows] = await pool.execute(
        `SELECT c.author_id, p.title AS post_title
         FROM forum_comments c
         JOIN forum_posts p ON p.id = c.post_id
         WHERE c.id = ? LIMIT 1`,
        [parentId]
      );
      if (pRows.length && Number(pRows[0].author_id) !== Number(req.user?.id)) {
        const parentAuthorId = pRows[0].author_id;
        const postTitle = pRows[0].post_title || 'Community Post';
        const preview = content.length > 80 ? `${content.slice(0, 77)}...` : content;
        const metaJson = JSON.stringify({ postId: String(postId), parentId: String(parentId), url: '/community' });
        await pool.execute(
          `INSERT INTO notifications (user_id, title, message, type, is_read, meta_json)
           VALUES (?, ?, ?, 'info', 0, ?)`,
          [
            parentAuthorId,
            `💬 Reply to your comment`,
            `${req.user?.full_name || 'A user'} replied to your comment in "${postTitle}": "${preview}"`,
            metaJson,
          ]
        );
      }
    } catch (notifErr) {
      console.warn('[Forum] Failed to send reply notification:', notifErr.message);
    }
  }

  return json(res, 201, { success: true, id: String(result.insertId) });
}

async function setLike(req, res) {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) return json(res, 400, { success: false, message: 'Invalid post id.' });
  const body = req.body || {};
  const liked = Boolean(body.liked);
  const userId = req.user?.id;
  if (!userId) return json(res, 401, { success: false, message: 'Unauthorized.' });

  if (liked) {
    try {
      await pool.execute('INSERT INTO forum_likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
    } catch {
      // ignore duplicates
    }
  } else {
    await pool.execute('DELETE FROM forum_likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
  }
  return json(res, 200, { success: true });
}

module.exports = {
  listPosts,
  createPost,
  updatePost,
  deletePost,
  listComments,
  addComment,
  setLike,
};


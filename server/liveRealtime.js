const { Server } = require('socket.io');
const { pool } = require('./db');
const {
  getLiveEventRowById,
  assertSessionAccess,
  ensureSessionParticipant,
  getEffectivePermission,
  getParticipantRow,
  syncViewerCount,
  toParticipantDto,
  toMessageDto,
} = require('./liveEvents');

function roomName(liveEventId) {
  return `live-session:${liveEventId}`;
}

async function authenticateSocket(socket, next) {
  try {
    const token = String(socket.handshake.auth?.token || '').trim();
    if (!token) return next(new Error('Missing token.'));

    const [rows] = await pool.execute(
      `SELECT u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > NOW()
       LIMIT 1`,
      [token]
    );

    if (!rows.length) return next(new Error('Invalid or expired token.'));
    socket.data.user = rows[0];
    return next();
  } catch (error) {
    return next(error);
  }
}

async function listParticipantRows(liveEventId) {
  const [rows] = await pool.execute(
    `SELECT
       p.*,
       u.full_name AS user_name,
       u.email AS user_email,
       u.role AS user_role,
       perms.can_join,
       perms.can_chat,
       perms.can_mic,
       perms.can_camera,
       perms.can_screenshare,
       perms.can_raise_hand,
       perms.can_react,
       perms.can_moderate
     FROM live_session_participants p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN live_session_permissions perms
       ON perms.live_event_id = p.live_event_id
      AND perms.user_id = p.user_id
     WHERE p.live_event_id = ? AND p.join_status = 'joined'
     ORDER BY
       CASE p.role_in_session WHEN 'host' THEN 0 WHEN 'moderator' THEN 1 WHEN 'participant' THEN 2 ELSE 3 END,
       p.joined_at ASC`,
    [liveEventId]
  );

  return rows.map(toParticipantDto);
}

async function createRealtimeChatMessage(liveEventId, userId, text) {
  const message = String(text || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);

  if (!message) return null;

  const [result] = await pool.execute(
    `INSERT INTO live_event_chat_messages (live_event_id, user_id, message)
     VALUES (?, ?, ?)`,
    [liveEventId, userId, message]
  );

  const [rows] = await pool.execute(
    `SELECT m.*, u.full_name, u.username, u.role
     FROM live_event_chat_messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.id = ?
     LIMIT 1`,
    [result.insertId]
  );

  return rows[0] ? toMessageDto(rows[0]) : null;
}

async function listConnectedPeers(io, liveEventId) {
  const sockets = await io.in(roomName(liveEventId)).fetchSockets();
  return sockets.map((candidate) => ({
    socketId: candidate.id,
    userId: String(candidate.data.user?.id || ''),
    name: candidate.data.user?.full_name || 'PSITS User',
    roleInSession: candidate.data.roleInSession || 'participant',
  }));
}

function attachLiveRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    socket.on('session:join', async (payload = {}, ack) => {
      try {
        const liveEventId = Number(payload.liveEventId);
        if (!Number.isFinite(liveEventId)) throw new Error('Invalid live session id.');

        const session = await getLiveEventRowById(liveEventId);
        const access = await assertSessionAccess(session, socket.data.user);
        if (!access.ok) throw new Error(access.message);

        const roleInSession = socket.data.user.role === 'member'
          ? session.session_type === 'livestream' ? 'viewer' : 'participant'
          : 'host';

        await ensureSessionParticipant(session, socket.data.user, roleInSession);
        await socket.join(roomName(liveEventId));

        socket.data.liveEventId = liveEventId;
        socket.data.roleInSession = roleInSession;

        const participants = await listParticipantRows(liveEventId);
        const peers = await listConnectedPeers(io, liveEventId);
        const permissions = await getEffectivePermission(session, socket.data.user);

        io.to(roomName(liveEventId)).emit('session:presence', {
          liveEventId: String(liveEventId),
          participants,
        });

        io.to(roomName(liveEventId)).emit('session:user-joined', {
          liveEventId: String(liveEventId),
          userId: String(socket.data.user.id),
          name: socket.data.user.full_name,
          roleInSession,
          socketId: socket.id,
        });

        if (typeof ack === 'function') {
          ack({
            ok: true,
            liveEventId: String(liveEventId),
            permissions,
            participants,
            peers,
            currentUserId: String(socket.data.user.id),
            currentSocketId: socket.id,
          });
        }
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, message: error instanceof Error ? error.message : 'Join failed.' });
      }
    });

    socket.on('session:leave', async (payload = {}, ack) => {
      try {
        const liveEventId = Number(payload.liveEventId || socket.data.liveEventId);
        if (!Number.isFinite(liveEventId)) throw new Error('Invalid live session id.');

        await pool.execute(
          `UPDATE live_session_participants
           SET join_status = 'left', left_at = NOW()
           WHERE live_event_id = ? AND user_id = ?`,
          [liveEventId, socket.data.user.id]
        );

        await socket.leave(roomName(liveEventId));
        await syncViewerCount(liveEventId);

        const participants = await listParticipantRows(liveEventId);
        io.to(roomName(liveEventId)).emit('session:presence', {
          liveEventId: String(liveEventId),
          participants,
        });
        io.to(roomName(liveEventId)).emit('session:user-left', {
          liveEventId: String(liveEventId),
          userId: String(socket.data.user.id),
          name: socket.data.user.full_name,
        });

        socket.data.liveEventId = null;
        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, message: error instanceof Error ? error.message : 'Leave failed.' });
      }
    });

    socket.on('webrtc:offer', (payload = {}) => {
      const targetSocketId = String(payload.targetSocketId || '');
      if (!targetSocketId) return;
      io.to(targetSocketId).emit('webrtc:offer', {
        fromSocketId: socket.id,
        fromUserId: String(socket.data.user.id),
        fromName: socket.data.user.full_name,
        description: payload.description,
      });
    });

    socket.on('webrtc:answer', (payload = {}) => {
      const targetSocketId = String(payload.targetSocketId || '');
      if (!targetSocketId) return;
      io.to(targetSocketId).emit('webrtc:answer', {
        fromSocketId: socket.id,
        fromUserId: String(socket.data.user.id),
        description: payload.description,
      });
    });

    socket.on('webrtc:ice-candidate', (payload = {}) => {
      const targetSocketId = String(payload.targetSocketId || '');
      if (!targetSocketId) return;
      io.to(targetSocketId).emit('webrtc:ice-candidate', {
        fromSocketId: socket.id,
        fromUserId: String(socket.data.user.id),
        candidate: payload.candidate,
      });
    });

    socket.on('session:chat', async (payload = {}, ack) => {
      try {
        const liveEventId = Number(payload.liveEventId || socket.data.liveEventId);
        if (!Number.isFinite(liveEventId)) throw new Error('Invalid live session id.');

        const session = await getLiveEventRowById(liveEventId);
        const access = await assertSessionAccess(session, socket.data.user);
        if (!access.ok) throw new Error(access.message);

        const permissions = await getEffectivePermission(session, socket.data.user);
        if (!permissions.canChat) throw new Error('Chat is disabled for this session.');

        const message = await createRealtimeChatMessage(liveEventId, socket.data.user.id, payload.message);
        if (!message) throw new Error('Message is required.');

        io.to(roomName(liveEventId)).emit('session:chat', message);
        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, message: error instanceof Error ? error.message : 'Chat failed.' });
      }
    });

    socket.on('session:state', async (payload = {}, ack) => {
      try {
        const liveEventId = Number(payload.liveEventId || socket.data.liveEventId);
        if (!Number.isFinite(liveEventId)) throw new Error('Invalid live session id.');

        const participant = await getParticipantRow(liveEventId, socket.data.user.id);
        if (!participant) throw new Error('Participant not found in this session.');

        const sets = [];
        const params = [];
        if (payload.handRaised !== undefined) {
          sets.push('hand_raised = ?');
          params.push(Number(payload.handRaised) ? 1 : 0);
        }
        if (payload.micEnabled !== undefined) {
          sets.push('mic_enabled = ?');
          params.push(Number(payload.micEnabled) ? 1 : 0);
        }
        if (payload.cameraEnabled !== undefined) {
          sets.push('camera_enabled = ?');
          params.push(Number(payload.cameraEnabled) ? 1 : 0);
        }
        if (payload.screenShareEnabled !== undefined) {
          sets.push('screen_share_enabled = ?');
          params.push(Number(payload.screenShareEnabled) ? 1 : 0);
        }

        if (sets.length) {
          params.push(participant.id);
          await pool.execute(`UPDATE live_session_participants SET ${sets.join(', ')} WHERE id = ?`, params);
          const participants = await listParticipantRows(liveEventId);
          io.to(roomName(liveEventId)).emit('session:presence', {
            liveEventId: String(liveEventId),
            participants,
          });
        }

        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, message: error instanceof Error ? error.message : 'State update failed.' });
      }
    });

    socket.on('session:moderate', async (payload = {}, ack) => {
      try {
        const liveEventId = Number(payload.liveEventId || socket.data.liveEventId);
        const targetUserId = Number(payload.targetUserId);
        const action = String(payload.action || '');
        if (!Number.isFinite(liveEventId) || !Number.isFinite(targetUserId)) throw new Error('Invalid moderation request.');

        const session = await getLiveEventRowById(liveEventId);
        const permissions = await getEffectivePermission(session, socket.data.user);
        if (!permissions.canModerate) throw new Error('You do not have permission to moderate this session.');

        const participant = await getParticipantRow(liveEventId, targetUserId);
        if (!participant) throw new Error('Participant not found.');

        if (action === 'remove') {
          await pool.execute(
            `UPDATE live_session_participants
             SET join_status = 'removed', left_at = NOW()
             WHERE live_event_id = ? AND user_id = ?`,
            [liveEventId, targetUserId]
          );
        } else if (action === 'mute') {
          await pool.execute(
            `UPDATE live_session_participants
             SET mic_enabled = 0
             WHERE live_event_id = ? AND user_id = ?`,
            [liveEventId, targetUserId]
          );
        } else {
          throw new Error('Unsupported moderation action.');
        }

        const participants = await listParticipantRows(liveEventId);
        io.to(roomName(liveEventId)).emit('session:presence', {
          liveEventId: String(liveEventId),
          participants,
        });
        io.to(roomName(liveEventId)).emit('session:moderated', {
          liveEventId: String(liveEventId),
          action,
          targetUserId: String(targetUserId),
        });

        if (action === 'remove') {
          const sockets = await io.in(roomName(liveEventId)).fetchSockets();
          for (const candidate of sockets) {
            if (String(candidate.data.user?.id || '') === String(targetUserId)) {
              candidate.emit('session:removed', { liveEventId: String(liveEventId) });
              await candidate.leave(roomName(liveEventId));
            }
          }
        }

        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, message: error instanceof Error ? error.message : 'Moderation failed.' });
      }
    });

    socket.on('disconnect', async () => {
      try {
        const liveEventId = Number(socket.data.liveEventId);
        if (!Number.isFinite(liveEventId)) return;

        await pool.execute(
          `UPDATE live_session_participants
           SET join_status = 'left', left_at = NOW()
           WHERE live_event_id = ? AND user_id = ?`,
          [liveEventId, socket.data.user.id]
        );

        await syncViewerCount(liveEventId);
        const participants = await listParticipantRows(liveEventId);
        io.to(roomName(liveEventId)).emit('session:presence', {
          liveEventId: String(liveEventId),
          participants,
        });
        io.to(roomName(liveEventId)).emit('session:user-left', {
          liveEventId: String(liveEventId),
          userId: String(socket.data.user.id),
          name: socket.data.user.full_name,
        });
      } catch {
        // ignore disconnect cleanup errors
      }
    });
  });

  return io;
}

module.exports = { attachLiveRealtime };

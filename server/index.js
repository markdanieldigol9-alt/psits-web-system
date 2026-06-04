const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

dotenv.config({ path: path.join(__dirname, '.env') });

const { migrate } = require('./migrate');
const { pool } = require('./db');
const { isDbError, getDbUnavailableMessage } = require('./isDbError');
const { authMiddleware, requireRole, register, login, logout, createAdmin, verifyCurrentPassword, renewLookup } = require('./auth');
const {
  listMembers,
  listMemberStatusLogs,
  getMemberDetails,
  createMember,
  updateMember,
  changeMemberStatus,
  deleteMember,
  resendApprovalEmail,
  triggerExpirationCheck,
} = require('./members');
const { getDashboardReport, getElectionReport, getPartnerContributionsReport } = require('./reports');
const { getMe, updateMe } = require('./me');
const { listEvents, createEvent, updateEvent, deleteEvent } = require('./events');
const { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } = require('./announcements');
const {
  listAnnouncementComments,
  createAnnouncementComment,
  deleteAnnouncementComment,
  getAnnouncementLikes,
  setAnnouncementLike,
} = require('./announcementInteractions');
const { listPartners, createPartner, updatePartner, deletePartner, listPartnerContributions, createPartnerContribution, deletePartnerContribution } = require('./partners');
const { listPayments, createPayment, verifyPayment } = require('./payments');
const { listElections, getElectionDetails, createElection, updateElection, addCandidate, updateCandidate, markWinner, castVote, checkVotedStatus, deleteCandidate, deleteElection } = require('./elections');
const { listPosts, createPost, updatePost, deletePost, listComments, addComment, setLike } = require('./forum');
const {
  listLiveEvents,
  listLiveEventsByEvent,
  getLiveEventById,
  createLiveEvent,
  updateLiveEvent,
  deleteLiveEvent,
  startLiveEvent,
  endLiveEvent,
  cancelLiveEvent,
  joinLiveEvent,
  leaveLiveEvent,
  listLiveEventParticipants,
  updateLiveEventParticipant,
  updateLiveEventPermissions,
  listLiveEventChatMessages,
  createLiveEventChatMessage,
  validateLiveEventRoomCode,
  getLiveEventCounts,
  uploadLiveEventRecording,
  downloadLiveEventRecording,
  cleanupExpiredLiveEventRecordings,
} = require('./liveEvents');
const { listOfficers, createOfficer, assignOfficer, updateOfficer, deleteOfficer } = require('./officers');
const { listInstitutionMembers, bulkCreateInstitutionMembers, approveInstitutionMember } = require('./institutionMembers');
const { registerForEvent, listEventRegistrations, listMyRegistrations, approveEventRegistration } = require('./eventRegistrations');
const { sendSmtpTest } = require('./emailTest');
const { resendFailedApprovalEmails } = require('./mailer');
const { checkExpiringMemberships } = require('./services/expirationService');
const { buildRedisClient, createRateLimiter } = require('./rateLimiter');
const { attachLiveRealtime } = require('./liveRealtime');
const app = express();
const isProd = process.env.NODE_ENV === 'production';
const trustProxy = String(process.env.TRUST_PROXY || '').toLowerCase() === 'true';
const redis = buildRedisClient();

if (trustProxy) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // Attendance scanning removed; keep permissions locked down.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts. Please try again later.',
  name: 'login',
  getKey: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return email ? `${ip}:${email}` : ip;
  },
  redis,
});

const registerLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many registration attempts. Please try again later.',
  name: 'register',
  getKey: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return email ? `${ip}:${email}` : ip;
  },
  redis,
});

const verifyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many password checks. Please try again later.',
  name: 'verify',
  redis,
});

app.use(cors({
  origin: (origin, cb) => {
    // Allow non-browser tools (no Origin header)
    if (!origin) return cb(null, true);

    // Allow additional origins via env: "https://example.com,http://localhost:5173"
    const extra = String(process.env.CORS_ORIGIN || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (extra.includes(origin)) return cb(null, true);

    // Dev convenience: allow localhost/loopback + private LAN IPs on any port.
    // This prevents browser "Network Error" when opening Vite via IPv6 or your machine IP.
    if (!isProd) {
      if (/^http:\/\/(\[::1\]|localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
      if (/^http:\/\/(10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[0-1])(\.\d{1,3}){2})(:\d+)?$/.test(origin)) return cb(null, true);
    }

    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
// Registration includes a base64-encoded payment proof data URL.
// Base64 overhead can push an ~8MB image beyond the default 10MB JSON limit.
app.use(express.json({ limit: '15mb' }));

// Serve uploaded assets (local dev / self-hosted)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

let migrationReady = false;
let migrationError = null;

function requireMigrationReady(_req, res, next) {
  if (migrationReady) return next();
  if (migrationError) {
    return res.status(503).json({
      success: false,
      message: 'API database migration failed. Check server logs and database connection, then restart the API.',
      error: migrationError,
    });
  }
  return res.status(503).json({
    success: false,
    message: 'API is starting up. Please try again in a moment.',
  });
}

app.get('/api/health', async (_req, res) => {
  let dbOk = false;
  let dbError = null;

  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch (err) {
    dbError = {
      code: err?.code,
      message: String(err?.message || ''),
    };
  }

  res.json({
    ok: true,
    db: { ok: dbOk, error: dbError },
    migration: { ok: migrationReady, error: migrationError },
  });
});

app.post('/api/uploads/payment-proof', authMiddleware, requireRole(['member']), async (req, res) => {
  const body = req.body || {};
  const dataUrl = String(body.dataUrl || '');

  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ success: false, message: 'Invalid image format. Use a PNG/JPG/WebP data URL.' });
  }

  const mime = match[1];
  const base64 = match[3];
  const buffer = Buffer.from(base64, 'base64');

  const maxBytes = 8 * 1024 * 1024; // 8MB
  if (!buffer.length || buffer.length > maxBytes) {
    return res.status(400).json({ success: false, message: 'Image is required and must be <= 8MB.' });
  }

  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const dir = path.join(__dirname, 'uploads', 'payment-proofs');
  await fs.mkdir(dir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);

  return res.status(201).json({ success: true, url: `/uploads/payment-proofs/${filename}` });
});

app.post('/api/uploads/team-profile', authMiddleware, requireRole(['member']), async (req, res) => {
  const body = req.body || {};
  const dataUrl = String(body.dataUrl || '');

  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp)|application\/pdf);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ success: false, message: 'Invalid file format. Use PNG/JPG/WebP/PDF data URL.' });
  }

  const mime = match[1];
  const base64 = match[3];
  const buffer = Buffer.from(base64, 'base64');

  const maxBytes = 8 * 1024 * 1024; // 8MB
  if (!buffer.length || buffer.length > maxBytes) {
    return res.status(400).json({ success: false, message: 'File is required and must be <= 8MB.' });
  }

  const ext = mime === 'image/png'
    ? 'png'
    : mime === 'image/webp'
      ? 'webp'
      : mime === 'application/pdf'
        ? 'pdf'
        : 'jpg';
  const dir = path.join(__dirname, 'uploads', 'team-profiles');
  await fs.mkdir(dir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);

  return res.status(201).json({ success: true, url: `/uploads/team-profiles/${filename}` });
});

app.post('/api/uploads/announcement-image', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), async (req, res) => {
  const body = req.body || {};
  const dataUrl = String(body.dataUrl || '');

  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ success: false, message: 'Invalid image format. Use a PNG/JPG/WebP data URL.' });
  }

  const mime = match[1];
  const base64 = match[3];
  const buffer = Buffer.from(base64, 'base64');

  const maxBytes = 8 * 1024 * 1024;
  if (!buffer.length || buffer.length > maxBytes) {
    return res.status(400).json({ success: false, message: 'Image is required and must be <= 8MB.' });
  }

  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const dir = path.join(__dirname, 'uploads', 'announcement-images');
  await fs.mkdir(dir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);

  return res.status(201).json({ success: true, url: `/uploads/announcement-images/${filename}` });
});

app.post('/api/auth/register', requireMigrationReady, registerLimiter, register);
app.post('/api/auth/login', requireMigrationReady, loginLimiter, login);
app.post('/api/auth/verify-password', requireMigrationReady, verifyLimiter, authMiddleware, verifyCurrentPassword);
app.post('/api/auth/logout', authMiddleware, logout);
app.post('/api/auth/renew-lookup', requireMigrationReady, registerLimiter, renewLookup);
app.post('/api/auth/create-admin', authMiddleware, requireRole(['super_admin']), createAdmin);

app.get('/api/me', authMiddleware, getMe);
app.put('/api/me', authMiddleware, updateMe);

app.get('/api/members', requireMigrationReady, authMiddleware, listMembers);
app.get('/api/memberships', requireMigrationReady, authMiddleware, listMembers);
app.post('/api/members', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), createMember);
app.post('/api/memberships', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), createMember);
app.put('/api/members/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), updateMember);
app.put('/api/memberships/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), updateMember);
app.post('/api/members/:id/status', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), changeMemberStatus);
app.post('/api/memberships/:id/status', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), changeMemberStatus);
app.get('/api/members/:id/status-logs', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), listMemberStatusLogs);
app.get('/api/memberships/:id/status-logs', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), listMemberStatusLogs);
app.get('/api/members/:id/details', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), getMemberDetails);
app.get('/api/memberships/:id/details', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), getMemberDetails);
app.delete('/api/members/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), deleteMember);
app.delete('/api/memberships/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), deleteMember);
app.post('/api/members/:id/resend-approval-email', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), resendApprovalEmail);
app.post('/api/memberships/:id/resend-approval-email', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), resendApprovalEmail);
app.post('/api/members/trigger-expiration-check', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin']), triggerExpirationCheck);

// Officers
app.get('/api/officers', requireMigrationReady, authMiddleware, listOfficers);
app.post('/api/officers', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin']), createOfficer);
app.post('/api/officers/assign', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin']), assignOfficer);
app.put('/api/officers/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin']), updateOfficer);
app.delete('/api/officers/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin']), deleteOfficer);

// Events
app.get('/api/events', requireMigrationReady, authMiddleware, listEvents);
app.post('/api/events', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), createEvent);
app.put('/api/events/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), updateEvent);
app.delete('/api/events/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin']), deleteEvent);
app.post('/api/events/:id/register', requireMigrationReady, authMiddleware, requireRole(['member']), registerForEvent);
app.post('/api/events/:id/payment', requireMigrationReady, authMiddleware, requireRole(['member']), (req, res) => {
  req.body = { ...(req.body || {}), eventId: req.params.id };
  return createPayment(req, res);
});
app.get('/api/events/:id/registrations', requireMigrationReady, authMiddleware, listEventRegistrations);
app.get('/api/events/registrations/my', requireMigrationReady, authMiddleware, requireRole(['member']), listMyRegistrations);
app.put('/api/events/registrations/:id/approval', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), approveEventRegistration);

// Announcements
app.get('/api/announcements', authMiddleware, listAnnouncements);
app.post('/api/announcements', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), createAnnouncement);
app.put('/api/announcements/:id', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), updateAnnouncement);
app.delete('/api/announcements/:id', authMiddleware, requireRole(['super_admin', 'admin']), deleteAnnouncement);

// Announcement interactions (comments + likes)
app.get('/api/announcements/:id/comments', authMiddleware, listAnnouncementComments);
app.post('/api/announcements/:id/comments', authMiddleware, createAnnouncementComment);
app.delete('/api/announcements/:id/comments/:commentId', authMiddleware, deleteAnnouncementComment);
app.get('/api/announcements/:id/likes', authMiddleware, getAnnouncementLikes);
app.post('/api/announcements/:id/likes', authMiddleware, setAnnouncementLike);

// Partners
app.get('/api/partners', requireMigrationReady, authMiddleware, listPartners);
app.post('/api/partners', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), createPartner);
app.put('/api/partners/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), updatePartner);
app.delete('/api/partners/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin']), deletePartner);
app.get('/api/partners/:id/contributions', requireMigrationReady, authMiddleware, listPartnerContributions);
app.post('/api/partners/:id/contributions', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), createPartnerContribution);
app.delete('/api/partners/contributions/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), deletePartnerContribution);

// Payments
app.get('/api/payments', requireMigrationReady, authMiddleware, listPayments);
app.post('/api/payments', requireMigrationReady, authMiddleware, requireRole(['member']), createPayment);
app.put('/api/payments/:id/verify', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), verifyPayment);

// Elections
app.get('/api/elections', requireMigrationReady, authMiddleware, listElections);
app.get('/api/elections/:id', requireMigrationReady, authMiddleware, getElectionDetails);
app.post('/api/elections', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), createElection);
app.put('/api/elections/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), updateElection);
app.post('/api/elections/:id/candidates', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), addCandidate);
app.put('/api/elections/:id/candidates/:candidateId', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), updateCandidate);
app.post('/api/elections/:id/candidates/:candidateId/winner', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), markWinner);
app.delete('/api/elections/:id/candidates/:candidateId', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), deleteCandidate);
app.delete('/api/elections/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), deleteElection);
app.get('/api/elections/:id/voted', requireMigrationReady, authMiddleware, requireRole(['member']), checkVotedStatus);
app.post('/api/elections/:id/vote', requireMigrationReady, authMiddleware, requireRole(['member']), castVote);

// Community Forum
app.get('/api/forum/posts', requireMigrationReady, authMiddleware, listPosts);
app.post('/api/forum/posts', requireMigrationReady, authMiddleware, createPost);
app.put('/api/forum/posts/:id', requireMigrationReady, authMiddleware, updatePost);
app.delete('/api/forum/posts/:id', requireMigrationReady, authMiddleware, requireRole(['super_admin', 'admin', 'officer']), deletePost);
app.get('/api/forum/posts/:id/comments', requireMigrationReady, authMiddleware, listComments);
app.post('/api/forum/posts/:id/comments', requireMigrationReady, authMiddleware, addComment);
app.post('/api/forum/posts/:id/like', requireMigrationReady, authMiddleware, setLike);

app.post('/api/uploads/forum-video', authMiddleware, express.raw({ type: '*/*', limit: '1024mb' }), async (req, res) => {
  const contentType = String(req.headers['content-type'] || 'application/octet-stream').trim();
  const originalFilename = req.headers['x-filename'] || 'video.mp4';
  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  
  if (!buffer.length) {
    return res.status(400).json({ success: false, message: 'Video upload body is empty.' });
  }

  const dir = require('node:path').join(__dirname, 'uploads', 'forum-videos');
  await require('node:fs/promises').mkdir(dir, { recursive: true });

  const ext = contentType === 'video/webm' ? 'webm' : 'mp4';
  const filename = `${Date.now()}-${require('node:crypto').randomBytes(8).toString('hex')}.${ext}`;
  
  await require('node:fs/promises').writeFile(require('node:path').join(dir, filename), buffer);

  return res.status(201).json({ success: true, url: `/uploads/forum-videos/${filename}` });
});

// Institutional participants upload/list
app.get('/api/institution-members', authMiddleware, listInstitutionMembers);
app.post('/api/institution-members/bulk', authMiddleware, requireRole(['member']), bulkCreateInstitutionMembers);
app.put('/api/institution-members/:id/approval', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), approveInstitutionMember);

  app.get('/api/reports/dashboard', authMiddleware, requireRole(['super_admin', 'admin', 'officer', 'member']), getDashboardReport);
  app.get('/api/reports/elections/:id', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), getElectionReport);
  app.get('/api/reports/partners/contributions', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), getPartnerContributionsReport);

// SMTP test (admin/super_admin only)
app.post('/api/email-test', authMiddleware, requireRole(['super_admin', 'admin']), sendSmtpTest);

// Live Events
app.get('/api/live-events', authMiddleware, listLiveEvents);
app.get('/api/live-sessions', authMiddleware, listLiveEvents);
app.post('/api/live-events/validate-room-code', authMiddleware, validateLiveEventRoomCode);
app.post('/api/live-sessions/validate-room-code', authMiddleware, validateLiveEventRoomCode);
app.get('/api/live-events/:id', authMiddleware, getLiveEventById);
app.get('/api/live-sessions/:id', authMiddleware, getLiveEventById);
app.put(
  '/api/live-events/:id/recording',
  authMiddleware,
  requireRole(['super_admin', 'admin', 'officer']),
  express.raw({ type: '*/*', limit: '1024mb' }),
  uploadLiveEventRecording
);
app.get('/api/live-events/:id/recording/download', authMiddleware, downloadLiveEventRecording);
app.post('/api/live-events', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), createLiveEvent);
app.post('/api/live-sessions', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), createLiveEvent);
app.put('/api/live-events/:id', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), updateLiveEvent);
app.put('/api/live-sessions/:id', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), updateLiveEvent);
app.delete('/api/live-events/:id', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), deleteLiveEvent);
app.delete('/api/live-sessions/:id', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), deleteLiveEvent);
app.post('/api/live-events/:id/start', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), startLiveEvent);
app.post('/api/live-sessions/:id/start', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), startLiveEvent);
app.post('/api/live-events/:id/end', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), endLiveEvent);
app.post('/api/live-sessions/:id/end', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), endLiveEvent);
app.post('/api/live-events/:id/cancel', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), cancelLiveEvent);
app.post('/api/live-sessions/:id/cancel', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), cancelLiveEvent);
app.post('/api/live-events/:id/join', authMiddleware, joinLiveEvent);
app.post('/api/live-sessions/:id/join', authMiddleware, joinLiveEvent);
app.post('/api/live-events/:id/leave', authMiddleware, leaveLiveEvent);
app.get('/api/live-events/:id/participants', authMiddleware, listLiveEventParticipants);
app.put('/api/live-events/:id/participants/:userId', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), updateLiveEventParticipant);
app.put('/api/live-events/:id/permissions', authMiddleware, requireRole(['super_admin', 'admin', 'officer']), updateLiveEventPermissions);
app.get('/api/live-events/:id/counts', authMiddleware, getLiveEventCounts);
app.get('/api/live-events/:id/chat', authMiddleware, listLiveEventChatMessages);
app.post('/api/live-events/:id/chat', authMiddleware, createLiveEventChatMessage);
app.get('/api/events/:id/live-sessions', authMiddleware, listLiveEventsByEvent);

// Audit logs
app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);

  if (isDbError(err)) {
    return res.status(503).json({ success: false, message: getDbUnavailableMessage(err) });
  }

  res.status(500).json({ success: false, message: 'Server error.' });
});

const port = Number(process.env.PORT || 3000);
const httpServer = http.createServer(app);
attachLiveRealtime(httpServer);

httpServer.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(
      `API failed to start: port ${port} is already in use.\n` +
        `- Stop the process using port ${port}, then rerun.\n` +
        `- Or set a different port: PORT=3001 node server/index.js`
    );
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.error('HTTP server error:', err);
  process.exitCode = 1;
});

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/api`);
});

// Periodic cleanup of expired sessions
setInterval(async () => {
  try {
    await pool.execute('DELETE FROM sessions WHERE expires_at <= NOW()');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Session cleanup failed:', err);
  }
}, 60 * 60 * 1000);

// Run membership expiration check every 24 hours
setInterval(async () => {
  try {
    await checkExpiringMemberships();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Membership expiration check failed:', err);
  }
}, 24 * 60 * 60 * 1000);

// Run initial check 10 seconds after startup
setTimeout(async () => {
  try {
    await checkExpiringMemberships();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Initial membership expiration check failed:', err);
  }
}, 10 * 1000);

// Cleanup expired live session recordings (15-day retention after upload)
setInterval(async () => {
  try {
    await cleanupExpiredLiveEventRecordings();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Recording cleanup failed:', err);
  }
}, 60 * 60 * 1000);

// Retry failed approval emails every 5 minutes when SMTP recovers.
let approvalRetryRunning = false;
setInterval(async () => {
  if (approvalRetryRunning) return;
  approvalRetryRunning = true;
  try {
    await resendFailedApprovalEmails({ limit: 25 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Approval email retry failed:', err);
  } finally {
    approvalRetryRunning = false;
  }
}, 5 * 60 * 1000);

// Run DB migration in the background so the API can still start and report useful errors
// when MySQL is down/misconfigured (instead of failing to listen at all).
migrate()
  .then(() => {
    migrationReady = true;
  })
  .catch((err) => {
    migrationReady = false;
    migrationError = {
      code: err?.code,
      message: String(err?.message || ''),
    };
    // eslint-disable-next-line no-console
    console.error('Migration failed:', err);
  });

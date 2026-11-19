import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const dbHost = process.env.DB_HOST || '127.0.0.1';
const pool = mysql.createPool({
  host: dbHost,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'psits_web_system',
  ssl: dbHost.includes('tidbcloud')
    ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    : undefined,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

const API_BASE = (process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');

function hashScrypt(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `s2:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function floorSec(date) {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

function toYmdLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toIsoOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function apiRequest(route, { token = null, method = 'GET', body = undefined } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${route}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { rawText: text };
  }
  return { status: res.status, data };
}

function assertEventWinnersSummary(payload) {
  assert.ok(payload && typeof payload === 'object', 'Response body must be an object');
  assert.ok(payload.summary && typeof payload.summary === 'object', 'summary object required');
  assert.ok(Array.isArray(payload.events), 'events array required');
  assert.ok(Array.isArray(payload.rows), 'rows array required');

  const { summary, events, rows } = payload;
  const expectedTotalEvents = events.length;
  const expectedWithWinners = events.filter((e) => e.hasWinners).length;
  const expectedWithoutWinners = events.filter((e) => !e.hasWinners).length;
  const expectedTotalEntries = events.reduce((acc, e) => acc + Number(e.winnerCount || 0), 0);
  const expectedTotalPoints = rows.reduce((acc, r) => acc + Number(r.points || 0), 0);

  assert.equal(summary.totalEvents, expectedTotalEvents, 'summary.totalEvents mismatch');
  assert.equal(summary.eventsWithWinners, expectedWithWinners, 'summary.eventsWithWinners mismatch');
  assert.equal(summary.eventsWithoutWinners, expectedWithoutWinners, 'summary.eventsWithoutWinners mismatch');
  assert.equal(summary.totalWinnerEntries, expectedTotalEntries, 'summary.totalWinnerEntries mismatch');
  assert.equal(summary.totalPointsAwarded, expectedTotalPoints, 'summary.totalPointsAwarded mismatch');
}

function assertAttendanceSummary(payload) {
  assert.ok(payload && typeof payload === 'object', 'Response body must be an object');
  assert.ok(payload.summary && typeof payload.summary === 'object', 'summary object required');
  assert.ok(Array.isArray(payload.events), 'events array required');
  assert.ok(Array.isArray(payload.records), 'records array required');

  const { summary, records } = payload;
  assert.equal(summary.totalRecords, records.length, 'summary.totalRecords mismatch');
  assert.equal(
    summary.checkedInCount,
    records.filter((r) => Boolean(r.isCheckedIn)).length,
    'summary.checkedInCount mismatch'
  );
  assert.equal(
    summary.timedOutCount,
    records.filter((r) => r.attendanceStatus === 'timed_out').length,
    'summary.timedOutCount mismatch'
  );
  assert.equal(
    summary.inVenueCount,
    records.filter((r) => r.attendanceStatus === 'in_venue').length,
    'summary.inVenueCount mismatch'
  );
  assert.equal(
    summary.notTimedOutCount,
    records.filter((r) => r.attendanceStatus === 'not_timed_out').length,
    'summary.notTimedOutCount mismatch'
  );
  assert.equal(
    summary.notArrivedCount,
    records.filter((r) => r.attendanceStatus === 'not_arrived').length,
    'summary.notArrivedCount mismatch'
  );
  assert.equal(
    summary.lateCount,
    records.filter((r) => Boolean(r.isLate)).length,
    'summary.lateCount mismatch'
  );
  assert.equal(
    summary.leftEarlyCount,
    records.filter((r) => Boolean(r.leftEarly)).length,
    'summary.leftEarlyCount mismatch'
  );
}

async function run() {
  const runHex = crypto.randomBytes(4).toString('hex');
  const runId = `${Date.now()}_${runHex}`;
  const prefix = `__e2e_rpt_${runId}__`;

  const tracked = {
    userIds: [],
    tokens: [],
    eventIds: [],
    winnerIds: [],
    regIds: [],
    instMemberIds: [],
  };

  const results = [];
  let fatalError = null;

  async function check(tier, name, fn) {
    try {
      await fn();
      results.push({ tier, name, status: 'PASS' });
      console.log(`PASS [${tier}] ${name}`);
    } catch (err) {
      results.push({ tier, name, status: 'FAIL', error: err?.message || String(err) });
      console.error(`FAIL [${tier}] ${name}\n  -> ${err?.stack || err}`);
    }
  }

  async function seedUser({ key, role, fullName, memberType = 'individual', sector = 'school', sectorDetails = null, occupation = 'Member' }) {
    const username = `e2e_rpt_${runHex}_${key}`.slice(0, 64);
    const email = `${prefix}${key}@e2e.local`;
    const passwordHash = hashScrypt('TestPass@123');

    const [res] = await pool.execute(
      `INSERT INTO users
         (email, username, full_name, password_hash, role, contact_number, sector, sector_details, member_type, occupation, status, terms_accepted)
       VALUES (?, ?, ?, ?, ?, '09170000001', ?, ?, ?, ?, 'active', 1)`,
      [email, username, fullName, passwordHash, role, sector, sectorDetails, memberType, occupation]
    );
    const userId = res.insertId;
    tracked.userIds.push(userId);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.execute(
      `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
      [token, userId, expiresAt]
    );
    tracked.tokens.push(token);

    return { userId, email, username, token };
  }

  async function seedOfficer(userId, position) {
    await pool.execute(
      `INSERT INTO officers (user_id, position, start_date, officer_status)
       VALUES (?, ?, '2026-01-01', 'active')`,
      [userId, position]
    );
  }

  async function seedEvent({ title, eventType = 'seminar', registrationMode = 'individual', status = 'completed', startAt, endAt, location = 'Main Hall', isEsports = 0, esportsGame = null, createdBy = null }) {
    const [res] = await pool.execute(
      `INSERT INTO events
         (title, description, registration_mode, event_type, start_at, end_at, location, status, is_esports, esports_game, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, `${prefix} description`, registrationMode, eventType, floorSec(startAt), endAt ? floorSec(endAt) : null, location, status, isEsports, esportsGame, createdBy]
    );
    tracked.eventIds.push(res.insertId);
    return res.insertId;
  }

  let hasWinnerEventModeCol = false;

  async function seedWinner({ eventId, rankPosition, awardTitle, institutionName, participantName, points, scoreOrNotes = null, eventMode = 'individual', createdBy = null }) {
    const [res] = hasWinnerEventModeCol
      ? await pool.execute(
          `INSERT INTO event_competition_winners
             (event_id, rank_position, award_title, institution_name, participant_name, points, score_or_notes, event_mode, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [eventId, rankPosition, awardTitle, institutionName, participantName, points, scoreOrNotes, eventMode, createdBy]
        )
      : await pool.execute(
          `INSERT INTO event_competition_winners
             (event_id, rank_position, award_title, institution_name, participant_name, points, score_or_notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [eventId, rankPosition, awardTitle, institutionName, participantName, points, scoreOrNotes, createdBy]
        );
    tracked.winnerIds.push(res.insertId);
    return res.insertId;
  }

  async function seedRegistration({ eventId, memberId, status = 'approved', participantCount = 1, isCheckedIn = 0, checkedInCount = 0, checkedInAt = null, checkedOutAt = null }) {
    const [res] = await pool.execute(
      `INSERT INTO event_registrations
         (event_id, member_id, participant_count, checked_in_count, status, is_checked_in, checked_in_at, checked_out_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        memberId,
        participantCount,
        checkedInCount,
        status,
        isCheckedIn,
        checkedInAt ? floorSec(checkedInAt) : null,
        checkedOutAt ? floorSec(checkedOutAt) : null,
      ]
    );
    tracked.regIds.push(res.insertId);
    return res.insertId;
  }

  async function seedInstMember({ instUserId, eventId, fullName, email, position = 'Delegate', status = 'approved', checkedIn = 0, checkedInAt = null, checkedOutAt = null }) {
    const [res] = await pool.execute(
      `INSERT INTO institution_members
         (institution_user_id, event_id, full_name, email, contact_number, position, status, checked_in, checked_in_at, checked_out_at)
       VALUES (?, ?, ?, ?, '09170000002', ?, ?, ?, ?, ?)`,
      [
        instUserId,
        eventId,
        fullName,
        email,
        position,
        status,
        checkedIn,
        checkedInAt ? floorSec(checkedInAt) : null,
        checkedOutAt ? floorSec(checkedOutAt) : null,
      ]
    );
    tracked.instMemberIds.push(res.insertId);
    return res.insertId;
  }

  try {
    console.log(`Starting PSITS Report Module backend/DB/API verification (runId=${runId}, API=${API_BASE})...`);
    await pool.query('SELECT 1');

    const [winModeCols] = await pool.query(`SHOW COLUMNS FROM event_competition_winners LIKE 'event_mode'`);
    hasWinnerEventModeCol = winModeCols.length > 0;
    const [regOutCols] = await pool.query(`SHOW COLUMNS FROM event_registrations LIKE 'checked_out_at'`);
    const [instOutCols] = await pool.query(`SHOW COLUMNS FROM institution_members LIKE 'checked_out_at'`);
    if (regOutCols.length === 0 || instOutCols.length === 0) {
      throw new Error('Schema not migrated: checked_out_at missing on event_registrations or institution_members. Run `npm run api:migrate` or start the backend server first.');
    }

    // 1. Seed Users, Officers & Sessions
    const admin = await seedUser({
      key: 'adm',
      role: 'admin',
      fullName: `${prefix} Admin User`,
      sectorDetails: `${prefix} PSITS Admin`,
      occupation: 'Administrator',
    });
    const officerAllowed = await seedUser({
      key: 'sec',
      role: 'officer',
      fullName: `${prefix} Secretary Officer`,
      sectorDetails: `${prefix} PSITS National`,
      occupation: 'Secretary',
    });
    await seedOfficer(officerAllowed.userId, 'Secretary');

    const officerDenied = await seedUser({
      key: 'prt',
      role: 'officer',
      fullName: `${prefix} Protocol Officer`,
      sectorDetails: `${prefix} PSITS National`,
      occupation: 'Protocol Officer',
    });
    await seedOfficer(officerDenied.userId, 'Protocol Officer');

    const memberUser = await seedUser({
      key: 'mem1',
      role: 'member',
      fullName: `${prefix} Individual Member One`,
      memberType: 'individual',
      sector: 'school',
      sectorDetails: `${prefix} School Alpha`,
      occupation: 'Student',
    });
    const memberUser2 = await seedUser({
      key: 'mem2',
      role: 'member',
      fullName: `${prefix} Individual Member Two`,
      memberType: 'individual',
      sector: 'school',
      sectorDetails: `${prefix} School Gamma`,
      occupation: 'Developer',
    });
    const instUser = await seedUser({
      key: 'inst1',
      role: 'member',
      fullName: `${prefix} Inst Beta`,
      memberType: 'institution',
      sector: 'institution',
      sectorDetails: `${prefix} Inst Beta`,
      occupation: 'Institution',
    });
    const instUser2 = await seedUser({
      key: 'inst2',
      role: 'member',
      fullName: `${prefix} Inst Delta`,
      memberType: 'institution',
      sector: 'institution',
      sectorDetails: `${prefix} Inst Delta`,
      occupation: 'Institution',
    });

    // 2. Seed Events & Winners (deterministic past dates for startDate/endDate tests)
    const nowSec = floorSec(new Date());
    const nowMs = nowSec.getTime();

    const evtWithWinnersStart = new Date(2025, 5, 15, 9, 0, 0);
    const evtWithWinnersEnd = new Date(2025, 5, 15, 17, 0, 0);
    const evtWithWinnersId = await seedEvent({
      title: `${prefix} Coding Olympiad`,
      eventType: 'competition',
      registrationMode: 'individual',
      status: 'completed',
      startAt: evtWithWinnersStart,
      endAt: evtWithWinnersEnd,
      createdBy: admin.userId,
    });
    const w1Id = await seedWinner({
      eventId: evtWithWinnersId,
      rankPosition: 1,
      awardTitle: 'Champion',
      institutionName: `${prefix} School Alpha`,
      participantName: `${prefix} Winner Alice`,
      points: 10,
      scoreOrNotes: '98.5 pts',
      eventMode: 'individual',
      createdBy: admin.userId,
    });
    const w2Id = await seedWinner({
      eventId: evtWithWinnersId,
      rankPosition: 2,
      awardTitle: '1st Runner Up',
      institutionName: `${prefix} Inst Beta`,
      participantName: `${prefix} Winner Bob`,
      points: 7,
      scoreOrNotes: '92.0 pts',
      eventMode: 'individual',
      createdBy: admin.userId,
    });

    // Seed participation rows on evtWithWinners (including is_checked_in=1 with checked_in_count=0 edge case)
    await seedRegistration({
      eventId: evtWithWinnersId,
      memberId: memberUser.userId,
      status: 'approved',
      participantCount: 1,
      isCheckedIn: 1,
      checkedInCount: 0,
      checkedInAt: new Date(evtWithWinnersStart.getTime() + 5 * 60000),
      checkedOutAt: new Date(evtWithWinnersStart.getTime() + 120 * 60000),
    });
    await seedInstMember({
      instUserId: instUser.userId,
      eventId: evtWithWinnersId,
      fullName: `${prefix} Inst Olympiad CheckedIn`,
      email: `${prefix}inst_oly@e2e.local`,
      status: 'approved',
      checkedIn: 1,
      checkedInAt: new Date(evtWithWinnersStart.getTime() + 10 * 60000),
      checkedOutAt: new Date(evtWithWinnersStart.getTime() + 120 * 60000),
    });

    const evtTiedStart = new Date(2025, 7, 20, 9, 0, 0);
    const evtTiedEnd = new Date(2025, 7, 20, 17, 0, 0);
    const evtTiedWinnersId = await seedEvent({
      title: `${prefix} Hackathon Tie`,
      eventType: 'competition',
      registrationMode: 'team',
      status: 'completed',
      startAt: evtTiedStart,
      endAt: evtTiedEnd,
      isEsports: 1,
      esportsGame: 'Valorant',
      createdBy: admin.userId,
    });
    await seedWinner({
      eventId: evtTiedWinnersId,
      rankPosition: 1,
      awardTitle: 'Co-Champion Alpha',
      institutionName: `${prefix} School Alpha`,
      participantName: `${prefix} Team Alpha`,
      points: 10,
      scoreOrNotes: 'Tiebreak 1',
      eventMode: 'team',
      createdBy: admin.userId,
    });
    await seedWinner({
      eventId: evtTiedWinnersId,
      rankPosition: 1,
      awardTitle: 'Co-Champion Beta',
      institutionName: `${prefix} Inst Beta`,
      participantName: `${prefix} Team Beta`,
      points: 10,
      scoreOrNotes: 'Tiebreak 2',
      eventMode: 'team',
      createdBy: admin.userId,
    });

    const evtNoWinStart = new Date(2025, 9, 10, 13, 0, 0);
    const evtNoWinEnd = new Date(2025, 9, 10, 16, 0, 0);
    const evtWithoutWinnersId = await seedEvent({
      title: `${prefix} Tech Seminar No Winners`,
      eventType: 'seminar',
      registrationMode: 'individual',
      status: 'completed',
      startAt: evtNoWinStart,
      endAt: evtNoWinEnd,
      createdBy: admin.userId,
    });

    const evtDraftId = await seedEvent({
      title: `${prefix} Draft Competition`,
      eventType: 'competition',
      registrationMode: 'individual',
      status: 'draft',
      startAt: new Date(2026, 11, 25, 9, 0, 0),
      endAt: new Date(2026, 11, 25, 17, 0, 0),
      createdBy: admin.userId,
    });
    await seedWinner({
      eventId: evtDraftId,
      rankPosition: 1,
      awardTitle: 'Draft Winner',
      institutionName: `${prefix} School Alpha`,
      participantName: `${prefix} Draft Winner Person`,
      points: 15,
      createdBy: admin.userId,
    });

    const evtCancelledId = await seedEvent({
      title: `${prefix} Cancelled Seminar`,
      eventType: 'seminar',
      registrationMode: 'individual',
      status: 'cancelled',
      startAt: new Date(2026, 11, 28, 9, 0, 0),
      endAt: new Date(2026, 11, 28, 17, 0, 0),
      createdBy: admin.userId,
    });

    // 3. Seed Ongoing & Past Attendance Events
    const ongoingStart = new Date(nowMs - 30 * 60000);
    const ongoingEnd = new Date(nowMs + 90 * 60000);
    const evtOngoingId = await seedEvent({
      title: `${prefix} Live Workshop`,
      eventType: 'seminar',
      registrationMode: 'individual',
      status: 'ongoing',
      startAt: ongoingStart,
      endAt: ongoingEnd,
      createdBy: admin.userId,
    });
    const regOngoingLiveId = await seedRegistration({
      eventId: evtOngoingId,
      memberId: memberUser.userId,
      status: 'approved',
      isCheckedIn: 0,
      checkedInCount: 0,
    });
    const instOngoingInVenueId = await seedInstMember({
      instUserId: instUser.userId,
      eventId: evtOngoingId,
      fullName: `${prefix} Inst LiveInVenue`,
      email: `${prefix}live_in@e2e.local`,
      status: 'approved',
      checkedIn: 1,
      checkedInAt: new Date(nowMs - 10 * 60000),
      checkedOutAt: null,
    });
    const instOngoingNotArrivedId = await seedInstMember({
      instUserId: instUser2.userId,
      eventId: evtOngoingId,
      fullName: `${prefix} Inst LiveNotArrived`,
      email: `${prefix}live_na@e2e.local`,
      status: 'approved',
      checkedIn: 0,
    });

    const pastStart = new Date(nowMs - 5 * 3600000);
    const pastEnd = new Date(nowMs - 2 * 3600000);
    const evtPastAttendanceId = await seedEvent({
      title: `${prefix} Past Attendance Audit`,
      eventType: 'seminar',
      registrationMode: 'individual',
      status: 'completed',
      startAt: pastStart,
      endAt: pastEnd,
      createdBy: admin.userId,
    });
    const regPastNotTimedOutId = await seedRegistration({
      eventId: evtPastAttendanceId,
      memberId: memberUser.userId,
      status: 'approved',
      isCheckedIn: 1,
      checkedInCount: 1,
      checkedInAt: new Date(pastStart.getTime() + 5 * 60000),
      checkedOutAt: null,
    });
    const regPastRejectedId = await seedRegistration({
      eventId: evtPastAttendanceId,
      memberId: memberUser2.userId,
      status: 'rejected',
      isCheckedIn: 0,
      checkedInCount: 0,
    });
    const instPastTimedOutId = await seedInstMember({
      instUserId: instUser.userId,
      eventId: evtPastAttendanceId,
      fullName: `${prefix} Inst PastTimedOut`,
      email: `${prefix}past_to@e2e.local`,
      status: 'approved',
      checkedIn: 1,
      checkedInAt: new Date(pastStart.getTime() + 20 * 60000),
      checkedOutAt: new Date(pastEnd.getTime() - 30 * 60000),
    });
    const instPastNotArrivedId = await seedInstMember({
      instUserId: instUser2.userId,
      eventId: evtPastAttendanceId,
      fullName: `${prefix} Inst PastNotArrived`,
      email: `${prefix}past_na@e2e.local`,
      status: 'approved',
      checkedIn: 0,
    });
    const instPastPendingId = await seedInstMember({
      instUserId: instUser2.userId,
      eventId: evtPastAttendanceId,
      fullName: `${prefix} Inst PastPending`,
      email: `${prefix}past_pend@e2e.local`,
      status: 'pending',
      checkedIn: 0,
    });

    // -------------------------------------------------------------------------
    // TIER 1: Auth Smoke & RBAC + Core Endpoint Contracts
    // -------------------------------------------------------------------------
    await check('Tier 1', 'POST /api/auth/login smoke check works for seeded admin', async () => {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email: admin.email, password: 'TestPass@123' },
      });
      assert.equal(res.status, 200, `Expected 200 login, got ${res.status}: ${JSON.stringify(res.data)}`);
      assert.equal(res.data?.success, true);
      assert.ok(typeof res.data?.token === 'string' && res.data.token.length === 64, 'Expected 64-char session token');
      tracked.tokens.push(res.data.token);
    });

    const rbacRoutes = [
      '/api/reports/event-winners',
      '/api/reports/attendance',
      '/api/reports/event-participation',
    ];
    for (const route of rbacRoutes) {
      await check('Tier 1', `RBAC ${route}: unauthenticated -> 401`, async () => {
        const res = await apiRequest(route);
        assert.equal(res.status, 401, `Expected 401 for unauthenticated ${route}, got ${res.status}`);
      });
      await check('Tier 1', `RBAC ${route}: member -> 403`, async () => {
        const res = await apiRequest(route, { token: memberUser.token });
        assert.equal(res.status, 403, `Expected 403 for member on ${route}, got ${res.status}`);
      });
      await check('Tier 1', `RBAC ${route}: disallowed officer (Protocol Officer) -> 403`, async () => {
        const res = await apiRequest(route, { token: officerDenied.token });
        assert.equal(res.status, 403, `Expected 403 for Protocol Officer on ${route}, got ${res.status}`);
      });
      await check('Tier 1', `RBAC ${route}: admin & Secretary officer -> 200`, async () => {
        const resAdmin = await apiRequest(route, { token: admin.token });
        assert.equal(resAdmin.status, 200, `Expected 200 for admin on ${route}, got ${resAdmin.status}`);
        const resSec = await apiRequest(route, { token: officerAllowed.token });
        assert.equal(resSec.status, 200, `Expected 200 for Secretary on ${route}, got ${resSec.status}`);
      });
    }

    await check('Tier 1', 'R1: GET /api/reports/event-winners returns events with winners, tied ranks, and without winners + summary math', async () => {
      const res = await apiRequest(`/api/reports/event-winners?search=${encodeURIComponent(prefix)}`, {
        token: admin.token,
      });
      assert.equal(res.status, 200);
      assertEventWinnersSummary(res.data);

      const { events, rows, summary } = res.data;
      const eventIds = events.map((e) => Number(e.eventId));
      assert.ok(eventIds.includes(evtWithWinnersId), 'evtWithWinners should be included');
      assert.ok(eventIds.includes(evtTiedWinnersId), 'evtTiedWinners should be included');
      assert.ok(eventIds.includes(evtWithoutWinnersId), 'evtWithoutWinners should be included');
      assert.ok(!eventIds.includes(evtDraftId), 'evtDraft must be excluded by default');

      const withWin = events.find((e) => Number(e.eventId) === evtWithWinnersId);
      assert.equal(withWin.hasWinners, true);
      assert.equal(withWin.winnerCount, 2);
      assert.equal(withWin.winners.length, 2);
      const firstWin = withWin.winners.find((w) => Number(w.winnerId) === w1Id);
      const secondWin = withWin.winners.find((w) => Number(w.winnerId) === w2Id);
      assert.equal(firstWin.rankPosition, 1);
      assert.equal(firstWin.points, 10);
      assert.equal(firstWin.participantName, `${prefix} Winner Alice`);
      assert.equal(firstWin.institutionName, `${prefix} School Alpha`);
      assert.equal(firstWin.awardTitle, 'Champion');
      assert.equal(secondWin.rankPosition, 2);
      assert.equal(secondWin.points, 7);

      const tiedWin = events.find((e) => Number(e.eventId) === evtTiedWinnersId);
      assert.equal(tiedWin.hasWinners, true);
      assert.equal(tiedWin.winnerCount, 2);
      assert.ok(tiedWin.winners.every((w) => w.rankPosition === 1 && w.points === 10), 'Both tied Rank 1 winners preserved');

      const noWin = events.find((e) => Number(e.eventId) === evtWithoutWinnersId);
      assert.equal(noWin.hasWinners, false);
      assert.equal(noWin.winnerCount, 0);
      assert.deepEqual(noWin.winners, []);

      const noWinRows = rows.filter((r) => Number(r.eventId) === evtWithoutWinnersId);
      assert.equal(noWinRows.length, 1, 'Event with 0 winners must emit exactly 1 fallback row');
      assert.equal(noWinRows[0].winnerId, null);
      assert.equal(noWinRows[0].rankPosition, null);
      assert.equal(noWinRows[0].awardTitle, 'No Winners Recorded');
      assert.equal(noWinRows[0].participantName, '—');
      assert.equal(noWinRows[0].institutionName, '—');
      assert.equal(noWinRows[0].points, 0);
      assert.equal(noWinRows[0].scoreOrNotes, null);
      assert.equal(noWinRows[0].awardedAt, null);

      assert.equal(summary.totalWinnerEntries, 4);
      assert.equal(summary.totalPointsAwarded, 37);
    });

    await check('Tier 1', 'R2: GET /api/reports/attendance returns dual-sourced records matching MySQL 1:1', async () => {
      const res = await apiRequest(`/api/reports/attendance?eventId=${evtPastAttendanceId}`, {
        token: admin.token,
      });
      assert.equal(res.status, 200);
      assertAttendanceSummary(res.data);

      const { records } = res.data;
      const keys = records.map((r) => r.participantKey);
      assert.ok(keys.includes(`reg-${regPastNotTimedOutId}`), 'Individual registration included');
      assert.ok(keys.includes(`inst-${instPastTimedOutId}`), 'Institution timed-out member included');
      assert.ok(keys.includes(`inst-${instPastNotArrivedId}`), 'Institution not-arrived member included');
      assert.ok(keys.includes(`inst-${instPastPendingId}`), 'Pending institution member included by default');
      assert.ok(!keys.includes(`reg-${regPastRejectedId}`), 'Rejected registration excluded by default');

      const [dbRegRows] = await pool.execute(
        `SELECT checked_in_at, checked_out_at FROM event_registrations WHERE id = ?`,
        [regPastNotTimedOutId]
      );
      const regRec = records.find((r) => r.participantKey === `reg-${regPastNotTimedOutId}`);
      assert.equal(regRec.sourceType, 'individual');
      assert.equal(regRec.isCheckedIn, true);
      assert.equal(toIsoOrNull(regRec.checkedInAt), toIsoOrNull(dbRegRows[0].checked_in_at));
      assert.equal(regRec.checkedOutAt, null);
      assert.equal(regRec.attendanceStatus, 'not_timed_out');
      assert.equal(regRec.timeOutPlaceholder, 'Not Timed Out');
      assert.equal(regRec.isLate, false);
      assert.equal(regRec.leftEarly, false);
      assert.equal(regRec.durationMinutes, null);

      const [dbInstRows] = await pool.execute(
        `SELECT checked_in_at, checked_out_at FROM institution_members WHERE id = ?`,
        [instPastTimedOutId]
      );
      const instRec = records.find((r) => r.participantKey === `inst-${instPastTimedOutId}`);
      assert.equal(instRec.sourceType, 'institution');
      assert.equal(instRec.isCheckedIn, true);
      assert.equal(toIsoOrNull(instRec.checkedInAt), toIsoOrNull(dbInstRows[0].checked_in_at));
      assert.equal(toIsoOrNull(instRec.checkedOutAt), toIsoOrNull(dbInstRows[0].checked_out_at));
      assert.equal(instRec.attendanceStatus, 'timed_out');
      assert.equal(instRec.timeOutPlaceholder, null);
      assert.equal(instRec.isLate, true);
      assert.equal(instRec.leftEarly, true);
      assert.equal(instRec.durationMinutes, 130);

      const naRec = records.find((r) => r.participantKey === `inst-${instPastNotArrivedId}`);
      assert.equal(naRec.isCheckedIn, false);
      assert.equal(naRec.checkedInAt, null);
      assert.equal(naRec.checkedOutAt, null);
      assert.equal(naRec.attendanceStatus, 'not_arrived');
      assert.equal(naRec.timeOutPlaceholder, '—');
    });

    await check('Tier 1', 'R2 Non-Regression: live capture POST /api/events/:id/attendance/time (time_in -> time_out) updates attendance sheet & report', async () => {
      const pKey = `reg-${regOngoingLiveId}`;

      const timeInRes = await apiRequest(`/api/events/${evtOngoingId}/attendance/time`, {
        method: 'POST',
        token: officerAllowed.token,
        body: { participantKeys: [pKey], action: 'time_in' },
      });
      assert.equal(timeInRes.status, 200, `time_in failed: ${JSON.stringify(timeInRes.data)}`);
      assert.equal(timeInRes.data?.updatedCount, 1);

      const afterInSheet = await apiRequest(`/api/events/${evtOngoingId}/attendance`, { token: officerAllowed.token });
      assert.equal(afterInSheet.status, 200);
      const sheetInRow = afterInSheet.data?.participants?.find((p) => p.participantKey === pKey);
      assert.ok(sheetInRow && sheetInRow.isCheckedIn && sheetInRow.checkedInAt && !sheetInRow.checkedOutAt);

      const afterInReport = await apiRequest(`/api/reports/attendance?eventId=${evtOngoingId}`, { token: officerAllowed.token });
      assert.equal(afterInReport.status, 200);
      assertAttendanceSummary(afterInReport.data);
      const rptInRow = afterInReport.data.records.find((r) => r.participantKey === pKey);
      assert.ok(rptInRow, 'Live time-in participant must appear in attendance report');
      assert.equal(rptInRow.attendanceStatus, 'in_venue');
      assert.equal(rptInRow.timeOutPlaceholder, '—');
      assert.equal(rptInRow.checkedOutAt, null);

      const timeOutRes = await apiRequest(`/api/events/${evtOngoingId}/attendance/time`, {
        method: 'POST',
        token: officerAllowed.token,
        body: { participantKeys: [pKey], action: 'time_out' },
      });
      assert.equal(timeOutRes.status, 200, `time_out failed: ${JSON.stringify(timeOutRes.data)}`);
      assert.equal(timeOutRes.data?.updatedCount, 1);

      const [dbRows] = await pool.execute(
        `SELECT is_checked_in, checked_in_at, checked_out_at FROM event_registrations WHERE id = ?`,
        [regOngoingLiveId]
      );
      assert.equal(dbRows[0].is_checked_in, 1);
      assert.ok(dbRows[0].checked_in_at, 'DB checked_in_at must be populated');
      assert.ok(dbRows[0].checked_out_at, 'DB checked_out_at must be populated');

      const afterOutReport = await apiRequest(`/api/reports/attendance?eventId=${evtOngoingId}`, { token: officerAllowed.token });
      assert.equal(afterOutReport.status, 200);
      assertAttendanceSummary(afterOutReport.data);
      const rptOutRow = afterOutReport.data.records.find((r) => r.participantKey === pKey);
      assert.equal(rptOutRow.attendanceStatus, 'timed_out');
      assert.equal(rptOutRow.timeOutPlaceholder, null);
      assert.equal(toIsoOrNull(rptOutRow.checkedInAt), toIsoOrNull(dbRows[0].checked_in_at));
      assert.equal(toIsoOrNull(rptOutRow.checkedOutAt), toIsoOrNull(dbRows[0].checked_out_at));
    });

    // -------------------------------------------------------------------------
    // TIER 2: Boundary & Corner Cases (filters, validation, defaults)
    // -------------------------------------------------------------------------
    await check('Tier 2', 'R1: Invalid eventId (abc, 0, -1) returns 400 on /api/reports/event-winners', async () => {
      for (const badId of ['abc', '0', '-1']) {
        const res = await apiRequest(`/api/reports/event-winners?eventId=${badId}`, { token: admin.token });
        assert.equal(res.status, 400, `Expected 400 for eventId=${badId}, got ${res.status}`);
      }
    });

    await check('Tier 2', 'R2: Invalid eventId (abc, 0, -5) returns 400 on /api/reports/attendance', async () => {
      for (const badId of ['abc', '0', '-5']) {
        const res = await apiRequest(`/api/reports/attendance?eventId=${badId}`, { token: admin.token });
        assert.equal(res.status, 400, `Expected 400 for eventId=${badId}, got ${res.status}`);
      }
    });

    await check('Tier 2', 'R1: Default excludes draft; status=all_including_draft and status=draft include evtDraft', async () => {
      const defRes = await apiRequest(`/api/reports/event-winners?search=${encodeURIComponent(prefix)}`, { token: admin.token });
      assert.equal(defRes.status, 200);
      assert.ok(!defRes.data.events.some((e) => Number(e.eventId) === evtDraftId), 'Default must exclude draft');

      const allRes = await apiRequest(`/api/reports/event-winners?search=${encodeURIComponent(prefix)}&status=all_including_draft`, { token: admin.token });
      assert.equal(allRes.status, 200);
      assertEventWinnersSummary(allRes.data);
      assert.ok(allRes.data.events.some((e) => Number(e.eventId) === evtDraftId), 'all_including_draft must include draft');

      const draftOnlyRes = await apiRequest(`/api/reports/event-winners?search=${encodeURIComponent(prefix)}&status=draft`, { token: admin.token });
      assert.equal(draftOnlyRes.status, 200);
      assertEventWinnersSummary(draftOnlyRes.data);
      assert.equal(draftOnlyRes.data.events.length, 1);
      assert.equal(Number(draftOnlyRes.data.events[0].eventId), evtDraftId);
    });

    await check('Tier 2', 'R1: hasWinners=with_winners & hasWinners=without_winners & eventId filters', async () => {
      const withRes = await apiRequest(`/api/reports/event-winners?search=${encodeURIComponent(prefix)}&hasWinners=with_winners`, { token: admin.token });
      assert.equal(withRes.status, 200);
      assertEventWinnersSummary(withRes.data);
      assert.ok(withRes.data.events.every((e) => e.hasWinners === true && e.winnerCount > 0));
      assert.ok(withRes.data.rows.every((r) => r.winnerId !== null));

      const withoutRes = await apiRequest(`/api/reports/event-winners?search=${encodeURIComponent(prefix)}&hasWinners=without_winners`, { token: admin.token });
      assert.equal(withoutRes.status, 200);
      assertEventWinnersSummary(withoutRes.data);
      assert.ok(withoutRes.data.events.every((e) => e.hasWinners === false && e.winnerCount === 0));
      assert.ok(withoutRes.data.events.some((e) => Number(e.eventId) === evtWithoutWinnersId));

      const singleRes = await apiRequest(`/api/reports/event-winners?eventId=${evtWithoutWinnersId}`, { token: admin.token });
      assert.equal(singleRes.status, 200);
      assertEventWinnersSummary(singleRes.data);
      assert.equal(singleRes.data.events.length, 1);
      assert.equal(singleRes.data.rows.length, 1);
      assert.equal(singleRes.data.rows[0].awardTitle, 'No Winners Recorded');
    });

    await check('Tier 2', 'R1: status, eventType, and startDate/endDate filters on /api/reports/event-winners', async () => {
      const cancelRes = await apiRequest(`/api/reports/event-winners?search=${encodeURIComponent(prefix)}&status=cancelled`, { token: admin.token });
      assert.equal(cancelRes.status, 200);
      assert.ok(cancelRes.data.events.some((e) => Number(e.eventId) === evtCancelledId));
      assert.ok(cancelRes.data.events.every((e) => e.eventStatus === 'cancelled'));

      const compRes = await apiRequest(`/api/reports/event-winners?search=${encodeURIComponent(prefix)}&eventType=competition`, { token: admin.token });
      assert.equal(compRes.status, 200);
      assert.ok(compRes.data.events.every((e) => e.eventType === 'competition'));
      assert.equal(compRes.data.events.length, 2, 'Should match evtWithWinners and evtTiedWinners');

      const ymdFrom = toYmdLocal(new Date(2025, 7, 1));
      const ymdTo = toYmdLocal(new Date(2025, 7, 31));
      const dateRes = await apiRequest(
        `/api/reports/event-winners?search=${encodeURIComponent(prefix)}&startDate=${ymdFrom}&endDate=${ymdTo}`,
        { token: admin.token }
      );
      assert.equal(dateRes.status, 200);
      assertEventWinnersSummary(dateRes.data);
      assert.equal(dateRes.data.events.length, 1);
      assert.equal(Number(dateRes.data.events[0].eventId), evtTiedWinnersId);
    });

    await check('Tier 2', 'R2: All 3 null-timeout states (in_venue, not_timed_out, not_arrived) + registrationStatus filters', async () => {
      const ongoingRes = await apiRequest(`/api/reports/attendance?eventId=${evtOngoingId}`, { token: admin.token });
      assert.equal(ongoingRes.status, 200);
      assertAttendanceSummary(ongoingRes.data);
      const inVenueRec = ongoingRes.data.records.find((r) => r.participantKey === `inst-${instOngoingInVenueId}`);
      const naOngoingRec = ongoingRes.data.records.find((r) => r.participantKey === `inst-${instOngoingNotArrivedId}`);
      assert.equal(inVenueRec.attendanceStatus, 'in_venue');
      assert.equal(inVenueRec.timeOutPlaceholder, '—');
      assert.equal(inVenueRec.isLate, true);
      assert.equal(naOngoingRec.attendanceStatus, 'not_arrived');
      assert.equal(naOngoingRec.timeOutPlaceholder, '—');

      const rejRes = await apiRequest(`/api/reports/attendance?eventId=${evtPastAttendanceId}&registrationStatus=rejected`, { token: admin.token });
      assert.equal(rejRes.status, 200);
      assertAttendanceSummary(rejRes.data);
      assert.equal(rejRes.data.records.length, 1);
      assert.equal(rejRes.data.records[0].participantKey, `reg-${regPastRejectedId}`);
      assert.equal(rejRes.data.records[0].registrationStatus, 'rejected');

      const allRegRes = await apiRequest(`/api/reports/attendance?eventId=${evtPastAttendanceId}&registrationStatus=all`, { token: admin.token });
      assert.equal(allRegRes.status, 200);
      assert.ok(allRegRes.data.records.some((r) => r.participantKey === `reg-${regPastRejectedId}`));
      assert.ok(allRegRes.data.records.some((r) => r.participantKey === `inst-${instPastPendingId}`));

      const pendRes = await apiRequest(`/api/reports/attendance?eventId=${evtPastAttendanceId}&registrationStatus=pending`, { token: admin.token });
      assert.equal(pendRes.status, 200);
      assert.equal(pendRes.data.records.length, 1);
      assert.equal(pendRes.data.records[0].participantKey, `inst-${instPastPendingId}`);

      const appRes = await apiRequest(`/api/reports/attendance?eventId=${evtPastAttendanceId}&registrationStatus=approved`, { token: admin.token });
      assert.equal(appRes.status, 200);
      assert.ok(appRes.data.records.every((r) => r.registrationStatus === 'approved'));
      assert.equal(appRes.data.records.length, 3);
    });

    await check('Tier 2', 'R2: source, institution, attendanceStatus, search, and startDate/endDate filters on /api/reports/attendance', async () => {
      const srcRes = await apiRequest(`/api/reports/attendance?eventId=${evtPastAttendanceId}&source=individual`, { token: admin.token });
      assert.equal(srcRes.status, 200);
      assert.ok(srcRes.data.records.every((r) => r.sourceType === 'individual'));
      assert.equal(srcRes.data.records.length, 1);

      const instFilterRes = await apiRequest(
        `/api/reports/attendance?eventId=${evtPastAttendanceId}&institution=${encodeURIComponent(`${prefix} Inst Beta`)}`,
        { token: admin.token }
      );
      assert.equal(instFilterRes.status, 200);
      assert.equal(instFilterRes.data.records.length, 1);
      assert.equal(instFilterRes.data.records[0].participantKey, `inst-${instPastTimedOutId}`);

      for (const attStatus of ['timed_out', 'not_timed_out', 'not_arrived']) {
        const stRes = await apiRequest(`/api/reports/attendance?eventId=${evtPastAttendanceId}&attendanceStatus=${attStatus}`, { token: admin.token });
        assert.equal(stRes.status, 200);
        assertAttendanceSummary(stRes.data);
        assert.ok(stRes.data.records.length >= 1, `Expected >= 1 record for attendanceStatus=${attStatus}`);
        assert.ok(stRes.data.records.every((r) => r.attendanceStatus === attStatus));
      }

      const inVenueOnly = await apiRequest(`/api/reports/attendance?eventId=${evtOngoingId}&attendanceStatus=in_venue`, { token: admin.token });
      assert.equal(inVenueOnly.status, 200);
      assert.equal(inVenueOnly.data.records.length, 1);
      assert.equal(inVenueOnly.data.records[0].participantKey, `inst-${instOngoingInVenueId}`);

      const searchEmpty = await apiRequest(`/api/reports/attendance?search=${encodeURIComponent(`${prefix}_NO_MATCH_999`)}`, { token: admin.token });
      assert.equal(searchEmpty.status, 200);
      assertAttendanceSummary(searchEmpty.data);
      assert.equal(searchEmpty.data.records.length, 0);

      const pastYmd = toYmdLocal(pastStart);
      const nowYmd = toYmdLocal(new Date());
      const dateRangeRes = await apiRequest(
        `/api/reports/attendance?search=${encodeURIComponent(prefix)}&startDate=${pastYmd}&endDate=${nowYmd}`,
        { token: admin.token }
      );
      assert.equal(dateRangeRes.status, 200);
      assertAttendanceSummary(dateRangeRes.data);
      assert.ok(dateRangeRes.data.records.some((r) => Number(r.eventId) === evtPastAttendanceId));
      assert.ok(!dateRangeRes.data.records.some((r) => Number(r.eventId) === evtWithWinnersId));
    });

    // -------------------------------------------------------------------------
    // TIER 3: Pairwise Filter Combinations & Event Participation Enrichment
    // -------------------------------------------------------------------------
    await check('Tier 3', 'R1 Pairwise: search + status=completed + eventType=competition + hasWinners=with_winners', async () => {
      const res = await apiRequest(
        `/api/reports/event-winners?search=${encodeURIComponent(prefix)}&status=completed&eventType=competition&hasWinners=with_winners`,
        { token: officerAllowed.token }
      );
      assert.equal(res.status, 200);
      assertEventWinnersSummary(res.data);
      assert.equal(res.data.events.length, 2);
      assert.equal(res.data.rows.length, 4);
      assert.equal(res.data.summary.totalPointsAwarded, 37);
    });

    await check('Tier 3', 'R2 Pairwise: eventId + source=institution + attendanceStatus=timed_out + registrationStatus=approved', async () => {
      const res = await apiRequest(
        `/api/reports/attendance?eventId=${evtPastAttendanceId}&source=institution&attendanceStatus=timed_out&registrationStatus=approved`,
        { token: officerAllowed.token }
      );
      assert.equal(res.status, 200);
      assertAttendanceSummary(res.data);
      assert.equal(res.data.records.length, 1);
      assert.equal(res.data.records[0].participantKey, `inst-${instPastTimedOutId}`);
    });

    await check('Tier 3', 'Event Participation enrichment reflects is_checked_in=1 (even if checked_in_count=0) + institution_members.checked_in=1', async () => {
      const res = await apiRequest(
        `/api/reports/event-participation?eventId=${evtWithWinnersId}`,
        { token: admin.token }
      );
      assert.equal(res.status, 200);
      assert.equal(res.data?.success, true);

      const parts = res.data?.participants || [];
      assert.equal(parts.length, 2, `Expected 2 participants on evtWithWinners, got ${parts.length}`);
      assert.ok(parts.every((p) => Boolean(p.is_checked_in)), 'Both individual (is_checked_in=1, checked_in_count=0) and institution (checked_in=1) must report is_checked_in truthy');

      const evtEntry = (res.data?.events || []).find((e) => Number(e.id) === evtWithWinnersId);
      assert.ok(evtEntry, 'evtWithWinners should appear in participation events list');
      assert.equal(Number(evtEntry.total_participants), 2);
      if (evtEntry.checked_in_count !== undefined) {
        assert.equal(Number(evtEntry.checked_in_count), 2);
      }

      const checkedInFilterRes = await apiRequest(
        `/api/reports/event-participation?eventId=${evtWithWinnersId}&status=checked_in`,
        { token: admin.token }
      );
      assert.equal(checkedInFilterRes.status, 200);
      assert.equal((checkedInFilterRes.data?.participants || []).length, 2);
    });

    // -------------------------------------------------------------------------
    // TIER 4: End-to-End Multi-Step Officer Audit Scenarios
    // -------------------------------------------------------------------------
    await check('Tier 4', 'Scenario 1: Officer audits mixed winners/no-winners/tied events and drills down by single eventId', async () => {
      const allRes = await apiRequest(`/api/reports/event-winners?search=${encodeURIComponent(prefix)}&status=completed`, {
        token: officerAllowed.token,
      });
      assert.equal(allRes.status, 200);
      assertEventWinnersSummary(allRes.data);
      assert.equal(allRes.data.summary.eventsWithWinners, 2);
      assert.equal(allRes.data.summary.eventsWithoutWinners, 2);

      const drillRes = await apiRequest(`/api/reports/event-winners?eventId=${evtTiedWinnersId}`, {
        token: officerAllowed.token,
      });
      assert.equal(drillRes.status, 200);
      assertEventWinnersSummary(drillRes.data);
      assert.equal(Boolean(drillRes.data.events[0].isEsports), true);
      assert.equal(drillRes.data.events[0].esportsGame, 'Valorant');
      assert.equal(drillRes.data.rows.length, 2);
    });

    await check('Tier 4', 'Scenario 2: Officer audits cross-event attendance (ongoing + past) verifying summary totals across all states', async () => {
      const res = await apiRequest(`/api/reports/attendance?search=${encodeURIComponent(prefix)}`, {
        token: officerAllowed.token,
      });
      assert.equal(res.status, 200);
      assertAttendanceSummary(res.data);
      // Seeded non-rejected rows: 2 on evtWithWinners (both timed_out), 3 on evtOngoing (1 timed_out, 1 in_venue, 1 not_arrived), 4 on evtPastAttendance (1 not_timed_out, 1 timed_out, 2 not_arrived) = 9
      assert.equal(res.data.summary.totalRecords, 9);
      assert.equal(res.data.summary.timedOutCount, 4);
      assert.equal(res.data.summary.inVenueCount, 1);
      assert.equal(res.data.summary.notTimedOutCount, 1);
      assert.equal(res.data.summary.notArrivedCount, 3);
      assert.equal(res.data.summary.checkedInCount, 6);
    });
  } catch (err) {
    fatalError = err;
    console.error('Fatal setup/execution error:', err);
  } finally {
    // Guaranteed FK child-to-parent cleanup
    try {
      const cleanIn = async (table, col, ids, extraWhere = '', extraParams = []) => {
        if (ids.length > 0 && extraWhere) {
          const ph = ids.map(() => '?').join(',');
          await pool.query(`DELETE FROM ${table} WHERE ${col} IN (${ph}) OR (${extraWhere})`, [...ids, ...extraParams]);
        } else if (ids.length > 0) {
          const ph = ids.map(() => '?').join(',');
          await pool.query(`DELETE FROM ${table} WHERE ${col} IN (${ph})`, ids);
        } else if (extraWhere) {
          await pool.query(`DELETE FROM ${table} WHERE ${extraWhere}`, extraParams);
        }
      };

      const likePrefix = `${prefix}%`;
      await cleanIn('event_competition_winners', 'event_id', tracked.eventIds, 'participant_name LIKE ?', [likePrefix]);
      if (tracked.userIds.length > 0) {
        const uPh = tracked.userIds.map(() => '?').join(',');
        await pool.query(`DELETE FROM event_registrations WHERE member_id IN (${uPh})`, tracked.userIds);
        await pool.query(`DELETE FROM institution_members WHERE institution_user_id IN (${uPh})`, tracked.userIds);
        await pool.query(`DELETE FROM payments WHERE member_id IN (${uPh})`, tracked.userIds);
      }
      await cleanIn('event_registrations', 'event_id', tracked.eventIds);
      await cleanIn('institution_members', 'event_id', tracked.eventIds, 'full_name LIKE ?', [likePrefix]);
      await cleanIn('payments', 'event_id', tracked.eventIds);
      await cleanIn('events', 'id', tracked.eventIds, 'title LIKE ?', [likePrefix]);
      await cleanIn('sessions', 'token', tracked.tokens, 'user_id IN (SELECT id FROM users WHERE email LIKE ?)', [likePrefix]);
      await cleanIn('officers', 'user_id', tracked.userIds);
      await cleanIn('users', 'id', tracked.userIds, 'email LIKE ?', [likePrefix]);
      console.log('Cleanup complete: removed all seeded fixtures.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr);
    } finally {
      await pool.end();
    }
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\nSummary: ${passed} passed, ${failed} failed (total ${results.length})`);

  if (fatalError || failed > 0 || results.length === 0) {
    process.exit(1);
  }
}

run();

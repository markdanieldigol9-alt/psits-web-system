import { test, expect } from '@playwright/test';
import type { Page, Locator, Download } from '@playwright/test';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* -------------------------------------------------------------------------- */
/*  Root Node Dependency Resolution (mysql2 & dotenv live in root node_modules) */
/* -------------------------------------------------------------------------- */

interface DbResultHeader {
  insertId: number;
  affectedRows: number;
}

type DbRow = Record<string, unknown>;

interface DbPool {
  query: <T = DbRow[]>(sql: string, params?: readonly unknown[]) => Promise<[T, unknown]>;
  execute: <T = DbRow[]>(sql: string, params?: readonly unknown[]) => Promise<[T, unknown]>;
  end: () => Promise<void>;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const requireFromRoot = createRequire(path.resolve(currentDir, '../../package.json'));
const dotenv = requireFromRoot('dotenv') as {
  config: (options: { path: string }) => void;
};
const mysql = requireFromRoot('mysql2/promise') as {
  createPool: (config: Record<string, unknown>) => DbPool;
};

dotenv.config({ path: path.resolve(currentDir, '../../server/.env') });

/* -------------------------------------------------------------------------- */
/*  Types & Deterministic Run Context                                         */
/* -------------------------------------------------------------------------- */

interface SeedUser {
  id: number;
  email: string;
  fullName: string;
  token: string;
}

interface SeedEvent {
  id: number;
  title: string;
}

interface SeedContext {
  runId: string;
  prefix: string;
  admin: SeedUser;
  officerAllowed: SeedUser;
  officerDenied: SeedUser;
  memberUser: SeedUser;
  instUser: SeedUser;
  paginatedMembers: SeedUser[];
  evtWithWinners: SeedEvent;
  evtTiedWinners: SeedEvent;
  evtWithoutWinners: SeedEvent;
  evtPastAttendance: SeedEvent;
  evtOngoing: SeedEvent;
  electionId: number;
  electionTitle: string;
  partnerId: number;
  partnerCompany: string;
  dealTitle: string;
  createdUserIds: number[];
  createdEventIds: number[];
  createdTokens: string[];
  createdPaymentIds: number[];
  createdElectionIds: number[];
  createdPartnerIds: number[];
}

interface CsvTable {
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
}

interface PrintAuditOptions {
  reportLabel: string;
  expectTable?: boolean;
  minPrintRows?: number;
  assertButtonsInReportVisible?: boolean;
  assertToastHidden?: boolean;
}

interface PrintAuditEvaluation {
  printableCount: number;
  printableVisible: boolean;
  printableTextLen: number;
  tableCount: number;
  bodyRowCount: number;
  nonEmptyCellCount: number;
  leakedElements: string[];
  hiddenDataButtons: string[];
}

const PASSWORD_PLAIN = 'TestPass@123';

let pool: DbPool;
let seed: SeedContext;

/* -------------------------------------------------------------------------- */
/*  DB Helpers                                                                */
/* -------------------------------------------------------------------------- */

function hashScrypt(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `s2:${salt.toString('hex')}:${derived.toString('hex')}`;
}

function toSqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function toSqlDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function insertRow(sql: string, params: readonly unknown[]): Promise<number> {
  const [result] = await pool.execute<DbResultHeader>(sql, params);
  return result.insertId;
}

async function createUserWithSession(opts: {
  email: string;
  username: string;
  fullName: string;
  role: 'admin' | 'officer' | 'member';
  status?: 'active' | 'pending';
  memberType?: 'individual' | 'institution' | 'industry' | 'student';
  sector?: 'school' | 'industry' | 'institution';
  sectorDetails?: string | null;
  position?: string | null;
  officerPosition?: string | null;
  passwordHash: string;
  withSession?: boolean;
}): Promise<SeedUser> {
  const userId = await insertRow(
    `INSERT INTO users
      (email, username, full_name, password_hash, role, contact_number, sector, sector_details, member_type, position, status, terms_accepted, membership_mode, membership_started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'new', NOW())`,
    [
      opts.email,
      opts.username,
      opts.fullName,
      opts.passwordHash,
      opts.role,
      '09171234567',
      opts.sector ?? 'school',
      opts.sectorDetails ?? null,
      opts.memberType ?? 'individual',
      opts.position ?? null,
      opts.status ?? 'active',
    ]
  );
  seed.createdUserIds.push(userId);

  if (opts.role === 'officer' && opts.officerPosition) {
    await pool.execute(
      `INSERT INTO officers (user_id, position, start_date, officer_status)
       VALUES (?, ?, ?, 'active')`,
      [userId, opts.officerPosition, '2026-01-01']
    );
  }

  let token = '';
  if (opts.withSession !== false) {
    token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.execute(
      `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
      [token, userId, toSqlDateTime(expiresAt)]
    );
    seed.createdTokens.push(token);
  }

  return {
    id: userId,
    email: opts.email,
    fullName: opts.fullName,
    token,
  };
}

function formatInPlaceholders(values: readonly unknown[]): string {
  return values.map(() => '?').join(', ');
}

async function cleanupSeededData(ctx: SeedContext): Promise<void> {
  const likePrefix = `${ctx.prefix}%`;

  await pool.execute(
    `DELETE FROM event_competition_winners WHERE participant_name LIKE ? OR award_title LIKE ?`,
    [likePrefix, likePrefix]
  );

  if (ctx.createdEventIds.length > 0) {
    const ph = formatInPlaceholders(ctx.createdEventIds);
    await pool.execute(
      `DELETE FROM event_competition_winners WHERE event_id IN (${ph})`,
      ctx.createdEventIds
    );
    await pool.execute(
      `DELETE FROM event_registrations WHERE event_id IN (${ph})`,
      ctx.createdEventIds
    );
    await pool.execute(
      `DELETE FROM institution_members WHERE event_id IN (${ph})`,
      ctx.createdEventIds
    );
  }

  await pool.execute(`DELETE FROM institution_members WHERE full_name LIKE ?`, [likePrefix]);

  if (ctx.createdUserIds.length > 0) {
    const ph = formatInPlaceholders(ctx.createdUserIds);
    await pool.execute(`DELETE FROM event_registrations WHERE member_id IN (${ph})`, ctx.createdUserIds);
    await pool.execute(
      `DELETE FROM institution_members WHERE institution_user_id IN (${ph})`,
      ctx.createdUserIds
    );
    await pool.execute(`DELETE FROM payments WHERE member_id IN (${ph})`, ctx.createdUserIds);
    await pool.execute(`DELETE FROM election_votes WHERE user_id IN (${ph})`, ctx.createdUserIds);
    await pool.execute(`DELETE FROM election_candidates WHERE member_id IN (${ph})`, ctx.createdUserIds);
  }

  if (ctx.createdPaymentIds.length > 0) {
    const ph = formatInPlaceholders(ctx.createdPaymentIds);
    await pool.execute(`DELETE FROM payments WHERE id IN (${ph})`, ctx.createdPaymentIds);
  }
  await pool.execute(`DELETE FROM payments WHERE reference_number LIKE ?`, [likePrefix]);

  if (ctx.createdPartnerIds.length > 0) {
    const ph = formatInPlaceholders(ctx.createdPartnerIds);
    await pool.execute(
      `DELETE FROM partner_contributions WHERE partner_id IN (${ph})`,
      ctx.createdPartnerIds
    );
    await pool.execute(`DELETE FROM partners WHERE id IN (${ph})`, ctx.createdPartnerIds);
  }
  await pool.execute(`DELETE FROM partner_contributions WHERE deal_title LIKE ?`, [likePrefix]);
  await pool.execute(`DELETE FROM partners WHERE company LIKE ?`, [likePrefix]);

  if (ctx.createdElectionIds.length > 0) {
    const ph = formatInPlaceholders(ctx.createdElectionIds);
    await pool.execute(`DELETE FROM election_votes WHERE election_id IN (${ph})`, ctx.createdElectionIds);
    await pool.execute(
      `DELETE FROM election_candidates WHERE election_id IN (${ph})`,
      ctx.createdElectionIds
    );
    await pool.execute(`DELETE FROM elections WHERE id IN (${ph})`, ctx.createdElectionIds);
  }
  await pool.execute(`DELETE FROM elections WHERE title LIKE ?`, [likePrefix]);

  if (ctx.createdEventIds.length > 0) {
    const ph = formatInPlaceholders(ctx.createdEventIds);
    await pool.execute(`DELETE FROM events WHERE id IN (${ph})`, ctx.createdEventIds);
  }
  await pool.execute(`DELETE FROM events WHERE title LIKE ?`, [likePrefix]);

  if (ctx.createdTokens.length > 0) {
    const ph = formatInPlaceholders(ctx.createdTokens);
    await pool.execute(`DELETE FROM sessions WHERE token IN (${ph})`, ctx.createdTokens);
  }

  if (ctx.createdUserIds.length > 0) {
    const ph = formatInPlaceholders(ctx.createdUserIds);
    await pool.execute(`DELETE FROM sessions WHERE user_id IN (${ph})`, ctx.createdUserIds);
    await pool.execute(`DELETE FROM officers WHERE user_id IN (${ph})`, ctx.createdUserIds);
    await pool.execute(`DELETE FROM users WHERE id IN (${ph})`, ctx.createdUserIds);
  }
  await pool.execute(`DELETE FROM users WHERE email LIKE ?`, [likePrefix]);
}

/* -------------------------------------------------------------------------- */
/*  RFC-4180 CSV Parser & Download Helper                                     */
/* -------------------------------------------------------------------------- */

function parseCsvRecords(rawCsv: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = rawCsv.replace(/^\uFEFF/, '');
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (clean[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      matrix.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      matrix.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    matrix.push(row);
  }

  const nonEmpty = matrix.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = nonEmpty[0].map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = (values[idx] ?? '').trim();
    });
    return record;
  });

  return { headers, rows };
}

async function readDownloadAsText(download: Download): Promise<string> {
  const filePath = await download.path();
  if (filePath) {
    return fs.readFile(filePath, 'utf8');
  }
  const stream = await download.createReadStream();
  if (!stream) {
    throw new Error(`Unable to read downloaded file: ${download.suggestedFilename()}`);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function downloadAndParseCsv(
  page: Page,
  triggerDownload: () => Promise<void>
): Promise<CsvTable> {
  const [download] = await Promise.all([page.waitForEvent('download'), triggerDownload()]);
  const content = await readDownloadAsText(download);
  const parsed = parseCsvRecords(content);
  return {
    filename: download.suggestedFilename(),
    headers: parsed.headers,
    rows: parsed.rows,
  };
}

/* -------------------------------------------------------------------------- */
/*  Browser Auth, Navigation & Print Audit Helpers                            */
/* -------------------------------------------------------------------------- */

async function authenticateAs(page: Page, token: string): Promise<void> {
  await page.addInitScript((authToken: string) => {
    window.localStorage.setItem('auth_token', authToken);
  }, token);
}

async function navigateToReports(page: Page): Promise<void> {
  await page.goto('/reports');
  await expect(
    page.getByRole('heading', { name: /Organization Reports & Audit Exports/i })
  ).toBeVisible();
  await expect(page.getByText('Loading report data...')).toBeHidden({ timeout: 15000 });
}

async function closeWizardIfOpen(page: Page): Promise<void> {
  const dialog = page.locator('[role="dialog"]');
  if ((await dialog.count()) > 0 && (await dialog.first().isVisible())) {
    const closeBtn = dialog.first().locator('[aria-label="Close modal"]');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
    await expect(dialog).toBeHidden();
  }
}

async function selectReportAndOpenWizard(
  page: Page,
  titlePattern: RegExp,
  step: 1 | 2 = 2
): Promise<{ optionLabel: string; dialog: Locator }> {
  await closeWizardIfOpen(page);

  const selectEl = page
    .locator('select')
    .filter({ has: page.locator('option', { hasText: titlePattern }) })
    .first();
  await expect(selectEl).toBeVisible();

  const optionTexts = await selectEl.locator('option').allTextContents();
  const matchedOption = optionTexts.find((text) => titlePattern.test(text));
  expect(matchedOption, `Expected a report option matching ${titlePattern}`).toBeTruthy();

  await selectEl.selectOption({ label: matchedOption! });

  const actionBtn = page
    .getByRole('button', { name: step === 2 ? /^View$/i : /^Generate$/i })
    .first();
  await actionBtn.click();

  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog).toBeVisible();
  await expect(page.getByText('Loading report data...')).toBeHidden({ timeout: 15000 });

  const spinner = dialog.locator('.animate-spin');
  if ((await spinner.count()) > 0) {
    await expect(spinner.first()).toBeHidden({ timeout: 15000 });
  }

  return { optionLabel: matchedOption!, dialog };
}

async function stubWindowPrintWithEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as {
      __origPrint?: () => void;
      __printCalls?: number;
    };
    if (!win.__origPrint) {
      win.__origPrint = window.print.bind(window);
    }
    win.__printCalls = 0;
    window.print = () => {
      win.__printCalls = (win.__printCalls ?? 0) + 1;
      window.dispatchEvent(new Event('beforeprint'));
    };
  });
}

async function restoreWindowPrintWithAfterPrint(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('afterprint'));
    const win = window as unknown as {
      __origPrint?: () => void;
    };
    if (win.__origPrint) {
      window.print = win.__origPrint;
      delete win.__origPrint;
    }
  });
}

async function evaluatePrintAudit(
  page: Page,
  opts: PrintAuditOptions
): Promise<PrintAuditEvaluation> {
  return page.evaluate(
    ({ assertButtonsInReportVisible, assertToastHidden }) => {
      const isHiddenInPrint = (el: Element): boolean => {
        let cur: Element | null = el;
        while (cur) {
          const style = window.getComputedStyle(cur);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            Number(style.opacity) === 0
          ) {
            return true;
          }
          cur = cur.parentElement;
        }
        const rect = el.getBoundingClientRect();
        return rect.width <= 0 || rect.height <= 0;
      };

      const printableNodes = Array.from(document.querySelectorAll('#printable-report-area'));
      const printable = printableNodes[0] ?? null;

      let printableVisible = false;
      let printableTextLen = 0;
      let tableCount = 0;
      let bodyRowCount = 0;
      let nonEmptyCellCount = 0;
      const hiddenDataButtons: string[] = [];

      if (printable) {
        const style = window.getComputedStyle(printable);
        const rect = printable.getBoundingClientRect();
        printableVisible =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0;
        printableTextLen = (printable.textContent ?? '').trim().length;

        const tables = Array.from(printable.querySelectorAll('table'));
        tableCount = tables.length;

        const rows = Array.from(printable.querySelectorAll('tbody tr'));
        bodyRowCount = rows.length;

        for (const td of Array.from(printable.querySelectorAll('tbody tr td'))) {
          if ((td.textContent ?? '').trim().length > 0 && !isHiddenInPrint(td)) {
            nonEmptyCellCount += 1;
          }
        }

        if (assertButtonsInReportVisible) {
          const dataButtons = Array.from(printable.querySelectorAll('tbody tr td button'));
          for (const btn of dataButtons) {
            if (btn.closest('.no-print') || btn.classList.contains('no-print')) {
              continue;
            }
            if (isHiddenInPrint(btn)) {
              hiddenDataButtons.push((btn.textContent ?? '').trim() || '<empty button>');
            }
          }
        }
      }

      const leakedElements: string[] = [];
      const recordIfLeaked = (selectorLabel: string, el: Element) => {
        if (!isHiddenInPrint(el)) {
          const snippet = (el.textContent ?? '').trim().slice(0, 60);
          leakedElements.push(`${selectorLabel} (${snippet})`);
        }
      };

      // 1. Global chrome & overlays
      for (const el of Array.from(document.querySelectorAll('header, nav, aside'))) {
        recordIfLeaked(el.tagName.toLowerCase(), el);
      }

      // 2. Toast notifications ([role="status"])
      const toasts = Array.from(document.querySelectorAll('[role="status"]'));
      if (assertToastHidden && toasts.length === 0) {
        leakedElements.push('[role="status"] missing when assertToastHidden was requested');
      }
      for (const el of toasts) {
        recordIfLeaked('[role="status"]', el);
      }

      // 3. Reports page banner & generator card outside #printable-report-area
      for (const el of Array.from(document.querySelectorAll('.module-header-banner'))) {
        recordIfLeaked('.module-header-banner', el);
      }
      for (const el of Array.from(document.querySelectorAll('h2, h3'))) {
        if (
          (el.textContent ?? '').includes('Analytics & Official Reports Generator') &&
          !el.closest('#printable-report-area')
        ) {
          recordIfLeaked('generator-card', el);
        }
      }

      // 4. Modal close button & wizard step tabs
      for (const el of Array.from(document.querySelectorAll('[aria-label="Close modal"]'))) {
        recordIfLeaked('[aria-label="Close modal"]', el);
      }
      const wizardTabLabels = [
        '1. Parameters & Filters',
        '2. Detailed Document Preview',
        '3. Export & Submit',
      ];
      for (const btn of Array.from(document.querySelectorAll('button'))) {
        const text = (btn.textContent ?? '').trim();
        if (wizardTabLabels.some((lbl) => text.includes(lbl))) {
          recordIfLeaked(`wizard-tab:${text}`, btn);
        }
      }

      // 5. Filter inputs & selects anywhere on page (including inside printable container)
      for (const el of Array.from(document.querySelectorAll('input, select'))) {
        recordIfLeaked(el.tagName.toLowerCase(), el);
      }

      // 6. Action buttons (Print, Export CSV/Excel, Save PDF, View List, Filter Ledger, etc.)
      const actionLabelPattern =
        /^(Print|Print \/ Save PDF|Print Report|Export CSV|Export Excel|Export Table|Export to Excel|Save PDF|View List|Filter Ledger|Parameters|Edit Parameters|Proceed to Export & Submit|Back to Preview|Submit & Record Report|Export Scorecard CSV|Export Canvass CSV|Reset)/i;
      for (const btn of Array.from(document.querySelectorAll('button'))) {
        const text = (btn.textContent ?? '').trim();
        const inReportTableData = Boolean(
          btn.closest('#printable-report-area tbody tr td') &&
            !btn.closest('.no-print') &&
            !btn.classList.contains('no-print')
        );
        if (inReportTableData) continue;
        if (
          !btn.closest('#printable-report-area') ||
          btn.closest('.no-print') ||
          btn.classList.contains('no-print') ||
          actionLabelPattern.test(text)
        ) {
          recordIfLeaked(`button:${text || btn.getAttribute('title') || 'unnamed'}`, btn);
        }
      }

      // 7. Pagination controls & labels
      for (const el of Array.from(document.querySelectorAll('span, div, p'))) {
        if (el.children.length > 3) continue;
        const text = (el.textContent ?? '').trim();
        if (
          /^Rows per page:/i.test(text) ||
          /^Show:$/i.test(text) ||
          /^Page \d+ of \d+$/i.test(text)
        ) {
          recordIfLeaked(`pagination:${text}`, el);
        }
      }

      return {
        printableCount: printableNodes.length,
        printableVisible,
        printableTextLen,
        tableCount,
        bodyRowCount,
        nonEmptyCellCount,
        leakedElements,
        hiddenDataButtons,
      };
    },
    {
      assertButtonsInReportVisible: Boolean(opts.assertButtonsInReportVisible),
      assertToastHidden: Boolean(opts.assertToastHidden),
    }
  );
}

async function assertCleanPrintOutput(page: Page, opts: PrintAuditOptions): Promise<void> {
  await page.emulateMedia({ media: 'print' });
  try {
    const audit = await evaluatePrintAudit(page, opts);
    expect(
      audit.printableCount,
      `${opts.reportLabel}: expected exactly 1 #printable-report-area`
    ).toBe(1);
    expect(
      audit.printableVisible,
      `${opts.reportLabel}: #printable-report-area must be visible in print`
    ).toBe(true);
    expect(
      audit.printableTextLen,
      `${opts.reportLabel}: #printable-report-area must have non-empty content`
    ).toBeGreaterThan(20);

    if (opts.expectTable !== false) {
      expect(
        audit.tableCount,
        `${opts.reportLabel}: expected at least 1 <table> inside #printable-report-area`
      ).toBeGreaterThan(0);
      expect(
        audit.bodyRowCount,
        `${opts.reportLabel}: expected table body rows inside #printable-report-area`
      ).toBeGreaterThanOrEqual(opts.minPrintRows ?? 1);
      expect(
        audit.nonEmptyCellCount,
        `${opts.reportLabel}: expected non-empty visible <td> cells in print`
      ).toBeGreaterThan(0);
    }

    expect(
      audit.hiddenDataButtons,
      `${opts.reportLabel}: data-bearing <button> cells inside report table were hidden in print`
    ).toEqual([]);
    expect(
      audit.leakedElements,
      `${opts.reportLabel}: non-report UI leaked into @media print output`
    ).toEqual([]);
  } finally {
    await page.emulateMedia({ media: 'screen' });
  }
}

async function extractTableDataFromArea(
  area: Locator,
  preferredHeaderPattern?: RegExp
): Promise<{ headers: string[]; rows: string[][] }> {
  return area.evaluate(
    (root, headerRegexSource) => {
      const tables = Array.from(root.querySelectorAll('table'));
      if (tables.length === 0) {
        return { headers: [], rows: [] };
      }

      const regex = headerRegexSource ? new RegExp(headerRegexSource, 'i') : null;
      let targetTable = tables[tables.length - 1];
      if (regex) {
        const matched = tables.find((tbl) =>
          Array.from(tbl.querySelectorAll('thead th')).some((th) =>
            regex.test((th.textContent ?? '').trim())
          )
        );
        if (matched) targetTable = matched;
      }

      const headers = Array.from(targetTable.querySelectorAll('thead th')).map((th) =>
        (th.textContent ?? '').trim()
      );
      const rows = Array.from(targetTable.querySelectorAll('tbody tr'))
        .filter((tr) => {
          const cells = Array.from(tr.querySelectorAll('td'));
          if (cells.length === 1 && (cells[0].getAttribute('colspan') || Number(cells[0].colSpan) > 1)) {
            return false;
          }
          return cells.length > 0;
        })
        .map((tr) =>
          Array.from(tr.querySelectorAll('td')).map((td) =>
            (td.textContent ?? '').replace(/\s+/g, ' ').trim()
          )
        );

      return { headers, rows };
    },
    preferredHeaderPattern ? preferredHeaderPattern.source : null
  );
}

/* -------------------------------------------------------------------------- */
/*  Global Setup & Teardown (Self-Contained DB Seeding)                       */
/* -------------------------------------------------------------------------- */

test.describe('PSITS Reports Module — E2E Suite (RBAC, R1, R2, R3)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const dbHost = process.env.DB_HOST || '127.0.0.1';
    pool = mysql.createPool({
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
    });

    const shortId = crypto.randomBytes(4).toString('hex');
    const prefix = `__e2e_rpt_${shortId}__`;
    const passwordHash = hashScrypt(PASSWORD_PLAIN);

    seed = {
      runId: shortId,
      prefix,
      admin: { id: 0, email: '', fullName: '', token: '' },
      officerAllowed: { id: 0, email: '', fullName: '', token: '' },
      officerDenied: { id: 0, email: '', fullName: '', token: '' },
      memberUser: { id: 0, email: '', fullName: '', token: '' },
      instUser: { id: 0, email: '', fullName: '', token: '' },
      paginatedMembers: [],
      evtWithWinners: { id: 0, title: `${prefix} Hackathon Winners` },
      evtTiedWinners: { id: 0, title: `${prefix} Esports Tie Cup` },
      evtWithoutWinners: { id: 0, title: `${prefix} Seminar No Winners` },
      evtPastAttendance: { id: 0, title: `${prefix} Past Attendance Summit` },
      evtOngoing: { id: 0, title: `${prefix} Ongoing Live Workshop` },
      electionId: 0,
      electionTitle: `${prefix} 2026 General Election`,
      partnerId: 0,
      partnerCompany: `${prefix} Acme Tech Corp`,
      dealTitle: `${prefix} Gold Hackathon Sponsorship`,
      createdUserIds: [],
      createdEventIds: [],
      createdTokens: [],
      createdPaymentIds: [],
      createdElectionIds: [],
      createdPartnerIds: [],
    };

    try {
      // 1. RBAC & Actor Users
      seed.admin = await createUserWithSession({
        email: `${prefix}admin@e2e.local`,
        username: `e2e_${shortId}_adm`,
        fullName: `${prefix} Admin User`,
        role: 'admin',
        sector: 'industry',
        sectorDetails: `${prefix} Central Exec`,
        passwordHash,
      });

      seed.officerAllowed = await createUserWithSession({
        email: `${prefix}sec@e2e.local`,
        username: `e2e_${shortId}_sec`,
        fullName: `${prefix} Secretary Officer`,
        role: 'officer',
        position: 'Secretary',
        officerPosition: 'Secretary',
        sector: 'school',
        sectorDetails: `${prefix} School Alpha`,
        passwordHash,
      });

      seed.officerDenied = await createUserWithSession({
        email: `${prefix}proto@e2e.local`,
        username: `e2e_${shortId}_pro`,
        fullName: `${prefix} Protocol Officer`,
        role: 'officer',
        position: 'Protocol Officer',
        officerPosition: 'Protocol Officer',
        sector: 'school',
        sectorDetails: `${prefix} School Alpha`,
        passwordHash,
      });

      seed.memberUser = await createUserWithSession({
        email: `${prefix}member@e2e.local`,
        username: `e2e_${shortId}_mem`,
        fullName: `${prefix} Individual Member`,
        role: 'member',
        memberType: 'individual',
        sector: 'school',
        sectorDetails: `${prefix} School Alpha`,
        passwordHash,
      });

      seed.instUser = await createUserWithSession({
        email: `${prefix}inst@e2e.local`,
        username: `e2e_${shortId}_ins`,
        fullName: `${prefix} Inst Beta`,
        role: 'member',
        memberType: 'institution',
        sector: 'institution',
        sectorDetails: `${prefix} Inst Beta`,
        passwordHash,
        withSession: false,
      });

      // 2. Seed 18 members + 18 payments (>15 default pagination threshold)
      for (let i = 1; i <= 18; i += 1) {
        const padded = String(i).padStart(2, '0');
        const mUser = await createUserWithSession({
          email: `${prefix}m${padded}@e2e.local`,
          username: `e2e_${shortId}_m${padded}`,
          fullName: `${prefix} Member ${padded}`,
          role: 'member',
          status: i <= 16 ? 'active' : 'pending',
          memberType: 'individual',
          sector: 'school',
          sectorDetails: i <= 10 ? `${prefix} School Alpha` : `${prefix} School Gamma`,
          passwordHash,
          withSession: false,
        });
        seed.paginatedMembers.push(mUser);

        const isGcash = i <= 10;
        const isBank = i > 10 && i <= 15;
        const paymentMethod = isGcash ? 'gcash' : isBank ? 'bank_transfer' : 'cash_officer';
        const legacyMethod = isGcash ? 'gcash' : isBank ? 'card' : 'gcash';
        const payStatus = i <= 15 ? 'verified' : 'pending';
        const paymentStatusCol = i <= 15 ? 'paid' : 'pending';
        const processStatusCol = i <= 15 ? 'verified' : 'submitted';

        const paymentId = await insertRow(
          `INSERT INTO payments
            (member_id, amount, payment_kind, payment_method, reference_number, method, payment_status, process_status, status)
           VALUES (?, ?, 'membership_renewal', ?, ?, ?, ?, ?, ?)`,
          [
            mUser.id,
            250 + i * 10,
            paymentMethod,
            `${prefix}REF-${padded}`,
            legacyMethod,
            paymentStatusCol,
            processStatusCol,
            payStatus,
          ]
        );
        seed.createdPaymentIds.push(paymentId);
      }

      // 3. Seed Events & Winners (R1)
      const now = Date.now();
      const daysAgo = (days: number, offsetHours = 0): Date =>
        new Date(now - days * 24 * 60 * 60 * 1000 + offsetHours * 60 * 60 * 1000);

      seed.evtWithWinners.id = await insertRow(
        `INSERT INTO events
          (title, description, event_type, start_at, end_at, location, registration_fee, capacity, status, created_by)
         VALUES (?, ?, 'competition', ?, ?, 'Davao Hall', 150.00, 100, 'completed', ?)`,
        [
          seed.evtWithWinners.title,
          `${prefix} competition with 2 winners`,
          toSqlDateTime(daysAgo(10)),
          toSqlDateTime(daysAgo(10, 6)),
          seed.admin.id,
        ]
      );
      seed.createdEventIds.push(seed.evtWithWinners.id);

      await pool.execute(
        `INSERT INTO event_competition_winners
          (event_id, rank_position, award_title, institution_name, participant_name, points, score_or_notes, event_mode, created_by)
         VALUES
          (?, 1, 'Champion', ?, ?, 10, '98.5 pts', 'team', ?),
          (?, 2, '1st Runner-Up', ?, ?, 7, '92.0 pts', 'team', ?)`,
        [
          seed.evtWithWinners.id,
          `${prefix} School Alpha`,
          `${prefix} Alice Winner`,
          seed.admin.id,
          seed.evtWithWinners.id,
          `${prefix} Inst Beta`,
          `${prefix} Bob Runner`,
          seed.admin.id,
        ]
      );

      seed.evtTiedWinners.id = await insertRow(
        `INSERT INTO events
          (title, description, event_type, start_at, end_at, location, registration_fee, capacity, status, is_esports, esports_game, created_by)
         VALUES (?, ?, 'competition', ?, ?, 'Arena A', 100.00, 64, 'completed', 1, 'Valorant', ?)`,
        [
          seed.evtTiedWinners.title,
          `${prefix} competition with tied Rank 1 winners`,
          toSqlDateTime(daysAgo(8)),
          toSqlDateTime(daysAgo(8, 4)),
          seed.admin.id,
        ]
      );
      seed.createdEventIds.push(seed.evtTiedWinners.id);

      await pool.execute(
        `INSERT INTO event_competition_winners
          (event_id, rank_position, award_title, institution_name, participant_name, points, score_or_notes, event_mode, created_by)
         VALUES
          (?, 1, 'Co-Champion', ?, ?, 10, '2-2 Tie', 'team', ?),
          (?, 1, 'Co-Champion', ?, ?, 10, '2-2 Tie', 'team', ?)`,
        [
          seed.evtTiedWinners.id,
          `${prefix} School Alpha`,
          `${prefix} Team Tie One`,
          seed.admin.id,
          seed.evtTiedWinners.id,
          `${prefix} Inst Beta`,
          `${prefix} Team Tie Two`,
          seed.admin.id,
        ]
      );

      seed.evtWithoutWinners.id = await insertRow(
        `INSERT INTO events
          (title, description, event_type, start_at, end_at, location, registration_fee, capacity, status, created_by)
         VALUES (?, ?, 'seminar', ?, ?, 'Auditorium B', 0.00, 200, 'completed', ?)`,
        [
          seed.evtWithoutWinners.title,
          `${prefix} completed seminar without winners`,
          toSqlDateTime(daysAgo(6)),
          toSqlDateTime(daysAgo(6, 3)),
          seed.admin.id,
        ]
      );
      seed.createdEventIds.push(seed.evtWithoutWinners.id);

      // 4. Seed Attendance Events & Dual-Sourced Records (R2)
      const pastStart = new Date(now - 5 * 60 * 60 * 1000);
      const pastEnd = new Date(now - 2 * 60 * 60 * 1000);
      seed.evtPastAttendance.id = await insertRow(
        `INSERT INTO events
          (title, description, event_type, start_at, end_at, location, registration_fee, capacity, status, created_by)
         VALUES (?, ?, 'seminar', ?, ?, 'Main Hall', 0.00, 150, 'completed', ?)`,
        [
          seed.evtPastAttendance.title,
          `${prefix} past attendance audit event`,
          toSqlDateTime(pastStart),
          toSqlDateTime(pastEnd),
          seed.admin.id,
        ]
      );
      seed.createdEventIds.push(seed.evtPastAttendance.id);

      const pastCheckInOnTime = new Date(pastStart.getTime() + 5 * 60 * 1000);
      const pastCheckOut = new Date(pastEnd.getTime() - 15 * 60 * 1000);
      const pastCheckInLate = new Date(pastStart.getTime() + 25 * 60 * 1000);

      // Individual timed_out
      await pool.execute(
        `INSERT INTO event_registrations
          (event_id, member_id, participant_count, checked_in_count, status, is_checked_in, checked_in_at, checked_out_at)
         VALUES (?, ?, 1, 1, 'approved', 1, ?, ?)`,
        [
          seed.evtPastAttendance.id,
          seed.memberUser.id,
          toSqlDateTime(pastCheckInOnTime),
          toSqlDateTime(pastCheckOut),
        ]
      );
      // Individual not_timed_out (checked_out_at IS NULL on past ended event)
      await pool.execute(
        `INSERT INTO event_registrations
          (event_id, member_id, participant_count, checked_in_count, status, is_checked_in, checked_in_at, checked_out_at)
         VALUES (?, ?, 1, 1, 'approved', 1, ?, NULL)`,
        [
          seed.evtPastAttendance.id,
          seed.paginatedMembers[0].id,
          toSqlDateTime(pastCheckInLate),
        ]
      );
      // Individual rejected (must be excluded by default)
      await pool.execute(
        `INSERT INTO event_registrations
          (event_id, member_id, participant_count, checked_in_count, status, is_checked_in, checked_in_at, checked_out_at)
         VALUES (?, ?, 1, 0, 'rejected', 0, NULL, NULL)`,
        [seed.evtPastAttendance.id, seed.paginatedMembers[1].id]
      );

      // Institution timed_out + not_timed_out
      await pool.execute(
        `INSERT INTO institution_members
          (institution_user_id, event_id, full_name, email, contact_number, position, event_title, status, checked_in, checked_in_at, checked_out_at, created_by)
         VALUES
          (?, ?, ?, ?, '09170000001', 'Delegate', ?, 'approved', 1, ?, ?, ?),
          (?, ?, ?, ?, '09170000002', 'Delegate', ?, 'approved', 1, ?, NULL, ?)`,
        [
          seed.instUser.id,
          seed.evtPastAttendance.id,
          `${prefix} Inst Timed Out`,
          `${prefix}inst_to@e2e.local`,
          seed.evtPastAttendance.title,
          toSqlDateTime(pastCheckInLate),
          toSqlDateTime(pastCheckOut),
          seed.admin.id,
          seed.instUser.id,
          seed.evtPastAttendance.id,
          `${prefix} Inst No Timeout`,
          `${prefix}inst_nto@e2e.local`,
          seed.evtPastAttendance.title,
          toSqlDateTime(pastCheckInOnTime),
          seed.admin.id,
        ]
      );

      // Ongoing event (in_venue + not_arrived)
      const ongoingStart = new Date(now - 30 * 60 * 1000);
      const ongoingEnd = new Date(now + 90 * 60 * 1000);
      seed.evtOngoing.id = await insertRow(
        `INSERT INTO events
          (title, description, event_type, start_at, end_at, location, registration_fee, capacity, status, created_by)
         VALUES (?, ?, 'workshop', ?, ?, 'Lab 101', 50.00, 80, 'ongoing', ?)`,
        [
          seed.evtOngoing.title,
          `${prefix} ongoing workshop event`,
          toSqlDateTime(ongoingStart),
          toSqlDateTime(ongoingEnd),
          seed.admin.id,
        ]
      );
      seed.createdEventIds.push(seed.evtOngoing.id);

      await pool.execute(
        `INSERT INTO event_registrations
          (event_id, member_id, participant_count, checked_in_count, status, is_checked_in, checked_in_at, checked_out_at)
         VALUES
          (?, ?, 1, 1, 'approved', 1, ?, NULL),
          (?, ?, 1, 0, 'approved', 0, NULL, NULL)`,
        [
          seed.evtOngoing.id,
          seed.paginatedMembers[2].id,
          toSqlDateTime(new Date(now - 10 * 60 * 1000)),
          seed.evtOngoing.id,
          seed.paginatedMembers[3].id,
        ]
      );

      await pool.execute(
        `INSERT INTO institution_members
          (institution_user_id, event_id, full_name, email, contact_number, position, event_title, status, checked_in, checked_in_at, checked_out_at, created_by)
         VALUES (?, ?, ?, ?, '09170000003', 'Participant', ?, 'approved', 1, ?, NULL, ?)`,
        [
          seed.instUser.id,
          seed.evtOngoing.id,
          `${prefix} Inst In Venue`,
          `${prefix}inst_iv@e2e.local`,
          seed.evtOngoing.title,
          toSqlDateTime(new Date(now - 5 * 60 * 1000)),
          seed.admin.id,
        ]
      );

      // 5. Seed Election + Candidates + Votes (for Election Tally print sweep)
      seed.electionId = await insertRow(
        `INSERT INTO elections (title, description, start_date, end_date, status, created_by)
         VALUES (?, ?, ?, ?, 'closed', ?)`,
        [
          seed.electionTitle,
          `${prefix} election for report sweep`,
          toSqlDate(daysAgo(20)),
          toSqlDate(daysAgo(19)),
          seed.admin.id,
        ]
      );
      seed.createdElectionIds.push(seed.electionId);

      await pool.execute(
        `INSERT INTO election_candidates (election_id, member_id, position, platform, status, votes_count)
         VALUES
          (?, ?, 'President', 'Digital Governance', 'winner', 12),
          (?, ?, 'President', 'Community First', 'approved', 5)`,
        [seed.electionId, seed.memberUser.id, seed.electionId, seed.paginatedMembers[0].id]
      );

      await pool.execute(
        `INSERT INTO election_votes (election_id, user_id) VALUES (?, ?), (?, ?)`,
        [seed.electionId, seed.memberUser.id, seed.electionId, seed.paginatedMembers[0].id]
      );

      // 6. Seed Partner + Partner Contribution (for Partner Contributions print sweep)
      seed.partnerId = await insertRow(
        `INSERT INTO partners
          (company, type, contact_person, location, email, phone, partnership_status, created_by)
         VALUES (?, 'Industry', 'Jane Partner', 'Davao', ?, '09178889999', 'active', ?)`,
        [seed.partnerCompany, `${prefix}partner@e2e.local`, seed.admin.id]
      );
      seed.createdPartnerIds.push(seed.partnerId);

      await pool.execute(
        `INSERT INTO partner_contributions
          (partner_id, event_id, deal_title, contribution_type, value_amount, description)
         VALUES (?, ?, ?, 'funds', 25000.00, 'E2E seeded sponsorship')`,
        [seed.partnerId, seed.evtWithWinners.id, seed.dealTitle]
      );
    } catch (err) {
      await cleanupSeededData(seed);
      await pool.end();
      throw err;
    }
  });

  test.afterAll(async () => {
    if (pool && seed) {
      try {
        await cleanupSeededData(seed);
      } finally {
        await pool.end();
      }
    }
  });

  /* ------------------------------------------------------------------------ */
  /*  Tier 1 & 2: Login UI Smoke + RBAC on /reports                           */
  /* ------------------------------------------------------------------------ */

  test.describe('Authentication Smoke & /reports RBAC', () => {
    test('login form authenticates admin and navigates to /dashboard', async ({ page }) => {
      await page.goto('/login');
      await page.getByPlaceholder('Enter your email').fill(seed.admin.email);
      await page.getByPlaceholder('Enter your password').fill(PASSWORD_PLAIN);
      await page.getByRole('button', { name: /^Login$/i }).click();

      await expect(page).toHaveURL(/\/dashboard$/);
    });

    test('unauthenticated visitor to /reports redirects to /login', async ({ page }) => {
      await page.goto('/reports');
      await expect(page).toHaveURL(/\/login$/);
    });

    test('member role visiting /reports redirects to /unauthorized', async ({ page }) => {
      await authenticateAs(page, seed.memberUser.token);
      await page.goto('/reports');
      await expect(page).toHaveURL(/\/unauthorized$/);
      await expect(page.getByRole('heading', { name: /Unauthorized/i })).toBeVisible();
    });

    test('disallowed officer (Protocol Officer) visiting /reports redirects to /unauthorized', async ({
      page,
    }) => {
      await authenticateAs(page, seed.officerDenied.token);
      await page.goto('/reports');
      await expect(page).toHaveURL(/\/unauthorized$/);
      await expect(page.getByRole('heading', { name: /Unauthorized/i })).toBeVisible();
    });

    test('allowed officer (Secretary) can access /reports', async ({ page }) => {
      await authenticateAs(page, seed.officerAllowed.token);
      await navigateToReports(page);
    });

    test('admin can access /reports', async ({ page }) => {
      await authenticateAs(page, seed.admin.token);
      await navigateToReports(page);
    });
  });

  /* ------------------------------------------------------------------------ */
  /*  R1: Event Winners In-Module View, Filters, Boundary & CSV Parity        */
  /* ------------------------------------------------------------------------ */

  test.describe('R1 — Event Winners Report View, Filtering & CSV Parity', () => {
    test('renders winners, tied ranks, and events without winners, filters accurately, and exports matching CSV', async ({
      page,
    }) => {
      await authenticateAs(page, seed.admin.token);
      await navigateToReports(page);

      const { dialog } = await selectReportAndOpenWizard(page, /winner/i, 2);
      const area = dialog.locator('#printable-report-area');
      await expect(area).toBeVisible();

      // 1. Verify events with winners, tied Rank 1 winners, and events without winners appear
      await expect(area).toContainText(seed.evtWithWinners.title);
      await expect(area).toContainText(`${seed.prefix} Alice Winner`);
      await expect(area).toContainText(`${seed.prefix} Bob Runner`);

      await expect(area).toContainText(seed.evtTiedWinners.title);
      await expect(area).toContainText(`${seed.prefix} Team Tie One`);
      await expect(area).toContainText(`${seed.prefix} Team Tie Two`);

      await expect(area).toContainText(seed.evtWithoutWinners.title);
      await expect(area).toContainText(/No Winners Recorded|—/i);

      // 2. Boundary: empty-result search renders gracefully without crash
      const searchInput = area
        .locator('input[type="text"], input[type="search"], input:not([type])')
        .first();
      await expect(searchInput).toBeVisible();
      await searchInput.fill(`${seed.prefix}__NONEXISTENT_EVENT__`);
      const emptyTable = await extractTableDataFromArea(area);
      expect(emptyTable.rows.length).toBe(0);

      // 3. Filter to our seeded prefix so row count is deterministic, then apply hasWinners filter if available
      await searchInput.fill(seed.prefix);
      const hasWinnersSelect = area
        .locator('select')
        .filter({ has: page.locator('option', { hasText: /with.?winner/i }) })
        .first();
      if ((await hasWinnersSelect.count()) > 0 && (await hasWinnersSelect.isVisible())) {
        const opts = await hasWinnersSelect.locator('option').allTextContents();
        const withWinnersOpt = opts.find((o) => /with\s*winners/i.test(o) && !/without/i.test(o));
        if (withWinnersOpt) {
          await hasWinnersSelect.selectOption({ label: withWinnersOpt });
        }
      }

      const displayed = await extractTableDataFromArea(area, /event|winner|participant/i);
      expect(displayed.rows.length).toBeGreaterThanOrEqual(4);

      // 4. Trigger CSV export and verify 1:1 parity with displayed filtered table rows
      const inViewExport = area.getByRole('button', { name: /export.*(csv|excel|table)/i }).first();
      const exportTrigger =
        (await inViewExport.count()) > 0 && (await inViewExport.isVisible())
          ? inViewExport
          : dialog.getByRole('button', { name: /^Export CSV$/i }).first();

      const csv = await downloadAndParseCsv(page, () => exportTrigger.click());
      expect(csv.headers.length).toBeGreaterThan(0);
      expect(csv.rows.length).toBe(displayed.rows.length);

      const csvSerialized = csv.rows.map((r) => Object.values(r).join(' | ')).join('\n');
      expect(csvSerialized).toContain(`${seed.prefix} Alice Winner`);
      expect(csvSerialized).toContain(`${seed.prefix} Bob Runner`);
      expect(csvSerialized).toContain(`${seed.prefix} Team Tie One`);
      expect(csvSerialized).toContain(`${seed.prefix} Team Tie Two`);

      // Reset filter to include event without winners and verify print isolation
      if ((await hasWinnersSelect.count()) > 0 && (await hasWinnersSelect.isVisible())) {
        const opts = await hasWinnersSelect.locator('option').allTextContents();
        const allOpt = opts.find((o) => /^all/i.test(o.trim()));
        if (allOpt) {
          await hasWinnersSelect.selectOption({ label: allOpt });
        }
      }
      await expect(area).toContainText(seed.evtWithoutWinners.title);

      await assertCleanPrintOutput(page, {
        reportLabel: 'Event Winners',
        minPrintRows: 5,
      });
    });
  });

  /* ------------------------------------------------------------------------ */
  /*  R2: Attendance Time-In/Out View, DB Parity & CSV Parity                 */
  /* ------------------------------------------------------------------------ */

  test.describe('R2 — Attendance Time-In/Out Report View, DB & CSV Parity', () => {
    test('displays dual-sourced records with time-in/out & consistent missing-timeout placeholders matching DB and CSV', async ({
      page,
    }) => {
      await authenticateAs(page, seed.admin.token);
      await navigateToReports(page);

      const { dialog } = await selectReportAndOpenWizard(page, /attendance/i, 2);
      const area = dialog.locator('#printable-report-area');
      await expect(area).toBeVisible();

      // 1. Filter by our run prefix so we isolate our deterministic seeded cohort
      const searchInput = area
        .locator('input[type="text"], input[type="search"], input:not([type])')
        .first();
      await expect(searchInput).toBeVisible();
      await searchInput.fill(seed.prefix);

      // Verify both individual and institution participants appear
      await expect(area).toContainText(seed.memberUser.fullName);
      await expect(area).toContainText(seed.paginatedMembers[0].fullName);
      await expect(area).toContainText(`${seed.prefix} Inst Timed Out`);
      await expect(area).toContainText(`${seed.prefix} Inst No Timeout`);
      await expect(area).toContainText(`${seed.prefix} Inst In Venue`);
      await expect(area).toContainText(seed.paginatedMembers[2].fullName);
      await expect(area).toContainText(seed.paginatedMembers[3].fullName);

      // Rejected registration must be excluded by default
      await expect(area).not.toContainText(seed.paginatedMembers[1].fullName);

      // Verify consistent missing time-out placeholder appears for not_timed_out
      await expect(area).toContainText(/Not Timed Out/i);

      // 2. Cross-check underlying DB records directly
      const [dbRegRows] = await pool.execute<
        Array<{ full_name: string; checked_in_at: Date | null; checked_out_at: Date | null }>
      >(
        `SELECT u.full_name, er.checked_in_at, er.checked_out_at
         FROM event_registrations er
         JOIN users u ON u.id = er.member_id
         WHERE er.event_id IN (?, ?) AND er.status <> 'rejected'`,
        [seed.evtPastAttendance.id, seed.evtOngoing.id]
      );
      const [dbInstRows] = await pool.execute<
        Array<{ full_name: string; checked_in_at: Date | null; checked_out_at: Date | null }>
      >(
        `SELECT im.full_name, im.checked_in_at, im.checked_out_at
         FROM institution_members im
         WHERE im.event_id IN (?, ?) AND im.status <> 'rejected'`,
        [seed.evtPastAttendance.id, seed.evtOngoing.id]
      );

      const expectedNames = new Set([
        ...dbRegRows.map((r) => r.full_name),
        ...dbInstRows.map((r) => r.full_name),
      ]);
      expect(expectedNames.size).toBe(7);

      const uiTableAll = await extractTableDataFromArea(area, /participant|name|time\s*in/i);
      expect(uiTableAll.rows.length).toBe(expectedNames.size);

      // 3. Apply a second filter (source = Institution) -> verify UI & CSV match filtered subset 1:1
      const sourceSelect = area
        .locator('select')
        .filter({ has: page.locator('option', { hasText: /institution/i }) })
        .first();
      if ((await sourceSelect.count()) > 0 && (await sourceSelect.isVisible())) {
        const opts = await sourceSelect.locator('option').allTextContents();
        const instOpt = opts.find((o) => /institution/i.test(o) && !/^all/i.test(o.trim()));
        if (instOpt) {
          await sourceSelect.selectOption({ label: instOpt });
        }
      } else {
        const instBtn = area.getByRole('button', { name: /^Institution/i }).first();
        if ((await instBtn.count()) > 0 && (await instBtn.isVisible())) {
          await instBtn.click();
        }
      }

      const uiFiltered = await extractTableDataFromArea(area, /participant|name|time\s*in/i);
      expect(uiFiltered.rows.length).toBe(dbInstRows.length);

      const inViewExport = area.getByRole('button', { name: /export.*(csv|excel|table)/i }).first();
      const exportTrigger =
        (await inViewExport.count()) > 0 && (await inViewExport.isVisible())
          ? inViewExport
          : dialog.getByRole('button', { name: /^Export CSV$/i }).first();

      const csv = await downloadAndParseCsv(page, () => exportTrigger.click());
      expect(csv.rows.length).toBe(uiFiltered.rows.length);

      for (const dbRow of dbInstRows) {
        const matchingCsvRow = csv.rows.find((r) =>
          Object.values(r).some((val) => val.includes(dbRow.full_name))
        );
        expect(matchingCsvRow, `Missing ${dbRow.full_name} in attendance CSV`).toBeTruthy();

        const serialized = Object.values(matchingCsvRow!).join(' | ');
        if (dbRow.checked_out_at === null) {
          expect(serialized).toMatch(/Not Timed Out|—/);
        }
      }

      // 4. Boundary: empty search result does not crash
      await searchInput.fill(`${seed.prefix}__NO_MATCH__`);
      const emptyRows = await extractTableDataFromArea(area, /participant|name|time\s*in/i);
      expect(emptyRows.rows.length).toBe(0);

      // Restore prefix search for print check
      await searchInput.fill(seed.prefix);
      await expect(area).toContainText(`${seed.prefix} Inst Timed Out`);

      await assertCleanPrintOutput(page, {
        reportLabel: 'Attendance (Time-In / Time-Out)',
        minPrintRows: dbInstRows.length,
      });
    });
  });

  /* ------------------------------------------------------------------------ */
  /*  R3: Filtered CSV Parity, Unpaginated Print (>15 rows) & Toast Isolation */
  /* ------------------------------------------------------------------------ */

  test.describe('R3 — Filtered CSV Parity, Unpagination (>15 rows) & Toast Isolation', () => {
    test('inline Member Directory unpaginates from 15 to all seeded rows on print, restores on afterprint, and hides active Toasts', async ({
      page,
    }) => {
      await authenticateAs(page, seed.admin.token);
      await navigateToReports(page);

      const inlineArea = page.locator('#printable-report-area');
      await expect(inlineArea).toBeVisible();

      // Filter inline table to our 18+ seeded members so counts are deterministic
      const searchInput = inlineArea.getByPlaceholder('Search by name, email, role...');
      await searchInput.fill(seed.prefix);

      // Screen default pageSize is 15 -> must show 15 rows on screen
      const screenRows = inlineArea.locator('tbody tr');
      await expect(screenRows).toHaveCount(15);

      // Trigger an active toast notification ([role="status"]) via Wizard Step 3 Submit & Record Report
      await selectReportAndOpenWizard(page, /^Executive Summary$/i, 2);
      await page.locator('[role="dialog"]').getByRole('button', { name: /Proceed to Export & Submit/i }).first().click();
      await page.locator('[role="dialog"]').getByRole('button', { name: /Submit & Record Report/i }).click();
      await expect(page.locator('[role="status"]').first()).toBeVisible();

      // Stub window.print -> dispatch beforeprint, click inline Print button, verify >= 18 rows
      await stubWindowPrintWithEvents(page);
      await inlineArea.getByRole('button', { name: /^Print$/i }).click();

      await expect
        .poll(async () => inlineArea.locator('tbody tr').count(), { timeout: 5000 })
        .toBeGreaterThanOrEqual(18);

      await assertCleanPrintOutput(page, {
        reportLabel: 'Inline Member Directory (with active Toast)',
        minPrintRows: 18,
        assertToastHidden: true,
      });

      // Restore afterprint -> pagination must return to 15 rows on screen
      await restoreWindowPrintWithAfterPrint(page);
      await expect(inlineArea.locator('tbody tr')).toHaveCount(15);
    });

    test('Financial Summary exports ONLY filtered rows to CSV and unpaginates >15 rows on print/Save PDF', async ({
      page,
    }) => {
      await authenticateAs(page, seed.admin.token);
      await navigateToReports(page);

      const { dialog } = await selectReportAndOpenWizard(page, /^Financial Summary$/i, 2);
      const area = dialog.locator('#printable-report-area');
      await expect(area).toBeVisible();

      // Filter ledger to our prefix REF- -> 18 seeded payments
      const searchInput = area.getByPlaceholder('Search name, ref #, event...');
      await searchInput.fill(`${seed.prefix}REF-`);

      const ledgerRows = area.locator('table').last().locator('tbody tr');

      // Default pageSize is 15 on screen
      await expect(ledgerRows).toHaveCount(15);
      await expect(area).toContainText(/Showing 1 to 15 of 18 filtered entries/i);

      // Apply GCash channel pill filter -> 10 seeded GCash payments
      const gcashPill = area.locator('button').filter({ hasText: /^GCash/ }).first();
      await gcashPill.click();
      await expect(ledgerRows).toHaveCount(10);

      // Export CSV via in-view button and verify ONLY the 10 filtered GCash rows are exported
      const csv = await downloadAndParseCsv(page, () =>
        area.getByRole('button', { name: /^Export CSV$/i }).click()
      );
      expect(csv.rows.length).toBe(10);
      for (const row of csv.rows) {
        const serialized = Object.values(row).join(' ');
        expect(serialized).toContain(seed.prefix);
        expect(serialized).toMatch(/GCash/i);
      }

      // Reset to All Channels (18 rows) to verify unpagination on print
      await area.locator('button').filter({ hasText: /^All Channels/ }).first().click();
      await expect(ledgerRows).toHaveCount(15);

      await stubWindowPrintWithEvents(page);
      await dialog.getByRole('button', { name: /Print \/ Save PDF/i }).click();

      await expect
        .poll(async () => ledgerRows.count(), { timeout: 5000 })
        .toBe(18);

      await assertCleanPrintOutput(page, {
        reportLabel: 'Financial Summary (Unpaginated)',
        minPrintRows: 18,
      });

      await restoreWindowPrintWithAfterPrint(page);
      await expect(ledgerRows).toHaveCount(15);

      // Also verify Step 3 "Save PDF" triggers unpagination cleanly
      await dialog.getByRole('button', { name: /Proceed to Export & Submit/i }).first().click();
      await expect(dialog.getByRole('button', { name: /Save PDF/i })).toBeVisible();

      await stubWindowPrintWithEvents(page);
      await dialog.getByRole('button', { name: /Save PDF/i }).click();

      await expect
        .poll(async () => ledgerRows.count(), { timeout: 5000 })
        .toBe(18);

      await assertCleanPrintOutput(page, {
        reportLabel: 'Financial Summary Step 3 (Save PDF)',
        minPrintRows: 18,
      });

      await restoreWindowPrintWithAfterPrint(page);
    });
  });

  /* ------------------------------------------------------------------------ */
  /*  R3: Comprehensive @media print Isolation Sweep Across Remaining Views   */
  /* ------------------------------------------------------------------------ */

  test.describe('R3 — Full 12-View @media print Isolation Sweep', () => {
    test('Event Participation preserves clickable <button> data cells in print and hides nested Participant Roster modal', async ({
      page,
    }) => {
      await authenticateAs(page, seed.admin.token);
      await navigateToReports(page);

      const { dialog } = await selectReportAndOpenWizard(page, /^Event Participation$/i, 2);
      const area = dialog.locator('#printable-report-area');
      await expect(area).toBeVisible();
      await expect(area).toContainText(seed.evtWithWinners.title);

      // Assert data-bearing <button> cells (Event Title & Registered count) remain VISIBLE in print
      await assertCleanPrintOutput(page, {
        reportLabel: 'Event Participation',
        minPrintRows: 3,
        assertButtonsInReportVisible: true,
      });

      // Open nested Participant Roster modal, verify it is hidden in print while report stays intact
      const viewListBtn = area.getByRole('button', { name: /View List/i }).first();
      await viewListBtn.click();
      const nestedModal = page
        .locator('[role="dialog"]')
        .filter({ hasText: /Participant Roster/i })
        .first();
      await expect(nestedModal).toBeVisible();

      await page.emulateMedia({ media: 'print' });
      const nestedVisibleInPrint = await nestedModal.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      });
      await page.emulateMedia({ media: 'screen' });
      expect(nestedVisibleInPrint, 'Nested Participant Roster modal must be hidden in print').toBe(false);
    });

    const wizardViewsToSweep: Array<{ label: string; pattern: RegExp; viaStep1?: boolean }> = [
      { label: 'Executive Summary', pattern: /^Executive Summary$/i },
      { label: 'Membership Growth', pattern: /^Membership Growth$/i },
      { label: 'Member Directory & Roster', pattern: /^Member Directory & Roster$/i },
      { label: 'Complete Event', pattern: /^Complete Event$/i },
      { label: 'Revenue by Method', pattern: /^Revenue by Method$/i },
      { label: 'Election Tally', pattern: /^Election Tally$/i, viaStep1: true },
      { label: 'Partner Contributions', pattern: /^Partner Contributions$/i },
    ];

    for (const view of wizardViewsToSweep) {
      test(`@media print isolates #printable-report-area cleanly for ${view.label}`, async ({
        page,
      }) => {
        await authenticateAs(page, seed.admin.token);
        await navigateToReports(page);

        if (view.viaStep1) {
          const { dialog } = await selectReportAndOpenWizard(page, view.pattern, 1);
          const electionSelect = dialog
            .locator('select')
            .filter({ has: page.locator('option', { hasText: seed.prefix }) })
            .first();
          await expect(electionSelect).toBeVisible();
          const opts = await electionSelect.locator('option').allTextContents();
          const targetOpt = opts.find((o) => o.includes(seed.electionTitle));
          expect(targetOpt).toBeTruthy();
          await electionSelect.selectOption({ label: targetOpt! });
          await dialog.getByRole('button', { name: /Preview Detailed Report/i }).click();
          await expect(dialog.locator('#printable-report-area')).toBeVisible();
          await expect(page.getByText('Loading report data...')).toBeHidden({ timeout: 15000 });
        } else {
          await selectReportAndOpenWizard(page, view.pattern, 2);
        }

        await assertCleanPrintOutput(page, {
          reportLabel: view.label,
          minPrintRows: 1,
          assertButtonsInReportVisible: view.label === 'Complete Event',
        });
      });
    }
  });
});

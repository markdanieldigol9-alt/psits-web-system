import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import { Button } from '@/shared/components/Form';
import { exportToCSV } from '@/shared/utils/export';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  LogIn,
  LogOut,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Timer,
  Undo2,
  UserCheck,
  UserX,
  Users,
  AlertTriangle,
  X,
} from 'lucide-react';
import type {
  AttendanceTimeAction,
  EventAttendanceData,
  EventAttendanceParticipant,
} from '@/shared/types';

/* ────────────────────────────────────────────────────────────
 * Schedule helpers
 * ──────────────────────────────────────────────────────────── */

type AttendanceKey = 'not_arrived' | 'in_venue' | 'timed_out';
type StatusFilter = 'all' | AttendanceKey | 'late' | 'left_early';
type SourceFilter = 'all' | 'Individual Registration' | 'Institution Roster';
type SchedulePhase = 'unscheduled' | 'not_open' | 'gate_open' | 'in_progress' | 'ended';

interface RowState {
  key: AttendanceKey;
  timeInMs: number | null;
  timeOutMs: number | null;
  isLate: boolean;
  lateByMin: number;
  leftEarly: boolean;
  durationMin: number | null;
}

interface AttendanceRow extends EventAttendanceParticipant {
  state: RowState;
}

const DEFAULT_GRACE_MIN = 15;
const DEFAULT_OPENS_BEFORE_MIN = 120;

const parseMs = (iso?: string | null): number | null => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
};

const fmtTime = (ms: number | null) =>
  ms === null ? '—' : new Date(ms).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

const fmtDateTime = (ms: number | null) =>
  ms === null
    ? 'TBA'
    : new Date(ms).toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

const fmtShortDate = (ms: number | null) =>
  ms === null ? '' : new Date(ms).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

const fmtDuration = (min: number | null) => {
  if (min === null || min < 0) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** Normalized `YYYY-MM-DD HH:mm` for spreadsheet exports. */
const toExportDateTime = (ms: number | null) => {
  if (ms === null) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const computeRowState = (
  p: EventAttendanceParticipant,
  startMs: number | null,
  endMs: number | null,
  graceMin: number,
  nowMs: number
): RowState => {
  const timeInMs = parseMs(p.checkedInAt);
  const timeOutMs = parseMs(p.checkedOutAt);

  if (!p.isCheckedIn) {
    return { key: 'not_arrived', timeInMs: null, timeOutMs: null, isLate: false, lateByMin: 0, leftEarly: false, durationMin: null };
  }

  const lateThreshold = startMs !== null ? startMs + graceMin * 60000 : null;
  const isLate = timeInMs !== null && lateThreshold !== null && timeInMs > lateThreshold;
  const lateByMin = isLate && startMs !== null && timeInMs !== null ? Math.round((timeInMs - startMs) / 60000) : 0;

  if (timeOutMs !== null) {
    return {
      key: 'timed_out',
      timeInMs,
      timeOutMs,
      isLate,
      lateByMin,
      leftEarly: endMs !== null && timeOutMs < endMs,
      durationMin: timeInMs !== null ? (timeOutMs - timeInMs) / 60000 : null,
    };
  }

  // Still inside the venue: live duration, capped at the scheduled end.
  const liveEnd = endMs !== null ? Math.min(nowMs, endMs) : nowMs;
  return {
    key: 'in_venue',
    timeInMs,
    timeOutMs: null,
    isLate,
    lateByMin,
    leftEarly: false,
    durationMin: timeInMs !== null ? Math.max(0, (liveEnd - timeInMs) / 60000) : null,
  };
};

const STATUS_LABEL: Record<AttendanceKey, string> = {
  not_arrived: 'Not in Venue',
  in_venue: 'In Venue',
  timed_out: 'Timed Out',
};

/* ────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────── */

interface EventAttendanceSheetProps {
  eventId: string;
  eventTitle?: string;
  eventLocation?: string;
  /** Only admins & officers may record time in / time out. */
  canManage: boolean;
  /** Pre-applied institution filter (e.g. when opened from a delegation row). */
  initialInstitution?: string;
  /** Notifies the parent so delegation counters stay in sync. */
  onAttendanceChanged?: () => void;
}

export const EventAttendanceSheet = ({
  eventId,
  eventTitle,
  eventLocation,
  canManage,
  initialInstitution = 'all',
  onAttendanceChanged,
}: EventAttendanceSheetProps) => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [data, setData] = useState<EventAttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [search, setSearch] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState<string>(initialInstitution || 'all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const notify = useCallback(
    (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') =>
      addNotification({ userId: 'current', title, message, type, isRead: false }),
    [addNotification]
  );

  // Live clock so durations & schedule phase stay current.
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!eventId) return;
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      try {
        const res = await api.getEventAttendance(eventId);
        if (res.data?.success) {
          setData(res.data as EventAttendanceData);
          setNowMs(Date.now());
        }
      } catch (err: any) {
        notify('Attendance Error', err?.response?.data?.message || err?.message || 'Failed to load attendance sheet.', 'error');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [eventId, notify]
  );

  useEffect(() => {
    setSelected(new Set());
    void load();
  }, [load]);

  /* ── Schedule ───────────────────────────────────────────── */
  const schedule = data?.schedule;
  const startMs = parseMs(schedule?.startAt ?? data?.event?.startAt);
  const endMs = parseMs(schedule?.endAt ?? data?.event?.endAt);
  const graceMin = schedule?.lateGraceMinutes ?? DEFAULT_GRACE_MIN;
  const opensBeforeMin = schedule?.timeInOpensBeforeMinutes ?? DEFAULT_OPENS_BEFORE_MIN;
  const opensMs = parseMs(schedule?.timeInOpensAt) ?? (startMs !== null ? startMs - opensBeforeMin * 60000 : null);

  const phase: SchedulePhase = useMemo(() => {
    if (startMs === null) return 'unscheduled';
    if (opensMs !== null && nowMs < opensMs) return 'not_open';
    if (nowMs < startMs) return 'gate_open';
    if (endMs === null || nowMs <= endMs) return 'in_progress';
    return 'ended';
  }, [startMs, endMs, opensMs, nowMs]);

  const canTimeIn = canManage && (phase === 'gate_open' || phase === 'in_progress' || phase === 'unscheduled');
  const timeInBlockedReason =
    phase === 'not_open'
      ? `Time-in opens ${fmtDateTime(opensMs)}`
      : phase === 'ended'
      ? `Time-in closed — event ended ${fmtDateTime(endMs)}`
      : '';

  /* ── Rows ───────────────────────────────────────────────── */
  const rows: AttendanceRow[] = useMemo(
    () =>
      (data?.participants || []).map((p) => ({
        ...p,
        state: computeRowState(p, startMs, endMs, graceMin, nowMs),
      })),
    [data?.participants, startMs, endMs, graceMin, nowMs]
  );

  const institutions = useMemo(() => {
    const set = new Set<string>((data?.institutionBreakdown || []).map((i) => i.institutionName));
    if (initialInstitution && initialInstitution !== 'all') set.add(initialInstitution);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data?.institutionBreakdown, initialInstitution]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (institutionFilter !== 'all' && r.institutionName !== institutionFilter) return false;
      if (sourceFilter !== 'all' && r.registrationSource !== sourceFilter) return false;
      if (statusFilter === 'late' && !r.state.isLate) return false;
      if (statusFilter === 'left_early' && !r.state.leftEarly) return false;
      if (['not_arrived', 'in_venue', 'timed_out'].includes(statusFilter) && r.state.key !== statusFilter) return false;
      if (q) {
        const hay = `${r.fullName} ${r.institutionName} ${r.position || ''} ${r.email || ''} ${r.contactNumber || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, institutionFilter, sourceFilter, statusFilter]);

  const stats = useMemo(() => {
    const scope = institutionFilter === 'all' ? rows : rows.filter((r) => r.institutionName === institutionFilter);
    const inVenue = scope.filter((r) => r.state.key === 'in_venue').length;
    const timedOut = scope.filter((r) => r.state.key === 'timed_out').length;
    const arrived = inVenue + timedOut;
    return {
      total: scope.length,
      inVenue,
      timedOut,
      notArrived: scope.length - arrived,
      late: scope.filter((r) => r.state.isLate).length,
      rate: scope.length > 0 ? Math.round((arrived / scope.length) * 100) : 0,
    };
  }, [rows, institutionFilter]);

  const stillInVenueKeys = useMemo(
    () => rows.filter((r) => r.state.key === 'in_venue' && r.state.timeInMs !== null).map((r) => r.participantKey),
    [rows]
  );

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.participantKey)), [rows, selected]);
  const selectedTimeInKeys = selectedRows.filter((r) => r.state.key === 'not_arrived').map((r) => r.participantKey);
  const selectedTimeOutKeys = selectedRows
    .filter((r) => r.state.key === 'in_venue' && r.state.timeInMs !== null)
    .map((r) => r.participantKey);

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.participantKey));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredRows.forEach((r) => next.delete(r.participantKey));
      else filteredRows.forEach((r) => next.add(r.participantKey));
      return next;
    });
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* ── Actions (admin & officer only) ─────────────────────── */
  const runAction = async (keys: string[], action: AttendanceTimeAction, actionId: string) => {
    if (!canManage || keys.length === 0) return;
    if (action === 'reset' && !window.confirm('Reset attendance? This clears both the time in and time out for the selected participant(s).')) {
      return;
    }
    setBusyId(actionId);
    try {
      const res = await api.recordAttendanceTime(eventId, keys, action);
      if (res.data?.success) {
        const skipped = res.data.skippedCount ? ` (${res.data.skippedCount} skipped — not eligible)` : '';
        notify('Attendance Updated', `${res.data.message}${skipped}`, 'success');
        setSelected(new Set());
        await load(true);
        onAttendanceChanged?.();
      }
    } catch (err: any) {
      notify('Attendance Error', err?.response?.data?.message || err?.message || 'Failed to record attendance.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  /* ── Export / Print ─────────────────────────────────────── */
  const activeFilterLabel = [
    institutionFilter !== 'all' ? `School: ${institutionFilter}` : null,
    sourceFilter !== 'all' ? `Source: ${sourceFilter}` : null,
    statusFilter !== 'all' ? `Status: ${statusFilter.replace('_', ' ')}` : null,
    search.trim() ? `Search: "${search.trim()}"` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const buildExportRows = () =>
    filteredRows.map((r, idx) => ({
      '#': idx + 1,
      'Full Name': r.fullName,
      'School / Affiliation': r.institutionName,
      'Role / Position': r.position || 'Participant',
      'Email Address': r.email || '',
      'Contact Number': r.contactNumber || '',
      'Registration Source': r.registrationSource,
      'Time In': toExportDateTime(r.state.timeInMs),
      'Arrival Status': r.state.key === 'not_arrived' ? '' : r.state.isLate ? 'Late' : 'On Time',
      'Time Out': toExportDateTime(r.state.timeOutMs),
      'Departure Status': r.state.key === 'timed_out' ? (r.state.leftEarly ? 'Left Early' : 'Completed') : '',
      'Duration (mins)': r.state.durationMin !== null ? Math.round(r.state.durationMin) : '',
      'Attendance Status': STATUS_LABEL[r.state.key],
    }));

  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      notify('Nothing to Export', 'No attendance records match the current filters.', 'info');
      return;
    }
    const safeTitle = (eventTitle || 'Event').replace(/[^\w-]+/g, '_');
    exportToCSV(`${safeTitle}_Attendance_Sheet_${toExportDateTime(Date.now()).slice(0, 10)}`, buildExportRows());
  };

  const handlePrint = (mode: 'print' | 'pdf') => {
    const win = window.open('', '_blank', 'width=1200,height=850');
    if (!win) {
      notify('Pop-up Blocked', 'Allow pop-ups for this site to print or save the attendance sheet.', 'warning');
      return;
    }
    const exportRows = buildExportRows();
    const headers = ['#', 'Full Name', 'School / Affiliation', 'Role / Position', 'Registration Source', 'Time In', 'Arrival', 'Time Out', 'Departure', 'Duration', 'Status'];
    const bodyRows = exportRows
      .map(
        (r) => `<tr>
          <td class="c">${r['#']}</td>
          <td><strong>${escapeHtml(r['Full Name'])}</strong><div class="muted">${escapeHtml(r['Email Address'])}</div></td>
          <td>${escapeHtml(r['School / Affiliation'])}</td>
          <td>${escapeHtml(r['Role / Position'])}</td>
          <td>${escapeHtml(r['Registration Source'])}</td>
          <td class="c">${escapeHtml(r['Time In'] || '—')}</td>
          <td class="c">${escapeHtml(r['Arrival Status'] || '—')}</td>
          <td class="c">${escapeHtml(r['Time Out'] || '—')}</td>
          <td class="c">${escapeHtml(r['Departure Status'] || '—')}</td>
          <td class="c">${escapeHtml(r['Duration (mins)'] !== '' ? fmtDuration(Number(r['Duration (mins)'])) : '—')}</td>
          <td class="c"><strong>${escapeHtml(r['Attendance Status'])}</strong></td>
        </tr>`
      )
      .join('');

    const docTitle = `${eventTitle || 'Event'} - Attendance Sheet`;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escapeHtml(docTitle)}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm 10mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; margin: 0; font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        #printable-report-area { padding: 8px; }
        h1 { font-size: 16pt; margin: 0; }
        h2 { font-size: 11pt; margin: 2px 0 0; font-weight: 600; color: #374151; }
        .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 16px; margin: 12px 0; padding: 8px 10px; border: 1px solid #111827; font-size: 9pt; }
        .meta b { display: block; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .04em; color: #4b5563; }
        .summary { margin: 0 0 10px; font-size: 9pt; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #111827; padding: 4px 6px; vertical-align: top; text-align: left; }
        th { background: #e5e7eb; font-size: 8pt; text-transform: uppercase; letter-spacing: .03em; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        .c { text-align: center; }
        .muted { color: #6b7280; font-size: 8pt; }
        .footer { margin-top: 28px; display: flex; justify-content: space-between; font-size: 9pt; }
        .sig { width: 240px; border-top: 1px solid #111827; padding-top: 4px; text-align: center; }
      </style></head><body>
      <div id="printable-report-area">
        <h1>Event Attendance Sheet — Time In / Time Out</h1>
        <h2>${escapeHtml(eventTitle || 'Event')}${eventLocation ? ` • ${escapeHtml(eventLocation)}` : ''}</h2>
        <div class="meta">
          <div><b>Event Schedule</b>${escapeHtml(fmtDateTime(startMs))} – ${escapeHtml(fmtDateTime(endMs))}</div>
          <div><b>Generated</b>${escapeHtml(fmtDateTime(Date.now()))}</div>
          <div><b>Prepared By</b>${escapeHtml(user?.fullName || 'PSITS Officer')}</div>
          <div><b>Total Records</b>${exportRows.length}</div>
        </div>
        <div class="summary">
          <strong>Summary:</strong> ${stats.total} registered • ${stats.inVenue} in venue • ${stats.timedOut} timed out • ${stats.notArrived} not arrived • ${stats.late} late arrivals • ${stats.rate}% turnout
          ${activeFilterLabel ? `<br/><strong>Filters:</strong> ${escapeHtml(activeFilterLabel)}` : ''}
          <br/><span class="muted">Late = time in later than ${graceMin} minutes after the scheduled start. Left Early = time out before the scheduled end.</span>
        </div>
        <table>
          <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${bodyRows || `<tr><td colspan="${headers.length}" class="c">No records</td></tr>`}</tbody>
        </table>
        <div class="footer">
          <div class="sig">${escapeHtml(user?.fullName || '')}<br/><span class="muted">Prepared by</span></div>
          <div class="sig">&nbsp;<br/><span class="muted">Verified by</span></div>
        </div>
      </div>
      <script>window.onload = function(){ setTimeout(function(){ window.focus(); window.print(); }, 250); };</script>
      </body></html>`);
    win.document.close();
    if (mode === 'pdf') {
      notify('Save as PDF', 'Choose "Save as PDF" as the destination in the print dialog.', 'info');
    }
  };

  /* ── Render helpers ─────────────────────────────────────── */
  const phaseChip = (() => {
    switch (phase) {
      case 'not_open':
        return { label: `Time-in opens ${fmtTime(opensMs)} ${fmtShortDate(opensMs)}`, cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
      case 'gate_open':
        return { label: 'Gate open • Time-in accepted', cls: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' };
      case 'in_progress':
        return { label: 'Event in progress', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' };
      case 'ended':
        return { label: 'Event ended • Time-in closed', cls: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' };
      default:
        return { label: 'No schedule set', cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' };
    }
  })();

  const selectCls =
    'px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer';

  const statCards = [
    { label: 'Registered', value: stats.total, hint: 'Individual + roster', icon: Users, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400', filter: 'all' as StatusFilter },
    { label: 'In Venue', value: stats.inVenue, hint: 'Timed in, not out', icon: UserCheck, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400', filter: 'in_venue' as StatusFilter },
    { label: 'Timed Out', value: stats.timedOut, hint: 'Departed venue', icon: LogOut, tone: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400', filter: 'timed_out' as StatusFilter },
    { label: 'Not Arrived', value: stats.notArrived, hint: 'No time in yet', icon: UserX, tone: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300', filter: 'not_arrived' as StatusFilter },
    { label: 'Late Arrivals', value: stats.late, hint: `> ${graceMin} min after start`, icon: AlertTriangle, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400', filter: 'late' as StatusFilter },
  ];

  return (
    <div>
      {/* Schedule strip */}
      <div className="px-5 sm:px-6 py-4 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <CalendarClock size={14} className="text-blue-600 dark:text-blue-400" />
            <span>
              Schedule: <strong className="text-slate-900 dark:text-slate-100">{fmtDateTime(startMs)}</strong>
              {' → '}
              <strong className="text-slate-900 dark:text-slate-100">{fmtDateTime(endMs)}</strong>
            </span>
          </span>
          {startMs !== null && (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <LogIn size={13} className="text-emerald-600" /> Time-in opens <strong className="text-slate-900 dark:text-slate-100">{fmtTime(opensMs)}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <Clock size={13} className="text-amber-600" /> Late after <strong className="text-slate-900 dark:text-slate-100">{fmtTime(startMs + graceMin * 60000)}</strong>
              </span>
            </>
          )}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wide ${phaseChip.cls}`}>
            {phase === 'in_progress' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            {phaseChip.label}
          </span>
        </div>

        <div className="flex items-center gap-2 no-print">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="flex items-center gap-1.5 text-xs font-bold">
            <Download size={14} /> Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePrint('print')} className="flex items-center gap-1.5 text-xs font-bold">
            <Printer size={14} /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePrint('pdf')} className="flex items-center gap-1.5 text-xs font-bold">
            <FileText size={14} /> Save PDF
          </Button>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={isRefreshing || isLoading}
            title="Refresh attendance"
            aria-label="Refresh attendance"
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stat cards (click to filter) */}
      <div className="p-5 sm:p-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 border-b border-slate-200/80 dark:border-slate-800">
        {statCards.map((c) => {
          const Icon = c.icon;
          const active = statusFilter === c.filter;
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => setStatusFilter(c.filter)}
              aria-pressed={active}
              className={`p-3.5 rounded-xl text-left bg-white dark:bg-slate-900 border flex items-center gap-3 transition-all cursor-pointer ${
                active
                  ? 'border-blue-500 ring-2 ring-blue-500/15 shadow-xs'
                  : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${c.tone}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 truncate">{c.label}</p>
                <p className="text-xl font-black text-slate-900 dark:text-slate-100 leading-tight">{c.value}</p>
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">{c.hint}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center gap-3 no-print">
        <div className="relative w-full xl:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, school, role, contact..."
            aria-label="Search attendance"
            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
          <select value={institutionFilter} onChange={(e) => setInstitutionFilter(e.target.value)} className={selectCls} aria-label="Filter by school">
            <option value="all">All Schools / Affiliations</option>
            {institutions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)} className={selectCls} aria-label="Filter by registration source">
            <option value="all">All Sources</option>
            <option value="Individual Registration">Individual Registration</option>
            <option value="Institution Roster">Institution Roster</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={selectCls} aria-label="Filter by attendance status">
            <option value="all">All Statuses</option>
            <option value="not_arrived">Not in Venue</option>
            <option value="in_venue">In Venue</option>
            <option value="timed_out">Timed Out</option>
            <option value="late">Late Arrivals</option>
            <option value="left_early">Left Early</option>
          </select>
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
          Showing {filteredRows.length} of {rows.length}
        </span>
      </div>

      {/* Bulk action bar (admin & officer) */}
      {canManage && (selected.size > 0 || (phase === 'ended' && stillInVenueKeys.length > 0)) && (
        <div className="px-4 sm:px-5 py-3 bg-blue-50/70 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/50 flex flex-wrap items-center gap-2 no-print">
          {selected.size > 0 && (
            <>
              <span className="text-xs font-bold text-blue-900 dark:text-blue-200 mr-1">{selected.size} selected</span>
              <Button
                variant="success"
                size="sm"
                disabled={!canTimeIn || selectedTimeInKeys.length === 0 || busyId !== null}
                isLoading={busyId === 'bulk-in'}
                onClick={() => void runAction(selectedTimeInKeys, 'time_in', 'bulk-in')}
                className="flex items-center gap-1.5 text-xs font-bold"
                title={!canTimeIn ? timeInBlockedReason : undefined}
              >
                <LogIn size={14} /> Time In ({selectedTimeInKeys.length})
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={selectedTimeOutKeys.length === 0 || busyId !== null}
                isLoading={busyId === 'bulk-out'}
                onClick={() => void runAction(selectedTimeOutKeys, 'time_out', 'bulk-out')}
                className="flex items-center gap-1.5 text-xs font-bold"
              >
                <LogOut size={14} /> Time Out ({selectedTimeOutKeys.length})
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="text-xs font-semibold">
                Clear selection
              </Button>
            </>
          )}
          {phase === 'ended' && stillInVenueKeys.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={busyId !== null}
              isLoading={busyId === 'auto-out'}
              onClick={() => void runAction(stillInVenueKeys, 'auto_time_out', 'auto-out')}
              className="ml-auto flex items-center gap-1.5 text-xs font-bold border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              title={`Stamp ${fmtDateTime(endMs)} as time out for everyone still in venue`}
            >
              <Timer size={14} /> Auto Time-Out at Schedule End ({stillInVenueKeys.length})
            </Button>
          )}
        </div>
      )}

      {/* Attendance table */}
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-xl shimmer border border-slate-100 dark:border-slate-800" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <Users size={32} className="mx-auto text-slate-400 mb-2" />
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">No participants registered yet</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              Individual registrations and institution rosters for this event will appear here for time in / time out recording.
            </p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[620px] border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
            <table className="w-full min-w-[1080px] text-left text-xs sm:text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {canManage && (
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all visible participants"
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-3 py-3 w-10 text-center">#</th>
                  <th className="px-3 py-3">Participant</th>
                  <th className="px-3 py-3">School / Affiliation</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Time In</th>
                  <th className="px-3 py-3">Time Out</th>
                  <th className="px-3 py-3 text-center">Duration</th>
                  <th className="px-3 py-3">Status</th>
                  {canManage && <th className="px-3 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 10 : 8} className="px-4 py-10 text-center text-xs font-medium text-slate-500">
                      No participants match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r, idx) => {
                    const s = r.state;
                    const isSelected = selected.has(r.participantKey);
                    const rowBusy = busyId === r.participantKey;
                    return (
                      <tr
                        key={r.participantKey}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-blue-50/60 dark:bg-blue-950/20'
                            : s.key === 'in_venue'
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/10 hover:bg-emerald-50/60'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {canManage && (
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(r.participantKey)}
                              aria-label={`Select ${r.fullName}`}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-3 py-3 text-center text-xs font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-3">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{r.fullName}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                            {r.position || 'Participant'}
                            {r.contactNumber ? ` • ${r.contactNumber}` : ''}
                            {r.email ? ` • ${r.email}` : ''}
                          </p>
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-300">{r.institutionName}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
                              r.registrationSource === 'Institution Roster'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
                                : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800'
                            }`}
                          >
                            {r.registrationSource === 'Institution Roster' ? 'Institution Roster' : 'Individual'}
                          </span>
                        </td>
                        {/* Time In */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          {s.key === 'not_arrived' ? (
                            <span className="text-slate-400">—</span>
                          ) : s.timeInMs === null ? (
                            <span className="text-[11px] font-semibold text-slate-500">Checked in (time not recorded)</span>
                          ) : (
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{fmtTime(s.timeInMs)}</p>
                              <span
                                className={`inline-flex mt-0.5 px-1.5 py-px rounded text-[10px] font-bold ${
                                  s.isLate
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                }`}
                              >
                                {s.isLate ? `Late +${fmtDuration(s.lateByMin)}` : 'On Time'}
                              </span>
                            </div>
                          )}
                        </td>
                        {/* Time Out */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          {s.key === 'timed_out' ? (
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{fmtTime(s.timeOutMs)}</p>
                              <span
                                className={`inline-flex mt-0.5 px-1.5 py-px rounded text-[10px] font-bold ${
                                  s.leftEarly
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                }`}
                              >
                                {s.leftEarly ? 'Left Early' : 'Completed'}
                              </span>
                            </div>
                          ) : s.key === 'in_venue' ? (
                            phase === 'ended' ? (
                              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Awaiting time-out</span>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-500">Still in venue</span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-semibold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {fmtDuration(s.durationMin)}
                          {s.key === 'in_venue' && s.durationMin !== null && phase !== 'ended' && (
                            <span className="block text-[9px] font-bold uppercase text-emerald-600">live</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {s.key === 'in_venue' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> In Venue
                            </span>
                          ) : s.key === 'timed_out' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800 whitespace-nowrap">
                              <CheckCircle2 size={11} /> Timed Out
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 whitespace-nowrap">
                              <Clock size={11} /> Not in Venue
                            </span>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {s.key === 'not_arrived' && (
                                <Button
                                  variant="success"
                                  size="xs"
                                  disabled={!canTimeIn || busyId !== null}
                                  isLoading={rowBusy}
                                  onClick={() => void runAction([r.participantKey], 'time_in', r.participantKey)}
                                  title={!canTimeIn ? timeInBlockedReason : 'Record time in now'}
                                  className="flex items-center gap-1 text-[11px] font-bold whitespace-nowrap"
                                >
                                  <LogIn size={12} /> Time In
                                </Button>
                              )}
                              {s.key === 'in_venue' && s.timeInMs !== null && (
                                <Button
                                  variant="primary"
                                  size="xs"
                                  disabled={busyId !== null}
                                  isLoading={rowBusy}
                                  onClick={() => void runAction([r.participantKey], 'time_out', r.participantKey)}
                                  title="Record time out now"
                                  className="flex items-center gap-1 text-[11px] font-bold whitespace-nowrap"
                                >
                                  <LogOut size={12} /> Time Out
                                </Button>
                              )}
                              {s.key === 'timed_out' && (
                                <button
                                  type="button"
                                  disabled={busyId !== null}
                                  onClick={() => void runAction([r.participantKey], 'undo_time_out', `${r.participantKey}-undo`)}
                                  title="Undo time out (mark back in venue)"
                                  aria-label={`Undo time out for ${r.fullName}`}
                                  className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 disabled:opacity-40 cursor-pointer"
                                >
                                  <Undo2 size={15} />
                                </button>
                              )}
                              {s.key !== 'not_arrived' && (
                                <button
                                  type="button"
                                  disabled={busyId !== null}
                                  onClick={() => void runAction([r.participantKey], 'reset', `${r.participantKey}-reset`)}
                                  title="Reset attendance (clear time in & time out)"
                                  aria-label={`Reset attendance for ${r.fullName}`}
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 cursor-pointer"
                                >
                                  <RotateCcw size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
          Time-in opens {opensBeforeMin / 60}h before the scheduled start and closes at the scheduled end. Arrivals more than {graceMin} minutes after
          the start are marked <strong>Late</strong>; departures before the scheduled end are marked <strong>Left Early</strong>.
          {!canManage && ' Only admins and officers can record time in / time out.'}
        </p>
      </div>
    </div>
  );
};

export default EventAttendanceSheet;

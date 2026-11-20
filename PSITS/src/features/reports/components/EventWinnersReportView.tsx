import { useEffect, useMemo, useState } from 'react';
import { exportToCSV } from '@/shared/utils/export';
import { printReportDocument, usePrintExpansion } from '../utils/printReport';
import logo from '@/assets/image/PSITS_Logo.png';
import type {
  EventWinnersReportEvent,
  EventWinnersReportRow,
  EventWinnersReportSummary,
} from '@/shared/types';
import {
  Trophy,
  Medal,
  Award,
  Search,
  FileSpreadsheet,
  FileCheck2,
  Printer,
  Building2,
  Calendar,
  Filter,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

export interface EventWinnersReportViewProps {
  events?: EventWinnersReportEvent[];
  rows?: EventWinnersReportRow[];
  summary?: EventWinnersReportSummary | null;
  reportTitle?: string;
  initialEventId?: string;
  initialHasWinners?: 'all' | 'with_winners' | 'without_winners';
  initialStatusFilter?: 'all' | 'completed' | 'ongoing' | 'upcoming';
  dateRangeFilter?: 'all' | 'this_month' | 'last_30_days' | 'this_quarter' | 'this_year' | 'custom';
  startDateFilter?: string;
  endDateFilter?: string;
  preparedBy?: string;
  userRole?: string;
  onFilteredRowsChange?: (rows: EventWinnersReportRow[]) => void;
  onExportCSV?: (rows: EventWinnersReportRow[]) => void;
}

export const formatWinnerModeLabel = (mode?: string | null): string => {
  const m = String(mode || 'individual').toLowerCase();
  if (m === 'pair' || m === 'duo') return 'Pair / Duo';
  if (m === 'team' || m === 'group') return 'Team / Group';
  return 'Individual';
};

export const formatWinnerRankDisplay = (rankPosition?: number | null): string => {
  if (rankPosition === null || rankPosition === undefined || !Number.isFinite(Number(rankPosition))) {
    return '—';
  }
  return `#${Number(rankPosition)}`;
};

export const formatWinnerEventDate = (isoDate?: string | null): string => {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
};

export const buildWinnerRowsFromEvents = (
  events: EventWinnersReportEvent[] = []
): EventWinnersReportRow[] => {
  const result: EventWinnersReportRow[] = [];
  for (const ev of events) {
    const winners = Array.isArray(ev.winners) ? ev.winners : [];
    if (winners.length > 0) {
      for (const w of winners) {
        result.push({
          eventId: String(ev.eventId),
          eventTitle: ev.eventTitle,
          eventType: ev.eventType || 'seminar',
          eventMode: w.eventMode || ev.eventMode || 'individual',
          eventStatus: ev.eventStatus || 'upcoming',
          location: ev.location || '',
          startAt: ev.startAt || null,
          endAt: ev.endAt || null,
          isEsports: Boolean(ev.isEsports),
          esportsGame: ev.esportsGame || null,
          hasWinners: true,
          winnerCount: winners.length,
          winnerId: w.winnerId ? String(w.winnerId) : null,
          rankPosition: Number(w.rankPosition),
          awardTitle: w.awardTitle || 'Winner',
          participantName: w.participantName || '—',
          institutionName: w.institutionName || '—',
          points: Number(w.points || 0),
          scoreOrNotes: w.scoreOrNotes || null,
          awardedAt: w.awardedAt || null,
        });
      }
    } else {
      result.push({
        eventId: String(ev.eventId),
        eventTitle: ev.eventTitle,
        eventType: ev.eventType || 'seminar',
        eventMode: ev.eventMode || 'individual',
        eventStatus: ev.eventStatus || 'upcoming',
        location: ev.location || '',
        startAt: ev.startAt || null,
        endAt: ev.endAt || null,
        isEsports: Boolean(ev.isEsports),
        esportsGame: ev.esportsGame || null,
        hasWinners: false,
        winnerCount: 0,
        winnerId: null,
        rankPosition: null,
        awardTitle: 'No Winners Recorded',
        participantName: '—',
        institutionName: '—',
        points: 0,
        scoreOrNotes: null,
        awardedAt: null,
      });
    }
  }
  return result;
};

export const filterWinnerReportRows = (
  sourceRows: EventWinnersReportRow[],
  options: {
    eventId?: string;
    hasWinners?: 'all' | 'with_winners' | 'without_winners';
    status?: 'all' | 'completed' | 'ongoing' | 'upcoming';
    mode?: 'all' | 'individual' | 'pair' | 'team';
    searchQuery?: string;
    dateRangeFilter?: 'all' | 'this_month' | 'last_30_days' | 'this_quarter' | 'this_year' | 'custom';
    startDateFilter?: string;
    endDateFilter?: string;
  } = {}
): EventWinnersReportRow[] => {
  const {
    eventId = 'all',
    hasWinners = 'all',
    status = 'all',
    mode = 'all',
    searchQuery = '',
    dateRangeFilter = 'all',
    startDateFilter = '',
    endDateFilter = '',
  } = options;

  return sourceRows.filter((row) => {
    if (eventId && eventId !== 'all' && String(row.eventId) !== String(eventId)) {
      return false;
    }

    if (hasWinners === 'with_winners' && (!row.hasWinners || row.winnerId === null)) {
      return false;
    }
    if (hasWinners === 'without_winners' && row.hasWinners) {
      return false;
    }

    if (status && status !== 'all') {
      const st = String(row.eventStatus || '').toLowerCase();
      if (status === 'completed' && st !== 'completed' && st !== 'closed') return false;
      if (status === 'ongoing' && st !== 'ongoing') return false;
      if (status === 'upcoming' && st !== 'upcoming') return false;
    }

    if (mode && mode !== 'all') {
      const m = String(row.eventMode || 'individual').toLowerCase();
      const normalizedMode = m === 'group' ? 'team' : m;
      if (normalizedMode !== mode) return false;
    }

    if (dateRangeFilter !== 'all' && row.startAt) {
      const d = new Date(row.startAt);
      if (!Number.isNaN(d.getTime())) {
        const now = new Date();
        if (dateRangeFilter === 'this_month') {
          if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
        } else if (dateRangeFilter === 'last_30_days') {
          const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
          if (diffDays < 0 || diffDays > 30) return false;
        } else if (dateRangeFilter === 'this_quarter') {
          const curQ = Math.floor(now.getMonth() / 3);
          const recQ = Math.floor(d.getMonth() / 3);
          if (d.getFullYear() !== now.getFullYear() || curQ !== recQ) return false;
        } else if (dateRangeFilter === 'this_year') {
          if (d.getFullYear() !== now.getFullYear()) return false;
        } else if (dateRangeFilter === 'custom') {
          if (startDateFilter && d < new Date(`${startDateFilter}T00:00:00`)) return false;
          if (endDateFilter) {
            const end = new Date(`${endDateFilter}T23:59:59.999`);
            if (d > end) return false;
          }
        }
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const title = (row.eventTitle || '').toLowerCase();
      const type = (row.eventType || '').toLowerCase();
      const loc = (row.location || '').toLowerCase();
      const game = (row.esportsGame || '').toLowerCase();
      const award = (row.awardTitle || '').toLowerCase();
      const part = (row.participantName || '').toLowerCase();
      const inst = (row.institutionName || '').toLowerCase();
      const notes = (row.scoreOrNotes || '').toLowerCase();
      if (
        !title.includes(q) &&
        !type.includes(q) &&
        !loc.includes(q) &&
        !game.includes(q) &&
        !award.includes(q) &&
        !part.includes(q) &&
        !inst.includes(q) &&
        !notes.includes(q)
      ) {
        return false;
      }
    }

    return true;
  });
};

export const mapWinnerRowToCSVRecord = (row: EventWinnersReportRow, idx: number) => ({
  '#': idx + 1,
  'Event ID': row.eventId,
  'Event Title': row.eventTitle || '—',
  'Event Category': (row.eventType || 'General').toUpperCase(),
  'Competition Mode': formatWinnerModeLabel(row.eventMode),
  'Event Status': (row.eventStatus || 'upcoming').toUpperCase(),
  'Rank': formatWinnerRankDisplay(row.rankPosition),
  'Award Title': row.awardTitle || 'No Winners Recorded',
  'Winner (Participant / Team)': row.participantName || '—',
  'Institution / School': row.institutionName || '—',
  'Points': Number(row.points || 0),
  'Score / Notes': row.scoreOrNotes || '—',
  'Event Date': formatWinnerEventDate(row.startAt),
});

export const exportEventWinnersToCSV = (
  rows: EventWinnersReportRow[],
  reportTitle = 'Event Winners'
) => {
  const dataToExport = rows.map((row, idx) => mapWinnerRowToCSVRecord(row, idx));
  const cleanTitle = reportTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  exportToCSV(`PSITS_${cleanTitle}_Report`, dataToExport);
};

export const EventWinnersReportView = ({
  events = [],
  rows = [],
  reportTitle = 'Event Winners',
  initialEventId = 'all',
  initialHasWinners = 'all',
  initialStatusFilter = 'all',
  dateRangeFilter = 'all',
  startDateFilter = '',
  endDateFilter = '',
  preparedBy = 'Competitions & Awards Director',
  userRole = 'Officer',
  onFilteredRowsChange,
  onExportCSV,
}: EventWinnersReportViewProps) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId || 'all');
  const [hasWinnersFilter, setHasWinnersFilter] = useState<'all' | 'with_winners' | 'without_winners'>(
    initialHasWinners || 'all'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'ongoing' | 'upcoming'>(
    initialStatusFilter || 'all'
  );
  const [modeFilter, setModeFilter] = useState<'all' | 'individual' | 'pair' | 'team'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(15);
  const isPrinting = usePrintExpansion();

  useEffect(() => {
    setSelectedEventId(initialEventId || 'all');
  }, [initialEventId]);

  useEffect(() => {
    setHasWinnersFilter(initialHasWinners || 'all');
  }, [initialHasWinners]);

  useEffect(() => {
    setStatusFilter(initialStatusFilter || 'all');
  }, [initialStatusFilter]);

  const normalizedRows = useMemo(() => {
    if (Array.isArray(rows) && rows.length > 0) {
      return rows;
    }
    return buildWinnerRowsFromEvents(events);
  }, [rows, events]);

  const availableEvents = useMemo(() => {
    if (Array.isArray(events) && events.length > 0) {
      return events.map((e) => ({
        eventId: String(e.eventId),
        eventTitle: e.eventTitle,
        hasWinners: Boolean(e.hasWinners),
        winnerCount: Number(e.winnerCount || 0),
      }));
    }
    const map = new Map<
      string,
      { eventId: string; eventTitle: string; hasWinners: boolean; winnerCount: number }
    >();
    for (const r of normalizedRows) {
      const id = String(r.eventId);
      if (!map.has(id)) {
        map.set(id, {
          eventId: id,
          eventTitle: r.eventTitle,
          hasWinners: Boolean(r.hasWinners),
          winnerCount: Number(r.winnerCount || 0),
        });
      }
    }
    return Array.from(map.values());
  }, [events, normalizedRows]);

  const filteredRows = useMemo(() => {
    return filterWinnerReportRows(normalizedRows, {
      eventId: selectedEventId,
      hasWinners: hasWinnersFilter,
      status: statusFilter,
      mode: modeFilter,
      searchQuery,
      dateRangeFilter,
      startDateFilter,
      endDateFilter,
    });
  }, [
    normalizedRows,
    selectedEventId,
    hasWinnersFilter,
    statusFilter,
    modeFilter,
    searchQuery,
    dateRangeFilter,
    startDateFilter,
    endDateFilter,
  ]);

  useEffect(() => {
    onFilteredRowsChange?.(filteredRows);
  }, [filteredRows, onFilteredRowsChange]);

  const metrics = useMemo(() => {
    const distinctEvents = new Map<string, boolean>();
    let winnerEntries = 0;
    let totalPoints = 0;

    for (const row of filteredRows) {
      const evId = String(row.eventId);
      if (!distinctEvents.has(evId)) {
        distinctEvents.set(evId, Boolean(row.hasWinners));
      } else if (row.hasWinners) {
        distinctEvents.set(evId, true);
      }
      if (row.hasWinners && row.winnerId !== null) {
        winnerEntries += 1;
        totalPoints += Number(row.points || 0);
      }
    }

    let withWinners = 0;
    let withoutWinners = 0;
    distinctEvents.forEach((hasWin) => {
      if (hasWin) withWinners += 1;
      else withoutWinners += 1;
    });

    return {
      totalEvents: distinctEvents.size,
      eventsWithWinners: withWinners,
      eventsWithoutWinners: withoutWinners,
      totalWinnerEntries: winnerEntries,
      totalPointsAwarded: totalPoints,
    };
  }, [filteredRows]);

  const paginatedRows = useMemo(() => {
    if (isPrinting || pageSize === 'all') return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize, isPrinting]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const handleResetFilters = () => {
    setSelectedEventId('all');
    setHasWinnersFilter('all');
    setStatusFilter('all');
    setModeFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (onExportCSV) {
      onExportCSV(filteredRows);
      return;
    }
    exportEventWinnersToCSV(filteredRows, reportTitle);
  };

  return (
    <div className="space-y-6 text-gray-900" data-testid="event-winners-report-view">
      {/* Official PSITS Letterhead Header */}
      <div className="border-b-2 border-primary/90 pb-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src={logo}
              alt="PSITS Logo"
              className="h-14 w-14 object-contain shadow-xs rounded-full p-1 border border-primary/20 bg-white"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary/80 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  Official Competition & Winners Report
                </span>
                <span className="text-[10px] text-slate-600 font-mono tabular-nums">
                  REF: PSITS-WIN-{new Date().getFullYear()}-{String(metrics.totalEvents).padStart(3, '0')}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight mt-0.5 text-balance">
                PHILIPPINE SOCIETY OF INFORMATION TECHNOLOGY STUDENTS
              </h1>
              <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">
                Committee on Academic, Technical & Esports Competitions
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-slate-600 space-y-1 bg-gray-50/80 p-2.5 rounded-lg border border-gray-200 min-w-[210px] tabular-nums">
            <p>
              <strong className="text-gray-800">Report:</strong>{' '}
              <span className="font-semibold text-primary">{reportTitle.toUpperCase()}</span>
            </p>
            <p>
              <strong className="text-gray-800">Generated:</strong> {new Date().toLocaleDateString()} at{' '}
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p>
              <strong className="text-gray-800">Reporter:</strong> {preparedBy} ({userRole})
            </p>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs bg-primary/5 border border-primary/15 px-3 py-1.5 rounded-lg">
          <div className="flex items-center gap-2 text-primary font-medium">
            <FileCheck2 size={15} />
            <span>
              Official extraction of competition winners per event, including rank placements, points, and events pending winner proclamation.
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-600 tabular-nums">
            <span>
              Total Events: <strong>{metrics.totalEvents}</strong>
            </span>
            <span>•</span>
            <span>
              With Winners: <strong>{metrics.eventsWithWinners}</strong>
            </span>
            <span>•</span>
            <span>
              Without Winners: <strong>{metrics.eventsWithoutWinners}</strong>
            </span>
            <span>•</span>
            <span>
              Winner Entries: <strong>{metrics.totalWinnerEntries}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 print:break-inside-avoid">
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-blue-900 uppercase">Total Events</span>
          <p className="text-2xl font-black text-primary mt-1 tabular-nums" data-testid="winners-kpi-total-events">
            {metrics.totalEvents}
          </p>
          <p className="text-[11px] text-blue-700 mt-0.5">Events in scope</p>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-amber-900 uppercase">Events With Winners</span>
          <p className="text-2xl font-black text-amber-700 mt-1 tabular-nums" data-testid="winners-kpi-with-winners">
            {metrics.eventsWithWinners}
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5">Proclaimed results</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-slate-700 uppercase">No Winners Yet</span>
          <p className="text-2xl font-black text-slate-700 mt-1 tabular-nums" data-testid="winners-kpi-without-winners">
            {metrics.eventsWithoutWinners}
          </p>
          <p className="text-[11px] text-slate-600 mt-0.5">Unrecorded / non-competitive</p>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-emerald-900 uppercase">Total Winner Entries</span>
          <p className="text-2xl font-black text-emerald-700 mt-1 tabular-nums" data-testid="winners-kpi-total-entries">
            {metrics.totalWinnerEntries}
          </p>
          <p className="text-[11px] text-emerald-700 mt-0.5">Medals & placements</p>
        </div>

        <div className="bg-cyan-50/70 border border-cyan-200/80 rounded-xl p-3.5 col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold text-cyan-900 uppercase">Points Awarded</span>
          <p className="text-2xl font-black text-cyan-800 mt-1 tabular-nums" data-testid="winners-kpi-total-points">
            {metrics.totalPointsAwarded.toLocaleString()}
          </p>
          <p className="text-[11px] text-cyan-800 mt-0.5">Aggregate tally</p>
        </div>
      </div>

      {/* Winners per Event Registry Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden print:overflow-visible">
        <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Trophy size={16} className="text-amber-600" /> Official Winners per Event Extraction Table
            </h3>
            <p className="text-xs text-slate-600">
              Complete per-event breakdown of proclaimed winners, rankings, institutions, and unrecorded events.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto no-print">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                aria-label="Search winners report"
                placeholder="Search event, winner, school, award..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white text-gray-900"
              />
            </div>
            <button
              type="button"
              onClick={() => printReportDocument(reportTitle)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              <Printer size={14} /> Print
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              <FileSpreadsheet size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Interactive Filter Controls (Screen Only) */}
        <div className="p-3 bg-gray-50/50 border-b border-gray-200 flex flex-wrap items-center gap-2.5 text-xs no-print">
          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-gray-500" />
            <span className="text-[11px] font-semibold text-gray-600">Event:</span>
            <select
              aria-label="Filter winners by event"
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs font-medium focus:border-primary focus:outline-none"
            >
              <option value="all">All Events ({availableEvents.length})</option>
              {availableEvents.map((ev) => (
                <option key={ev.eventId} value={ev.eventId}>
                  {ev.eventTitle} ({ev.winnerCount} {ev.winnerCount === 1 ? 'winner' : 'winners'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-gray-600">Winners:</span>
            {[
              { id: 'all', label: 'All Events' },
              { id: 'with_winners', label: 'With Winners' },
              { id: 'without_winners', label: 'Without Winners' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setHasWinnersFilter(tab.id as any);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  hasWinnersFilter === tab.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-gray-600">Status:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'completed', label: 'Completed' },
              { id: 'ongoing', label: 'Ongoing' },
              { id: 'upcoming', label: 'Upcoming' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id as any);
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-gray-600">Mode:</span>
            {[
              { id: 'all', label: 'All Modes' },
              { id: 'individual', label: 'Individual' },
              { id: 'pair', label: 'Pair / Duo' },
              { id: 'team', label: 'Team / Group' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setModeFilter(tab.id as any);
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  modeFilter === tab.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(selectedEventId !== 'all' ||
            hasWinnersFilter !== 'all' ||
            statusFilter !== 'all' ||
            modeFilter !== 'all' ||
            searchQuery.trim() !== '') && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:bg-gray-100 cursor-pointer ml-auto"
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>

        {/* Structured Winners Data Table */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Event winners report table"
          className="overflow-x-auto max-h-[500px] overflow-y-auto print:overflow-visible print:max-h-none"
        >
          <table className="w-full text-left border-collapse text-xs" data-testid="event-winners-table">
            <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 sticky top-0 z-10 print:static">
              <tr>
                <th scope="col" className="px-2.5 py-2.5 text-right w-10 tabular-nums">#</th>
                <th scope="col" className="px-3 py-2.5">Event Title</th>
                <th scope="col" className="px-2.5 py-2.5">Category</th>
                <th scope="col" className="px-2.5 py-2.5">Mode</th>
                <th scope="col" className="px-2.5 py-2.5 text-center">Event Status</th>
                <th scope="col" className="px-2.5 py-2.5 text-right tabular-nums">Rank</th>
                <th scope="col" className="px-3 py-2.5">Award Title</th>
                <th className="px-3 py-2.5">Winner (Participant / Team)</th>
                <th className="px-3 py-2.5">Institution / School</th>
                <th className="px-2.5 py-2.5 text-right tabular-nums">Points</th>
                <th className="px-3 py-2.5">Score / Notes</th>
                <th className="px-2.5 py-2.5 text-right tabular-nums">Event Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-600">
                    No event winner records found matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const rowIndex =
                    isPrinting || pageSize === 'all' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                  const rankDisplay = formatWinnerRankDisplay(row.rankPosition);
                  const modeLabel = formatWinnerModeLabel(row.eventMode);
                  const dateDisplay = formatWinnerEventDate(row.startAt);
                  const isChampion = row.rankPosition === 1;
                  const isSecond = row.rankPosition === 2;
                  const isThird = row.rankPosition === 3;

                  return (
                    <tr
                      key={row.winnerId ? `win-${row.winnerId}` : `nowin-${row.eventId}-${idx}`}
                      data-testid="event-winner-row"
                      data-event-id={row.eventId}
                      data-has-winners={row.hasWinners ? 'true' : 'false'}
                      className={`transition-colors ${
                        row.hasWinners ? 'hover:bg-amber-50/30' : 'bg-gray-50/40 hover:bg-gray-100/50 text-slate-600'
                      }`}
                    >
                      <td className="px-2.5 py-2.5 text-right tabular-nums text-slate-600">{rowIndex}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-900">
                        <div>{row.eventTitle || '—'}</div>
                        {row.isEsports && row.esportsGame && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 font-medium mt-0.5 no-print">
                            <Gamepad2 size={11} />
                            <span>{row.esportsGame}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2.5 uppercase text-[11px] font-semibold text-gray-700">
                        {(row.eventType || 'General').toUpperCase()}
                      </td>
                      <td className="px-2.5 py-2.5 text-[11px] font-medium text-gray-700">
                        {modeLabel}
                      </td>
                      <td className="px-2.5 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            row.eventStatus === 'completed' || row.eventStatus === 'closed'
                              ? 'bg-blue-100 text-blue-800'
                              : row.eventStatus === 'ongoing'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {(row.eventStatus || 'upcoming').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums font-bold">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
                            isChampion
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : isSecond
                              ? 'bg-slate-200 text-slate-800 border border-slate-300'
                              : isThird
                              ? 'bg-orange-100 text-orange-900 border border-orange-300'
                              : row.rankPosition !== null
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'text-slate-600'
                          }`}
                        >
                          {rankDisplay}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold">
                        <span
                          className={
                            row.hasWinners
                              ? 'inline-flex items-center gap-1 text-gray-900'
                              : 'text-slate-600 font-normal'
                          }
                        >
                          {isChampion && <Trophy size={12} className="text-amber-600 shrink-0 no-print" />}
                          {isSecond && <Medal size={12} className="text-slate-600 shrink-0 no-print" />}
                          {isThird && <Award size={12} className="text-orange-600 shrink-0 no-print" />}
                          <span>{row.awardTitle || 'No Winners Recorded'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-gray-900">
                        {row.participantName || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-800">
                        <span className="inline-flex items-center gap-1">
                          {row.hasWinners && (
                            <Building2 size={12} className="text-slate-500 shrink-0 no-print" />
                          )}
                          <span>{row.institutionName || '—'}</span>
                        </span>
                      </td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums font-bold text-primary">
                        {Number(row.points || 0)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {row.scoreOrNotes || '—'}
                      </td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums text-slate-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 justify-end">
                          <Calendar size={11} className="text-slate-500 shrink-0 no-print" />
                          <span>{dateDisplay}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer (Hidden on Print) */}
        <div className="no-print px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 tabular-nums">
            <span>Rows per page:</span>
            <select
              aria-label="Winners rows per page"
              value={String(pageSize)}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded border border-gray-300 bg-white text-gray-900 font-semibold tabular-nums"
            >
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="50">50</option>
              <option value="all">All ({filteredRows.length})</option>
            </select>
            <span className="tabular-nums">
              Showing{' '}
              <strong>
                {filteredRows.length === 0
                  ? 0
                  : pageSize === 'all'
                  ? 1
                  : (currentPage - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong>
                {pageSize === 'all'
                  ? filteredRows.length
                  : Math.min(currentPage * pageSize, filteredRows.length)}
              </strong>{' '}
              of <strong>{filteredRows.length}</strong> entries
            </span>
          </div>

          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center gap-1.5 tabular-nums">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 font-semibold text-gray-700 tabular-nums">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Official Certification & Signatures */}
      <div className="border border-gray-300 rounded-xl p-5 bg-gray-50/50 space-y-4 certification-block">
        <div className="text-xs text-gray-700 border-l-4 border-primary pl-3">
          <p className="font-semibold text-gray-900 uppercase tracking-wide text-[11px] mb-0.5">
            Official Competition Results Certification
          </p>
          "I hereby certify that the above competition winners, rank placements, point allocations, and event records are true, verified, and officially recorded in the PSITS Regional Information System."
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 text-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Prepared & Verified By:</p>
            <div className="pt-8 border-b-2 border-gray-500 w-48"></div>
            <p className="font-extrabold text-gray-900 text-sm mt-1">{preparedBy}</p>
            <p className="text-[11px] text-slate-600 capitalize">{userRole} / Competitions & Events</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Attested & Approved By:</p>
            <div className="pt-8 border-b-2 border-gray-500 w-48 md:ml-auto"></div>
            <p className="font-extrabold text-gray-900 text-sm mt-1">Regional Organization President</p>
            <p className="text-[11px] text-slate-600">PSITS Regional Executive Council</p>
          </div>
        </div>
      </div>
    </div>
  );
};

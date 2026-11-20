import { useEffect, useMemo, useState } from 'react';
import { exportToCSV } from '@/shared/utils/export';
import { printReportDocument, usePrintExpansion } from '../utils/printReport';
import logo from '@/assets/image/PSITS_Logo.png';
import type {
  AttendanceReportEvent,
  AttendanceReportRecord,
  AttendanceReportSummary,
} from '@/shared/types';
import {
  Clock,
  UserCheck,
  LogOut,
  AlertTriangle,
  Search,
  FileSpreadsheet,
  FileCheck2,
  Printer,
  Building2,
  Filter,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

export interface AttendanceReportViewProps {
  records?: AttendanceReportRecord[];
  events?: AttendanceReportEvent[];
  institutions?: string[];
  summary?: AttendanceReportSummary | null;
  reportTitle?: string;
  initialEventId?: string;
  initialInstitution?: string;
  initialSource?: 'all' | 'individual' | 'institution';
  initialAttendanceStatus?: 'all' | 'timed_out' | 'in_venue' | 'not_timed_out' | 'not_arrived';
  dateRangeFilter?: 'all' | 'this_month' | 'last_30_days' | 'this_quarter' | 'this_year' | 'custom';
  startDateFilter?: string;
  endDateFilter?: string;
  preparedBy?: string;
  userRole?: string;
  onFilteredRecordsChange?: (records: AttendanceReportRecord[]) => void;
  onExportCSV?: (records: AttendanceReportRecord[]) => void;
}

export const formatAttendanceTimestamp = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
};

export const formatAttendanceTimeIn = (rec: AttendanceReportRecord): string => {
  if (!rec.isCheckedIn || !rec.checkedInAt) {
    return '—';
  }
  return formatAttendanceTimestamp(rec.checkedInAt);
};

export const formatAttendanceTimeOut = (rec: AttendanceReportRecord): string => {
  if (rec.isCheckedIn && rec.checkedOutAt) {
    return formatAttendanceTimestamp(rec.checkedOutAt);
  }
  if (rec.timeOutPlaceholder) {
    return rec.timeOutPlaceholder;
  }
  return rec.attendanceStatus === 'not_timed_out' ? 'Not Timed Out' : '—';
};

export const formatAttendanceDurationCell = (durationMinutes?: number | null): number | string => {
  if (durationMinutes === null || durationMinutes === undefined || !Number.isFinite(Number(durationMinutes))) {
    return '—';
  }
  return Number(durationMinutes);
};

export const formatAttendanceStatusCell = (rec: AttendanceReportRecord): string => {
  if (rec.attendanceStatusLabel) return rec.attendanceStatusLabel;
  switch (rec.attendanceStatus) {
    case 'timed_out':
      return 'Timed Out';
    case 'in_venue':
      return 'In Venue';
    case 'not_timed_out':
      return 'Not Timed Out';
    default:
      return 'Not in Venue';
  }
};

export const filterAttendanceReportRecords = (
  sourceRecords: AttendanceReportRecord[],
  options: {
    eventId?: string;
    institution?: string;
    source?: 'all' | 'individual' | 'institution';
    attendanceStatus?: 'all' | 'timed_out' | 'in_venue' | 'not_timed_out' | 'not_arrived';
    searchQuery?: string;
    dateRangeFilter?: 'all' | 'this_month' | 'last_30_days' | 'this_quarter' | 'this_year' | 'custom';
    startDateFilter?: string;
    endDateFilter?: string;
  } = {}
): AttendanceReportRecord[] => {
  const {
    eventId = 'all',
    institution = 'all',
    source = 'all',
    attendanceStatus = 'all',
    searchQuery = '',
    dateRangeFilter = 'all',
    startDateFilter = '',
    endDateFilter = '',
  } = options;

  return sourceRecords.filter((rec) => {
    if (eventId && eventId !== 'all' && String(rec.eventId) !== String(eventId)) {
      return false;
    }

    if (institution && institution !== 'all') {
      const inst = (rec.institutionName || '').toLowerCase().trim();
      const target = institution.toLowerCase().trim();
      if (inst !== target && !inst.includes(target)) return false;
    }

    if (source && source !== 'all') {
      const srcType = String(rec.sourceType || '').toLowerCase();
      const regSrc = String(rec.registrationSource || '').toLowerCase();
      if (source === 'individual' && srcType !== 'individual' && !regSrc.includes('individual')) {
        return false;
      }
      if (source === 'institution' && srcType !== 'institution' && !regSrc.includes('institution')) {
        return false;
      }
    }

    if (attendanceStatus && attendanceStatus !== 'all') {
      if (rec.attendanceStatus !== attendanceStatus) {
        return false;
      }
    }

    if (dateRangeFilter !== 'all') {
      const refDateStr = rec.eventStartAt || rec.checkedInAt || rec.registeredAt;
      if (refDateStr) {
        const d = new Date(refDateStr);
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
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = (rec.fullName || '').toLowerCase();
      const email = (rec.email || '').toLowerCase();
      const contact = (rec.contactNumber || '').toLowerCase();
      const inst = (rec.institutionName || '').toLowerCase();
      const pos = (rec.position || '').toLowerCase();
      const evTitle = (rec.eventTitle || '').toLowerCase();
      const statusLbl = formatAttendanceStatusCell(rec).toLowerCase();
      if (
        !name.includes(q) &&
        !email.includes(q) &&
        !contact.includes(q) &&
        !inst.includes(q) &&
        !pos.includes(q) &&
        !evTitle.includes(q) &&
        !statusLbl.includes(q)
      ) {
        return false;
      }
    }

    return true;
  });
};

export const mapAttendanceRecordToCSVRecord = (rec: AttendanceReportRecord, idx: number) => ({
  '#': idx + 1,
  'Participant ID': rec.participantKey || '—',
  'Participant Name': rec.fullName || '—',
  'Event Title': rec.eventTitle || '—',
  'Institution / Affiliation': rec.institutionName || 'PSITS Individual Member',
  'Role / Position': rec.position || 'Participant',
  'Registration Source': rec.registrationSource || 'Individual Registration',
  'Time In': formatAttendanceTimeIn(rec),
  'Time Out': formatAttendanceTimeOut(rec),
  'Duration (Mins)': formatAttendanceDurationCell(rec.durationMinutes),
  'Attendance Status': formatAttendanceStatusCell(rec),
});

export const exportAttendanceRecordsToCSV = (
  records: AttendanceReportRecord[],
  reportTitle = 'Attendance Time-In & Time-Out'
) => {
  const dataToExport = records.map((rec, idx) => mapAttendanceRecordToCSVRecord(rec, idx));
  const cleanTitle = reportTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  exportToCSV(`PSITS_${cleanTitle}_Report`, dataToExport);
};

export const AttendanceReportView = ({
  records = [],
  events = [],
  institutions = [],
  reportTitle = 'Attendance Time-In & Time-Out',
  initialEventId = 'all',
  initialInstitution = 'all',
  initialSource = 'all',
  initialAttendanceStatus = 'all',
  dateRangeFilter = 'all',
  startDateFilter = '',
  endDateFilter = '',
  preparedBy = 'Attendance & Registration Officer',
  userRole = 'Officer',
  onFilteredRecordsChange,
  onExportCSV,
}: AttendanceReportViewProps) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId || 'all');
  const [selectedInstitution, setSelectedInstitution] = useState<string>(initialInstitution || 'all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'individual' | 'institution'>(
    initialSource || 'all'
  );
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<
    'all' | 'timed_out' | 'in_venue' | 'not_timed_out' | 'not_arrived'
  >(initialAttendanceStatus || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(15);
  const isPrinting = usePrintExpansion();

  useEffect(() => {
    setSelectedEventId(initialEventId || 'all');
  }, [initialEventId]);

  useEffect(() => {
    setSelectedInstitution(initialInstitution || 'all');
  }, [initialInstitution]);

  useEffect(() => {
    setSourceFilter(initialSource || 'all');
  }, [initialSource]);

  useEffect(() => {
    setAttendanceStatusFilter(initialAttendanceStatus || 'all');
  }, [initialAttendanceStatus]);

  const availableEvents = useMemo(() => {
    if (Array.isArray(events) && events.length > 0) {
      return events.map((e) => ({ id: String(e.id), title: e.title }));
    }
    const map = new Map<string, string>();
    for (const r of records) {
      const id = String(r.eventId);
      if (id && !map.has(id)) {
        map.set(id, r.eventTitle || `Event #${id}`);
      }
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [events, records]);

  const availableInstitutions = useMemo(() => {
    const set = new Set<string>();
    institutions.forEach((inst) => {
      if (inst && inst.trim()) set.add(inst.trim());
    });
    records.forEach((r) => {
      if (r.institutionName && r.institutionName.trim()) {
        set.add(r.institutionName.trim());
      }
    });
    return Array.from(set).sort();
  }, [institutions, records]);

  const filteredRecords = useMemo(() => {
    return filterAttendanceReportRecords(records, {
      eventId: selectedEventId,
      institution: selectedInstitution,
      source: sourceFilter,
      attendanceStatus: attendanceStatusFilter,
      searchQuery,
      dateRangeFilter,
      startDateFilter,
      endDateFilter,
    });
  }, [
    records,
    selectedEventId,
    selectedInstitution,
    sourceFilter,
    attendanceStatusFilter,
    searchQuery,
    dateRangeFilter,
    startDateFilter,
    endDateFilter,
  ]);

  useEffect(() => {
    onFilteredRecordsChange?.(filteredRecords);
  }, [filteredRecords, onFilteredRecordsChange]);

  const metrics = useMemo(() => {
    let checkedInCount = 0;
    let timedOutCount = 0;
    let inVenueCount = 0;
    let notTimedOutCount = 0;
    let notArrivedCount = 0;
    let lateCount = 0;
    let leftEarlyCount = 0;

    for (const rec of filteredRecords) {
      if (rec.isCheckedIn) checkedInCount += 1;
      if (rec.attendanceStatus === 'timed_out') timedOutCount += 1;
      else if (rec.attendanceStatus === 'in_venue') inVenueCount += 1;
      else if (rec.attendanceStatus === 'not_timed_out') notTimedOutCount += 1;
      else notArrivedCount += 1;
      if (rec.isLate) lateCount += 1;
      if (rec.leftEarly) leftEarlyCount += 1;
    }

    return {
      totalRecords: filteredRecords.length,
      checkedInCount,
      timedOutCount,
      inVenueCount,
      notTimedOutCount,
      notArrivedCount,
      lateCount,
      leftEarlyCount,
    };
  }, [filteredRecords]);

  const paginatedRecords = useMemo(() => {
    if (isPrinting || pageSize === 'all') return filteredRecords;
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize, isPrinting]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredRecords.length / pageSize));

  const handleResetFilters = () => {
    setSelectedEventId('all');
    setSelectedInstitution('all');
    setSourceFilter('all');
    setAttendanceStatusFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (onExportCSV) {
      onExportCSV(filteredRecords);
      return;
    }
    exportAttendanceRecordsToCSV(filteredRecords, reportTitle);
  };

  return (
    <div className="space-y-6 text-gray-900" data-testid="attendance-report-view">
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
                  Official Attendance & Time Log Report
                </span>
                <span className="text-[10px] text-slate-600 font-mono tabular-nums">
                  REF: PSITS-ATT-{new Date().getFullYear()}-{String(metrics.totalRecords).padStart(4, '0')}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight mt-0.5 text-balance">
                PHILIPPINE SOCIETY OF INFORMATION TECHNOLOGY STUDENTS
              </h1>
              <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">
                Office of the Secretariat • Venue Time-In & Time-Out Audit Registry
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
              Unified venue attendance audit across individual registrations and school delegation rosters with Time-In and Time-Out timestamps.
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-600 tabular-nums">
            <span>
              Total Records: <strong>{metrics.totalRecords}</strong>
            </span>
            <span>•</span>
            <span>
              Timed In: <strong>{metrics.checkedInCount}</strong>
            </span>
            <span>•</span>
            <span>
              Timed Out: <strong>{metrics.timedOutCount}</strong>
            </span>
            <span>•</span>
            <span>
              In Venue: <strong>{metrics.inVenueCount}</strong>
            </span>
            <span>•</span>
            <span>
              Not Timed Out: <strong>{metrics.notTimedOutCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 print:break-inside-avoid">
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-blue-900 uppercase">Total Participants</span>
          <p className="text-2xl font-black text-primary mt-1 tabular-nums" data-testid="attendance-kpi-total">
            {metrics.totalRecords}
          </p>
          <p className="text-[11px] text-blue-700 mt-0.5">Enrolled records</p>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-emerald-900 uppercase">Timed In (Present)</span>
          <p className="text-2xl font-black text-emerald-700 mt-1 tabular-nums" data-testid="attendance-kpi-checked-in">
            {metrics.checkedInCount}
          </p>
          <p className="text-[11px] text-emerald-700 mt-0.5 tabular-nums">
            {metrics.lateCount > 0 ? `${metrics.lateCount} late arrival(s)` : 'Recorded time-in'}
          </p>
        </div>

        <div className="bg-cyan-50/70 border border-cyan-200/80 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-cyan-900 uppercase">Timed Out</span>
          <p className="text-2xl font-black text-cyan-800 mt-1 tabular-nums" data-testid="attendance-kpi-timed-out">
            {metrics.timedOutCount}
          </p>
          <p className="text-[11px] text-cyan-800 mt-0.5">Completed log</p>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-amber-900 uppercase">In Venue / Pending Out</span>
          <p className="text-2xl font-black text-amber-700 mt-1 tabular-nums" data-testid="attendance-kpi-pending-out">
            {metrics.inVenueCount + metrics.notTimedOutCount}
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5 tabular-nums">
            {metrics.inVenueCount} in venue • {metrics.notTimedOutCount} not timed out
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold text-slate-700 uppercase">Not in Venue</span>
          <p className="text-2xl font-black text-slate-700 mt-1 tabular-nums" data-testid="attendance-kpi-not-arrived">
            {metrics.notArrivedCount}
          </p>
          <p className="text-[11px] text-slate-600 mt-0.5">No check-in recorded</p>
        </div>
      </div>

      {/* Attendance Time-In & Time-Out Registry Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden print:overflow-visible">
        <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Clock size={16} className="text-primary" /> Official Attendance Time-In & Time-Out Log
            </h3>
            <p className="text-xs text-slate-600">
              Chronological participant check-in and check-out registry from stored attendance records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto no-print">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                aria-label="Search attendance report"
                placeholder="Search participant, school, event..."
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
              aria-label="Filter attendance by event"
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs font-medium focus:border-primary focus:outline-none"
            >
              <option value="all">All Events ({availableEvents.length})</option>
              {availableEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-gray-600">Source:</span>
            <select
              aria-label="Filter attendance by registration source"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs font-medium focus:border-primary focus:outline-none"
            >
              <option value="all">All Sources</option>
              <option value="individual">Individual Registration</option>
              <option value="institution">Institution Roster</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-gray-600">School / Affiliation:</span>
            <select
              aria-label="Filter attendance by institution"
              value={selectedInstitution}
              onChange={(e) => {
                setSelectedInstitution(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs font-medium focus:border-primary focus:outline-none max-w-[200px]"
            >
              <option value="all">All Schools / Affiliations ({availableInstitutions.length})</option>
              {availableInstitutions.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-gray-600">Attendance:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'timed_out', label: 'Timed Out' },
              { id: 'in_venue', label: 'In Venue' },
              { id: 'not_timed_out', label: 'Not Timed Out' },
              { id: 'not_arrived', label: 'Not in Venue' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setAttendanceStatusFilter(tab.id as any);
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  attendanceStatusFilter === tab.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(selectedEventId !== 'all' ||
            selectedInstitution !== 'all' ||
            sourceFilter !== 'all' ||
            attendanceStatusFilter !== 'all' ||
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

        {/* Structured Attendance Data Table */}
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto print:overflow-visible print:max-h-none">
          <table className="w-full text-left border-collapse text-xs" data-testid="attendance-report-table">
            <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 sticky top-0 z-10 print:static">
              <tr>
                <th className="px-2.5 py-2.5 text-right w-10 tabular-nums">#</th>
                <th className="px-2.5 py-2.5">Participant ID</th>
                <th className="px-3 py-2.5">Participant Name</th>
                <th className="px-3 py-2.5">Event Title</th>
                <th className="px-3 py-2.5">Institution / Affiliation</th>
                <th className="px-2.5 py-2.5">Role / Position</th>
                <th className="px-2.5 py-2.5 text-center">Registration Source</th>
                <th className="px-3 py-2.5 text-center tabular-nums">Time In</th>
                <th className="px-3 py-2.5 text-center tabular-nums">Time Out</th>
                <th className="px-2.5 py-2.5 text-right tabular-nums">Duration (Mins)</th>
                <th className="px-3 py-2.5 text-center">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-600">
                    No attendance records found matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((rec, idx) => {
                  const rowIndex =
                    isPrinting || pageSize === 'all' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                  const timeInDisplay = formatAttendanceTimeIn(rec);
                  const timeOutDisplay = formatAttendanceTimeOut(rec);
                  const durationDisplay = formatAttendanceDurationCell(rec.durationMinutes);
                  const statusDisplay = formatAttendanceStatusCell(rec);
                  const isIndividual =
                    rec.sourceType === 'individual' ||
                    rec.registrationSource === 'Individual Registration';

                  return (
                    <tr
                      key={rec.participantKey || `${rec.eventId}-${rec.fullName}-${idx}`}
                      data-testid="attendance-report-row"
                      data-participant-key={rec.participantKey}
                      data-event-id={rec.eventId}
                      data-attendance-status={rec.attendanceStatus}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="px-2.5 py-2.5 text-right tabular-nums text-slate-600">{rowIndex}</td>
                      <td className="px-2.5 py-2.5 font-mono tabular-nums text-[11px] text-slate-600">
                        {rec.participantKey || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-gray-900">
                        {rec.fullName || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">
                        {rec.eventTitle || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-800">
                        <span className="inline-flex items-center gap-1">
                          <Building2 size={12} className="text-slate-500 shrink-0 no-print" />
                          <span>{rec.institutionName || 'PSITS Individual Member'}</span>
                        </span>
                      </td>
                      <td className="px-2.5 py-2.5 text-gray-700">
                        {rec.position || 'Participant'}
                      </td>
                      <td className="px-2.5 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isIndividual
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-cyan-100 text-cyan-900 border border-cyan-200'
                          }`}
                        >
                          {rec.registrationSource || 'Individual Registration'}
                        </span>
                      </td>
                      <td
                        className="px-3 py-2.5 text-center tabular-nums text-[11px] font-semibold text-gray-900 whitespace-nowrap"
                        data-testid="attendance-cell-time-in"
                        data-raw-time-in={rec.checkedInAt || ''}
                      >
                        {timeInDisplay}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-center tabular-nums text-[11px] whitespace-nowrap ${
                          rec.checkedOutAt
                            ? 'font-semibold text-gray-900'
                            : rec.attendanceStatus === 'not_timed_out'
                            ? 'font-bold text-amber-700'
                            : 'text-slate-600'
                        }`}
                        data-testid="attendance-cell-time-out"
                        data-raw-time-out={rec.checkedOutAt || ''}
                      >
                        {timeOutDisplay}
                      </td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums text-slate-700">
                        {durationDisplay}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          data-testid="attendance-cell-status"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.attendanceStatus === 'timed_out'
                              ? 'bg-cyan-100 text-cyan-900 border border-cyan-200'
                              : rec.attendanceStatus === 'in_venue'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : rec.attendanceStatus === 'not_timed_out'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}
                        >
                          {rec.attendanceStatus === 'timed_out' && (
                            <LogOut size={11} className="shrink-0 no-print" />
                          )}
                          {rec.attendanceStatus === 'in_venue' && (
                            <CheckCircle2 size={11} className="shrink-0 no-print" />
                          )}
                          {rec.attendanceStatus === 'not_timed_out' && (
                            <AlertTriangle size={11} className="shrink-0 no-print" />
                          )}
                          {rec.attendanceStatus === 'not_arrived' && (
                            <UserCheck size={11} className="shrink-0 text-slate-500 no-print" />
                          )}
                          <span>{statusDisplay}</span>
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
              aria-label="Attendance rows per page"
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
              <option value="all">All ({filteredRecords.length})</option>
            </select>
            <span className="tabular-nums">
              Showing{' '}
              <strong>
                {filteredRecords.length === 0
                  ? 0
                  : pageSize === 'all'
                  ? 1
                  : (currentPage - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong>
                {pageSize === 'all'
                  ? filteredRecords.length
                  : Math.min(currentPage * pageSize, filteredRecords.length)}
              </strong>{' '}
              of <strong>{filteredRecords.length}</strong> entries
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
            Official Venue Attendance & Time-Log Certification
          </p>
          "I hereby certify that the above participant Time-In and Time-Out logs accurately reflect the stored attendance records in the PSITS Regional Information System."
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 text-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Prepared & Verified By:</p>
            <div className="pt-8 border-b-2 border-gray-500 w-48"></div>
            <p className="font-extrabold text-gray-900 text-sm mt-1">{preparedBy}</p>
            <p className="text-[11px] text-slate-600 capitalize">{userRole} / Attendance & Secretariat</p>
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

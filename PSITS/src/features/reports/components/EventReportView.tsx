import { useMemo, useState } from 'react';
import { exportToCSV } from '@/shared/utils/export';
import logo from '@/assets/image/PSITS_Logo.png';
import {
  CalendarCheck2,
  Search,
  FileSpreadsheet,
  FileCheck2,
  Printer,
} from 'lucide-react';

export interface EventRecord {
  id: string | number;
  title: string;
  description?: string;
  eventType?: string;
  category?: string;
  status: string;
  capacity?: number;
  registrations?: number;
  participantsCount?: number;
  fee?: number;
  startDate?: string;
  endDate?: string;
  date?: string;
  location?: string;
  isEsports?: boolean;
  esportsGame?: string;
  createdAt?: string;
}

interface EventReportViewProps {
  events: EventRecord[];
  reportTitle?: string;
  preparedBy?: string;
  userRole?: string;
}

export const EventReportView = ({
  events = [],
  reportTitle = 'Event Participation',
  preparedBy = 'Events Coordinator',
  userRole = 'Officer',
}: EventReportViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'ongoing' | 'upcoming'>('all');

  const isCompletedReport = reportTitle === 'Complete Event';

  // Base scope based on report type
  const baseEvents = useMemo(() => {
    if (isCompletedReport) {
      return events.filter((e) => e.status === 'completed' || e.status === 'closed');
    }
    return events;
  }, [events, isCompletedReport]);

  // Metrics
  const metrics = useMemo(() => {
    let totalCap = 0;
    let totalRegs = 0;
    let completedCount = 0;
    let upcomingCount = 0;
    let ongoingCount = 0;
    let totalEstimatedRevenue = 0;

    baseEvents.forEach((e) => {
      const cap = Number(e.capacity || 0);
      const regs = Number(e.registrations || e.participantsCount || 0);
      const fee = Number(e.fee || 0);

      totalCap += cap;
      totalRegs += regs;
      totalEstimatedRevenue += regs * fee;

      const st = String(e.status || '').toLowerCase();
      if (st === 'completed' || st === 'closed') completedCount += 1;
      else if (st === 'ongoing') ongoingCount += 1;
      else if (st === 'upcoming') upcomingCount += 1;
    });

    const averageTurnout = totalCap > 0 ? (totalRegs / totalCap) * 100 : 0;

    return {
      totalEvents: baseEvents.length,
      totalCap,
      totalRegs,
      completedCount,
      ongoingCount,
      upcomingCount,
      totalEstimatedRevenue,
      averageTurnout,
    };
  }, [baseEvents]);

  // Filtered by in-document search and status
  const filteredEvents = useMemo(() => {
    return baseEvents.filter((e) => {
      if (statusFilter !== 'all') {
        const st = String(e.status || '').toLowerCase();
        if (statusFilter === 'completed' && st !== 'completed' && st !== 'closed') return false;
        if (statusFilter === 'ongoing' && st !== 'ongoing') return false;
        if (statusFilter === 'upcoming' && st !== 'upcoming') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = (e.title || '').toLowerCase();
        const type = (e.eventType || e.category || '').toLowerCase();
        const loc = (e.location || '').toLowerCase();
        if (!title.includes(q) && !type.includes(q) && !loc.includes(q)) return false;
      }

      return true;
    });
  }, [baseEvents, statusFilter, searchQuery]);

  const handleExportSpreadsheet = () => {
    const dataToExport = filteredEvents.map((e) => ({
      'Event ID': e.id,
      'Event Title': e.title,
      'Event Category': e.eventType || e.category || 'General',
      'Event Status': (e.status || 'upcoming').toUpperCase(),
      'Max Capacity': e.capacity || 'Unlimited',
      'Registered Participants': e.registrations || e.participantsCount || 0,
      'Registration Fee (PHP)': Number(e.fee || 0).toFixed(2),
      'Location / Venue': e.location || 'Online / Campus',
      'Start Date': e.startDate || e.date || '—',
      'End Date': e.endDate || '—',
    }));
    exportToCSV(`${reportTitle.replace(/\s+/g, '_')}_Official_Report`, dataToExport);
  };

  return (
    <div className="space-y-6 text-gray-900">
      {/* Official Header */}
      <div className="border-b-2 border-primary/90 pb-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img src={logo} alt="PSITS Logo" className="h-14 w-14 object-contain shadow-xs rounded-full p-1 border border-primary/20 bg-white" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary/80 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  Official Operations Report
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  REF: PSITS-EVT-{new Date().getFullYear()}-{String(events.length).padStart(3, '0')}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight mt-0.5">
                PHILIPPINE SOCIETY OF INFORMATION TECHNOLOGY STUDENTS
              </h1>
              <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider">
                Committee on Events, Competitions & Student Activities
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-gray-600 space-y-1 bg-gray-50/80 p-2.5 rounded-lg border border-gray-200 min-w-[200px]">
            <p><strong className="text-gray-800">Report:</strong> <span className="font-semibold text-primary">{reportTitle.toUpperCase()}</span></p>
            <p><strong className="text-gray-800">Generated:</strong> {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p><strong className="text-gray-800">Reporter:</strong> {preparedBy} ({userRole})</p>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs bg-primary/5 border border-primary/15 px-3 py-1.5 rounded-lg">
          <div className="flex items-center gap-2 text-primary font-medium">
            <FileCheck2 size={15} />
            <span>{isCompletedReport ? 'Comprehensive summary of completed events and outcomes.' : 'View official participation counts and turnout analysis.'}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span>Total Events: <strong>{metrics.totalEvents}</strong></span>
            <span>•</span>
            <span>Total Attendees: <strong>{metrics.totalRegs.toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-blue-900 uppercase">Total Events</span>
          <p className="text-2xl font-black text-primary mt-1">{metrics.totalEvents}</p>
          <p className="text-[11px] text-blue-700 mt-0.5">Program inventory</p>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-emerald-900 uppercase">Total Participants</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">{metrics.totalRegs.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-700 mt-0.5">Across all events</p>
        </div>

        <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-purple-900 uppercase">Capacity Utilization</span>
          <p className="text-2xl font-black text-purple-800 mt-1">{metrics.averageTurnout.toFixed(1)}%</p>
          <p className="text-[11px] text-purple-700 mt-0.5">Seats filled</p>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-amber-900 uppercase">Completed Programs</span>
          <p className="text-2xl font-black text-amber-700 mt-1">{metrics.completedCount}</p>
          <p className="text-[11px] text-amber-700 mt-0.5">Finished & closed</p>
        </div>
      </div>

      {/* Events Registry Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <CalendarCheck2 size={16} className="text-primary" /> Event Roster & Participation Registry
            </h3>
            <p className="text-xs text-gray-500">Official log of events, venues, registration rates, and statuses.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search event, type, venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white text-gray-900"
              />
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              <Printer size={14} /> Print
            </button>
            <button
              type="button"
              onClick={handleExportSpreadsheet}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              <FileSpreadsheet size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Quick Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 bg-gray-50/50 border-b border-gray-200 text-xs no-print">
          <span className="text-[11px] font-semibold text-gray-500 mr-1">Status:</span>
          {[
            { id: 'all', label: `All (${baseEvents.length})` },
            { id: 'upcoming', label: `Upcoming (${metrics.upcomingCount})` },
            { id: 'ongoing', label: `Ongoing (${metrics.ongoingCount})` },
            { id: 'completed', label: `Completed (${metrics.completedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === tab.id
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto print:overflow-visible print:max-h-none">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5">Event Title</th>
                <th className="px-3 py-2.5">Type / Category</th>
                <th className="px-3 py-2.5">Venue / Location</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-right">Capacity</th>
                <th className="px-3 py-2.5 text-right">Registered</th>
                <th className="px-3 py-2.5 text-right">Fee (₱)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 italic">
                    No event records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((e) => (
                  <tr key={e.id} className="hover:bg-blue-50/30">
                    <td className="px-3 py-2.5 font-bold text-gray-900">
                      <div>{e.title}</div>
                      {e.isEsports && e.esportsGame && (
                        <span className="text-[10px] text-purple-700 font-medium">🎮 {e.esportsGame}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 capitalize">{e.eventType || e.category || 'General'}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-[11px]">{e.location || 'Online / Venue'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        e.status === 'completed' || e.status === 'closed'
                          ? 'bg-blue-100 text-blue-800'
                          : e.status === 'ongoing'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">{e.capacity || 'Unlimited'}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-primary">
                      {(e.registrations || e.participantsCount || 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      {Number(e.fee || 0) > 0 ? `₱${Number(e.fee).toLocaleString()}` : 'Free'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Certification Clause */}
      <div className="border border-gray-300 rounded-xl p-5 bg-gray-50/50 space-y-4 certification-block">
        <div className="text-xs text-gray-700 italic border-l-4 border-primary pl-3">
          <p className="font-semibold text-gray-900 not-italic uppercase tracking-wide text-[11px] mb-0.5">
            Official Certification
          </p>
          "I hereby certify that the above event participation metrics, attendance logs, and completed project outcomes are accurate and recorded in the PSITS Regional Information System."
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 text-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Prepared By:</p>
            <div className="pt-8 border-b-2 border-gray-500 w-48"></div>
            <p className="font-extrabold text-gray-900 text-sm mt-1">{preparedBy}</p>
            <p className="text-[11px] text-gray-500 capitalize">{userRole} / Operations</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Approved By:</p>
            <div className="pt-8 border-b-2 border-gray-500 w-48 md:ml-auto"></div>
            <p className="font-extrabold text-gray-900 text-sm mt-1">Regional Organization President</p>
            <p className="text-[11px] text-gray-500">PSITS Regional Executive Council</p>
          </div>
        </div>
      </div>
    </div>
  );
};

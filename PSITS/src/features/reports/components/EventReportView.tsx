import { useMemo, useState } from 'react';
import { exportToCSV } from '@/shared/utils/export';
import logo from '@/assets/image/PSITS_Logo.png';
import {
  CalendarCheck2,
  Search,
  FileSpreadsheet,
  FileCheck2,
  Printer,
  Users,
  Eye,
  CheckCircle2,
  Clock,
  Building2,
  UserCheck,
  Filter,
  X,
} from 'lucide-react';
import { Modal } from '@/shared/components/Common';
import { api } from '@/shared/services/api';

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
  total_participants?: number;
  direct_registrations?: number;
  institution_registrations?: number;
  fee?: number;
  registration_fee?: number;
  startDate?: string;
  endDate?: string;
  date?: string;
  location?: string;
  isEsports?: boolean;
  esportsGame?: string;
  createdAt?: string;
}

export interface EventParticipantItem {
  participant_key?: string;
  event_id?: string | number;
  event_title?: string;
  event_category?: string;
  full_name: string;
  email?: string;
  contact_number?: string;
  institution_name?: string;
  position?: string;
  registration_source?: string;
  registration_status?: string;
  is_checked_in?: boolean | number;
  registered_at?: string;
}

interface EventReportViewProps {
  events: EventRecord[];
  participants?: EventParticipantItem[];
  reportTitle?: string;
  preparedBy?: string;
  userRole?: string;
}

export const EventReportView = ({
  events = [],
  participants = [],
  reportTitle = 'Event Participation',
  preparedBy = 'Events Coordinator',
  userRole = 'Officer',
}: EventReportViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'ongoing' | 'upcoming'>('all');

  // Participant roster modal states
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [rosterParticipants, setRosterParticipants] = useState<EventParticipantItem[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterSourceFilter, setRosterSourceFilter] = useState<'all' | 'individual' | 'institution'>('all');
  const [rosterStatusFilter, setRosterStatusFilter] = useState<'all' | 'checked_in' | 'approved' | 'pending'>('all');

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
      const regs = Number(e.total_participants ?? e.registrations ?? e.participantsCount ?? 0);
      const fee = Number(e.fee ?? e.registration_fee ?? 0);

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
      'Registered Participants': Number(e.total_participants ?? e.registrations ?? e.participantsCount ?? 0),
      'Registration Fee (PHP)': Number(e.fee ?? e.registration_fee ?? 0).toFixed(2),
      'Location / Venue': e.location || 'Online / Campus',
      'Start Date': e.startDate || e.date || '—',
      'End Date': e.endDate || '—',
    }));
    exportToCSV(`${reportTitle.replace(/\s+/g, '_')}_Official_Report`, dataToExport);
  };

  // Open participant roster modal for a specific event
  const handleOpenParticipants = async (event: EventRecord) => {
    setSelectedEvent(event);
    setRosterSearch('');
    setRosterSourceFilter('all');
    setRosterStatusFilter('all');
    setIsParticipantsModalOpen(true);

    // Initial filter from preloaded participants
    const preloaded = participants.filter((p) => {
      const matchId = String(p.event_id) === String(event.id);
      const matchTitle = Boolean(
        p.event_title && event.title && p.event_title.trim().toLowerCase() === event.title.trim().toLowerCase()
      );
      return matchId || matchTitle;
    });
    setRosterParticipants(preloaded);

    // Always fetch fresh roster for this specific event to ensure latest registrations and check-ins
    setIsLoadingRoster(true);
    try {
      const { data } = await api.getEventParticipationReport({ eventId: String(event.id) });
      if (data?.success && Array.isArray(data.participants)) {
        setRosterParticipants(data.participants);
      }
    } catch (err) {
      console.error('Failed to fetch event roster:', err);
    } finally {
      setIsLoadingRoster(false);
    }
  };

  // Participant roster metrics
  const rosterMetrics = useMemo(() => {
    const total = rosterParticipants.length;
    let individualCount = 0;
    let institutionCount = 0;
    let checkedInCount = 0;
    let approvedCount = 0;

    rosterParticipants.forEach((p) => {
      if (p.registration_source === 'Individual Registration') individualCount++;
      else if (p.registration_source === 'Institution Roster') institutionCount++;

      const isChecked = p.is_checked_in === true || p.is_checked_in === 1 || String(p.is_checked_in) === 'true';
      if (isChecked) checkedInCount++;

      const st = String(p.registration_status || '').toLowerCase();
      if (st === 'approved') approvedCount++;
    });

    const checkInRate = total > 0 ? (checkedInCount / total) * 100 : 0;

    return {
      total,
      individualCount,
      institutionCount,
      checkedInCount,
      approvedCount,
      checkInRate,
    };
  }, [rosterParticipants]);

  // Filtered participants roster
  const filteredRoster = useMemo(() => {
    return rosterParticipants.filter((p) => {
      // Source filter
      if (rosterSourceFilter === 'individual' && p.registration_source !== 'Individual Registration') {
        return false;
      }
      if (rosterSourceFilter === 'institution' && p.registration_source !== 'Institution Roster') {
        return false;
      }

      // Status filter
      if (rosterStatusFilter === 'checked_in') {
        const isChecked = p.is_checked_in === true || p.is_checked_in === 1 || String(p.is_checked_in) === 'true';
        if (!isChecked) return false;
      } else if (rosterStatusFilter !== 'all') {
        const st = String(p.registration_status || '').toLowerCase();
        if (st !== rosterStatusFilter) return false;
      }

      // Search query
      if (rosterSearch.trim()) {
        const q = rosterSearch.toLowerCase();
        const name = (p.full_name || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        const contact = (p.contact_number || '').toLowerCase();
        const inst = (p.institution_name || '').toLowerCase();
        const pos = (p.position || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !contact.includes(q) && !inst.includes(q) && !pos.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [rosterParticipants, rosterSourceFilter, rosterStatusFilter, rosterSearch]);

  const handleExportRosterCSV = () => {
    if (!selectedEvent) return;
    const dataToExport = filteredRoster.map((p, idx) => ({
      'No.': idx + 1,
      'Participant Name': p.full_name,
      'Position / Role': p.position || 'Member',
      'Affiliation / Institution': p.institution_name || 'PSITS Individual Member',
      'Email Address': p.email || '—',
      'Contact Number': p.contact_number || '—',
      'Registration Source': p.registration_source || 'Individual Registration',
      'Registration Status': (p.registration_status || 'Approved').toUpperCase(),
      'Checked In (In Venue)': (p.is_checked_in === true || p.is_checked_in === 1 || String(p.is_checked_in) === 'true') ? 'YES' : 'NO',
      'Date Registered': p.registered_at ? new Date(p.registered_at).toLocaleString() : '—',
      'Event Title': selectedEvent.title,
      'Event ID': selectedEvent.id,
    }));
    const cleanTitle = selectedEvent.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    exportToCSV(`${cleanTitle}_Participant_Roster`, dataToExport);
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
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
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
                <th className="px-3 py-2.5 text-center no-print">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 italic">
                    No event records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((e) => {
                  const registeredCount = Number(e.total_participants ?? e.registrations ?? e.participantsCount ?? 0);
                  return (
                    <tr key={e.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-3 py-2.5 font-bold text-gray-900">
                        <button
                          type="button"
                          onClick={() => handleOpenParticipants(e)}
                          className="text-left font-bold text-gray-900 hover:text-primary transition-colors cursor-pointer"
                          title="Click to view participant roster"
                        >
                          {e.title}
                        </button>
                        {e.isEsports && e.esportsGame && (
                          <span className="block text-[10px] text-purple-700 font-medium">🎮 {e.esportsGame}</span>
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
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenParticipants(e)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-xs bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200 transition-colors cursor-pointer"
                          title="Click to view participant roster"
                        >
                          <Users size={12} />
                          <span>{registeredCount.toLocaleString()}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {Number(e.fee ?? e.registration_fee ?? 0) > 0 ? `₱${Number(e.fee ?? e.registration_fee).toLocaleString()}` : 'Free'}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap no-print">
                        <button
                          type="button"
                          onClick={() => handleOpenParticipants(e)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer border border-primary/20 shadow-2xs"
                          title={`View participant list for ${e.title}`}
                        >
                          <Eye size={12} />
                          <span>View List</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
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

      {/* Participant Roster Modal */}
      <Modal
        isOpen={isParticipantsModalOpen}
        onClose={() => setIsParticipantsModalOpen(false)}
        title={selectedEvent ? `Participant Roster: ${selectedEvent.title}` : 'Event Participants'}
        subtitle={
          selectedEvent
            ? `${selectedEvent.eventType || selectedEvent.category || 'General Event'} • ${selectedEvent.location || 'Venue TBD'} • ${
                selectedEvent.startDate ? new Date(selectedEvent.startDate).toLocaleDateString() : 'Date TBD'
              }`
            : undefined
        }
        size="2xl"
      >
        <div className="space-y-4">
          {/* Roster KPI Summary Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-blue-900 font-bold text-[11px] uppercase tracking-wide">
                <Users size={13} className="text-blue-700" />
                <span>Total Registered</span>
              </div>
              <p className="text-2xl font-black text-primary mt-1">{rosterMetrics.total}</p>
              <p className="text-[10px] text-blue-600 mt-0.5">Enrolled participants</p>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-[11px] uppercase tracking-wide">
                <UserCheck size={13} className="text-emerald-700" />
                <span>In-Venue Attendance</span>
              </div>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                {rosterMetrics.checkedInCount}{' '}
                <span className="text-xs font-semibold text-emerald-600">
                  ({rosterMetrics.checkInRate.toFixed(1)}%)
                </span>
              </p>
              <p className="text-[10px] text-emerald-600 mt-0.5">Checked-in attendees</p>
            </div>

            <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-sky-900 font-bold text-[11px] uppercase tracking-wide">
                <Users size={13} className="text-sky-700" />
                <span>Individual Signups</span>
              </div>
              <p className="text-2xl font-black text-sky-700 mt-1">{rosterMetrics.individualCount}</p>
              <p className="text-[10px] text-sky-600 mt-0.5">Direct member entries</p>
            </div>

            <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-purple-900 font-bold text-[11px] uppercase tracking-wide">
                <Building2 size={13} className="text-purple-700" />
                <span>Institution Roster</span>
              </div>
              <p className="text-2xl font-black text-purple-700 mt-1">{rosterMetrics.institutionCount}</p>
              <p className="text-[10px] text-purple-600 mt-0.5">School batch delegations</p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-gray-50/80 p-3 rounded-xl border border-gray-200">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search participant name, email, school, role..."
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-gray-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white text-gray-900"
              />
              {rosterSearch && (
                <button
                  type="button"
                  onClick={() => setRosterSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Registration Source Filter */}
              <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-0.5 text-xs">
                <span className="text-[10px] text-gray-400 px-1 font-semibold flex items-center gap-0.5">
                  <Filter size={10} /> Source:
                </span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'individual', label: 'Individual' },
                  { id: 'institution', label: 'Institution' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setRosterSourceFilter(s.id as any)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      rosterSourceFilter === s.id
                        ? 'bg-primary text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-0.5 text-xs">
                <span className="text-[10px] text-gray-400 px-1 font-semibold">Status:</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'checked_in', label: 'Checked In' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'pending', label: 'Pending' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setRosterStatusFilter(st.id as any)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      rosterStatusFilter === st.id
                        ? 'bg-primary text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <button
                type="button"
                onClick={handleExportRosterCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
                title="Export this event's participant roster as CSV"
              >
                <FileSpreadsheet size={13} /> Export CSV
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-center w-10">#</th>
                    <th className="px-3 py-2">Participant Name</th>
                    <th className="px-3 py-2">Affiliation / School</th>
                    <th className="px-3 py-2">Contact Details</th>
                    <th className="px-3 py-2 text-center">Source</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-center">Attendance</th>
                    <th className="px-3 py-2 text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoadingRoster ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          <span className="text-xs font-medium text-gray-600">Loading participant roster...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500 italic">
                        {rosterParticipants.length === 0
                          ? 'No participants registered for this event yet.'
                          : 'No participants match the selected filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((p, idx) => {
                      const isCheckedIn = p.is_checked_in === true || p.is_checked_in === 1 || String(p.is_checked_in) === 'true';
                      const isIndividual = p.registration_source === 'Individual Registration';

                      return (
                        <tr key={p.participant_key || `${p.full_name}-${idx}`} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-3 py-2 text-center text-gray-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-bold text-gray-900">{p.full_name}</div>
                            {p.position && (
                              <div className="text-[11px] text-gray-500 font-medium">{p.position}</div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 text-gray-800 font-medium">
                              <Building2 size={12} className="text-gray-400 shrink-0" />
                              <span className="truncate max-w-[200px]" title={p.institution_name || 'Individual Member'}>
                                {p.institution_name || 'PSITS Individual Member'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {p.email && <div className="text-gray-700 font-mono text-[11px]">{p.email}</div>}
                            {p.contact_number && (
                              <div className="text-gray-500 text-[10px]">{p.contact_number}</div>
                            )}
                            {!p.email && !p.contact_number && <span className="text-gray-400 italic">—</span>}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isIndividual
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-purple-100 text-purple-800 border border-purple-200'
                              }`}
                            >
                              {isIndividual ? 'Individual' : 'Institution'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                String(p.registration_status || '').toLowerCase() === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : String(p.registration_status || '').toLowerCase() === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {p.registration_status || 'Approved'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isCheckedIn ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 size={11} className="text-emerald-700" />
                                Checked In
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                <Clock size={11} className="text-gray-400" />
                                Not in Venue
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500 text-[11px] whitespace-nowrap font-mono">
                            {p.registered_at ? new Date(p.registered_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-500 gap-2">
              <div>
                Showing <strong className="text-gray-800">{filteredRoster.length}</strong> of{' '}
                <strong className="text-gray-800">{rosterParticipants.length}</strong> registered participants
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsParticipantsModalOpen(false)}
                  className="px-3 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import { Card, Button, Badge } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import {
  Trophy,
  Building2,
  Users,
  MapPin,
  Calendar,
  CheckCircle2,
  Search,
  RefreshCw,
  UserCheck,
  Award,
  ChevronRight,
  Filter,
  Check,
  X,
} from 'lucide-react';
import type {
  InstitutionLeaderboardData,
  EventLeaderboardInstitution,
  EventLeaderboardParticipant,
} from '@/shared/types';

export const InstitutionEventLeaderboard = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [data, setData] = useState<InstitutionLeaderboardData | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'all_in_venue' | 'partial' | 'not_in_venue'>('all');

  // Modal state for viewing institution participants
  const [activeInstitution, setActiveInstitution] = useState<EventLeaderboardInstitution | null>(null);
  const [participantSearch, setParticipantSearch] = useState<string>('');
  const [togglingParticipantId, setTogglingParticipantId] = useState<string | null>(null);
  const [isBulkChecking, setIsBulkChecking] = useState<boolean>(false);

  const canManage =
    user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  const loadLeaderboard = useCallback(
    async (eventId?: string, showRefreshIndicator = false) => {
      if (showRefreshIndicator) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const res = await api.getInstitutionLeaderboard(eventId);
        if (res.data?.success) {
          setData(res.data);
          if (res.data.selectedEvent?.id) {
            setSelectedEventId(res.data.selectedEvent.id);
          }
          // If modal is open, sync active institution data
          if (activeInstitution) {
            const updatedInst = res.data.leaderboard.find(
              (i) => i.institutionId === activeInstitution.institutionId
            );
            if (updatedInst) setActiveInstitution(updatedInst);
          }
        }
      } catch (err: any) {
        addNotification({
          userId: 'current',
          title: 'Leaderboard Error',
          message: err?.response?.data?.message || err?.message || 'Failed to load institution leaderboard.',
          type: 'error',
          isRead: false,
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeInstitution?.institutionId]
  );

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    void loadLeaderboard(eventId);
  };

  const handleToggleAttendance = async (
    participant: EventLeaderboardParticipant,
    institutionId: string
  ) => {
    setTogglingParticipantId(participant.id);
    const nextCheckedIn = !participant.checkedIn;

    try {
      const res = await api.toggleParticipantAttendance({
        participantId: participant.id,
        checkedIn: nextCheckedIn,
      });

      if (res.data?.success) {
        addNotification({
          userId: 'current',
          title: nextCheckedIn ? 'Marked In Venue' : 'Attendance Removed',
          message: `${participant.fullName} is now ${nextCheckedIn ? 'verified in venue' : 'marked as not yet in venue'}.`,
          type: 'success',
          isRead: false,
        });

        // Optimistically update active institution modal
        if (activeInstitution && activeInstitution.institutionId === institutionId) {
          const updatedParts = activeInstitution.participants.map((p) =>
            p.id === participant.id
              ? { ...p, checkedIn: nextCheckedIn, checkedInAt: nextCheckedIn ? new Date().toISOString() : null }
              : p
          );
          const inVenue = updatedParts.filter((p) => p.checkedIn).length;
          const reg = activeInstitution.registeredCount;
          const allIn = reg > 0 && inVenue >= reg;
          setActiveInstitution({
            ...activeInstitution,
            participants: updatedParts,
            inVenueCount: inVenue,
            attendanceRate: reg > 0 ? Math.round((inVenue / reg) * 100) : 0,
            allInVenue: allIn,
            status: allIn ? 'All in Venue' : inVenue > 0 ? `Arriving (${inVenue}/${reg})` : 'Not in Venue',
          });
        }

        // Refresh entire leaderboard to keep ranks accurate
        void loadLeaderboard(selectedEventId, true);
      }
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Check-in Error',
        message: err?.response?.data?.message || err?.message || 'Failed to update attendance.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setTogglingParticipantId(null);
    }
  };

  const handleBulkCheckAll = async (institution: EventLeaderboardInstitution, checkIn: boolean) => {
    if (!selectedEventId) return;
    setIsBulkChecking(true);

    try {
      const res = await api.checkAllInstitutionParticipants({
        eventId: selectedEventId,
        institutionUserId: institution.institutionId,
        checkedIn: checkIn,
      });

      if (res.data?.success) {
        addNotification({
          userId: 'current',
          title: checkIn ? 'All Checked In' : 'Attendance Cleared',
          message: res.data.message || `Attendance updated for ${institution.institutionName}.`,
          type: 'success',
          isRead: false,
        });

        // Optimistically update active institution
        if (activeInstitution && activeInstitution.institutionId === institution.institutionId) {
          const updatedParts = activeInstitution.participants.map((p) => ({
            ...p,
            checkedIn: checkIn,
            checkedInAt: checkIn ? new Date().toISOString() : null,
          }));
          const inVenue = checkIn ? updatedParts.length : 0;
          setActiveInstitution({
            ...activeInstitution,
            participants: updatedParts,
            inVenueCount: inVenue,
            attendanceRate: checkIn ? 100 : 0,
            allInVenue: checkIn,
            status: checkIn ? 'All in Venue' : 'Not in Venue',
          });
        }

        void loadLeaderboard(selectedEventId, true);
      }
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Bulk Update Failed',
        message: err?.response?.data?.message || err?.message || 'Failed to update all participants.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsBulkChecking(false);
    }
  };

  // Filtered leaderboard
  const filteredLeaderboard = useMemo(() => {
    if (!data?.leaderboard) return [];

    let list = [...data.leaderboard];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.institutionName.toLowerCase().includes(q) ||
          i.institutionEmail?.toLowerCase().includes(q) ||
          i.participants.some((p) => p.fullName.toLowerCase().includes(q))
      );
    }

    if (statusFilter === 'all_in_venue') {
      list = list.filter((i) => i.allInVenue);
    } else if (statusFilter === 'partial') {
      list = list.filter((i) => i.inVenueCount > 0 && !i.allInVenue);
    } else if (statusFilter === 'not_in_venue') {
      list = list.filter((i) => i.inVenueCount === 0);
    }

    return list;
  }, [data?.leaderboard, searchQuery, statusFilter]);

  // Modal participants filtered
  const filteredParticipants = useMemo(() => {
    if (!activeInstitution?.participants) return [];
    if (!participantSearch.trim()) return activeInstitution.participants;
    const q = participantSearch.toLowerCase();
    return activeInstitution.participants.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.position?.toLowerCase().includes(q)
    );
  }, [activeInstitution?.participants, participantSearch]);

  const canEditInstitutionAttendance = (institution: EventLeaderboardInstitution) => {
    if (canManage) return true;
    return String(user?.id) === String(institution.institutionId);
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-yellow-950 font-black shadow-md shadow-amber-400/30 text-sm">
          🥇
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-slate-300 to-gray-200 text-slate-800 font-black shadow-md shadow-slate-300/30 text-sm">
          🥈
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-amber-700 to-amber-600 text-white font-black shadow-md shadow-amber-700/30 text-sm">
          🥉
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700">
        #{rank}
      </div>
    );
  };

  const summary = data?.summary || {
    totalInstitutions: 0,
    totalRegisteredParticipants: 0,
    totalInVenue: 0,
    overallAttendanceRate: 0,
    fullyPresentInstitutions: 0,
  };

  const selectedEvent = data?.selectedEvent;
  const events = data?.events || [];

  return (
    <div className="space-y-6">
      {/* ── Main Leaderboard Card ────────────────────────────── */}
      <Card className="overflow-hidden border border-blue-100/80 dark:border-slate-800 shadow-card-md">
        {/* Header with Title & Event Selector */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-t-2xl relative overflow-hidden">
          {/* Subtle background glow effect */}
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 left-1/3 w-36 h-36 bg-indigo-300/10 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/15 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
                  <Trophy className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    Institution Event Leaderboard
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-sm uppercase tracking-wider">
                      Live Attendance
                    </span>
                  </h2>
                  <p className="text-blue-100 text-xs sm:text-sm mt-0.5">
                    Track registered institutions, participant headcounts, and venue check-in turnout in real time.
                  </p>
                </div>
              </div>
            </div>

            {/* Event Selector Dropdown + Refresh */}
            <div className="flex items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-80 xl:w-96">
                <select
                  value={selectedEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  disabled={isLoading || events.length === 0}
                  className="w-full px-4 sm:px-5 py-3 sm:py-3.5 bg-white/15 hover:bg-white/20 backdrop-blur-md text-white border border-white/30 hover:border-white/45 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer appearance-none pr-10 sm:pr-12 shadow-sm transition-all"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                  }}
                >
                  {events.length === 0 ? (
                    <option value="" className="text-gray-800">
                      No active events available
                    </option>
                  ) : (
                    events.map((evt) => (
                      <option key={evt.id} value={evt.id} className="text-gray-900 bg-white font-medium">
                        {evt.title} ({evt.status})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <button
                type="button"
                onClick={() => void loadLeaderboard(selectedEventId, true)}
                disabled={isRefreshing || isLoading}
                title="Refresh Leaderboard Data"
                className="h-[46px] w-[46px] sm:h-[50px] sm:w-[50px] flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-95 text-white border border-white/30 rounded-xl sm:rounded-2xl shrink-0 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={19} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Selected Event Details Pill Strip */}
          {selectedEvent && (
            <div className="relative z-10 mt-4 pt-4 border-t border-white/15 flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-medium text-blue-100">
              <span className="flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                <MapPin size={13} className="text-amber-300" />
                <span>Venue: <strong className="text-white">{selectedEvent.location || 'TBA'}</strong></span>
              </span>
              <span className="flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                <Calendar size={13} className="text-blue-200" />
                <span>Schedule: <strong className="text-white">{selectedEvent.date}{selectedEvent.time ? ` at ${selectedEvent.time}` : ''}</strong></span>
              </span>
              <Badge
                variant={
                  selectedEvent.status === 'ongoing'
                    ? 'success'
                    : selectedEvent.status === 'upcoming'
                    ? 'info'
                    : 'secondary'
                }
                className="uppercase tracking-wider text-[10px] font-bold"
              >
                {selectedEvent.status}
              </Badge>
            </div>
          )}
        </div>

        {/* ── Summary Statistics Cards Grid ──────────────────────── */}
        <div className="p-5 sm:p-6 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Registered Institutions */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                <Building2 size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Registered Institutions
                </p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                  {summary.totalInstitutions}
                </p>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  Schools / Organizations
                </p>
              </div>
            </div>

            {/* Total Registered Participants */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Users size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Total Participants
                </p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                  {summary.totalRegisteredParticipants}
                </p>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  Registered for this event
                </p>
              </div>
            </div>

            {/* Present in Venue */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                <UserCheck size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  In Venue (Present)
                </p>
                <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {summary.totalInVenue}
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 ml-1">
                    / {summary.totalRegisteredParticipants}
                  </span>
                </p>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  {summary.fullyPresentInstitutions} institutions 100% present
                </p>
              </div>
            </div>

            {/* Overall Turnout Rate */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
                <Award size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Venue Turnout
                </p>
                <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                  {summary.overallAttendanceRate}%
                </p>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  Attendance verification rate
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filter and Search Controls ─────────────────────────── */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900">
          {/* Search box */}
          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search school or participant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 shrink-0 mr-1">
              <Filter size={13} /> Filter:
            </span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              All ({data?.leaderboard.length || 0})
            </button>
            <button
              onClick={() => setStatusFilter('all_in_venue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                statusFilter === 'all_in_venue'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 hover:bg-emerald-100'
              }`}
            >
              All in Venue (100%)
            </button>
            <button
              onClick={() => setStatusFilter('partial')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                statusFilter === 'partial'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 hover:bg-amber-100'
              }`}
            >
              Arriving / Partial
            </button>
            <button
              onClick={() => setStatusFilter('not_in_venue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                statusFilter === 'not_in_venue'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              Not in Venue
            </button>
          </div>
        </div>

        {/* ── Leaderboard Table / Cards ──────────────────────────── */}
        <div className="p-4 sm:p-6">
          {isLoading ? (
            <div className="space-y-3 py-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl shimmer border border-gray-100 dark:border-slate-800" />
              ))}
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Building2 size={26} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {searchQuery || statusFilter !== 'all'
                  ? 'No matching institutions found'
                  : 'No institutions registered for this event yet'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium max-w-md mx-auto mt-1">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search query or clear the active filter.'
                  : 'Institutions that register participants for this event will automatically show up on this leaderboard.'}
              </p>
              {(searchQuery || statusFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeaderboard.map((inst) => {
                const isUserSchool =
                  String(user?.id) === String(inst.institutionId) ||
                  user?.sectorDetails === inst.institutionName ||
                  user?.fullName === inst.institutionName;

                return (
                  <div
                    key={inst.institutionId}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                      inst.allInVenue
                        ? 'bg-gradient-to-r from-emerald-50/40 via-white to-emerald-50/20 dark:from-emerald-950/20 dark:via-slate-900 dark:to-emerald-950/10 border-emerald-300 dark:border-emerald-800/60 shadow-xs'
                        : isUserSchool
                        ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-300 dark:border-blue-900 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 shadow-card hover:shadow-card-md'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Rank + Institution Info */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Rank indicator */}
                        <div className="shrink-0">{getRankBadge(inst.rank)}</div>

                        {/* Institution logo/initials avatar */}
                        <div className="relative shrink-0">
                          {inst.institutionAvatar ? (
                            <img
                              src={inst.institutionAvatar}
                              alt={inst.institutionName}
                              className="w-11 h-11 rounded-xl object-cover border border-gray-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                              {inst.institutionName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {inst.allInVenue && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </div>

                        {/* Text info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                              {inst.institutionName}
                            </h4>
                            {isUserSchool && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                Your School
                              </span>
                            )}
                            {inst.allInVenue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 size={11} /> All in Venue
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5 truncate">
                            {inst.registeredCount} participant{inst.registeredCount !== 1 ? 's' : ''} registered
                            {inst.institutionEmail ? ` • ${inst.institutionEmail}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Right: Attendance Stats + Progress Bar + Action */}
                      <div className="flex items-center gap-4 sm:gap-6 justify-between md:justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-slate-800">
                        {/* Numbers & Progress bar */}
                        <div className="flex flex-col items-start md:items-end min-w-[130px] sm:min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              In Venue:
                            </span>
                            <span
                              className={`text-sm font-black ${
                                inst.allInVenue
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : inst.inVenueCount > 0
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {inst.inVenueCount} / {inst.registeredCount}
                            </span>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                              ({inst.attendanceRate}%)
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-1.5 border border-slate-300/50 dark:border-slate-700/50">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                inst.allInVenue
                                  ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                                  : inst.inVenueCount > 0
                                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                                  : 'bg-slate-300 dark:bg-slate-700'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(4, inst.attendanceRate))}%` }}
                            />
                          </div>
                        </div>

                        {/* View Participants button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveInstitution(inst)}
                          className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <span>Roster</span>
                          <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center">
                            {inst.participants.length || inst.registeredCount}
                          </span>
                          <ChevronRight size={14} className="text-slate-500 dark:text-slate-400" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* ── Institution Participants Roster & Check-In Modal ───── */}
      {activeInstitution && (
        <Modal
          isOpen={Boolean(activeInstitution)}
          onClose={() => {
            setActiveInstitution(null);
            setParticipantSearch('');
          }}
          title={activeInstitution.institutionName}
          subtitle={`Event Delegation • ${selectedEvent?.title || 'Selected Event'}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Modal Header Stats Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/60 border border-blue-100 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Venue Presence Status
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-black text-gray-900 dark:text-slate-100">
                    {activeInstitution.inVenueCount} of {activeInstitution.registeredCount} Present
                  </span>
                  <Badge
                    variant={
                      activeInstitution.allInVenue
                        ? 'success'
                        : activeInstitution.inVenueCount > 0
                        ? 'warning'
                        : 'secondary'
                    }
                  >
                    {activeInstitution.status}
                  </Badge>
                </div>
              </div>

              {/* Bulk actions for authorized users */}
              {canEditInstitutionAttendance(activeInstitution) && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isBulkChecking || activeInstitution.allInVenue}
                    onClick={() => void handleBulkCheckAll(activeInstitution, true)}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    <span>Check In All</span>
                  </Button>
                  {activeInstitution.inVenueCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBulkChecking}
                      onClick={() => void handleBulkCheckAll(activeInstitution, false)}
                      className="text-xs text-rose-600 hover:text-rose-700"
                    >
                      <span>Undo All</span>
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Search inside roster */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search participant by name or role..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Participants List */}
            {activeInstitution.participants.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                <Users size={28} className="mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Bulk Registration ({activeInstitution.registeredCount} seats)
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1 max-w-sm mx-auto">
                  This institution registered with a head count of {activeInstitution.registeredCount} participants.
                  Detailed individual names can be uploaded through the Institution Members module.
                </p>
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="py-8 text-center text-slate-600 dark:text-slate-400 font-medium text-xs">
                No participants matched &quot;{participantSearch}&quot;.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredParticipants.map((part) => {
                  const isBusy = togglingParticipantId === part.id;
                  const canEdit = canEditInstitutionAttendance(activeInstitution);

                  return (
                    <div
                      key={part.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        part.checkedIn
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            part.checkedIn
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold'
                          }`}
                        >
                          {part.checkedIn ? <Check size={14} strokeWidth={3} /> : part.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {part.fullName}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate">
                            {part.position || 'Participant'}
                            {part.contactNumber ? ` • ${part.contactNumber}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={part.checkedIn ? 'success' : 'secondary'} className="text-[11px]">
                          {part.checkedIn ? 'In Venue' : 'Not in Venue'}
                        </Badge>

                        {canEdit && (
                          <Button
                            variant={part.checkedIn ? 'outline' : 'primary'}
                            size="xs"
                            disabled={isBusy}
                            onClick={() => void handleToggleAttendance(part, activeInstitution.institutionId)}
                            className="text-[11px]"
                          >
                            {part.checkedIn ? 'Undo' : 'Check In'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setActiveInstitution(null);
                  setParticipantSearch('');
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

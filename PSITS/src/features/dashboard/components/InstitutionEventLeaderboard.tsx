import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import { Card, Button, Badge, Input } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import {
  Trophy,
  Building2,
  Users,
  MapPin,
  Calendar,
  Search,
  RefreshCw,
  ChevronRight,
  X,
  CheckCircle2,
  Clock,
  UserCheck,
  Medal,
  Crown,
  Plus,
  Trash2,
  Sparkles,
  Award,
} from 'lucide-react';
import type {
  InstitutionLeaderboardData,
  EventLeaderboardInstitution,
  OverallCompetitionStanding,
} from '@/shared/types';

export const InstitutionEventLeaderboard = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const isOfficerOrAdmin = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  // Navigation tab for the board
  const [activeTab, setActiveTab] = useState<'delegation' | 'event_winners' | 'overall_championship'>('delegation');

  const [data, setData] = useState<InstitutionLeaderboardData | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal state for viewing institution participants & check-in
  const [activeInstitution, setActiveInstitution] = useState<EventLeaderboardInstitution | null>(null);
  const [participantSearch, setParticipantSearch] = useState<string>('');
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState<string | null>(null);
  const [isBulkCheckingIn, setIsBulkCheckingIn] = useState<boolean>(false);

  // Winner management modal state
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState<boolean>(false);
  const [winnerForm, setWinnerForm] = useState<{
    id?: string;
    rankPosition: number;
    awardTitle: string;
    institutionName: string;
    participantName: string;
    points: number;
    scoreOrNotes: string;
  }>({
    rankPosition: 1,
    awardTitle: 'Champion',
    institutionName: '',
    participantName: '',
    points: 10,
    scoreOrNotes: '',
  });
  const [isSubmittingWinner, setIsSubmittingWinner] = useState<boolean>(false);
  const [deletingWinnerId, setDeletingWinnerId] = useState<string | null>(null);

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

  // Toggle in-venue attendance for a participant
  const handleToggleAttendance = async (participantKey: string, currentStatus: boolean) => {
    if (!selectedEventId || !participantKey) return;
    setIsUpdatingAttendance(participantKey);

    const nextStatus = !currentStatus;

    try {
      const res = await api.toggleEventAttendance(selectedEventId, participantKey, nextStatus);
      if (res.data?.success) {
        addNotification({
          userId: 'current',
          title: nextStatus ? 'Attendee Checked In' : 'Attendance Reverted',
          message: nextStatus ? 'Participant marked as present in venue.' : 'Attendance status reset to not in venue.',
          type: 'success',
          isRead: false,
        });

        // Optimistically update active institution participants
        if (activeInstitution) {
          const updatedParticipants = activeInstitution.participants.map((p) => {
            if (p.participantKey === participantKey || p.id === participantKey.replace(/^(inst-|reg-)/, '')) {
              return {
                ...p,
                isCheckedIn: nextStatus,
                checkedInAt: nextStatus ? new Date().toISOString() : null,
              };
            }
            return p;
          });

          const checkedCount = updatedParticipants.filter((p) => p.isCheckedIn).length;
          setActiveInstitution({
            ...activeInstitution,
            checkedInCount: checkedCount,
            attendanceRate: activeInstitution.registeredCount > 0
              ? Number(((checkedCount / activeInstitution.registeredCount) * 100).toFixed(1))
              : 0,
            participants: updatedParticipants,
          });
        }

        // Silent refresh of the full board
        void loadLeaderboard(selectedEventId, false);
      }
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Check-In Error',
        message: err?.response?.data?.message || err?.message || 'Failed to update attendance.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsUpdatingAttendance(null);
    }
  };

  // Bulk check-in all participants of the active institution
  const handleBulkCheckIn = async (checkedIn: boolean) => {
    if (!activeInstitution || !selectedEventId) return;
    const keys = activeInstitution.participants
      .map((p) => p.participantKey || (p.id ? `inst-${p.id}` : null))
      .filter(Boolean) as string[];

    if (keys.length === 0) return;
    setIsBulkCheckingIn(true);

    try {
      const res = await api.bulkCheckInAttendance(selectedEventId, keys, checkedIn);
      if (res.data?.success) {
        addNotification({
          userId: 'current',
          title: checkedIn ? 'All Delegation Checked In' : 'Delegation Check-In Cleared',
          message: `Updated in-venue attendance for ${res.data.updatedCount || keys.length} delegates.`,
          type: 'success',
          isRead: false,
        });
        void loadLeaderboard(selectedEventId, false);
      }
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Bulk Check-In Error',
        message: err?.response?.data?.message || err?.message || 'Failed to bulk update attendance.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsBulkCheckingIn(false);
    }
  };

  // Winner Management Handlers
  const handleOpenAddWinnerModal = () => {
    setWinnerForm({
      rankPosition: (data?.eventWinners?.length || 0) + 1,
      awardTitle:
        (data?.eventWinners?.length || 0) === 0 ? 'Champion' :
        (data?.eventWinners?.length || 0) === 1 ? '1st Runner Up' :
        (data?.eventWinners?.length || 0) === 2 ? '2nd Runner Up' : 'Finalist',
      institutionName: data?.leaderboard?.[0]?.institutionName || '',
      participantName: '',
      points:
        (data?.eventWinners?.length || 0) === 0 ? 10 :
        (data?.eventWinners?.length || 0) === 1 ? 7 :
        (data?.eventWinners?.length || 0) === 2 ? 5 : 3,
      scoreOrNotes: '',
    });
    setIsWinnerModalOpen(true);
  };

  const handleRankChange = (rank: number) => {
    const pts = rank === 1 ? 10 : rank === 2 ? 7 : rank === 3 ? 5 : 3;
    const title = rank === 1 ? 'Champion' : rank === 2 ? '1st Runner Up' : rank === 3 ? '2nd Runner Up' : `${rank}th Place`;
    setWinnerForm((prev) => ({
      ...prev,
      rankPosition: rank,
      awardTitle: title,
      points: pts,
    }));
  };

  const handleSaveWinner = async () => {
    if (!selectedEventId) return;
    if (!winnerForm.institutionName.trim() || !winnerForm.participantName.trim()) {
      addNotification({
        userId: 'current',
        title: 'Validation Error',
        message: 'Institution and participant/team names are required.',
        type: 'error',
        isRead: false,
      });
      return;
    }

    setIsSubmittingWinner(true);
    try {
      if (winnerForm.id) {
        await api.updateEventWinner(selectedEventId, winnerForm.id, winnerForm);
        addNotification({
          userId: 'current',
          title: 'Winner Updated',
          message: 'Competition winner details updated successfully.',
          type: 'success',
          isRead: false,
        });
      } else {
        await api.createEventWinner(selectedEventId, winnerForm);
        addNotification({
          userId: 'current',
          title: 'Winner Awarded',
          message: 'Winner proclaimed and points added to overall championship.',
          type: 'success',
          isRead: false,
        });
      }
      setIsWinnerModalOpen(false);
      void loadLeaderboard(selectedEventId, false);
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Winner Error',
        message: err?.response?.data?.message || err?.message || 'Failed to save winner.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsSubmittingWinner(false);
    }
  };

  const handleDeleteWinner = async (winnerId: string) => {
    if (!selectedEventId || !winnerId) return;
    setDeletingWinnerId(winnerId);
    try {
      await api.deleteEventWinner(selectedEventId, winnerId);
      addNotification({
        userId: 'current',
        title: 'Winner Removed',
        message: 'Winner record removed from this event.',
        type: 'info',
        isRead: false,
      });
      void loadLeaderboard(selectedEventId, false);
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Delete Error',
        message: err?.response?.data?.message || err?.message || 'Failed to delete winner.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setDeletingWinnerId(null);
    }
  };

  // Filtered leaderboard based on search query
  const filteredLeaderboard = useMemo(() => {
    if (!data?.leaderboard) return [];
    let list = [...data.leaderboard];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          (i.institutionName && i.institutionName.toLowerCase().includes(q)) ||
          (i.institutionEmail && i.institutionEmail.toLowerCase().includes(q)) ||
          (Array.isArray(i.participants) && i.participants.some((p) => p.fullName && p.fullName.toLowerCase().includes(q)))
      );
    }

    return list;
  }, [data?.leaderboard, searchQuery]);

  // Modal participants filtered
  const filteredParticipants = useMemo(() => {
    if (!activeInstitution?.participants) return [];
    if (!participantSearch.trim()) return activeInstitution.participants;
    const q = participantSearch.toLowerCase();
    return activeInstitution.participants.filter(
      (p) =>
        (p.fullName && p.fullName.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.position && p.position.toLowerCase().includes(q))
    );
  }, [activeInstitution?.participants, participantSearch]);

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
    totalCheckedInParticipants: 0,
    overallAttendanceRate: 0,
  };

  const selectedEvent = data?.selectedEvent;
  const events = data?.events || [];
  const eventWinners = data?.eventWinners || [];
  const overallStandings = data?.overallStandings || [];

  return (
    <div className="space-y-6">
      {/* ── Main Leaderboard Card ────────────────────────────── */}
      <Card className="overflow-hidden border border-blue-100/80 dark:border-slate-800 shadow-card-md">
        {/* Header with Title & Event Selector */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-t-2xl relative overflow-hidden">
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
                  </h2>
                </div>
              </div>
            </div>

            {/* Event Selector Dropdown + Refresh */}
            <div className="flex items-center gap-3 sm:gap-4 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-[440px] xl:w-[520px] 2xl:w-[580px]">
                <select
                  value={selectedEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  disabled={isLoading || events.length === 0}
                  className="w-full px-5 sm:px-6 py-3.5 sm:py-4 md:py-4.5 bg-white/15 hover:bg-white/20 backdrop-blur-md text-white border-2 border-white/35 hover:border-white/55 rounded-2xl text-base sm:text-lg md:text-xl font-black tracking-tight focus:outline-none focus:ring-4 focus:ring-white/30 cursor-pointer appearance-none pr-14 sm:pr-16 shadow-lg transition-all min-h-[52px] sm:min-h-[58px] md:min-h-[64px] flex items-center"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 20px center',
                  }}
                >
                  {events.length === 0 ? (
                    <option value="" className="text-gray-800 text-base">
                      No active events available
                    </option>
                  ) : (
                    events.map((evt) => (
                      <option key={evt.id} value={evt.id} className="text-gray-900 bg-white font-bold text-base sm:text-lg py-2">
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
                className="h-[52px] w-[52px] sm:h-[58px] sm:w-[58px] md:h-[64px] md:w-[64px] flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-95 text-white border-2 border-white/35 hover:border-white/55 rounded-2xl shrink-0 transition-all shadow-lg disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 ${isRefreshing ? 'animate-spin' : ''}`} />
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

        {/* ── Mode Switcher Tabs (Attendance vs Winners vs Overall Championship) ── */}
        <div className="bg-slate-100 dark:bg-slate-800/80 p-2 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('delegation')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'delegation'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/50 dark:hover:bg-slate-800'
            }`}
          >
            <UserCheck size={16} />
            <span>Venue Attendance & Delegation</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {summary.totalInstitutions}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('event_winners')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'event_winners'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/50 dark:hover:bg-slate-800'
            }`}
          >
            <Medal size={16} />
            <span>Event Winners Ranking</span>
            {eventWinners.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {eventWinners.length} Proclaimed
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overall_championship')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'overall_championship'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/50 dark:hover:bg-slate-800'
            }`}
          >
            <Crown size={16} />
            <span>Overall Event Championship</span>
            {overallStandings.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                Overall Winner
              </span>
            )}
          </button>
        </div>

        {/* ── TAB 1: VENUE ATTENDANCE & DELEGATION ────────────────── */}
        {activeTab === 'delegation' && (
          <div>
            {/* Summary Statistics Cards Grid */}
            <div className="p-5 sm:p-6 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Registered Institutions */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                    <Building2 size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                      Institutions
                    </p>
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                      {summary.totalInstitutions}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      Participating Schools
                    </p>
                  </div>
                </div>

                {/* Total Registered Participants */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Users size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                      Total Registered
                    </p>
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                      {summary.totalRegisteredParticipants}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      Delegates enrolled
                    </p>
                  </div>
                </div>

                {/* In-Venue Attendance Verified */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <UserCheck size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                      In-Venue Attendance
                    </p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {summary.totalCheckedInParticipants || 0}{' '}
                      <span className="text-xs font-bold text-slate-500">
                        / {summary.totalRegisteredParticipants}
                      </span>
                    </p>
                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 truncate">
                      {summary.overallAttendanceRate || 0}% present in venue
                    </p>
                  </div>
                </div>

                {/* In-Venue Turnout Progress */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-center">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Venue Turnout</span>
                    <span className="text-emerald-600 font-black">{summary.overallAttendanceRate || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mt-2">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, summary.overallAttendanceRate || 0)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 truncate">
                    Real-time participant verification
                  </p>
                </div>
              </div>
            </div>

            {/* Search Controls */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900">
              <div className="w-full sm:w-80 relative">
                <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search school or participant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Showing {filteredLeaderboard.length} of {data?.leaderboard.length || 0} registered institutions
              </div>
            </div>

            {/* Leaderboard Table / Cards */}
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
                    {searchQuery
                      ? 'No matching institutions found'
                      : 'No institutions registered for this event yet'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium max-w-md mx-auto mt-1">
                    {searchQuery
                      ? 'Try adjusting your search query.'
                      : 'Institutions that register participants for this event will automatically show up on this leaderboard.'}
                  </p>
                  {searchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      className="mt-4"
                    >
                      Clear Search
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLeaderboard.map((inst) => {
                    const isUserSchool =
                      Boolean(inst.institutionId && String(user?.id) === String(inst.institutionId)) ||
                      Boolean(user?.sectorDetails && inst.institutionName && user.sectorDetails.toLowerCase() === inst.institutionName.toLowerCase()) ||
                      Boolean(user?.fullName && inst.institutionName && user.fullName.toLowerCase() === inst.institutionName.toLowerCase());

                    const checkedIn = inst.checkedInCount || 0;
                    const totalReg = inst.registeredCount || 0;
                    const rate = inst.attendanceRate !== undefined ? inst.attendanceRate : (totalReg > 0 ? (checkedIn / totalReg) * 100 : 0);

                    return (
                      <div
                        key={inst.institutionId}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                          isUserSchool
                            ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-300 dark:border-blue-900 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 shadow-card hover:shadow-card-md'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Left: Rank + Institution Info */}
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div className="shrink-0">{getRankBadge(inst.rank)}</div>

                            <div className="relative shrink-0">
                              {inst.institutionAvatar ? (
                                <img
                                  src={inst.institutionAvatar}
                                  alt={inst.institutionName}
                                  className="w-11 h-11 rounded-xl object-cover border border-gray-200 dark:border-slate-700"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                                  {(inst.institutionName || 'Institution').charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>

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
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                <span>{totalReg} registered</span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                  <UserCheck size={13} /> {checkedIn} checked-in ({rate.toFixed(0)}%)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Turnout Progress + Roster Action */}
                          <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                            {/* Attendance mini pill */}
                            <div className="hidden md:flex flex-col items-end min-w-[100px]">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                {checkedIn} / {totalReg} in Venue
                              </span>
                              <div className="w-20 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                <div
                                  className="bg-emerald-500 h-full rounded-full"
                                  style={{ width: `${Math.min(100, rate)}%` }}
                                />
                              </div>
                            </div>

                            {/* View Delegation Roster & Check-In button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveInstitution(inst)}
                              className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <UserCheck size={14} className="text-blue-600 dark:text-blue-400" />
                              <span>Attendance Roster</span>
                              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center">
                                {inst.participants.length || totalReg}
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
          </div>
        )}

        {/* ── TAB 2: COMPETITION WINNER RANKINGS (PER EVENT) ──────── */}
        {activeTab === 'event_winners' && (
          <div className="p-5 sm:p-6 space-y-6">
            {/* Header with Title and Proclaim/Add Winner Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Medal className="text-amber-500" />
                  <span>Competition Winners & Rankings: {selectedEvent?.title || 'Selected Event'}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Official proclamation of winners, rankings, and tournament points for this event.
                </p>
              </div>

              {isOfficerOrAdmin && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenAddWinnerModal}
                  className="flex items-center gap-1.5 font-bold shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Plus size={15} /> Proclaim / Record Winner
                </Button>
              )}
            </div>

            {/* Podium Display (Top 3) */}
            {eventWinners.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* 1st Place / Champion */}
                {(() => {
                  const champion = eventWinners.find((w) => w.rankPosition === 1);
                  if (!champion) return null;
                  return (
                    <div className="order-1 md:order-2 p-5 rounded-2xl bg-gradient-to-b from-amber-500/15 via-yellow-500/10 to-transparent border-2 border-amber-400 dark:border-amber-500/50 shadow-lg text-center relative overflow-hidden">
                      <div className="absolute top-2 right-2">
                        <Sparkles size={18} className="text-amber-500 animate-pulse" />
                      </div>
                      <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center font-black text-2xl shadow-md shadow-amber-500/30">
                        🥇
                      </div>
                      <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs">
                        {champion.awardTitle || 'Champion'}
                      </span>
                      <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-2 truncate">
                        {champion.participantName}
                      </h4>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mt-0.5 truncate">
                        {champion.institutionName}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-xs font-black text-amber-900 dark:text-amber-200">
                        <Trophy size={13} /> {champion.points} Championship Points
                      </div>
                      {champion.scoreOrNotes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-2">
                          &quot;{champion.scoreOrNotes}&quot;
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* 2nd Place / 1st Runner Up */}
                {(() => {
                  const silver = eventWinners.find((w) => w.rankPosition === 2);
                  if (!silver) return null;
                  return (
                    <div className="order-2 md:order-1 p-5 rounded-2xl bg-gradient-to-b from-slate-200/40 via-gray-100/30 to-transparent border border-slate-300 dark:border-slate-700 shadow-md text-center">
                      <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-tr from-slate-300 to-gray-200 text-slate-800 flex items-center justify-center font-black text-xl shadow-xs">
                        🥈
                      </div>
                      <span className="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        {silver.awardTitle || '1st Runner Up'}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2 truncate">
                        {silver.participantName}
                      </h4>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                        {silver.institutionName}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        <Award size={12} /> {silver.points} Points
                      </div>
                    </div>
                  );
                })()}

                {/* 3rd Place / 2nd Runner Up */}
                {(() => {
                  const bronze = eventWinners.find((w) => w.rankPosition === 3);
                  if (!bronze) return null;
                  return (
                    <div className="order-3 p-5 rounded-2xl bg-gradient-to-b from-amber-700/10 via-amber-800/5 to-transparent border border-amber-700/30 shadow-md text-center">
                      <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-tr from-amber-700 to-amber-600 text-white flex items-center justify-center font-black text-xl shadow-xs">
                        🥉
                      </div>
                      <span className="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-700/15 text-amber-900 dark:text-amber-300">
                        {bronze.awardTitle || '2nd Runner Up'}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2 truncate">
                        {bronze.participantName}
                      </h4>
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mt-0.5 truncate">
                        {bronze.institutionName}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-xs font-bold text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <Award size={12} /> {bronze.points} Points
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Complete Event Winner Ranking Table */}
            {eventWinners.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <Trophy size={36} className="mx-auto text-amber-400 mb-2 opacity-60" />
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  No Winners Proclaimed Yet
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  Once this competition concludes, authorized officers can proclaim and rank the winning participants or school teams here.
                </p>
                {isOfficerOrAdmin && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleOpenAddWinnerModal}
                    className="mt-4 inline-flex items-center gap-1.5 font-bold bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Plus size={15} /> Proclaim First Winner
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-center w-12">Rank</th>
                      <th className="px-4 py-3">Award / Title</th>
                      <th className="px-4 py-3">Winner (Participant / Team)</th>
                      <th className="px-4 py-3">School / Institution</th>
                      <th className="px-4 py-3 text-center">Points</th>
                      <th className="px-4 py-3">Score / Notes</th>
                      {isOfficerOrAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {eventWinners.map((winner) => (
                      <tr key={winner.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 text-center font-bold">
                          {getRankBadge(winner.rankPosition)}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                            {winner.awardTitle}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-extrabold text-slate-900 dark:text-slate-100">
                          {winner.participantName}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Building2 size={13} className="text-slate-400 shrink-0" />
                            <span>{winner.institutionName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-black text-amber-600 dark:text-amber-400">
                          +{winner.points} pts
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 italic text-xs">
                          {winner.scoreOrNotes || '—'}
                        </td>
                        {isOfficerOrAdmin && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void handleDeleteWinner(winner.id)}
                              disabled={deletingWinnerId === winner.id}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete Winner"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: OVERALL EVENT CHAMPIONSHIP ───────────────────── */}
        {activeTab === 'overall_championship' && (
          <div className="p-5 sm:p-6 space-y-6">
            {/* Overall Champion Banner */}
            {overallStandings.length > 0 && overallStandings[0] && (
              <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white shadow-xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4 text-center md:text-left">
                    <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center font-black text-4xl shadow-inner shrink-0">
                      👑
                    </div>
                    <div>
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/30 text-white border border-white/40">
                        Official Overall Tournament Champion
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                        {overallStandings[0].institutionName}
                      </h3>
                      <p className="text-xs sm:text-sm font-semibold text-amber-100 mt-1">
                        Rank #1 in PSITS Regional Championship Series
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 bg-black/20 p-4 rounded-2xl backdrop-blur-md border border-white/20 shrink-0">
                    <div className="text-center">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">Total Points</p>
                      <p className="text-2xl sm:text-3xl font-black text-white">{overallStandings[0].totalPoints}</p>
                    </div>
                    <div className="w-px h-8 bg-white/20" />
                    <div className="text-center">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">Golds</p>
                      <p className="text-2xl sm:text-3xl font-black text-yellow-300">🥇 {overallStandings[0].goldCount}</p>
                    </div>
                    <div className="w-px h-8 bg-white/20" />
                    <div className="text-center">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">Medals</p>
                      <p className="text-2xl sm:text-3xl font-black text-white">{overallStandings[0].totalMedals}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Overall Medal Tally Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Trophy size={18} className="text-amber-500" />
                  <span>Overall Tournament Medal & Points Tally</span>
                </h4>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {overallStandings.length} Participating Institutions Ranked
                </span>
              </div>

              {overallStandings.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Crown size={36} className="mx-auto text-slate-400 mb-2 opacity-50" />
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    No Overall Standings Yet
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                    As competition winners are proclaimed per event, their points and medal counts will automatically calculate and display the overall champion school here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-center w-14">Rank</th>
                        <th className="px-4 py-3">School / Institution</th>
                        <th className="px-4 py-3 text-center font-bold text-amber-600">🥇 Gold</th>
                        <th className="px-4 py-3 text-center font-bold text-slate-600">🥈 Silver</th>
                        <th className="px-4 py-3 text-center font-bold text-amber-800">🥉 Bronze</th>
                        <th className="px-4 py-3 text-center font-bold">Total Medals</th>
                        <th className="px-4 py-3 text-center font-extrabold text-blue-600">Championship Points</th>
                        <th className="px-4 py-3 text-center">Events Won</th>
                        <th className="px-4 py-3 text-right">Standing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {overallStandings.map((inst: OverallCompetitionStanding, index: number) => {
                        const isChamp = index === 0;
                        return (
                          <tr
                            key={inst.institutionName}
                            className={`transition-colors ${
                              isChamp
                                ? 'bg-amber-50/40 dark:bg-amber-950/20 font-semibold'
                                : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <td className="px-4 py-3.5 text-center">
                              {getRankBadge(inst.rank)}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900 dark:text-slate-100">
                                  {inst.institutionName}
                                </span>
                                {isChamp && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                                    Overall Champion
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-center font-black text-amber-600 dark:text-amber-400">
                              {inst.goldCount}
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold text-slate-600 dark:text-slate-300">
                              {inst.silverCount}
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold text-amber-700 dark:text-amber-500">
                              {inst.bronzeCount}
                            </td>
                            <td className="px-4 py-3.5 text-center font-extrabold text-slate-900 dark:text-slate-100">
                              {inst.totalMedals}
                            </td>
                            <td className="px-4 py-3.5 text-center font-black text-blue-600 dark:text-blue-400 text-base">
                              {inst.totalPoints} pts
                            </td>
                            <td className="px-4 py-3.5 text-center font-medium text-slate-600 dark:text-slate-300">
                              {inst.eventsWonCount}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                  isChamp
                                    ? 'bg-amber-500 text-white'
                                    : inst.rank <= 3
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                                    : 'bg-gray-100 dark:bg-slate-800/60 text-gray-600 dark:text-gray-400'
                                }`}
                              >
                                {isChamp ? 'Grand Champion' : inst.rank <= 3 ? 'Podium Finisher' : 'Top Contender'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ── Institution Participants Delegation Roster & Check-In Modal ───── */}
      {activeInstitution && (
        <Modal
          isOpen={Boolean(activeInstitution)}
          onClose={() => {
            setActiveInstitution(null);
            setParticipantSearch('');
          }}
          title={activeInstitution.institutionName}
          subtitle={`Event In-Venue Attendance Roster • ${selectedEvent?.title || 'Selected Event'}`}
          size="xl"
        >
          <div className="space-y-4">
            {/* Modal Header Stats Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/60 border border-blue-100 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Institution Delegation Attendance
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xl font-black text-gray-900 dark:text-slate-100">
                    {activeInstitution.registeredCount} Enrolled
                  </span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full">
                    {activeInstitution.checkedInCount || 0} In Venue ({activeInstitution.attendanceRate || 0}%)
                  </span>
                </div>
              </div>

              {isOfficerOrAdmin && activeInstitution.participants.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleBulkCheckIn(true)}
                    disabled={isBulkCheckingIn}
                    isLoading={isBulkCheckingIn}
                    className="flex items-center gap-1.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 size={14} /> Check In All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleBulkCheckIn(false)}
                    disabled={isBulkCheckingIn}
                    className="text-xs font-semibold"
                  >
                    Reset All
                  </Button>
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
                  Detailed individual names can be registered through the Institution Members portal.
                </p>
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="py-8 text-center text-slate-600 dark:text-slate-400 font-medium text-xs">
                No participants matched &quot;{participantSearch}&quot;.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredParticipants.map((part) => {
                  const isCheckedIn = Boolean(part.isCheckedIn);
                  const pKey = part.participantKey || `inst-${part.id}`;
                  const isUpdating = isUpdatingAttendance === pKey;

                  return (
                    <div
                      key={part.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        isCheckedIn
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                          : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isCheckedIn
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {(part.fullName || 'Participant').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {part.fullName}
                            </p>
                            {isCheckedIn ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 size={11} /> Checked In
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                <Clock size={11} /> Not in Venue
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate mt-0.5">
                            {part.position || 'Participant'}
                            {part.contactNumber ? ` • ${part.contactNumber}` : ''}
                            {part.email ? ` • ${part.email}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Check In Action for Officers & Admins */}
                      {isOfficerOrAdmin && (
                        <div className="shrink-0">
                          <Button
                            variant={isCheckedIn ? 'outline' : 'primary'}
                            size="sm"
                            disabled={isUpdating}
                            isLoading={isUpdating}
                            onClick={() => void handleToggleAttendance(pKey, isCheckedIn)}
                            className={`text-xs font-bold px-3 py-1.5 ${
                              isCheckedIn
                                ? 'text-rose-600 hover:bg-rose-50 border-rose-200 dark:border-rose-900'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {isCheckedIn ? 'Revert Check-In' : 'Mark Checked In'}
                          </Button>
                        </div>
                      )}
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

      {/* ── Modal to Record / Manage Winners ────────────────────────── */}
      {isWinnerModalOpen && (
        <Modal
          isOpen={isWinnerModalOpen}
          onClose={() => setIsWinnerModalOpen(false)}
          title={winnerForm.id ? 'Edit Winner Entry' : 'Proclaim / Record Competition Winner'}
          subtitle={`Event: ${selectedEvent?.title || 'Selected Event'}`}
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Rank Position
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { rank: 1, label: '1st (Gold)', icon: '🥇' },
                  { rank: 2, label: '2nd (Silver)', icon: '🥈' },
                  { rank: 3, label: '3rd (Bronze)', icon: '🥉' },
                  { rank: 4, label: 'Finalist', icon: '🎖️' },
                ].map((r) => (
                  <button
                    key={r.rank}
                    type="button"
                    onClick={() => handleRankChange(r.rank)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      winnerForm.rankPosition === r.rank
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xl">{r.icon}</div>
                    <div className="text-xs font-bold mt-1">{r.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Award Title"
              value={winnerForm.awardTitle}
              onChange={(e) => setWinnerForm((p) => ({ ...p, awardTitle: e.target.value }))}
              placeholder="e.g. Champion, 1st Runner Up, Best Pitch"
              required
            />

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                School / Institution Name
              </label>
              <input
                type="text"
                list="institutions-datalist"
                value={winnerForm.institutionName}
                onChange={(e) => setWinnerForm((p) => ({ ...p, institutionName: e.target.value }))}
                placeholder="e.g. Notre Dame of Marbel University"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
              <datalist id="institutions-datalist">
                {data?.leaderboard?.map((i) => (
                  <option key={i.institutionId} value={i.institutionName} />
                ))}
              </datalist>
            </div>

            <Input
              label="Winner (Participant or Team Name)"
              value={winnerForm.participantName}
              onChange={(e) => setWinnerForm((p) => ({ ...p, participantName: e.target.value }))}
              placeholder="e.g. Team Phoenix or Juan Dela Cruz"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Championship Points"
                type="number"
                value={winnerForm.points}
                onChange={(e) => setWinnerForm((p) => ({ ...p, points: Number(e.target.value) || 0 }))}
                placeholder="10"
                required
              />

              <Input
                label="Score or Winning Project (Optional)"
                value={winnerForm.scoreOrNotes}
                onChange={(e) => setWinnerForm((p) => ({ ...p, scoreOrNotes: e.target.value }))}
                placeholder="e.g. Final Score: 96.5"
              />
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsWinnerModalOpen(false)}
                disabled={isSubmittingWinner}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => void handleSaveWinner()}
                isLoading={isSubmittingWinner}
                className="font-bold bg-amber-600 hover:bg-amber-700 text-white"
              >
                Save & Proclaim Winner
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

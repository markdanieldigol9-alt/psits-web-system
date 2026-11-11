import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import { Card, Button, Badge, Input } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import { EventAttendanceSheet } from './EventAttendanceSheet';
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
  UserCheck,
  Medal,
  Crown,
  Plus,
  Trash2,
  Sparkles,
  Award,
  ClipboardCheck,
  Pencil,
  ArrowUp,
  ArrowDown,
  Lock,
} from 'lucide-react';
import type {
  InstitutionLeaderboardData,
  EventLeaderboardInstitution,
  EventWinnerRecord,
  OverallCompetitionStanding,
} from '@/shared/types';

export const InstitutionEventLeaderboard = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const isOfficerOrAdmin = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  // Navigation tab for the board
  const [activeTab, setActiveTab] = useState<'delegation' | 'attendance_sheet' | 'event_winners' | 'overall_championship'>('delegation');

  const [data, setData] = useState<InstitutionLeaderboardData | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal state for viewing institution participants & time-in / time-out sheet
  const [activeInstitution, setActiveInstitution] = useState<EventLeaderboardInstitution | null>(null);

  // Winner management modal state (Admin & Officer only)
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState<boolean>(false);
  const [winnerParticipantSearch, setWinnerParticipantSearch] = useState<string>('');
  const [winnerForm, setWinnerForm] = useState<{
    id?: string;
    eventId?: string;
    eventMode: 'individual' | 'pair' | 'team';
    rankPosition: number;
    awardTitle: string;
    institutionName: string;
    participantName: string;
    points: number;
    scoreOrNotes: string;
  }>({
    eventId: '',
    eventMode: 'individual',
    rankPosition: 1,
    awardTitle: 'Champion',
    institutionName: '',
    participantName: '',
    points: 10,
    scoreOrNotes: '',
  });
  const [isSubmittingWinner, setIsSubmittingWinner] = useState<boolean>(false);
  const [deletingWinnerId, setDeletingWinnerId] = useState<string | null>(null);
  const [movingWinnerId, setMovingWinnerId] = useState<string | null>(null);

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
          message: err?.response?.data?.message || err?.message || 'Failed to load events leaderboard.',
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

  const normalizeEventMode = (raw?: string | null): 'individual' | 'pair' | 'team' => {
    const val = String(raw || '').toLowerCase();
    if (val === 'pair') return 'pair';
    if (val === 'team' || val === 'group') return 'team';
    return 'individual';
  };

  const formatEventModeLabel = (raw?: string | null) => {
    const m = normalizeEventMode(raw);
    if (m === 'pair') return 'Pair / Duo';
    if (m === 'team') return 'Team / Group';
    return 'Individual';
  };

  // Winner Management Handlers (Admin & Officer only)
  const handleOpenAddWinnerModal = (presetRank?: number) => {
    if (!isOfficerOrAdmin) return;
    const rank = presetRank ?? (data?.eventWinners?.length || 0) + 1;
    const pts = rank === 1 ? 10 : rank === 2 ? 7 : rank === 3 ? 5 : rank === 4 ? 3 : 2;
    const title =
      rank === 1
        ? 'Champion'
        : rank === 2
        ? '1st Runner Up'
        : rank === 3
        ? '2nd Runner Up'
        : rank === 4
        ? '3rd Runner Up'
        : `${rank}th Place`;

    setWinnerParticipantSearch('');
    setWinnerForm({
      id: undefined,
      eventId: selectedEventId,
      eventMode: normalizeEventMode(data?.selectedEvent?.registrationMode),
      rankPosition: rank,
      awardTitle: title,
      institutionName: data?.leaderboard?.[0]?.institutionName || '',
      participantName: '',
      points: pts,
      scoreOrNotes: '',
    });
    setIsWinnerModalOpen(true);
  };

  const handleOpenEditWinnerModal = (winner: EventWinnerRecord) => {
    if (!isOfficerOrAdmin) return;
    setWinnerParticipantSearch('');
    setWinnerForm({
      id: winner.id,
      eventId: winner.eventId || selectedEventId,
      eventMode: normalizeEventMode(winner.eventMode || data?.selectedEvent?.registrationMode),
      rankPosition: winner.rankPosition,
      awardTitle: winner.awardTitle,
      institutionName: winner.institutionName,
      participantName: winner.participantName,
      points: winner.points,
      scoreOrNotes: winner.scoreOrNotes || '',
    });
    setIsWinnerModalOpen(true);
  };

  const handleRankChange = (rank: number) => {
    const safeRank = Math.max(1, Math.min(100, Number(rank) || 1));
    const pts = safeRank === 1 ? 10 : safeRank === 2 ? 7 : safeRank === 3 ? 5 : safeRank === 4 ? 3 : 2;
    const title =
      safeRank === 1
        ? 'Champion'
        : safeRank === 2
        ? '1st Runner Up'
        : safeRank === 3
        ? '2nd Runner Up'
        : safeRank === 4
        ? '3rd Runner Up'
        : `${safeRank}th Place`;
    setWinnerForm((prev) => ({
      ...prev,
      rankPosition: safeRank,
      awardTitle: title,
      points: pts,
    }));
  };

  const handleSaveWinner = async () => {
    const targetEventId = winnerForm.eventId || selectedEventId;
    if (!isOfficerOrAdmin || !targetEventId) return;
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
        await api.updateEventWinner(targetEventId, winnerForm.id, winnerForm);
        addNotification({
          userId: 'current',
          title: 'Winner Ranking Updated',
          message: 'Competition winner ranking updated successfully.',
          type: 'success',
          isRead: false,
        });
      } else {
        await api.createEventWinner(targetEventId, winnerForm);
        addNotification({
          userId: 'current',
          title: 'Winner Ranked & Proclaimed',
          message: 'Winner ranked and points added to overall championship.',
          type: 'success',
          isRead: false,
        });
      }
      setIsWinnerModalOpen(false);
      void loadLeaderboard(targetEventId, false);
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

  const handleMoveWinner = async (winnerId: string, direction: 'up' | 'down') => {
    if (!isOfficerOrAdmin || !selectedEventId || !winnerId) return;
    setMovingWinnerId(winnerId);
    try {
      await api.moveEventWinner(selectedEventId, winnerId, direction);
      addNotification({
        userId: 'current',
        title: 'Ranking Adjusted',
        message: `Moved winner ${direction === 'up' ? 'up' : 'down'} in the ranking.`,
        type: 'success',
        isRead: false,
      });
      void loadLeaderboard(selectedEventId, false);
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Reorder Error',
        message: err?.response?.data?.message || err?.message || 'Failed to reorder winner ranking.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setMovingWinnerId(null);
    }
  };

  const handleDeleteWinner = async (winnerId: string) => {
    if (!isOfficerOrAdmin || !selectedEventId || !winnerId) return;
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

  // Registered participants for fast winner selection in the modal
  const allRegisteredParticipants = useMemo(() => {
    if (data?.registeredParticipants && data.registeredParticipants.length > 0) {
      return data.registeredParticipants;
    }
    if (!data?.leaderboard) return [];
    const list: Array<{
      id: string;
      participantKey: string;
      fullName: string;
      institutionName: string;
      position?: string;
      isCheckedIn?: boolean;
      registrationSource?: string;
    }> = [];
    const seen = new Set<string>();
    for (const inst of data.leaderboard) {
      for (const p of inst.participants || []) {
        const key = p.participantKey || `inst-${p.id}`;
        if (!p.fullName || seen.has(key)) continue;
        seen.add(key);
        list.push({
          id: p.id,
          participantKey: key,
          fullName: p.fullName,
          institutionName: inst.institutionName,
          position: p.position || 'Participant',
          isCheckedIn: p.isCheckedIn,
          registrationSource: key.startsWith('reg-') ? 'Individual Registration' : 'Institution Roster',
        });
      }
    }
    return list.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [data?.registeredParticipants, data?.leaderboard]);

  const filteredWinnerParticipantOptions = useMemo(() => {
    const q = winnerParticipantSearch.trim().toLowerCase();
    const targetSchool = winnerForm.institutionName.trim().toLowerCase();
    return allRegisteredParticipants
      .filter((p) => {
        if (!q) return true;
        return (
          p.fullName.toLowerCase().includes(q) ||
          p.institutionName.toLowerCase().includes(q) ||
          (p.position && p.position.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        // Prioritize participants belonging to the currently selected school
        const aMatch = targetSchool && a.institutionName.toLowerCase() === targetSchool ? 0 : 1;
        const bMatch = targetSchool && b.institutionName.toLowerCase() === targetSchool ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return a.fullName.localeCompare(b.fullName);
      });
  }, [allRegisteredParticipants, winnerParticipantSearch, winnerForm.institutionName]);

  const handleSelectRegisteredWinner = (
    participant: { fullName: string; institutionName: string },
    appendIfMultiMode = false
  ) => {
    setWinnerForm((prev) => {
      const canAppend = appendIfMultiMode && (prev.eventMode === 'pair' || prev.eventMode === 'team') && prev.participantName.trim().length > 0;
      const existingNames = prev.participantName
        .split(/\s*(?:&|,)\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      const alreadyIncluded = existingNames.some((n) => n.toLowerCase() === participant.fullName.toLowerCase());
      const nextParticipantName = canAppend
        ? alreadyIncluded
          ? prev.participantName
          : `${prev.participantName.trim()} & ${participant.fullName}`
        : participant.fullName;

      return {
        ...prev,
        participantName: nextParticipantName,
        institutionName: participant.institutionName || prev.institutionName,
      };
    });
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
    totalCheckedInParticipants: 0,
    overallAttendanceRate: 0,
  };

  const selectedEvent = data?.selectedEvent;
  const events = data?.events || [];
  const eventWinners = data?.eventWinners || [];
  const overallStandings = data?.overallStandings || [];

  const formattedScheduleRange = useMemo(() => {
    if (!selectedEvent) return 'TBA';
    if (selectedEvent.startAt) {
      const s = new Date(selectedEvent.startAt);
      const startStr = s.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      if (selectedEvent.endAt) {
        const e = new Date(selectedEvent.endAt);
        const sameDay = s.toDateString() === e.toDateString();
        const endStr = sameDay
          ? e.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
          : e.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        return `${startStr} – ${endStr}`;
      }
      return startStr;
    }
    return `${selectedEvent.date}${selectedEvent.time ? ` at ${selectedEvent.time}` : ''}`;
  }, [selectedEvent]);

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
                    Events Leaderboard
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
                  aria-label="Select Event"
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
                        {evt.title} • {formatEventModeLabel(evt.registrationMode)} ({evt.status})
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
                aria-label="Refresh Leaderboard Data"
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
                <Trophy size={13} className="text-amber-300" />
                <span>Event: <strong className="text-white">{selectedEvent.title}</strong></span>
              </span>
              <span className="flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                <Users size={13} className="text-cyan-300" />
                <span>Mode: <strong className="text-white">{formatEventModeLabel(selectedEvent.registrationMode)}</strong></span>
              </span>
              <span className="flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                <MapPin size={13} className="text-amber-300" />
                <span>Venue: <strong className="text-white">{selectedEvent.location || 'TBA'}</strong></span>
              </span>
              <span className="flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                <Calendar size={13} className="text-blue-200" />
                <span>Schedule: <strong className="text-white">{formattedScheduleRange}</strong></span>
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

        {/* ── Mode Switcher Tabs (Delegations, Venue Attendance Table, Winners Ranking, Overall Championship) ── */}
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
            <Building2 size={16} />
            <span>Participating Delegations</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {summary.totalInstitutions}
            </span>
          </button>

          {isOfficerOrAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('attendance_sheet')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'attendance_sheet'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/50 dark:hover:bg-slate-800'
              }`}
            >
              <ClipboardCheck size={16} />
              <span>Event Attendance (Time In / Out)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {summary.totalCheckedInParticipants || 0}/{summary.totalRegisteredParticipants}
              </span>
            </button>
          )}

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
            <span>Winner Ranking</span>
            {eventWinners.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {eventWinners.length} Ranked
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

        {/* ── TAB 1: PARTICIPATING DELEGATIONS ──────────────────────── */}
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
                      Registered Institutions
                    </p>
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                      {summary.totalInstitutions}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      Participating Schools / Organizations
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
                      Total Participants
                    </p>
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                      {summary.totalRegisteredParticipants}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      Total delegation registered for this event
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
                  {isOfficerOrAdmin ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('attendance_sheet')}
                      className="mt-2 text-left text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Open Time In / Time Out Sheet →
                    </button>
                  ) : (
                    <p className="text-[10px] text-slate-500 mt-1.5 truncate">
                      Real-time participant verification
                    </p>
                  )}
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

            {/* Leaderboard Cards */}
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
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                <span>{totalReg} registered participants</span>
                                {inst.institutionEmail && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{inst.institutionEmail}</span>
                                  </>
                                )}
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                  <UserCheck size={13} /> {checkedIn} in venue ({rate.toFixed(0)}%)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Turnout Progress + Roster Action */}
                          <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                              {totalReg} Participants
                            </span>

                            {/* View Delegation Roster / Attendance button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveInstitution(inst)}
                              className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <UserCheck size={14} className="text-blue-600 dark:text-blue-400" />
                              <span>Roster</span>
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

        {/* ── TAB 2: VENUE ATTENDANCE SHEET (TIME IN / TIME OUT TABLE) ── */}
        {activeTab === 'attendance_sheet' && isOfficerOrAdmin && selectedEventId && (
          <EventAttendanceSheet
            eventId={selectedEventId}
            eventTitle={selectedEvent?.title}
            eventLocation={selectedEvent?.location}
            canManage={isOfficerOrAdmin}
            onAttendanceChanged={() => void loadLeaderboard(selectedEventId, false)}
          />
        )}

        {/* ── TAB 3: COMPETITION WINNER RANKINGS (PER EVENT) ──────── */}
        {activeTab === 'event_winners' && (
          <div className="p-5 sm:p-6 space-y-6">
            {/* Header with Title and Manual Set Winner Ranking Action (Admin & Officer only) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Medal className="text-amber-500" />
                    <span>Event Winner Ranking: {selectedEvent?.title || 'Selected Event'}</span>
                  </h3>
                  {selectedEvent && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                      <Users size={12} /> Mode: {formatEventModeLabel(selectedEvent.registrationMode)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Official event winner rankings and championship points manually set by authorized administrators and officers.
                </p>
              </div>

              {isOfficerOrAdmin ? (
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { rank: 1, label: 'Set 1st Place', icon: '🥇' },
                    { rank: 2, label: 'Set 2nd Place', icon: '🥈' },
                    { rank: 3, label: 'Set 3rd Place', icon: '🥉' },
                  ]
                    .filter((slot) => !eventWinners.some((w) => w.rankPosition === slot.rank))
                    .map((slot) => (
                      <Button
                        key={slot.rank}
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAddWinnerModal(slot.rank)}
                        className="flex items-center gap-1.5 text-xs font-bold"
                      >
                        <span>{slot.icon}</span>
                        <span>{slot.label}</span>
                      </Button>
                    ))}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenAddWinnerModal()}
                    className="flex items-center gap-1.5 font-bold shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Plus size={15} /> Set Winner Ranking
                  </Button>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                  <Lock size={13} /> Managed by Admins & Officers
                </span>
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
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        {isOfficerOrAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditWinnerModal(champion)}
                            title="Edit 1st Place Winner"
                            className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:text-blue-600 cursor-pointer"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
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
                    <div className="order-2 md:order-1 p-5 rounded-2xl bg-gradient-to-b from-slate-200/40 via-gray-100/30 to-transparent border border-slate-300 dark:border-slate-700 shadow-md text-center relative">
                      {isOfficerOrAdmin && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditWinnerModal(silver)}
                          title="Edit 2nd Place Winner"
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:text-blue-600 cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
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
                    <div className="order-3 p-5 rounded-2xl bg-gradient-to-b from-amber-700/10 via-amber-800/5 to-transparent border border-amber-700/30 shadow-md text-center relative">
                      {isOfficerOrAdmin && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditWinnerModal(bronze)}
                          title="Edit 3rd Place Winner"
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:text-blue-600 cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
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
                  No Winners Ranked Yet
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  Once this competition concludes, authorized admins and officers can manually set the winner ranking for participants or school teams here.
                </p>
                {isOfficerOrAdmin && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenAddWinnerModal(1)}
                    className="mt-4 inline-flex items-center gap-1.5 font-bold bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Plus size={15} /> Set 1st Place Winner
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-center w-14">Rank</th>
                      <th className="px-4 py-3">Award / Title</th>
                      <th className="px-4 py-3">Event &amp; Mode</th>
                      <th className="px-4 py-3">Winner (Participant / Team)</th>
                      <th className="px-4 py-3">School / Institution</th>
                      <th className="px-4 py-3 text-center">Points</th>
                      <th className="px-4 py-3">Score / Notes</th>
                      {isOfficerOrAdmin && <th className="px-4 py-3 text-right">Manage Ranking</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {eventWinners.map((winner, index) => (
                      <tr key={winner.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 text-center font-bold">
                          <div className="flex items-center justify-center">{getRankBadge(winner.rankPosition)}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                            {winner.awardTitle}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {winner.eventTitle || selectedEvent?.title || 'Event'}
                          </p>
                          <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                            {formatEventModeLabel(winner.eventMode || selectedEvent?.registrationMode)}
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
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => void handleMoveWinner(winner.id, 'up')}
                                disabled={index === 0 || movingWinnerId !== null}
                                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                title="Move Rank Up"
                                aria-label={`Move ${winner.participantName} up`}
                              >
                                <ArrowUp size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleMoveWinner(winner.id, 'down')}
                                disabled={index === eventWinners.length - 1 || movingWinnerId !== null}
                                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                title="Move Rank Down"
                                aria-label={`Move ${winner.participantName} down`}
                              >
                                <ArrowDown size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditWinnerModal(winner)}
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                title="Edit Winner Ranking"
                                aria-label={`Edit ${winner.participantName}`}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteWinner(winner.id)}
                                disabled={deletingWinnerId === winner.id}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Delete Winner"
                                aria-label={`Delete ${winner.participantName}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
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

        {/* ── TAB 4: OVERALL EVENT CHAMPIONSHIP ───────────────────── */}
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
                    As competition winners are ranked per event, their points and medal counts will automatically calculate and display the overall champion school here.
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

      {/* ── Institution Delegation Roster Modal ─────────────────────── */}
      {activeInstitution && (
        <Modal
          isOpen={Boolean(activeInstitution)}
          onClose={() => setActiveInstitution(null)}
          title={activeInstitution.institutionName}
          subtitle={`Delegation Roster & Venue Attendance • ${selectedEvent?.title || 'Selected Event'}`}
          size={isOfficerOrAdmin ? '2xl' : 'lg'}
        >
          {isOfficerOrAdmin && selectedEventId ? (
            <EventAttendanceSheet
              eventId={selectedEventId}
              eventTitle={selectedEvent?.title}
              eventLocation={selectedEvent?.location}
              canManage={isOfficerOrAdmin}
              initialInstitution={activeInstitution.institutionName}
              onAttendanceChanged={() => void loadLeaderboard(selectedEventId, false)}
            />
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/60 border border-blue-100 dark:border-slate-700 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                    Institution Delegation
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xl font-black text-gray-900 dark:text-slate-100">
                      {activeInstitution.registeredCount} Registered
                    </span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full">
                      {activeInstitution.checkedInCount || 0} In Venue ({activeInstitution.attendanceRate || 0}%)
                    </span>
                  </div>
                </div>
              </div>

              {activeInstitution.participants.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                  <Users size={28} className="mx-auto mb-2 text-slate-400" />
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Bulk Registration ({activeInstitution.registeredCount} seats)
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2.5">#</th>
                        <th className="px-3 py-2.5">Participant</th>
                        <th className="px-3 py-2.5">Role / Position</th>
                        <th className="px-3 py-2.5">Time In</th>
                        <th className="px-3 py-2.5">Time Out</th>
                        <th className="px-3 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {activeInstitution.participants.map((p, idx) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2.5 text-slate-400 font-bold">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">{p.fullName}</td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{p.position || 'Participant'}</td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {p.checkedInAt ? new Date(p.checkedInAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {p.checkedOutAt ? new Date(p.checkedOutAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.checkedOutAt
                                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                  : p.isCheckedIn
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {p.checkedOutAt ? 'Timed Out' : p.isCheckedIn ? 'In Venue' : 'Not in Venue'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ── Modal to Set / Edit Winner Ranking (Admin & Officer only) ── */}
      {isOfficerOrAdmin && isWinnerModalOpen && (
        <Modal
          isOpen={isWinnerModalOpen}
          onClose={() => setIsWinnerModalOpen(false)}
          title={winnerForm.id ? 'Edit Competition Winner Ranking' : 'Proclaim / Record Competition Winner'}
          subtitle={`Event: ${selectedEvent?.title || 'Selected Event'} (${formatEventModeLabel(winnerForm.eventMode)} Mode) • Admin & Officer Only`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Event Name & Mode of the Event */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Event Name
                  </label>
                  <select
                    value={winnerForm.eventId || selectedEventId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      const foundEvt = events.find((ev) => ev.id === nextId);
                      setWinnerForm((prev) => ({
                        ...prev,
                        eventId: nextId,
                        eventMode: normalizeEventMode(foundEvt?.registrationMode || prev.eventMode),
                      }));
                      if (nextId && nextId !== selectedEventId) {
                        handleEventChange(nextId);
                      }
                    }}
                    disabled={Boolean(winnerForm.id)}
                    aria-label="Event Name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer disabled:opacity-60"
                  >
                    {events.map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.title} ({evt.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Mode of the Event
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { mode: 'individual', label: 'Individual', icon: '👤' },
                        { mode: 'pair', label: 'Pair / Duo', icon: '👥' },
                        { mode: 'team', label: 'Team / Group', icon: '🛡️' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.mode}
                        type="button"
                        onClick={() => setWinnerForm((prev) => ({ ...prev, eventMode: m.mode }))}
                        className={`px-2.5 py-2 rounded-xl border text-center transition-all cursor-pointer ${
                          winnerForm.eventMode === m.mode
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100 font-bold shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold'
                        }`}
                      >
                        <span className="text-xs mr-1">{m.icon}</span>
                        <span className="text-[11px]">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Rank Position
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { rank: 1, label: '1st (Gold)', icon: '🥇' },
                  { rank: 2, label: '2nd (Silver)', icon: '🥈' },
                  { rank: 3, label: '3rd (Bronze)', icon: '🥉' },
                  { rank: 4, label: '4th Place', icon: '🎖️' },
                  { rank: 5, label: 'Finalist', icon: '🏅' },
                ].map((r) => (
                  <button
                    key={r.rank}
                    type="button"
                    onClick={() => handleRankChange(r.rank)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      winnerForm.rankPosition === r.rank
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-lg">{r.icon}</div>
                    <div className="text-[11px] font-bold mt-0.5">{r.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Rank Position (#)"
                type="number"
                min={1}
                max={100}
                value={winnerForm.rankPosition}
                onChange={(e) => handleRankChange(Number(e.target.value) || 1)}
                required
              />
              <div className="sm:col-span-2">
                <Input
                  label="Award Title"
                  value={winnerForm.awardTitle}
                  onChange={(e) => setWinnerForm((p) => ({ ...p, awardTitle: e.target.value }))}
                  placeholder="e.g. Champion, 1st Runner Up, Best Pitch"
                  required
                />
              </div>
            </div>

            {/* Fast Selection of Registered Participant in the Event */}
            <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-slate-800/50 border border-blue-200/80 dark:border-slate-700 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    Select Registered Participant in Event (Fast Fill)
                  </label>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Choose a registered participant to auto-fill Winner &amp; School/Institution
                    {(winnerForm.eventMode === 'pair' || winnerForm.eventMode === 'team') && ' (use "+ Add" to combine teammates)'}.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0 self-start sm:self-center">
                  {allRegisteredParticipants.length} Registered
                </span>
              </div>

              {allRegisteredParticipants.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  No individual participant names found for this event yet — you can type the winner and school below.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={winnerParticipantSearch}
                        onChange={(e) => setWinnerParticipantSearch(e.target.value)}
                        placeholder="Search registered participant or school..."
                        className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      {winnerParticipantSearch && (
                        <button
                          type="button"
                          onClick={() => setWinnerParticipantSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <select
                      value=""
                      onChange={(e) => {
                        const key = e.target.value;
                        const found = allRegisteredParticipants.find((p) => p.participantKey === key);
                        if (found) handleSelectRegisteredWinner(found, false);
                      }}
                      aria-label="Quick select registered participant"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      <option value="">
                        — Quick Select from {filteredWinnerParticipantOptions.length} Participant(s) —
                      </option>
                      {filteredWinnerParticipantOptions.map((p) => (
                        <option key={p.participantKey} value={p.participantKey}>
                          {p.fullName} — {p.institutionName} ({p.isCheckedIn ? 'Checked In' : 'Registered'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Clickable participant chips */}
                  <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1.5 pt-1">
                    {filteredWinnerParticipantOptions.slice(0, 30).map((p) => {
                      const isSelected = winnerForm.participantName
                        .toLowerCase()
                        .split(/\s*(?:&|,)\s*/)
                        .includes(p.fullName.toLowerCase());
                      const isMulti = winnerForm.eventMode === 'pair' || winnerForm.eventMode === 'team';

                      return (
                        <div
                          key={p.participantKey}
                          className={`inline-flex items-center rounded-xl border text-xs transition-all overflow-hidden ${
                            isSelected
                              ? 'border-blue-500 bg-blue-600 text-white font-bold shadow-2xs'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-blue-400'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectRegisteredWinner(p, false)}
                            className="px-2.5 py-1 text-left cursor-pointer flex items-center gap-1.5"
                            title={`Select ${p.fullName} (${p.institutionName})`}
                          >
                            <span className="truncate max-w-[150px]">{p.fullName}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full truncate max-w-[120px] ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {p.institutionName}
                            </span>
                          </button>
                          {isMulti && !isSelected && winnerForm.participantName.trim().length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleSelectRegisteredWinner(p, true)}
                              title={`Add ${p.fullName} to ${winnerForm.eventMode}`}
                              className="px-2 py-1 border-l border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] hover:bg-indigo-100 cursor-pointer"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                School / Institution Name *
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

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Winner ({winnerForm.eventMode === 'team' ? 'Team or Participants Name' : winnerForm.eventMode === 'pair' ? 'Pair / Duo Names' : 'Participant Name'}) *
              </label>
              <input
                type="text"
                list="participants-datalist"
                value={winnerForm.participantName}
                onChange={(e) => setWinnerForm((p) => ({ ...p, participantName: e.target.value }))}
                placeholder={
                  winnerForm.eventMode === 'team'
                    ? 'e.g. Team Phoenix or Juan Dela Cruz & Maria Santos'
                    : winnerForm.eventMode === 'pair'
                    ? 'e.g. Juan Dela Cruz & Maria Santos'
                    : 'e.g. Juan Dela Cruz'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
              <datalist id="participants-datalist">
                {filteredWinnerParticipantOptions.map((p) => (
                  <option key={p.participantKey} value={p.fullName}>
                    {p.institutionName} ({p.position || 'Participant'})
                  </option>
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Championship Points"
                type="number"
                min={0}
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
                {winnerForm.id ? 'Update Winner Ranking' : 'Save & Proclaim Winner'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

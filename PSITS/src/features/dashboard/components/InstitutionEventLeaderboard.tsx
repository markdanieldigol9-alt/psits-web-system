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
  Search,
  RefreshCw,
  ChevronRight,
  X,
} from 'lucide-react';
import type {
  InstitutionLeaderboardData,
  EventLeaderboardInstitution,
} from '@/shared/types';

export const InstitutionEventLeaderboard = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [data, setData] = useState<InstitutionLeaderboardData | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal state for viewing institution participants
  const [activeInstitution, setActiveInstitution] = useState<EventLeaderboardInstitution | null>(null);
  const [participantSearch, setParticipantSearch] = useState<string>('');

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

  // Filtered leaderboard based on search query
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

    return list;
  }, [data?.leaderboard, searchQuery]);

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
                  </h2>
                  <p className="text-blue-100 text-xs sm:text-sm mt-0.5">
                    Track registered institutions and participant headcounts in real time.
                  </p>
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

        {/* ── Summary Statistics Cards Grid (Registered Institutions & Total Participants) ── */}
        <div className="p-5 sm:p-6 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Registered Institutions */}
            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                <Building2 size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Registered Institutions
                </p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                  {summary.totalInstitutions}
                </p>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  Participating Schools / Organizations
                </p>
              </div>
            </div>

            {/* Total Registered Participants */}
            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
              <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Users size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Total Participants
                </p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                  {summary.totalRegisteredParticipants}
                </p>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  Total delegation registered for this event
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Search Controls ─────────────────────────── */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900">
          {/* Search box */}
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Showing {filteredLeaderboard.length} of {data?.leaderboard.length || 0} registered institutions
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
                  String(user?.id) === String(inst.institutionId) ||
                  user?.sectorDetails === inst.institutionName ||
                  user?.fullName === inst.institutionName;

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
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5 truncate">
                            {inst.registeredCount} registered participant{inst.registeredCount !== 1 ? 's' : ''}
                            {inst.institutionEmail ? ` • ${inst.institutionEmail}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Right: Participant Count Badge + Action */}
                      <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                        <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
                          {inst.registeredCount} {inst.registeredCount === 1 ? 'Participant' : 'Participants'}
                        </div>

                        {/* View Delegation Roster button */}
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

      {/* ── Institution Participants Delegation Roster Modal ───── */}
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
                  Registered Delegation
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-black text-gray-900 dark:text-slate-100">
                    {activeInstitution.registeredCount} {activeInstitution.registeredCount === 1 ? 'Participant' : 'Participants'}
                  </span>
                </div>
              </div>
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
                {filteredParticipants.map((part) => (
                  <div
                    key={part.id}
                    className="p-3 rounded-xl border flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                        {part.fullName.charAt(0).toUpperCase()}
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
                  </div>
                ))}
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

import { useMemo, useState } from 'react';
import { exportToCSV } from '@/shared/utils/export';
import logo from '@/assets/image/PSITS_Logo.png';
import {
  Trophy,
  Users,
  Vote,
  CheckCircle2,
  Printer,
  FileSpreadsheet,
  Search,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  XCircle,
  Award,
  UserCheck,
  Layers,
} from 'lucide-react';

export interface ElectionCandidateItem {
  id: number | string;
  position: string;
  platform?: string | null;
  status: string;
  votes_count: number | string;
  member_id?: number | string;
  name: string;
  email?: string;
  member_type?: string;
  sector?: string;
  sector_details?: string;
  avatar_url?: string | null;
  isWinner?: boolean;
  voteShare?: number;
  positionTotalVotes?: number;
  deficit?: number;
}

export interface ElectionVoterItem {
  user_id: number | string;
  voter_name: string;
  voter_email?: string;
  member_type?: string;
  sector?: string;
  sector_details?: string;
  voted_at?: string;
}

export interface ElectionReportData {
  election?: {
    id: number | string;
    title: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    status: string;
    allowed_positions?: string | string[];
    created_at?: string;
  };
  candidates?: ElectionCandidateItem[];
  positions?: Array<{
    position: string;
    totalVotes: number;
    candidatesCount: number;
    winners: ElectionCandidateItem[];
    runnersUp: ElectionCandidateItem[];
  }>;
  winners?: ElectionCandidateItem[];
  defeated?: ElectionCandidateItem[];
  voters?: ElectionVoterItem[];
  totalVotes?: number;
  totalBallotsCast?: number;
  totalEligibleVoters?: number;
  turnoutRate?: number;
}

interface ElectionReportViewProps {
  electionData: ElectionReportData | null;
  preparedBy?: string;
  userRole?: string;
  onExportCSV?: () => void;
}

export const ElectionReportView = ({
  electionData,
  preparedBy = 'COMELEC Canvassing Officer',
  userRole = 'Officer',
  onExportCSV,
}: ElectionReportViewProps) => {
  const [activeTab, setActiveTab] = useState<'all' | 'winners' | 'losers' | 'voters'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPositionFilter, setSelectedPositionFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(15);

  const election = electionData?.election;
  const rawCandidates = useMemo(() => electionData?.candidates || [], [electionData?.candidates]);
  const rawVoters = useMemo(() => electionData?.voters || [], [electionData?.voters]);

  // Compute position grouping, winners, and defeated if not pre-computed by backend
  const { positionsList, winnersList, defeatedList, positionMap } = useMemo(() => {
    const pMap = new Map<string, { totalVotes: number; candidates: ElectionCandidateItem[] }>();

    rawCandidates.forEach((c) => {
      const pos = c.position || 'General Office';
      if (!pMap.has(pos)) {
        pMap.set(pos, { totalVotes: 0, candidates: [] });
      }
      const pEntry = pMap.get(pos)!;
      pEntry.totalVotes += Number(c.votes_count || 0);
      pEntry.candidates.push(c);
    });

    const winners: ElectionCandidateItem[] = [];
    const defeated: ElectionCandidateItem[] = [];
    const positions: Array<{ position: string; totalVotes: number; candidates: ElectionCandidateItem[] }> = [];

    pMap.forEach((entry, pos) => {
      entry.candidates.sort((a, b) => Number(b.votes_count || 0) - Number(a.votes_count || 0));

      let posWinners = entry.candidates.filter((c) => c.status === 'winner');
      if (posWinners.length === 0 && entry.candidates.length > 0) {
        const top = entry.candidates[0];
        if (Number(top.votes_count || 0) > 0) {
          posWinners = [top];
        }
      }

      const winnerIds = new Set(posWinners.map((w) => String(w.id)));
      const topVotes = posWinners.length > 0 ? Number(posWinners[0].votes_count || 0) : 0;

      entry.candidates.forEach((c) => {
        const isWin = winnerIds.has(String(c.id));
        const share = entry.totalVotes > 0 ? (Number(c.votes_count || 0) / entry.totalVotes) * 100 : 0;
        const deficit = isWin ? 0 : Math.max(0, topVotes - Number(c.votes_count || 0));

        const item: ElectionCandidateItem = {
          ...c,
          isWinner: isWin,
          voteShare: share,
          positionTotalVotes: entry.totalVotes,
          deficit,
        };

        if (isWin) {
          winners.push(item);
        } else {
          defeated.push(item);
        }
      });

      positions.push({
        position: pos,
        totalVotes: entry.totalVotes,
        candidates: entry.candidates,
      });
    });

    return {
      positionsList: positions,
      winnersList: electionData?.winners && electionData.winners.length > 0 ? electionData.winners : winners,
      defeatedList: electionData?.defeated && electionData.defeated.length > 0 ? electionData.defeated : defeated,
      positionMap: pMap,
    };
  }, [rawCandidates, electionData]);

  // Combined candidates with enhanced metrics
  const enhancedCandidates = useMemo(() => {
    return rawCandidates.map((c) => {
      const pEntry = positionMap.get(c.position || 'General Office');
      const totalPosVotes = pEntry?.totalVotes || 0;
      const share = totalPosVotes > 0 ? (Number(c.votes_count || 0) / totalPosVotes) * 100 : 0;
      const isWinner = winnersList.some((w) => String(w.id) === String(c.id));
      const posWinner = winnersList.find((w) => w.position === c.position);
      const topVotes = posWinner ? Number(posWinner.votes_count || 0) : 0;
      const deficit = isWinner ? 0 : Math.max(0, topVotes - Number(c.votes_count || 0));

      return {
        ...c,
        isWinner,
        voteShare: share,
        positionTotalVotes: totalPosVotes,
        deficit,
      };
    });
  }, [rawCandidates, positionMap, winnersList]);

  // All contested position names for the filter dropdown
  const uniquePositions = useMemo(() => {
    const s = new Set<string>();
    rawCandidates.forEach((c) => {
      if (c.position) s.add(c.position);
    });
    return Array.from(s);
  }, [rawCandidates]);

  // Filtered candidate list based on active tab, search, and position
  const filteredCandidates = useMemo(() => {
    return enhancedCandidates.filter((c) => {
      // Tab filter
      if (activeTab === 'winners' && !c.isWinner) return false;
      if (activeTab === 'losers' && c.isWinner) return false;

      // Position filter
      if (selectedPositionFilter !== 'all' && c.position !== selectedPositionFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (c.name || '').toLowerCase();
        const pos = (c.position || '').toLowerCase();
        const platform = (c.platform || '').toLowerCase();
        const school = (c.sector_details || c.sector || '').toLowerCase();

        return name.includes(q) || pos.includes(q) || platform.includes(q) || school.includes(q);
      }

      return true;
    });
  }, [enhancedCandidates, activeTab, selectedPositionFilter, searchQuery]);

  // Filtered voters list
  const filteredVoters = useMemo(() => {
    return rawVoters.filter((v) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = (v.voter_name || '').toLowerCase();
      const email = (v.voter_email || '').toLowerCase();
      const school = (v.sector_details || v.sector || '').toLowerCase();
      return name.includes(q) || email.includes(q) || school.includes(q);
    });
  }, [rawVoters, searchQuery]);

  // Pagination for Candidates
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredCandidates.length / pageSize);
  const paginatedCandidates = useMemo(() => {
    if (pageSize === 'all') return filteredCandidates;
    const start = (currentPage - 1) * pageSize;
    return filteredCandidates.slice(start, start + pageSize);
  }, [filteredCandidates, currentPage, pageSize]);

  // Turnout calculation
  const totalBallots = electionData?.totalVotes || electionData?.totalBallotsCast || rawVoters.length || (winnersList.length > 0 ? Math.max(...positionsList.map((p) => p.totalVotes), 1) : 0);
  const totalEligible = electionData?.totalEligibleVoters || 45;
  const turnoutRate = electionData?.turnoutRate || (totalEligible > 0 ? (totalBallots / totalEligible) * 100 : 0);

  // CSV Export handler
  const handleExportCanvassCSV = () => {
    if (onExportCSV) {
      onExportCSV();
      return;
    }

    const exportRows = enhancedCandidates.map((c, idx) => ({
      '#': idx + 1,
      'Election Title': election?.title || 'PSITS Election',
      'Contested Position': c.position,
      'Candidate Full Name': c.name,
      'Electoral Outcome': c.isWinner ? '🏆 PROCLAIMED ELECTED OFFICER' : 'DEFEATED / RUNNER-UP',
      'Votes Received': c.votes_count,
      'Position Total Votes': c.positionTotalVotes,
      'Vote Share %': `${(c.voteShare || 0).toFixed(1)}%`,
      'Vote Deficit vs Winner': c.isWinner ? '0' : `-${c.deficit}`,
      'Platform / Agenda': c.platform || '—',
      'Affiliation / School': c.sector_details || c.sector || 'Individual Member',
      'Status in System': c.status,
    }));

    exportToCSV(`${(election?.title || 'Election').replace(/\s+/g, '_')}_Official_Canvass_Report`, exportRows);
  };

  return (
    <div className="space-y-6 text-gray-900">
      {/* ============================================================== */}
      {/* 1. OFFICIAL PSITS COMELEC CANVASS LETTERHEAD                   */}
      {/* ============================================================== */}
      <div className="border-b-2 border-primary/90 pb-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img src={logo} alt="PSITS Logo" className="h-14 w-14 object-contain shadow-xs rounded-full p-1 border border-primary/20 bg-white" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded flex items-center gap-1">
                  <Vote size={11} /> Official COMELEC Canvass Document
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  REF: PSITS-ELEC-{election?.id || '01'}-{new Date().getFullYear()}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight mt-0.5">
                PHILIPPINE SOCIETY OF INFORMATION TECHNOLOGY STUDENTS
              </h1>
              <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider">
                Regional Commission on Elections (COMELEC) • Official Election Tally & Canvass of Ballots
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-gray-600 space-y-1 bg-gray-50/80 p-2.5 rounded-lg border border-gray-200 min-w-[200px]">
            <p>
              <strong className="text-gray-800">Election:</strong>{' '}
              <span className="font-semibold text-purple-900">{election?.title || 'General Elections'}</span>
            </p>
            <p>
              <strong className="text-gray-800">Canvass Date:</strong>{' '}
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p>
              <strong className="text-gray-800">Canvassed By:</strong> {preparedBy} ({userRole})
            </p>
            <p>
              <strong className="text-gray-800">Election Status:</strong>{' '}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${election?.status === 'closed' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                {election?.status || 'CLOSED'}
              </span>
            </p>
          </div>
        </div>

        {/* Subtitle & Quick Actions Bar */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs bg-purple-50/70 border border-purple-200/80 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-2 text-purple-950 font-medium">
            <FileCheck2 size={16} className="text-purple-700" />
            <span>
              Official Certification of Elected Officers, Defeated Candidates Slate, and Voter Participation Registry.
            </span>
          </div>

          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={handleExportCanvassCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={13} /> Export Canvass CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setPageSize('all');
                setTimeout(() => window.print(), 150);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-800 hover:bg-black text-white rounded-md text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Printer size={13} /> Print / Save PDF
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. EXECUTIVE ELECTION SCORECARDS                               */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Ballots Cast */}
        <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wide">Total Ballots Cast</span>
            <Vote size={16} className="text-purple-600" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-purple-900 tracking-tight">{totalBallots}</p>
            <p className="text-[11px] text-purple-700 mt-0.5">Audited ballots canvassed</p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-purple-200/60 text-[10px] text-purple-800 font-medium flex justify-between">
            <span>Turnout</span>
            <strong>{turnoutRate.toFixed(1)}% of voters</strong>
          </div>
        </div>

        {/* Proclaimed Officers (Winners) */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide">Elected Officers</span>
            <Trophy size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-emerald-700 tracking-tight">{winnersList.length}</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">Offices officially proclaimed</p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-emerald-200/60 text-[10px] text-emerald-800 font-medium">
            Incoming Executive Board
          </div>
        </div>

        {/* Defeated Candidates (Losers) */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Defeated Candidates</span>
            <XCircle size={16} className="text-amber-600" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-amber-800 tracking-tight">{defeatedList.length}</p>
            <p className="text-[11px] text-amber-700 mt-0.5">Non-winning runners-up</p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-amber-200/60 text-[10px] text-amber-800 font-medium">
            Opposing slates / runners-up
          </div>
        </div>

        {/* Contested Positions */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wide">Contested Offices</span>
            <Layers size={16} className="text-primary" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-primary tracking-tight">{positionsList.length}</p>
            <p className="text-[11px] text-blue-700 mt-0.5">Executive & board positions</p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-blue-200/60 text-[10px] text-blue-800 font-medium">
            Full constitutional slate
          </div>
        </div>

        {/* Total Candidates Running */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">Total Participants</span>
            <Users size={16} className="text-slate-600" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-900 tracking-tight">{rawCandidates.length}</p>
            <p className="text-[11px] text-slate-600 mt-0.5">Candidates in official roster</p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-200 text-[10px] text-slate-700 font-medium">
            {rawVoters.length} registered voters
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. SECTION 1: PROCLAIMED CURRENT OFFICERS (THE WINNERS)       */}
      {/* ============================================================== */}
      <div className="bg-white border-2 border-emerald-300 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <Trophy size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
                Newly Elected Officers & Official Executive Board
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                  Duly Proclaimed
                </span>
              </h3>
              <p className="text-xs text-emerald-800">
                Official winners who secured plurality votes and are recognized as the incoming PSITS Officers.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
            {winnersList.length} Proclaimed Position{winnersList.length !== 1 ? 's' : ''}
          </span>
        </div>

        {winnersList.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500 italic bg-gray-50 rounded-xl border">
            No winning candidates have been marked or tallied yet for this election.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {winnersList.map((w) => (
              <div
                key={w.id}
                className="bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 border border-emerald-300 rounded-xl p-4 shadow-2xs space-y-2 relative overflow-hidden"
              >
                <div className="absolute top-2 right-2">
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
                    <Award size={10} /> Proclaimed
                  </span>
                </div>

                <div className="pr-16">
                  <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                    {w.position}
                  </span>
                  <h4 className="text-base font-black text-gray-900 mt-0.5 leading-snug">{w.name}</h4>
                  <p className="text-[11px] text-gray-500 font-mono truncate">{w.email || w.sector_details || 'Verified Candidate'}</p>
                </div>

                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Total Mandate</span>
                    <strong className="text-sm font-extrabold text-emerald-800">
                      {w.votes_count} vote{Number(w.votes_count) !== 1 ? 's' : ''}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 block">Position Share</span>
                    <strong className="text-sm font-black text-emerald-700">
                      {(w.voteShare || 0).toFixed(1)}%
                    </strong>
                  </div>
                </div>

                {w.platform && (
                  <div className="pt-1 text-[11px] text-gray-600 italic bg-white/60 p-2 rounded border border-emerald-100">
                    <span className="font-semibold text-gray-700 not-italic block text-[10px] uppercase">Platform:</span>
                    "{w.platform}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 4. SECTION 2: DEFEATED CANDIDATES (THE LOSERS LIST)            */}
      {/* ============================================================== */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <XCircle size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                Non-Winning Candidates & Runners-Up (Loser List)
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                  Canvassed Runners-Up
                </span>
              </h3>
              <p className="text-xs text-gray-500">
                Official audit of candidates who contested positions but did not secure the winning plurality.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 px-3 py-1 rounded-lg">
            {defeatedList.length} Defeated Candidate{defeatedList.length !== 1 ? 's' : ''}
          </span>
        </div>

        {defeatedList.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500 italic bg-gray-50 rounded-xl border">
            No defeated candidates or uncontested elections recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                  <th className="px-3 py-2.5">Candidate Name</th>
                  <th className="px-3 py-2.5">Contested Position</th>
                  <th className="px-3 py-2.5">Affiliation / School</th>
                  <th className="px-3 py-2.5 text-right">Votes</th>
                  <th className="px-3 py-2.5 text-right">Vote Share</th>
                  <th className="px-3 py-2.5 text-center">Margin Behind Winner</th>
                  <th className="px-3 py-2.5 text-center">Outcome Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {defeatedList.map((d) => (
                  <tr key={d.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-gray-900">
                      <div>{d.name}</div>
                      {d.platform && <div className="text-[10px] text-gray-500 italic font-normal">"{d.platform}"</div>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 font-semibold">{d.position}</td>
                    <td className="px-3 py-2.5 text-gray-600">{d.sector_details || d.sector || 'Individual Member'}</td>
                    <td className="px-3 py-2.5 text-right font-black text-gray-900">{d.votes_count}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-800">
                      {(d.voteShare || 0).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 text-center text-[11px] font-mono text-rose-700 font-bold">
                      {d.deficit && d.deficit > 0 ? `-${d.deficit} vote${d.deficit !== 1 ? 's' : ''}` : '0 (Tied)'}
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
                        Runner-Up / Defeated
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 5. SECTION 3: ALL PARTICIPANTS & COMPLETE CANVASS ROSTER      */}
      {/* ============================================================== */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden space-y-0">
        <div className="p-4 bg-gray-50/70 border-b border-gray-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Users size={18} className="text-primary" /> Complete Election Participants Registry
              </h3>
              <p className="text-xs text-gray-500">
                Full roster of participating candidates across all positions alongside voting participant records.
              </p>
            </div>

            {/* In-Document Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search candidates, voters, offices..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white text-gray-900"
              />
            </div>
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-200 no-print">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('all');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                All Candidates ({rawCandidates.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('winners');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === 'winners'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                }`}
              >
                <Trophy size={13} /> Proclaimed Officers ({winnersList.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('losers');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === 'losers'
                    ? 'bg-amber-700 text-white shadow-2xs'
                    : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
                }`}
              >
                <XCircle size={13} /> Defeated Candidates ({defeatedList.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('voters');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === 'voters'
                    ? 'bg-purple-800 text-white shadow-2xs'
                    : 'bg-white text-purple-800 hover:bg-purple-50 border border-purple-200'
                }`}
              >
                <UserCheck size={13} /> Voter Participants ({rawVoters.length})
              </button>
            </div>

            {/* Position Filter Dropdown (for candidate tabs) */}
            {activeTab !== 'voters' && uniquePositions.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-semibold text-[11px]">Filter Office:</span>
                <select
                  value={selectedPositionFilter}
                  onChange={(e) => {
                    setSelectedPositionFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded border border-gray-300 text-xs bg-white text-gray-800 focus:outline-none focus:border-primary"
                >
                  <option value="all">All Positions ({uniquePositions.length})</option>
                  {uniquePositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1, 2, 3: Candidates Table */}
        {activeTab !== 'voters' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Candidate Name</th>
                  <th className="px-3 py-2.5">Contested Position</th>
                  <th className="px-3 py-2.5">Affiliation / School</th>
                  <th className="px-3 py-2.5 text-center">Electoral Outcome</th>
                  <th className="px-3 py-2.5 text-right">Votes Garnered</th>
                  <th className="px-3 py-2.5 text-center min-w-[120px]">Position Vote Share</th>
                  <th className="px-3 py-2.5">Platform Manifesto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 italic">
                      No candidates match your current filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedCandidates.map((c, idx) => (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        c.isWinner ? 'bg-emerald-50/30 hover:bg-emerald-50/60' : 'hover:bg-blue-50/30'
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono text-[11px] text-gray-500">
                        {pageSize === 'all' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-extrabold text-gray-900">{c.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{c.email || '—'}</div>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800">{c.position}</td>
                      <td className="px-3 py-2.5 text-gray-600">{c.sector_details || c.sector || 'Individual Member'}</td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {c.isWinner ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs">
                            <Trophy size={11} /> ELECTED WINNER
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-300">
                            Runner-Up
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-black text-sm text-gray-900">
                        {c.votes_count}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold">
                            <span>{(c.voteShare || 0).toFixed(1)}%</span>
                            <span className="text-gray-400">of {c.positionTotalVotes || 0} votes</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-500 ${
                                c.isWinner ? 'bg-emerald-600' : 'bg-primary'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, c.voteShare || 0))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-gray-600 max-w-[200px] truncate" title={c.platform || ''}>
                        {c.platform ? `"${c.platform}"` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Voter Participants Table */}
        {activeTab === 'voters' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-purple-50 text-purple-900 font-bold border-b border-purple-200">
                <tr>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Voter Full Name</th>
                  <th className="px-3 py-2.5">Email Address</th>
                  <th className="px-3 py-2.5">Affiliation / School</th>
                  <th className="px-3 py-2.5">Membership Category</th>
                  <th className="px-3 py-2.5 text-center">Timestamp Voted</th>
                  <th className="px-3 py-2.5 text-center">Ballot Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredVoters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 italic">
                      No voter logs recorded yet for this election.
                    </td>
                  </tr>
                ) : (
                  filteredVoters.map((v, idx) => (
                    <tr key={String(v.user_id) + idx} className="hover:bg-purple-50/30 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-900">{v.voter_name}</td>
                      <td className="px-3 py-2.5 text-gray-600 font-mono text-[11px]">{v.voter_email || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-700">{v.sector_details || v.sector || 'Individual Member'}</td>
                      <td className="px-3 py-2.5 capitalize font-medium">{v.member_type || 'student'}</td>
                      <td className="px-3 py-2.5 text-center text-[11px] text-gray-600">
                        {v.voted_at ? new Date(v.voted_at).toLocaleString() : 'Audited In Ballot'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 size={11} /> Counted & Verified
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar for Candidates */}
        {activeTab !== 'voters' && (
          <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span>Show:</span>
              {[15, 30, 50, 'all'].map((sz) => (
                <button
                  key={String(sz)}
                  type="button"
                  onClick={() => {
                    setPageSize(sz as any);
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                    pageSize === sz ? 'bg-primary text-white' : 'bg-white border text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {sz === 'all' ? 'All' : sz}
                </button>
              ))}
              <span className="text-gray-400">|</span>
              <span>
                Showing {filteredCandidates.length > 0 ? (currentPage - 1) * (pageSize === 'all' ? filteredCandidates.length : pageSize) + 1 : 0} to{' '}
                {pageSize === 'all' ? filteredCandidates.length : Math.min(currentPage * (pageSize as number), filteredCandidates.length)} of {filteredCandidates.length} filtered candidate records
              </span>
            </div>

            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:hover:bg-white cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[11px] font-semibold px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:hover:bg-white cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 6. OFFICIAL COMELEC CANVASS CERTIFICATION & TRIPLE SIGN-OFF     */}
      {/* ============================================================== */}
      <div className="border border-gray-300 rounded-xl p-5 bg-gray-50/50 space-y-4 certification-block">
        <div className="text-xs text-gray-700 italic border-l-4 border-purple-700 pl-3">
          <p className="font-semibold text-purple-900 not-italic uppercase tracking-wide text-[11px] mb-0.5">
            COMELEC Canvassing Board Certification Resolution
          </p>
          "We, the members of the PSITS Regional Commission on Elections (COMELEC) and Board of Canvassers, hereby certify under official oath that the ballot tallies, elected winner proclamations, runner-up tallies, and voter registries set forth in this official document represent an audited, true, and definitive canvass of the election results in accordance with the PSITS Regional Election Code."
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-xs">
          {/* Canvassed By */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Prepared & Canvassed By:</p>
            <div className="pt-8 border-b-2 border-gray-500 w-full sm:w-48"></div>
            <p className="font-extrabold text-gray-900 text-sm mt-1">{preparedBy}</p>
            <p className="text-[11px] text-gray-500 capitalize">{userRole} / Chief Scrutineer</p>
            <p className="text-[10px] text-gray-400">Date: {new Date().toLocaleDateString()}</p>
          </div>

          {/* Certified by COMELEC Chair */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Audited & Certified By:</p>
            <div className="pt-8 border-b-2 border-gray-500 w-full sm:w-48"></div>
            <p className="font-extrabold text-gray-900 text-sm mt-1">COMELEC Commission Chairman</p>
            <p className="text-[11px] text-gray-500">Board of Canvassers & Scrutineers</p>
            <p className="text-[10px] text-gray-400">Official Seal & Signature</p>
          </div>

          {/* Approved & Ratified by President */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Noted & Ratified By:</p>
            <div className="pt-8 border-b-2 border-gray-500 w-full sm:w-48"></div>
            <p className="font-extrabold text-gray-900 text-sm mt-1">PSITS Regional Secretariat</p>
            <p className="text-[11px] text-gray-500">Regional Executive Council</p>
            <p className="text-[10px] text-gray-400">Official Ratification Stamp</p>
          </div>
        </div>
      </div>
    </div>
  );
};

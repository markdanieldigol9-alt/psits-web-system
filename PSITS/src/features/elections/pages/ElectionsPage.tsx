import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Input, TextArea, Select, Badge } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import { Plus, Users, Trophy, Lock, Eye, Trash2, Info } from 'lucide-react';

type ElectionStatus = 'draft' | 'open' | 'closed' | 'archived';

export const isElectionClosed = (election?: any): boolean => {
  if (!election) return false;
  if (election.status === 'closed' || election.status === 'archived') return true;
  if (!election.endDate) return false;
  const end = new Date(election.endDate + 'T23:59:59');
  return !isNaN(end.getTime()) && new Date() > end;
};

export const ElectionsPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const canManage = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  const [statusFilter, setStatusFilter] = useState<'all' | ElectionStatus>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [elections, setElections] = useState<any[]>([]);

  // Create / Edit Election Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingElection, setEditingElection] = useState<any | null>(null);
  const [form, setForm] = useState({ title: '', description: '', startDate: '', endDate: '', status: 'draft' as ElectionStatus, allowedPositions: [] as string[] });

  // Dynamic Custom Positions State
  const [showAddCustomPos, setShowAddCustomPos] = useState(false);
  const [customPosName, setCustomPosName] = useState('');

  // Candidates Configured Inside Create / Edit Modal
  const [createCandidates, setCreateCandidates] = useState<Array<{
    memberId: number;
    memberName: string;
    memberEmail: string;
    position: string;
    platform: string;
  }>>([]);

  // Multi-Select Candidate Modal State
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [candidateModalSource, setCandidateModalSource] = useState<'create_modal' | 'details_modal'>('create_modal');
  const [candidateModalStep, setCandidateModalStep] = useState<1 | 2>(1);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [candidateTargetPosition, setCandidateTargetPosition] = useState<string>('');
  const [candidatePlatforms, setCandidatePlatforms] = useState<Record<number, string>>({});
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [activeMembers, setActiveMembers] = useState<any[]>([]);

  // Candidate Full Profile / Details Modal
  const [viewingCandidate, setViewingCandidate] = useState<any | null>(null);

  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [details, setDetails] = useState<{ election: any; candidates: any[] } | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmWinner, setConfirmWinner] = useState<{ candidateId: string; name: string; position: string } | null>(null);

  const [hasVoted, setHasVoted] = useState(false);
  const [showVotingModal, setShowVotingModal] = useState(false);
  const [selectedVotes, setSelectedVotes] = useState<Record<string, string>>({});
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  const [confirmDeleteElection, setConfirmDeleteElection] = useState<{ id: string; title: string } | null>(null);
  const [confirmDeleteCandidate, setConfirmDeleteCandidate] = useState<{ id: string; name: string } | null>(null);
  const [allOfficerPositions, setAllOfficerPositions] = useState<string[]>([
    'President',
    'Vice President',
    'Secretary',
    'Treasurer',
    'Member',
  ]);

  const load = async () => {
    setIsLoading(true);
    try {
      const [electionsResp, posResp] = await Promise.all([
        api.getElections({ status: statusFilter }),
        api.getOfficerPositions(),
      ]);
      if (electionsResp.data?.success) setElections(electionsResp.data.elections || []);
      if (posResp.data?.success && posResp.data.positions?.length > 0) {
        setAllOfficerPositions(posResp.data.positions.map((p: any) => p.name));
      }
    } catch (err) {
      addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to load elections.', type: 'error', isRead: false });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const loadActiveMembers = async () => {
    try {
      const { data } = await api.getMembers({ status: 'active' });
      if (data?.success) setActiveMembers(data.members || []);
    } catch {
      // ignore
    }
  };

  const handleAddCustomPosition = () => {
    const trimmed = customPosName.trim();
    if (!trimmed) return;
    if (!allOfficerPositions.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setAllOfficerPositions((prev) => [...prev, trimmed]);
    }
    if (!form.allowedPositions.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setForm((prev) => ({ ...prev, allowedPositions: [...prev.allowedPositions, trimmed] }));
    }
    setCustomPosName('');
    setShowAddCustomPos(false);
  };

  const openCreate = () => {
    setEditingElection(null);
    setCreateCandidates([]);
    setForm({
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      status: 'draft',
      allowedPositions: [...allOfficerPositions]
    });
    setShowEditModal(true);
  };

  const openEdit = (election: any) => {
    setEditingElection(election);
    setCreateCandidates([]);
    setForm({
      title: election.title || '',
      description: election.description || '',
      startDate: election.startDate || '',
      endDate: election.endDate || '',
      status: (election.status || 'draft') as ElectionStatus,
      allowedPositions: election.allowedPositions || [...allOfficerPositions]
    });
    setShowEditModal(true);
  };

  const openAddCandidateModal = async (source: 'create_modal' | 'details_modal', defaultPos?: string) => {
    setCandidateModalSource(source);
    setCandidateModalStep(1);
    setSelectedMemberIds([]);
    setCandidatePlatforms({});
    setMemberSearchQuery('');
    const posList = source === 'create_modal' ? form.allowedPositions : (details?.election?.allowedPositions || form.allowedPositions);
    setCandidateTargetPosition(defaultPos || (posList.length ? posList[0] : 'President'));
    setShowAddCandidate(true);
    if (!activeMembers.length) {
      await loadActiveMembers();
    }
  };

  const handleSaveCandidatesMulti = async () => {
    if (!selectedMemberIds.length || !candidateTargetPosition) return;
    
    // Validate all platforms are filled (required)
    const missing = selectedMemberIds.some((id) => !candidatePlatforms[id]?.trim());
    if (missing) {
      addNotification({
        userId: 'current',
        title: 'Platform Required',
        message: 'Please provide a platform statement for each selected candidate.',
        type: 'error',
        isRead: false,
      });
      return;
    }

    setIsLoading(true);
    try {
      if (candidateModalSource === 'create_modal') {
        const newCandidates = selectedMemberIds.map((id) => {
          const m = activeMembers.find((member) => Number(member.id) === Number(id));
          return {
            memberId: Number(id),
            memberName: m?.fullName || m?.email || `Member #${id}`,
            memberEmail: m?.email || '',
            position: candidateTargetPosition,
            platform: candidatePlatforms[id].trim(),
          };
        });
        setCreateCandidates((prev) => [...prev, ...newCandidates]);
        addNotification({
          userId: 'current',
          title: 'Candidates Added',
          message: `Added ${selectedMemberIds.length} candidate(s) with required platform to ${candidateTargetPosition}.`,
          type: 'success',
          isRead: false,
        });
        setShowAddCandidate(false);
      } else {
        if (!selectedElectionId) return;
        const candidatePayload = selectedMemberIds.map((id) => ({
          memberId: Number(id),
          position: candidateTargetPosition,
          platform: candidatePlatforms[id].trim(),
        }));

        const { data } = await api.addElectionCandidate(selectedElectionId, {
          candidates: candidatePayload,
          position: candidateTargetPosition,
        });
        if (data?.success) {
          setDetails((prev) => (prev ? { ...prev, candidates: data.candidates || [] } : prev));
          addNotification({
            userId: 'current',
            title: 'Candidates Added',
            message: `Added ${selectedMemberIds.length} candidate(s) with required platform to ${candidateTargetPosition}.`,
            type: 'success',
            isRead: false,
          });
        }
        setShowAddCandidate(false);
      }
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Failed to add candidates.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteElection = async () => {
    if (!confirmDeleteElection) return;
    setIsLoading(true);
    try {
      const { data } = await api.deleteElection(confirmDeleteElection.id);
      if (data?.success) {
        setElections((prev) => prev.filter((e) => String(e.id) !== confirmDeleteElection.id));
        addNotification({
          userId: 'current',
          title: 'Election Deleted',
          message: 'Election deleted successfully.',
          type: 'success',
          isRead: false
        });
      }
      setConfirmDeleteElection(null);
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: err.message || 'Failed to delete election.',
        type: 'error',
        isRead: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeCandidate = async () => {
    if (!confirmDeleteCandidate || !selectedElectionId) return;
    setIsLoading(true);
    try {
      const { data } = await api.deleteElectionCandidate(selectedElectionId, confirmDeleteCandidate.id);
      if (data?.success) {
        setDetails((prev) => prev ? { ...prev, candidates: data.candidates || [] } : prev);
        addNotification({
          userId: 'current',
          title: 'Candidate Removed',
          message: 'Candidate removed successfully.',
          type: 'success',
          isRead: false
        });
      }
      setConfirmDeleteCandidate(null);
    } catch (err: any) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: err.message || 'Failed to remove candidate.',
        type: 'error',
        isRead: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openDetails = async (id: string) => {
    setSelectedElectionId(id);
    setDetails(null);
    setShowDetailsModal(true);
    try {
      const { data } = await api.getElection(id);
      if (data?.success) setDetails({ election: data.election, candidates: data.candidates || [] });
      if (user?.role === 'member') {
        const { data: votedResp } = await api.checkVoted(id);
        if (votedResp?.success) setHasVoted(votedResp.voted);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!details?.election || details.election.status !== 'open') return;
    const interval = setInterval(() => {
      const end = new Date(details.election.endDate + 'T23:59:59');
      const diff = end.getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft('Election Ended');
        clearInterval(interval);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [details]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return elections;
    return elections.filter((e) => e.status === statusFilter);
  }, [elections, statusFilter]);

  const saveElection = async () => {
    setIsLoading(true);
    try {
      if (editingElection?.id) {
        const { data } = await api.updateElection(String(editingElection.id), {
          ...form,
          candidates: createCandidates,
        });
        if (data?.success && data.election) {
          setElections((prev) => prev.map((e) => (String(e.id) === String(data.election.id) ? data.election : e)));
        }
        addNotification({ userId: 'current', title: 'Election Updated', message: 'Election and candidate updates saved.', type: 'success', isRead: false });
      } else {
        const { data } = await api.createElection({
          ...form,
          candidates: createCandidates,
        });
        if (data?.success && data.election) {
          setElections((prev) => [data.election, ...prev]);
        }
        addNotification({ userId: 'current', title: 'Election Created', message: 'Election and candidates created successfully in one go!', type: 'success', isRead: false });
      }
      setShowEditModal(false);
      setCreateCandidates([]);
    } catch (err) {
      addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to save election.', type: 'error', isRead: false });
    } finally {
      setIsLoading(false);
    }
  };

  const markWinner = async () => {
    if (!selectedElectionId || !confirmWinner) return;
    setIsLoading(true);
    try {
      const { data } = await api.markElectionWinner(selectedElectionId, confirmWinner.candidateId);
      if (data?.success) {
        const refreshed = await api.getElection(selectedElectionId);
        if (refreshed.data?.success) setDetails({ election: refreshed.data.election, candidates: refreshed.data.candidates || [] });
      }
      addNotification({ userId: 'current', title: 'Winner Marked', message: 'Winner saved and officer record updated.', type: 'success', isRead: false });
      setConfirmWinner(null);
    } catch (err) {
      addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to mark winner.', type: 'error', isRead: false });
    } finally {
      setIsLoading(false);
    }
  };

  const candidatesByPosition = useMemo(() => {
    if (!details?.candidates) return {};
    const grouped: Record<string, any[]> = {};
    details.candidates.forEach((c) => {
      const pos = c.position || 'Other';
      if (!grouped[pos]) grouped[pos] = [];
      grouped[pos].push(c);
    });
    return grouped;
  }, [details]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">Officer Elections</h1>
            <p className="mt-2 text-gray-600">Election periods, manage candidates, and record winners.</p>
          </div>
          {canManage && (
            <Button variant="primary" size="lg" onClick={openCreate} className="w-full sm:w-auto">
              <Plus size={18} /> Create Election
            </Button>
          )}
        </div>

        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="all">All</option>
              {canManage && <option value="draft">Draft</option>}
              <option value="open">Open</option>
              <option value="closed">Closed (History)</option>
              <option value="archived">Archived (History)</option>
            </select>
            <Button variant="outline" onClick={() => void load()} isLoading={isLoading}>Refresh</Button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filtered.map((e) => (
              <Card key={e.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{e.title}</p>
                    <p className="text-sm text-gray-600 mt-1 truncate">{e.description || '—'}</p>
                    <p className="text-xs text-gray-500 mt-2">{e.startDate} → {e.endDate}</p>
                  </div>
                  {(() => {
                    const isClosed = isElectionClosed(e);
                    const label = isClosed && e.status === 'open' ? 'CLOSED' : String(e.status).toUpperCase();
                    const variant = isClosed || e.status === 'closed' ? 'warning' : e.status === 'open' ? 'success' : 'info';
                    return <Badge variant={variant}>{label}</Badge>;
                  })()}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 items-center justify-between w-full">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void openDetails(String(e.id))}>
                      <Users size={16} /> Details
                    </Button>
                    {canManage && (
                      <Button variant="secondary" size="sm" onClick={() => openEdit(e)}>
                        Edit
                      </Button>
                    )}
                  </div>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDeleteElection({ id: String(e.id), title: e.title })}
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Card>
            ))}
            {!filtered.length && (
              <div className="text-sm text-gray-500 p-6">No elections found.</div>
            )}
          </div>
        </Card>
      </div>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={editingElection ? 'Edit Election' : 'Create Election'} size="lg">
        <div className="space-y-4 font-sans">
          <Input label="Election Year" placeholder="e.g. 2026 Election" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <TextArea label="Description" rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: (e.target as HTMLTextAreaElement).value }))} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
            <Input label="End Date" type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
          </div>

          {/* Contested Positions Selection with Dynamic + Add Position */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700">Contested Officer Positions</label>
              {!showAddCustomPos && (
                <button
                  type="button"
                  onClick={() => setShowAddCustomPos(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus size={14} /> Add Custom Position
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500">Select the officer positions that will be active and voted for in this election.</p>

            {/* Dynamic Custom Position Input */}
            {showAddCustomPos && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-blue-900">New Custom Officer Position</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Public Relations Officer, Auditor, Representative"
                    value={customPosName}
                    onChange={(e) => setCustomPosName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomPosition(); } }}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <Button type="button" size="sm" variant="primary" onClick={handleAddCustomPosition}>Add</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setShowAddCustomPos(false); setCustomPosName(''); }}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {allOfficerPositions.map((pos) => {
                const isChecked = form.allowedPositions.includes(pos);
                return (
                  <label
                    key={pos}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer select-none transition-all ${
                      isChecked
                        ? 'border-blue-500 bg-blue-50/20 text-blue-900 font-semibold ring-1 ring-blue-500'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      checked={isChecked}
                      onChange={() => {
                        setForm((prev) => {
                          const exist = prev.allowedPositions.includes(pos);
                          const next = exist
                            ? prev.allowedPositions.filter((p) => p !== pos)
                            : [...prev.allowedPositions, pos];
                          return { ...prev, allowedPositions: next };
                        });
                      }}
                    />
                    <span className="text-sm truncate">{pos}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Inline Candidates Lineup Setup */}
          <div className="space-y-2 pt-2 border-t border-gray-150">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-semibold text-gray-800">
                  Candidate Lineup ({createCandidates.length} Added)
                </label>
                <p className="text-xs text-gray-500">Assign candidates right now so the election is ready when saved.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void openAddCandidateModal('create_modal')}
                className="flex items-center gap-1 text-xs"
              >
                <Plus size={14} /> Add Candidates
              </Button>
            </div>

            {createCandidates.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center text-xs text-gray-500">
                No candidates assigned yet. Click <strong>+ Add Candidates</strong> to select multiple members at once, or you can add them later.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {createCandidates.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 truncate">{c.memberName}</span>
                        <span className="text-gray-500 truncate text-[11px]">({c.memberEmail})</span>
                        <span className="font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-[11px] shrink-0">
                          {c.position}
                        </span>
                      </div>
                      {c.platform && (
                        <p className="text-gray-500 italic mt-0.5 truncate text-[11px]">
                          "{c.platform}"
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateCandidates((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50"
                      title="Remove from lineup"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canManage && (
            <Select
              label="Status"
              options={
                editingElection
                  ? [
                      { value: 'draft', label: 'Draft' },
                      { value: 'open', label: 'Open' },
                      { value: 'closed', label: 'Closed' },
                      { value: 'archived', label: 'Archived' },
                    ]
                  : [
                      { value: 'draft', label: 'Draft' },
                      { value: 'open', label: 'Open' },
                    ]
              }
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: (e.target as HTMLSelectElement).value as ElectionStatus }))}
            />
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-150">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setConfirmSave(true)} isLoading={isLoading}>Save Election & Candidates</Button>
          </div>
        </div>
      </Modal>

      <VerifyActionModal
        isOpen={confirmSave}
        title="Verify Election Save"
        message="Save this election and its configured candidate lineup?"
        confirmLabel="Accept"
        confirmVariant="primary"
        onCancel={() => setConfirmSave(false)}
        onVerified={async () => {
          setConfirmSave(false);
          await saveElection();
        }}
      />

      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title="Election Details" size="lg">
        {!details ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-4 font-sans">
            <div className="rounded-lg border border-gray-250 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{details.election.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{details.election.description || '—'}</p>
                  <p className="text-xs text-gray-500 mt-2">{details.election.startDate} → {details.election.endDate}</p>
                </div>
                <Badge variant={details.election.status === 'open' ? 'success' : details.election.status === 'closed' ? 'warning' : 'info'}>{String(details.election.status).toUpperCase()}</Badge>
              </div>
            </div>

            {/* Voting CTA or Closed Notice */}
            {(() => {
              const isClosed = isElectionClosed(details.election);
              if (user?.role === 'member' && !isClosed && details.election.status === 'open') {
                return (
                  <div className="rounded-xl border p-5 text-center space-y-3 bg-blue-50/50 border-blue-200">
                    {hasVoted ? (
                      <div className="space-y-1">
                        <p className="text-green-800 font-bold text-lg">✓ Vote Submitted Successfully</p>
                        <p className="text-green-600 text-sm font-medium">You have already cast your ballot in this election. Thank you for participating.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-blue-900 font-bold text-lg">Elections are Open!</p>
                        <p className="text-blue-700 text-sm max-w-md mx-auto">Please review the list of candidates and click below to submit your secure ballot.</p>
                        <Button
                          variant="primary"
                          onClick={() => {
                            setSelectedVotes({});
                            setShowDetailsModal(false);
                            setShowVotingModal(true);
                          }}
                          className="px-6 py-2"
                        >
                          Cast Your Vote Now
                        </Button>
                      </div>
                    )}
                  </div>
                );
              }

              if (isClosed) {
                return (
                  <div className="rounded-xl border p-4 text-center space-y-1.5 bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                    <p className="text-amber-900 dark:text-amber-200 font-bold text-base flex items-center justify-center gap-2">
                      <Lock size={18} className="text-amber-600" />
                      Voting Concluded (Closed)
                    </p>
                    <p className="text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-medium max-w-lg mx-auto">
                      The election schedule has concluded and voting is closed. Members cannot cast votes, but you can view all live tallies, votes, percentages, and candidate updates below.
                    </p>
                  </div>
                );
              }

              return null;
            })()}

            <div className="flex items-center justify-between border-b border-gray-150 pb-2">
              <p className="text-sm font-semibold text-gray-900">Candidates & Results</p>
              {canManage && !isElectionClosed(details.election) && (details.election.status === 'draft' || details.election.status === 'open') && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void openAddCandidateModal('details_modal')}
                >
                  <Plus size={16} /> Add Candidate
                </Button>
              )}
            </div>

            {/* Grouped Visual Candidates & Results List */}
            <div className="space-y-6">
              {Object.entries(candidatesByPosition).map(([position, positionCandidates]) => {
                const isClosed = isElectionClosed(details.election);
                const maxVotes = Math.max(...positionCandidates.map((c) => c.votesCount || 0));
                const totalPosVotes = positionCandidates.reduce((acc, curr) => acc + (curr.votesCount || 0), 0);

                return (
                  <div key={position} className="border border-gray-250 rounded-xl p-4 bg-gray-50/40 space-y-3 shadow-sm">
                    <h4 className="font-bold text-gray-900 border-b border-gray-200 pb-2 text-sm flex items-center justify-between">
                      <span>{position}</span>
                      {(canManage || isClosed || details.election.status === 'closed' || details.election.status === 'archived') && <span className="text-xs text-gray-500 font-normal">Total Votes: {totalPosVotes}</span>}
                    </h4>
                    <div className="space-y-3">
                      {positionCandidates.map((c: any) => {
                        const pct = totalPosVotes > 0 ? Math.round(((c.votesCount || 0) / totalPosVotes) * 100) : 0;
                        const isWinner = c.status === 'winner';
                        const isLeading = (c.votesCount || 0) === maxVotes && maxVotes > 0;

                        return (
                          <div
                            key={c.id}
                            className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg border bg-white ${
                              isWinner
                                ? 'border-green-300 ring-1 ring-green-300 bg-green-50/10'
                                : isLeading && details.election.status !== 'draft'
                                ? 'border-yellow-300 ring-1 ring-yellow-300 bg-yellow-50/10'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 text-sm">{c.memberName || c.memberEmail}</span>
                                {isWinner && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                                    Winner
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 italic truncate">"{c.platform || 'No platform bio provided.'}"</p>

                              {/* Progress bar visual for results */}
                              {(canManage || isClosed || details.election.status === 'closed' || details.election.status === 'archived') && details.election.status !== 'draft' && (
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="flex-1 bg-gray-150 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${isWinner ? 'bg-green-600' : isLeading ? 'bg-yellow-500' : 'bg-blue-600'}`}
                                      style={{ width: `${pct}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-bold text-gray-700 min-w-[32px] text-right">{pct}%</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 justify-between md:justify-end flex-wrap">
                              {/* Details / View Profile Button for Voters and Everyone */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingCandidate(c)}
                                className="py-1 px-2.5 text-xs flex items-center gap-1"
                              >
                                <Eye size={13} /> View Platform
                              </Button>

                              {(canManage || isClosed || details.election.status === 'closed' || details.election.status === 'archived') && (
                                <span className="text-xs font-semibold text-gray-600 bg-gray-150 px-2.5 py-1 rounded-lg">
                                  {c.votesCount || 0} Votes
                                </span>
                              )}

                              {canManage && (
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setConfirmWinner({
                                        candidateId: String(c.id),
                                        name: c.memberName || c.memberEmail || 'Candidate',
                                        position: c.position,
                                      })
                                    }
                                    disabled={c.status === 'winner'}
                                    className="py-1 px-2.5 text-xs flex items-center gap-1"
                                  >
                                    <Trophy size={13} /> {c.status === 'winner' ? 'Winner' : 'Mark Winner'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirmDeleteCandidate({ id: String(c.id), name: c.memberName || c.memberEmail })}
                                    className="py-1 px-2 text-xs text-red-600 hover:bg-red-50"
                                    title="Delete Candidate"
                                  >
                                    <Trash2 size={13} />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {!details.candidates.length && (
                <div className="text-center py-6 text-gray-500 text-sm font-medium">No candidates added yet.</div>
              )}
            </div>

            <div className="flex justify-end">
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showVotingModal} onClose={() => setShowVotingModal(false)} title="Election Voting Ballot" size="lg">
        {!details ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : isElectionClosed(details.election) ? (
          <div className="text-center py-10 space-y-3 font-sans">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600">
              <Lock size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Voting is Closed</h3>
            <p className="text-gray-600 text-sm max-w-md mx-auto">
              This election has concluded because the scheduled end date has arrived. You can view all candidate updates, vote counts, and winner updates in the election details.
            </p>
            <div className="pt-4">
              <Button variant="primary" onClick={() => setShowVotingModal(false)}>Close Ballot</Button>
            </div>
          </div>
        ) : showSuccessScreen ? (
          <div className="text-center py-12 space-y-4 font-sans">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 animate-bounce">
              <Trophy size={48} />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Vote Submitted Successfully!</h2>
            <p className="text-gray-600 max-w-md mx-auto font-medium">
              Your secure ballot has been successfully received by the PSITS election system. Thank you for participating.
            </p>
            <div className="flex justify-center gap-1.5 pt-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse delay-100"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse delay-200"></span>
            </div>
            <div className="pt-6">
              <Button variant="primary" onClick={() => { setShowVotingModal(false); setShowSuccessScreen(false); void load(); }}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 font-sans">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
              <h3 className="font-bold text-blue-900 text-lg">{details.election.title}</h3>
              <p className="text-blue-700 text-sm mt-1">{details.election.description || 'No description provided.'}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-blue-800 font-semibold bg-blue-100/50 rounded p-2">
                <span>VOTING ENDS: {details.election.endDate}</span>
                {timeLeft && <span className="animate-pulse text-red-600">⌛ {timeLeft}</span>}
              </div>
            </div>

            <div className="space-y-6">
              {Object.entries(candidatesByPosition).map(([position, positionCandidates]) => (
                <div key={position} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm space-y-4">
                  <h4 className="text-md font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center justify-between">
                    <span>{position}</span>
                    <span className="text-xs font-normal text-gray-500">Select exactly 1 candidate</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {positionCandidates.map((c: any) => {
                      const isSelected = selectedVotes[position] === String(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedVotes((prev) => ({ ...prev, [position]: String(c.id) }))}
                          className={`relative border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/20 ring-2 ring-blue-600'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-800 font-bold text-lg select-none shrink-0">
                              {c.memberName ? c.memberName.split(' ').map((n: string) => n[0]).slice(0,2).join('') : 'C'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 truncate">{c.memberName || c.memberEmail}</p>
                              <p className="text-xs text-gray-500 font-medium">BS Information Technology</p>
                              <p className="text-xs text-gray-600 mt-2 line-clamp-2 italic">
                                "{c.platform || 'No platform bio provided.'}"
                              </p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingCandidate(c);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1 mt-2"
                              >
                                <Eye size={12} /> View Full Platform
                              </button>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="absolute top-3 right-3 text-blue-600">
                              <Trophy size={18} className="fill-blue-600" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-150">
              <Button variant="outline" onClick={() => setShowVotingModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={Object.keys(selectedVotes).length === 0}
                onClick={() => setShowConfirmSubmit(true)}
              >
                Submit Vote
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <VerifyActionModal
        isOpen={showConfirmSubmit}
        title="Confirm Your Vote"
        message="Are you sure you want to submit your vote? Once submitted, you cannot change your selections."
        confirmLabel="Submit Vote"
        confirmVariant="primary"
        onCancel={() => setShowConfirmSubmit(false)}
        onVerified={async () => {
          setShowConfirmSubmit(false);
          setIsLoading(true);
          try {
            if (!selectedElectionId) return;
            const { data } = await api.castVote(selectedElectionId, selectedVotes);
            if (data?.success) {
              setShowSuccessScreen(true);
              setHasVoted(true);
            }
          } catch (err: any) {
            addNotification({
              userId: 'current',
              title: 'Voting Failed',
              message: err.response?.data?.message || err.message || 'Failed to cast vote.',
              type: 'error',
              isRead: false
            });
          } finally {
            setIsLoading(false);
          }
        }}
      />

      {/* Multi-Select Add Candidates Modal (2-Step Flow) */}
      <Modal
        isOpen={showAddCandidate}
        onClose={() => setShowAddCandidate(false)}
        title={
          candidateModalStep === 1
            ? 'Add Candidates — Step 1 of 2: Select Position & Members'
            : `Add Candidates — Step 2 of 2: Candidate Platforms (${candidateTargetPosition})`
        }
        size="lg"
      >
        <div className="space-y-4 font-sans">
          {candidateModalStep === 1 ? (
            <>
              <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 p-2.5 rounded-lg flex items-center gap-1.5">
                <Info size={16} className="text-blue-600 shrink-0" />
                <span>
                  <strong>Candidate Rule:</strong> Each candidate can only run for <strong>one position per election</strong>. Select the position and the members who will run.
                </span>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Assigned Position *"
                  options={[
                    { value: '', label: 'Select position' },
                    ...(candidateModalSource === 'create_modal' ? form.allowedPositions : (details?.election?.allowedPositions || form.allowedPositions)).map((pos: string) => ({
                      value: pos,
                      label: pos,
                    })),
                  ]}
                  value={candidateTargetPosition}
                  onChange={(e) => setCandidateTargetPosition((e.target as HTMLSelectElement).value)}
                />
                <div>
                  <Input
                    label="Search Members"
                    placeholder="Search name or email..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700">
                    Select Approved Members ({selectedMemberIds.length} Selected)
                  </label>
                  {(() => {
                    const runningMemberMap = new Map<string, string>();
                    if (candidateModalSource === 'create_modal') {
                      createCandidates.forEach((c) => runningMemberMap.set(String(c.memberId), c.position));
                    } else {
                      (details?.candidates || []).forEach((c: any) => runningMemberMap.set(String(c.memberId || c.member_id), c.position));
                    }
                    const available = activeMembers.filter((m) => !runningMemberMap.has(String(m.id)));
                    return (
                      available.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedMemberIds.length === available.length) {
                              setSelectedMemberIds([]);
                            } else {
                              setSelectedMemberIds(available.map((m) => Number(m.id)));
                            }
                          }}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          {selectedMemberIds.length === available.length ? 'Deselect All' : 'Select All Available'}
                        </button>
                      )
                    );
                  })()}
                </div>

                {/* Scrollable list of members with search */}
                <div className="border border-gray-250 rounded-xl max-h-60 overflow-y-auto divide-y divide-gray-100 bg-white">
                  {(() => {
                    const runningMemberMap = new Map<string, string>();
                    if (candidateModalSource === 'create_modal') {
                      createCandidates.forEach((c) => runningMemberMap.set(String(c.memberId), c.position));
                    } else {
                      (details?.candidates || []).forEach((c: any) => runningMemberMap.set(String(c.memberId || c.member_id), c.position));
                    }

                    const query = memberSearchQuery.toLowerCase().trim();
                    const filteredMembers = activeMembers.filter((m) => {
                      if (!query) return true;
                      return (m.fullName || '').toLowerCase().includes(query) || (m.email || '').toLowerCase().includes(query);
                    });

                    if (!filteredMembers.length) {
                      return (
                        <div className="p-6 text-center text-sm text-gray-500">
                          {memberSearchQuery ? 'No members matching your search.' : 'No active approved members found.'}
                        </div>
                      );
                    }

                    return filteredMembers.map((m) => {
                      const runningPos = runningMemberMap.get(String(m.id));
                      const isRunning = Boolean(runningPos);
                      const isChecked = selectedMemberIds.includes(Number(m.id));

                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            if (isRunning) return;
                            setSelectedMemberIds((prev) =>
                              isChecked ? prev.filter((id) => id !== Number(m.id)) : [...prev, Number(m.id)]
                            );
                          }}
                          className={`flex items-center justify-between p-3 transition-colors ${
                            isRunning
                              ? 'bg-gray-50/80 opacity-60 cursor-not-allowed'
                              : isChecked
                              ? 'bg-blue-50/50 cursor-pointer'
                              : 'hover:bg-gray-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              disabled={isRunning}
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 pointer-events-none"
                            />
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs shrink-0">
                              {m.fullName ? m.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('') : 'M'}
                            </div>
                            <div className="min-w-0 truncate">
                              <p className="text-sm font-semibold text-gray-900 truncate">{m.fullName || m.email}</p>
                              <p className="text-xs text-gray-500 truncate">{m.email}</p>
                            </div>
                          </div>
                          {isRunning && (
                            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                              Running for {runningPos}
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-150">
                <Button variant="outline" onClick={() => setShowAddCandidate(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={selectedMemberIds.length === 0 || !candidateTargetPosition}
                  onClick={() => setCandidateModalStep(2)}
                >
                  Next: Add Platforms ({selectedMemberIds.length} Candidate{selectedMemberIds.length === 1 ? '' : 's'}) →
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Step 2: Individual Required Platforms */}
              <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 p-2.5 rounded-lg flex items-center gap-1.5">
                <Info size={16} className="text-blue-600 shrink-0" />
                <span>
                  <strong>Platforms are mandatory:</strong> Please provide each candidate's platform and manifesto for the position of <strong>{candidateTargetPosition}</strong>.
                </span>
              </p>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {selectedMemberIds.map((id) => {
                  const m = activeMembers.find((member) => Number(member.id) === Number(id));
                  const name = m?.fullName || m?.email || `Member #${id}`;
                  const email = m?.email || '';
                  const platformVal = candidatePlatforms[id] || '';
                  const isFilled = Boolean(platformVal.trim());

                  return (
                    <div key={id} className="p-3.5 bg-gray-50 border border-gray-250 rounded-xl space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs shrink-0">
                          {name ? name.split(' ').map((n: string) => n[0]).slice(0, 2).join('') : 'C'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-gray-900 truncate">{name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{email} • Candidate for <span className="font-semibold text-blue-700">{candidateTargetPosition}</span></p>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-gray-700">
                            Candidate Platform & Vision <span className="text-red-500">* (Required)</span>
                          </label>
                          {!isFilled && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Required
                            </span>
                          )}
                        </div>
                        <textarea
                          required
                          rows={3}
                          placeholder={`Enter ${name}'s goals, vision, and plans for the position of ${candidateTargetPosition}...`}
                          value={platformVal}
                          onChange={(e) => setCandidatePlatforms((prev) => ({ ...prev, [id]: e.target.value }))}
                          className={`w-full rounded-lg border p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white leading-relaxed ${
                            !isFilled ? 'border-amber-300 ring-1 ring-amber-300' : 'border-gray-300'
                          }`}
                        />
                        {!isFilled && (
                          <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                            Please enter this candidate's platform before saving.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-150">
                <Button variant="outline" onClick={() => setCandidateModalStep(1)}>
                  ← Back to Members
                </Button>
                <Button
                  variant="primary"
                  disabled={
                    selectedMemberIds.length === 0 ||
                    selectedMemberIds.some((id) => !candidatePlatforms[id]?.trim())
                  }
                  onClick={() => void handleSaveCandidatesMulti()}
                  isLoading={isLoading}
                >
                  Save {selectedMemberIds.length} Candidate{selectedMemberIds.length === 1 ? '' : 's'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Candidate Full Profile & Platform View Modal */}
      <Modal
        isOpen={!!viewingCandidate}
        onClose={() => setViewingCandidate(null)}
        title="Candidate Profile & Platform"
        size="md"
      >
        {viewingCandidate && (
          <div className="space-y-4 font-sans">
            <div className="flex items-center gap-3.5 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xl shadow-sm select-none shrink-0">
                {viewingCandidate.memberName
                  ? viewingCandidate.memberName.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                  : 'C'}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-gray-900 truncate">
                  {viewingCandidate.memberName || viewingCandidate.memberEmail}
                </h3>
                <p className="text-xs text-gray-600 font-medium">BS Information Technology • {viewingCandidate.memberEmail}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge variant="info">Position: {viewingCandidate.position}</Badge>
                  {viewingCandidate.status === 'winner' && <Badge variant="success">Winner</Badge>}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Full Platform & Vision
              </label>
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 text-gray-800 text-sm leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                {viewingCandidate.platform ? (
                  viewingCandidate.platform
                ) : (
                  <span className="italic text-gray-400">No platform or bio statement submitted by this candidate.</span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="primary" onClick={() => setViewingCandidate(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <VerifyActionModal
        isOpen={!!confirmWinner}
        title="Verify Winner"
        message={confirmWinner ? `Mark ${confirmWinner.name} as winner for ${confirmWinner.position}? This will convert them into an officer.` : ''}
        confirmLabel="Accept"
        confirmVariant="primary"
        onCancel={() => setConfirmWinner(null)}
        onVerified={async () => {
          await markWinner();
        }}
      />

      <VerifyActionModal
        isOpen={!!confirmDeleteCandidate}
        title="Remove Candidate"
        message={confirmDeleteCandidate ? `Are you sure you want to remove ${confirmDeleteCandidate.name} as a candidate?` : ''}
        confirmLabel="Remove"
        confirmVariant="danger"
        onCancel={() => setConfirmDeleteCandidate(null)}
        onVerified={async () => {
          await removeCandidate();
        }}
      />

      <VerifyActionModal
        isOpen={!!confirmDeleteElection}
        title="Delete Election"
        message={confirmDeleteElection ? `Are you sure you want to delete ${confirmDeleteElection.title}? This will also delete all associated candidates and votes.` : ''}
        confirmLabel="Delete"
        confirmVariant="danger"
        onCancel={() => setConfirmDeleteElection(null)}
        onVerified={async () => {
          await deleteElection();
        }}
      />
    </MainLayout>
  );
};

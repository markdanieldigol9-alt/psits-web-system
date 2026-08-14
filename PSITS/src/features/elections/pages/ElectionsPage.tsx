import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Input, TextArea, Select, Badge } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import { Plus, Users, Trophy } from 'lucide-react';

type ElectionStatus = 'draft' | 'open' | 'closed' | 'archived';

export const ElectionsPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const canManage = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  const [statusFilter, setStatusFilter] = useState<'all' | ElectionStatus>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [elections, setElections] = useState<any[]>([]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingElection, setEditingElection] = useState<any | null>(null);
  const [form, setForm] = useState({ title: '', description: '', startDate: '', endDate: '', status: 'draft' as ElectionStatus, allowedPositions: [] as string[] });

  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [details, setDetails] = useState<{ election: any; candidates: any[] } | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [activeMembers, setActiveMembers] = useState<any[]>([]);
  const [candidateForm, setCandidateForm] = useState({ memberId: '', position: '', platform: '' });

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

  const openCreate = () => {
    setEditingElection(null);
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

  const loadActiveMembers = async () => {
    try {
      const { data } = await api.getMembers({ status: 'active' });
      if (data?.success) setActiveMembers(data.members || []);
    } catch {
      // ignore
    }
  };

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return elections;
    return elections.filter((e) => e.status === statusFilter);
  }, [elections, statusFilter]);

  const saveElection = async () => {
    setIsLoading(true);
    try {
      if (editingElection?.id) {
        const { data } = await api.updateElection(String(editingElection.id), form);
        if (data?.success && data.election) setElections((prev) => prev.map((e) => (String(e.id) === String(data.election.id) ? data.election : e)));
        addNotification({ userId: 'current', title: 'Election Updated', message: 'Election updated successfully.', type: 'success', isRead: false });
      } else {
        const { data } = await api.createElection(form);
        if (data?.success && data.election) setElections((prev) => [data.election, ...prev]);
        addNotification({ userId: 'current', title: 'Election Created', message: 'Election created successfully.', type: 'success', isRead: false });
      }
      setShowEditModal(false);
    } catch (err) {
      addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to save election.', type: 'error', isRead: false });
    } finally {
      setIsLoading(false);
    }
  };

  const addCandidate = async () => {
    if (!selectedElectionId) return;
    setIsLoading(true);
    try {
      const { data } = await api.addElectionCandidate(selectedElectionId, { ...candidateForm, memberId: Number(candidateForm.memberId) });
      if (data?.success) setDetails((prev) => (prev ? { ...prev, candidates: data.candidates || [] } : prev));
      addNotification({ userId: 'current', title: 'Candidate Added', message: 'Candidate added successfully.', type: 'success', isRead: false });
      setCandidateForm({ memberId: '', position: '', platform: '' });
      setShowAddCandidate(false);
    } catch (err) {
      addNotification({ userId: 'current', title: 'Error', message: err instanceof Error ? err.message : 'Failed to add candidate.', type: 'error', isRead: false });
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
                  <Badge variant={e.status === 'open' ? 'success' : e.status === 'draft' ? 'info' : e.status === 'closed' ? 'warning' : 'info'}>{String(e.status).toUpperCase()}</Badge>
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
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <TextArea label="Description" rows={4} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: (e.target as HTMLTextAreaElement).value }))} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
            <Input label="End Date" type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
          </div>

          {/* Contested Positions Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Contested Officer Positions</label>
            <p className="text-xs text-gray-500">Select the officer positions that will be active and voted for in this election.</p>
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
                    <span className="text-sm">{pos}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {canManage && (
            <Select
              label="Status"
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'open', label: 'Open' },
                { value: 'closed', label: 'Closed' },
                { value: 'archived', label: 'Archived' },
              ]}
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: (e.target as HTMLSelectElement).value as ElectionStatus }))}
            />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="primary" onClick={() => setConfirmSave(true)} isLoading={isLoading}>Save</Button>
          </div>
        </div>
      </Modal>


      <VerifyActionModal
        isOpen={confirmSave}
        title="Verify Election Save"
        message="Save this election?"
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

            {/* Voting CTA Card for Members */}
            {user?.role === 'member' && details.election.status === 'open' && (
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
            )}

            <div className="flex items-center justify-between border-b border-gray-150 pb-2">
              <p className="text-sm font-semibold text-gray-900">Candidates & Results</p>
              {canManage && (details.election.status === 'draft' || details.election.status === 'open') && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    await loadActiveMembers();
                    setShowAddCandidate(true);
                  }}
                >
                  <Plus size={16} /> Add Candidate
                </Button>
              )}
            </div>

            {/* Grouped Visual Candidates & Results List */}
            <div className="space-y-6">
              {Object.entries(candidatesByPosition).map(([position, positionCandidates]) => {
                const maxVotes = Math.max(...positionCandidates.map((c) => c.votesCount || 0));
                const totalPosVotes = positionCandidates.reduce((acc, curr) => acc + (curr.votesCount || 0), 0);

                return (
                  <div key={position} className="border border-gray-250 rounded-xl p-4 bg-gray-50/40 space-y-3 shadow-sm">
                    <h4 className="font-bold text-gray-900 border-b border-gray-200 pb-2 text-sm flex items-center justify-between">
                      <span>{position}</span>
                      {(canManage || details.election.status === 'closed' || details.election.status === 'archived') && <span className="text-xs text-gray-500 font-normal">Total Votes: {totalPosVotes}</span>}
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
                              {(canManage || details.election.status === 'closed' || details.election.status === 'archived') && details.election.status !== 'draft' && (
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

                            <div className="flex items-center gap-3 justify-between md:justify-end">
                              {(canManage || details.election.status === 'closed' || details.election.status === 'archived') && (
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
        ) : showSuccessScreen ? (
          <div className="text-center py-12 space-y-4 font-sans">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 animate-bounce">
              <Trophy size={48} />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Vote Submitted Successfully!</h2>
            <p className="text-gray-600 max-w-md mx-auto font-medium">
              Your secure ballot has been successfully received by the PSITS Hub election system. Thank you for participating.
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
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-800 font-bold text-lg select-none">
                              {c.memberName ? c.memberName.split(' ').map((n: string) => n[0]).slice(0,2).join('') : 'C'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 truncate">{c.memberName || c.memberEmail}</p>
                              <p className="text-xs text-gray-500 font-medium">BS Information Technology</p>
                              <p className="text-xs text-gray-600 mt-2 line-clamp-2 italic">
                                "{c.platform || 'No platform bio provided.'}"
                              </p>
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

      <Modal isOpen={showAddCandidate} onClose={() => setShowAddCandidate(false)} title="Add Candidate" size="md">
        <div className="space-y-3">
          <Select
            label="Approved Member"
            options={[
              { value: '', label: 'Select member' },
              ...activeMembers.map((m) => ({ value: String(m.id), label: `${m.fullName || m.email} (${m.email})` })),
            ]}
            value={candidateForm.memberId}
            onChange={(e) => setCandidateForm((p) => ({ ...p, memberId: (e.target as HTMLSelectElement).value }))}
          />
          <Select
            label="Position"
            options={[
              { value: '', label: 'Select position' },
              ...(details?.election?.allowedPositions || ['President', 'Vice President', 'Treasurer', 'Secretary', 'Member']).map((pos: string) => ({
                value: pos,
                label: pos,
              })),
            ]}
            value={candidateForm.position}
            onChange={(e) => setCandidateForm((p) => ({ ...p, position: (e.target as HTMLSelectElement).value }))}
          />
          <TextArea label="Platform (optional)" rows={4} value={candidateForm.platform} onChange={(e) => setCandidateForm((p) => ({ ...p, platform: (e.target as HTMLTextAreaElement).value }))} />
          <div className="flex justify-end gap-2">
            <Button variant="primary" onClick={() => void addCandidate()} isLoading={isLoading}>Add</Button>
          </div>
        </div>
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

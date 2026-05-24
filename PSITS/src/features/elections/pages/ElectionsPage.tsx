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
type CandidateStatus = 'pending' | 'approved' | 'disqualified' | 'winner';

export const ElectionsPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const canManage = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  const [statusFilter, setStatusFilter] = useState<'all' | ElectionStatus>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [elections, setElections] = useState<any[]>([]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingElection, setEditingElection] = useState<any | null>(null);
  const [form, setForm] = useState({ title: '', description: '', startDate: '', endDate: '', status: 'draft' as ElectionStatus });

  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [details, setDetails] = useState<{ election: any; candidates: any[] } | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [activeMembers, setActiveMembers] = useState<any[]>([]);
  const [candidateForm, setCandidateForm] = useState({ memberId: '', position: '', platform: '' });

  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmWinner, setConfirmWinner] = useState<{ candidateId: string; name: string; position: string } | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.getElections({ status: statusFilter });
      if (data?.success) setElections(data.elections || []);
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
    setForm({ title: '', description: '', startDate: '', endDate: '', status: 'draft' });
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
    });
    setShowEditModal(true);
  };

  const openDetails = async (id: string) => {
    setSelectedElectionId(id);
    setDetails(null);
    setShowDetailsModal(true);
    try {
      const { data } = await api.getElection(id);
      if (data?.success) setDetails({ election: data.election, candidates: data.candidates || [] });
    } catch {
      // ignore
    }
  };

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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">Officer Elections</h1>
            <p className="mt-2 text-gray-600">Create election periods, manage candidates, and record winners.</p>
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
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void openDetails(String(e.id))}>
                    <Users size={16} /> Details
                  </Button>
                  {canManage && (
                    <Button variant="secondary" size="sm" onClick={() => openEdit(e)}>
                      Edit
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
          <div className="flex justify-end gap-2">
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
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{details.election.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{details.election.description || '—'}</p>
                  <p className="text-xs text-gray-500 mt-2">{details.election.startDate} → {details.election.endDate}</p>
                </div>
                <Badge variant={details.election.status === 'open' ? 'success' : 'info'}>{String(details.election.status).toUpperCase()}</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Candidates</p>
              {canManage && (
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

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="px-4 py-2 text-left">Member</th>
                    <th className="px-4 py-2 text-left">Position</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Votes</th>
                    <th className="px-4 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {details.candidates.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2 text-gray-800">{c.memberName || c.memberEmail || c.memberId}</td>
                      <td className="px-4 py-2 text-gray-700">{c.position}</td>
                      <td className="px-4 py-2 text-gray-700">{c.status as CandidateStatus}</td>
                      <td className="px-4 py-2 text-gray-700">{c.votesCount || 0}</td>
                      <td className="px-4 py-2 text-right">
                        {canManage && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmWinner({ candidateId: String(c.id), name: c.memberName || c.memberEmail || 'Candidate', position: c.position })}
                            disabled={c.status === 'winner'}
                          >
                            <Trophy size={16} /> {c.status === 'winner' ? 'Winner' : 'Mark Winner'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!details.candidates.length && (
                    <tr><td className="px-4 py-6 text-gray-500" colSpan={5}>No candidates yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
            </div>
          </div>
        )}
      </Modal>

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
          <Input label="Position" value={candidateForm.position} onChange={(e) => setCandidateForm((p) => ({ ...p, position: e.target.value }))} />
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
    </MainLayout>
  );
};

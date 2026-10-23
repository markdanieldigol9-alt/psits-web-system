import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button } from '@/shared/components/Form';
import { Badge, Pagination, Modal } from '@/shared/components/Common';
import { Plus, Archive, ArrowLeftRight } from 'lucide-react';
import api from '@/shared/services/api';
import { useNotification } from '@/shared/context/NotificationContext';
import { AddOfficerModal } from '@/features/officers/components/AddOfficerModal';
import { ManagePositionsModal } from '@/features/officers/components/ManagePositionsModal';
import { useAuth } from '@/shared/context/AuthContext';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { getPositionRank } from '@/shared/utils/helpers';

const formatYear = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return String(dateStr);
  return date.getFullYear().toString();
};

export const OfficersPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'past'>('active');
  const [officers, setOfficers] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmAssign, setConfirmAssign] = useState(false);
  const [pendingAssign, setPendingAssign] = useState<{ userId: string; position: string; startDate?: string; endDate?: string } | null>(null);
  const [changeTarget, setChangeTarget] = useState<any | null>(null);
  const [isManagePositionsOpen, setIsManagePositionsOpen] = useState(false);

  const [directSwapSource, setDirectSwapSource] = useState<any | null>(null);
  const [directSwapTargetId, setDirectSwapTargetId] = useState<string>('');
  const [isDirectSwapOpen, setIsDirectSwapOpen] = useState(false);

  const [confirmToggleStatus, setConfirmToggleStatus] = useState<{ id: string; name: string; currentStatus: string; newStatus: 'active' | 'inactive' } | null>(null);

  const canManageOfficers = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.getOfficers(filterStatus);
        if (!cancelled && data?.success) setOfficers(data.officers || []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [filterStatus]);

  const filteredOfficers = useMemo(() => {
    const list = officers.filter((officer) => {
      const status = officer.officerStatus || (officer.status === 'active' ? 'active' : 'inactive');
      return filterStatus === 'all' || status === filterStatus;
    });
    return list.slice().sort((a, b) => {
      const rankA = getPositionRank(a.position);
      const rankB = getPositionRank(b.position);
      if (rankA !== rankB) return rankA - rankB;

      const dateA = a.termStart ? new Date(a.termStart).getTime() : 0;
      const dateB = b.termStart ? new Date(b.termStart).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;

      const nameA = String(a.fullName || a.name || '').toLowerCase();
      const nameB = String(b.fullName || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [officers, filterStatus]);

  const activeOfficers = useMemo(() => {
    return officers.filter((o) => o.officerStatus === 'active' || o.status === 'active');
  }, [officers]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredOfficers.length / itemsPerPage);
  const paginatedOfficers = filteredOfficers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {canManageOfficers ? 'Officer Management' : 'Officer Directory'}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
              {canManageOfficers
                ? 'Manage organizational leadership, positions, and executive board appointments'
                : 'Executive board and regional leadership directory for PSITS Region XII.'}
            </p>
          </div>
          {canManageOfficers && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setDirectSwapSource(null);
                  setDirectSwapTargetId('');
                  setIsDirectSwapOpen(true);
                }}
                className="w-full sm:w-auto flex items-center gap-1.5"
                title="Swap executive positions between two officers"
              >
                <ArrowLeftRight size={16} />
                Swap Positions
              </Button>
              <Button variant="outline" size="md" onClick={() => setIsManagePositionsOpen(true)} className="w-full sm:w-auto">
                Manage Positions
              </Button>
              <Button variant="cyber" size="md" onClick={() => setIsAddModalOpen(true)} className="w-full sm:w-auto">
                <Plus size={18} />
                Assign Officer
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 bg-white dark:bg-[#0B1326] border border-gray-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            <option value="active">Active Officers</option>
            <option value="all">All Officers</option>
            <option value="inactive">Inactive Officers</option>
            <option value="past">Past Officers / Alumni</option>
          </select>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 dark:bg-[#171F33] border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Position <span className="text-[10px] font-normal lowercase tracking-normal text-slate-400">(Executive Order)</span>
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sector</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Service Period</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  {canManageOfficers && (
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {paginatedOfficers.map((officer) => (
                  <tr key={officer.id} className="hover:bg-slate-50/80 dark:hover:bg-[#171F33]/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{officer.fullName || officer.name}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm font-medium">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300 border border-blue-200/60 dark:border-blue-800/60 text-xs font-semibold">
                        {officer.position}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm">{officer.sectorDetails || officer.sector}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm font-mono">
                      {formatYear(officer.termStart)}{officer.termEnd ? ` - ${formatYear(officer.termEnd)}` : ''}
                    </td>
                    <td className="px-6 py-4">
                      {canManageOfficers && officer.officerStatus !== 'past' ? (
                        <button
                          type="button"
                          onClick={() => {
                            const nextStatus = officer.officerStatus === 'active' ? 'inactive' : 'active';
                            setConfirmToggleStatus({
                              id: String(officer.id),
                              name: officer.fullName || officer.email || 'this officer',
                              currentStatus: officer.officerStatus,
                              newStatus: nextStatus,
                            });
                          }}
                          className="inline-flex items-center gap-1.5 cursor-pointer group"
                          title={`Click to set status to ${officer.officerStatus === 'active' ? 'Inactive' : 'Active'}`}
                        >
                          <Badge variant={officer.officerStatus === 'active' ? 'cyber' : 'error'} dot={true}>
                            {String(officer.officerStatus || '').charAt(0).toUpperCase() + String(officer.officerStatus || '').slice(1)}
                          </Badge>
                          <span className="text-[11px] text-cyan-600 dark:text-cyan-400 underline opacity-0 group-hover:opacity-100 transition-opacity">
                            (Toggle)
                          </span>
                        </button>
                      ) : (
                        <Badge variant={officer.officerStatus === 'active' ? 'cyber' : officer.officerStatus === 'past' ? 'gold' : 'error'} dot={true}>
                          {String(officer.officerStatus || '').charAt(0).toUpperCase() + String(officer.officerStatus || '').slice(1)}
                        </Badge>
                      )}
                    </td>
                    {canManageOfficers && (
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          className="p-2 hover:bg-gray-100 rounded transition-colors"
                          onClick={() =>
                            setConfirmDelete({
                              id: String(officer.id),
                              name: officer.fullName || officer.email || 'this officer',
                            })
                          }
                          aria-label="Archive officer"
                          title="Archive officer"
                        >
                          <Archive size={16} className="text-amber-700" />
                        </button>
                        <button
                          type="button"
                          className="ml-2 px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 font-medium"
                          onClick={() => setChangeTarget(officer)}
                          aria-label="Edit officer"
                          title="Edit officer details or change/swap position"
                        >
                          Edit
                        </button>
                        {officer.officerStatus === 'active' && (
                          <button
                            type="button"
                            className="ml-1.5 px-2.5 py-1 text-xs rounded border border-blue-200 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-medium inline-flex items-center gap-1 transition-colors"
                            onClick={() => {
                              setDirectSwapSource(officer);
                              setDirectSwapTargetId('');
                              setIsDirectSwapOpen(true);
                            }}
                            aria-label="Swap officer position"
                            title="Swap position with another active officer"
                          >
                            <ArrowLeftRight size={12} />
                            Swap
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paginatedOfficers.length === 0 && (
            <div className="p-8 text-center text-gray-500">{isLoading ? 'Loading...' : 'No officers found.'}</div>
          )}

          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          )}
        </Card>
      </div>

      {canManageOfficers && (
        <AddOfficerModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          isLoading={isLoading}
          title="Assign Officer"
          onSubmit={async (data) => {
            const isPositionTaken = officers.some(
              (o) => o.position?.toLowerCase() === data.position?.toLowerCase() && o.officerStatus === 'active'
            );
            if (isPositionTaken) {
              addNotification({
                userId: 'current',
                title: 'Assignment Failed',
                message: `The position of ${data.position} is already assigned to another active officer.`,
                type: 'error',
                isRead: false,
              });
              return;
            }
            setPendingAssign(data);
            setConfirmAssign(true);
            setIsAddModalOpen(false);
          }}
        />
      )}

      {canManageOfficers && (
        <AddOfficerModal
          isOpen={!!changeTarget}
          onClose={() => setChangeTarget(null)}
          isLoading={isLoading}
          title="Edit Officer Details"
          lockPosition={false}
          initialPosition={changeTarget?.position}
          initialStartDate={changeTarget?.termStart}
          initialEndDate={changeTarget?.termEnd}
          initialStatus={changeTarget?.officerStatus || changeTarget?.status || 'active'}
          initialMember={
            changeTarget
              ? {
                  id: String(changeTarget.id),
                  fullName: changeTarget.fullName || changeTarget.name || '',
                  email: changeTarget.email || '',
                  sector: changeTarget.sector,
                  status: changeTarget.officerStatus === 'active' ? 'active' : 'inactive',
                  officerStatus: changeTarget.officerStatus,
                }
              : null
          }
          onSubmit={async (data) => {
            if (!changeTarget) return;
            const targetPos = String(data.position || '').trim();
            const currPos = String(changeTarget.position || '').trim();
            const isPositionChanged = targetPos && targetPos.toLowerCase() !== currPos.toLowerCase();

            // Find if another active officer is occupying this position
            const otherOccupant = isPositionChanged
              ? officers.find(
                  (o) =>
                    (o.officerStatus === 'active' || o.status === 'active') &&
                    String(o.id) !== String(changeTarget.id) &&
                    String(o.position || '').trim().toLowerCase() === targetPos.toLowerCase()
                )
              : null;

            setPendingAssign({
              ...data,
              replaceOfficerId: changeTarget.id,
              replaceOfficerName: changeTarget.fullName || changeTarget.email || 'this officer',
              previousPosition: currPos,
              swapWithOfficer: otherOccupant
                ? {
                    id: otherOccupant.id,
                    name: otherOccupant.fullName || otherOccupant.name || otherOccupant.email || 'Officer',
                    position: otherOccupant.position,
                  }
                : null,
            } as any);
            setConfirmAssign(true);
            setChangeTarget(null);
          }}
        />
      )}

      <VerifyActionModal
        isOpen={confirmAssign}
        title={
          (pendingAssign as any)?.swapWithOfficer
            ? 'Confirm Executive Position Swap'
            : (pendingAssign as any)?.replaceOfficerId
            ? 'Update Officer Details'
            : 'Verify Officer Assignment'
        }
        message={
          (pendingAssign as any)?.swapWithOfficer
            ? `Swap executive positions? ${(pendingAssign as any).replaceOfficerName} will become "${pendingAssign?.position}", and ${(pendingAssign as any).swapWithOfficer.name} will become "${(pendingAssign as any).previousPosition || 'Protocol Officer'}".`
            : (pendingAssign as any)?.replaceOfficerId
            ? `Update details and set position to "${pendingAssign?.position}" for ${(pendingAssign as any).replaceOfficerName || 'the officer'}?`
            : 'Are you sure you want to assign this officer?'
        }
        confirmLabel={(pendingAssign as any)?.swapWithOfficer ? 'Swap Positions' : 'Accept'}
        confirmVariant="primary"
        onCancel={() => {
          if (isLoading) return;
          setConfirmAssign(false);
          setPendingAssign(null);
        }}
        onVerified={async () => {
          if (!pendingAssign) return;
          setIsLoading(true);
          try {
            const replaceOfficerId = (pendingAssign as any).replaceOfficerId;
            if (replaceOfficerId) {
              if (String(pendingAssign.userId) === String(replaceOfficerId)) {
                // Update same officer's details (including position & automatic swap!)
                const updateRes = await api.updateOfficer(String(replaceOfficerId), {
                  position: pendingAssign.position,
                  startDate: pendingAssign.startDate,
                  endDate: pendingAssign.endDate,
                  status: (pendingAssign as any).status,
                  officerStatus: (pendingAssign as any).officerStatus,
                });

                const { data: resp } = await api.getOfficers(filterStatus);
                if (resp?.success) setOfficers(resp.officers || []);

                const isSwapped = Boolean((pendingAssign as any).swapWithOfficer || updateRes?.data?.swappedWith);
                addNotification({
                  userId: 'current',
                  title: isSwapped ? 'Positions Swapped Successfully' : 'Officer Details Updated',
                  message:
                    updateRes?.data?.message ||
                    (isSwapped
                      ? 'Executive positions have been swapped successfully.'
                      : 'Officer details and position updated successfully.'),
                  type: 'success',
                  isRead: false,
                });
                setConfirmAssign(false);
                setPendingAssign(null);
                return;
              } else {
                // Replace with a different member
                await api.deleteOfficer(String(replaceOfficerId));
                await api.assignOfficer(pendingAssign.userId, pendingAssign.position, pendingAssign.startDate, pendingAssign.endDate);
              }
            } else {
              // Assign a completely new officer
              await api.assignOfficer(pendingAssign.userId, pendingAssign.position, pendingAssign.startDate, pendingAssign.endDate);
            }
            const { data: resp } = await api.getOfficers(filterStatus);
            if (resp?.success) setOfficers(resp.officers || []);
            
            addNotification({
              userId: 'current',
              title: 'Officer Assigned',
              message: 'Officer role assigned successfully.',
              type: 'success',
              isRead: false,
            });
            setConfirmAssign(false);
            setPendingAssign(null);
          } catch (err: any) {
            addNotification({
              userId: 'current',
              title: 'Error',
              message: err?.response?.data?.message || err?.message || 'Failed to update/assign officer.',
              type: 'error',
              isRead: false,
            });
          } finally {
            setIsLoading(false);
          }
        }}
      />

      <VerifyActionModal
        isOpen={!!confirmToggleStatus}
        title="Change Officer Status"
        message={
          confirmToggleStatus
            ? `Change the status of ${confirmToggleStatus.name} from ${confirmToggleStatus.currentStatus.toUpperCase()} to ${confirmToggleStatus.newStatus.toUpperCase()}?`
            : ''
        }
        confirmLabel={`Set ${confirmToggleStatus?.newStatus === 'active' ? 'Active' : 'Inactive'}`}
        confirmVariant={confirmToggleStatus?.newStatus === 'active' ? 'primary' : 'danger'}
        onCancel={() => {
          if (isLoading) return;
          setConfirmToggleStatus(null);
        }}
        onVerified={async () => {
          if (!confirmToggleStatus) return;
          setIsLoading(true);
          try {
            await api.updateOfficer(confirmToggleStatus.id, {
              status: confirmToggleStatus.newStatus,
              officerStatus: confirmToggleStatus.newStatus,
            });
            const { data: resp } = await api.getOfficers(filterStatus);
            if (resp?.success) setOfficers(resp.officers || []);
            addNotification({
              userId: 'current',
              title: 'Officer Status Updated',
              message: `${confirmToggleStatus.name} is now marked as ${confirmToggleStatus.newStatus}.`,
              type: 'success',
              isRead: false,
            });
            setConfirmToggleStatus(null);
          } catch (err) {
            addNotification({
              userId: 'current',
              title: 'Error',
              message: err instanceof Error ? err.message : 'Failed to update status.',
              type: 'error',
              isRead: false,
            });
          } finally {
            setIsLoading(false);
          }
        }}
      />

      <VerifyActionModal
        isOpen={!!confirmDelete}
        title="Archive Officer"
        message={`Archive ${confirmDelete?.name}? This will revert the role back to member.`}
        confirmLabel="Archive"
        confirmVariant="danger"
        onCancel={() => {
          if (isLoading) return;
          setConfirmDelete(null);
        }}
        onVerified={async () => {
          if (!confirmDelete) return;
          setIsLoading(true);
          try {
            await api.deleteOfficer(confirmDelete.id);
            const { data: resp } = await api.getOfficers(filterStatus);
            if (resp?.success) setOfficers(resp.officers || []);
            addNotification({
              userId: 'current',
              title: 'Officer Archived',
              message: 'Officer archived successfully.',
              type: 'success',
              isRead: false,
            });
            setConfirmDelete(null);
          } catch (err) {
            addNotification({
              userId: 'current',
              title: 'Error',
              message: err instanceof Error ? err.message : 'Failed to remove officer.',
              type: 'error',
              isRead: false,
            });
          } finally {
            setIsLoading(false);
          }
        }}
      />
      {canManageOfficers && (
        <ManagePositionsModal
          isOpen={isManagePositionsOpen}
          onClose={() => setIsManagePositionsOpen(false)}
        />
      )}

      {/* Direct Swap Officers Modal */}
      {isDirectSwapOpen && (
        <Modal
          isOpen={isDirectSwapOpen}
          onClose={() => {
            setIsDirectSwapOpen(false);
            setDirectSwapSource(null);
            setDirectSwapTargetId('');
          }}
          title="Swap Officer Positions"
          subtitle="Exchange executive roles and duties between two active officers"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                First Officer
              </label>
              <select
                value={directSwapSource?.id || ''}
                onChange={(e) => {
                  const found = officers.find((o) => String(o.id) === e.target.value);
                  setDirectSwapSource(found || null);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select an officer...</option>
                {activeOfficers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.fullName || o.name} — {o.position}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center my-1">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
                <ArrowLeftRight size={18} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Second Officer (to swap with)
              </label>
              <select
                value={directSwapTargetId}
                onChange={(e) => setDirectSwapTargetId(e.target.value)}
                disabled={!directSwapSource}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
              >
                <option value="">Select an officer to exchange position with...</option>
                {activeOfficers
                  .filter((o) => String(o.id) !== String(directSwapSource?.id))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.fullName || o.name} — {o.position}
                    </option>
                  ))}
              </select>
            </div>

            {/* Visual Swap Preview */}
            {(() => {
              const targetOfficer = officers.find((o) => String(o.id) === String(directSwapTargetId));
              if (directSwapSource && targetOfficer) {
                return (
                  <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 text-xs space-y-2">
                    <p className="font-bold text-blue-950 dark:text-blue-100 flex items-center gap-1.5">
                      <ArrowLeftRight size={14} className="text-blue-600" />
                      Position Exchange Summary
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800">
                        <p className="text-[11px] text-slate-500">New {targetOfficer.position}:</p>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5 truncate">
                          {directSwapSource.fullName || directSwapSource.name}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800">
                        <p className="text-[11px] text-slate-500">New {directSwapSource.position}:</p>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5 truncate">
                          {targetOfficer.fullName || targetOfficer.name}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDirectSwapOpen(false);
                  setDirectSwapSource(null);
                  setDirectSwapTargetId('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!directSwapSource || !directSwapTargetId || isLoading}
                onClick={async () => {
                  if (!directSwapSource || !directSwapTargetId) return;
                  setIsLoading(true);
                  try {
                    const res = await api.swapOfficers(directSwapSource.id, directSwapTargetId);
                    addNotification({
                      userId: 'current',
                      title: 'Officers Swapped',
                      message: res.data?.message || 'Officer positions swapped successfully.',
                      type: 'success',
                      isRead: false,
                    });
                    const { data: resp } = await api.getOfficers(filterStatus);
                    if (resp?.success) setOfficers(resp.officers || []);
                    setIsDirectSwapOpen(false);
                    setDirectSwapSource(null);
                    setDirectSwapTargetId('');
                  } catch (err: any) {
                    addNotification({
                      userId: 'current',
                      title: 'Swap Failed',
                      message: err?.response?.data?.message || err?.message || 'Failed to swap officers.',
                      type: 'error',
                      isRead: false,
                    });
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                {isLoading ? 'Swapping...' : 'Swap Positions'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
};

import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button } from '@/shared/components/Form';
import { Badge, Pagination } from '@/shared/components/Common';
import { Plus, Archive } from 'lucide-react';
import api from '@/shared/services/api';
import { useNotification } from '@/shared/context/NotificationContext';
import { AddOfficerModal } from '@/features/officers/components/AddOfficerModal';
import { ManagePositionsModal } from '@/features/officers/components/ManagePositionsModal';
import { useAuth } from '@/shared/context/AuthContext';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'past'>('all');
  const [officers, setOfficers] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmAssign, setConfirmAssign] = useState(false);
  const [pendingAssign, setPendingAssign] = useState<{ userId: string; position: string; startDate?: string; endDate?: string } | null>(null);
  const [changeTarget, setChangeTarget] = useState<any | null>(null);
  const [isManagePositionsOpen, setIsManagePositionsOpen] = useState(false);

  const [confirmToggleStatus, setConfirmToggleStatus] = useState<{ id: string; name: string; currentStatus: string; newStatus: 'active' | 'inactive' } | null>(null);

  const canManageOfficers = user?.role === 'super_admin' || user?.role === 'admin';

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

  const filteredOfficers = useMemo(
    () =>
      officers.filter(
        (officer) => filterStatus === 'all' || officer.officerStatus === filterStatus
      ),
    [officers, filterStatus]
  );

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
            <h1 className="text-3xl font-bold text-gray-900">
              {canManageOfficers ? 'Officer Management' : 'Officer List'}
            </h1>
            <p className="text-gray-600 mt-2">
              {canManageOfficers
                ? 'Manage organization officers, their positions, and active/inactive status'
                : 'View-only list of active organization officers.'}
            </p>
          </div>
          {canManageOfficers && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" size="lg" onClick={() => setIsManagePositionsOpen(true)} className="w-full sm:w-auto">
                Manage Positions
              </Button>
              <Button variant="primary" size="lg" onClick={() => setIsAddModalOpen(true)} className="w-full sm:w-auto">
                <Plus size={20} />
                Assign Officer
              </Button>
            </div>
          )}
        </div>

        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value as any);
            setCurrentPage(1);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Officers</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="past">Past Officers</option>
        </select>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Sector</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Service Period</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                  {canManageOfficers && (
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedOfficers.map((officer) => (
                  <tr key={officer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{officer.fullName || officer.name}</td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{officer.position}</td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{officer.sectorDetails || officer.sector}</td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
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
                          <Badge variant={officer.officerStatus === 'active' ? 'success' : 'error'}>
                            {String(officer.officerStatus || '').charAt(0).toUpperCase() + String(officer.officerStatus || '').slice(1)}
                          </Badge>
                          <span className="text-[11px] text-blue-600 underline opacity-0 group-hover:opacity-100 transition-opacity">
                            (Set {officer.officerStatus === 'active' ? 'Inactive' : 'Active'})
                          </span>
                        </button>
                      ) : (
                        <Badge variant={officer.officerStatus === 'active' ? 'success' : officer.officerStatus === 'past' ? 'warning' : 'error'}>
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
                          className="ml-2 px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium"
                          onClick={() => setChangeTarget(officer)}
                          aria-label="Edit officer"
                          title="Edit officer details or status"
                        >
                          Edit
                        </button>
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
          lockPosition={true}
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
            setPendingAssign({
              ...data,
              replaceOfficerId: changeTarget.id,
              replaceOfficerName: changeTarget.fullName || changeTarget.email || 'this officer',
            } as any);
            setConfirmAssign(true);
            setChangeTarget(null);
          }}
        />
      )}

      <VerifyActionModal
        isOpen={confirmAssign}
        title={(pendingAssign as any)?.replaceOfficerId ? "Update Officer Details" : "Verify Officer Assignment"}
        message={
          (pendingAssign as any)?.replaceOfficerId
            ? `Update details and status for ${(pendingAssign as any).replaceOfficerName || 'the officer'}?`
            : 'Are you sure you want to assign this officer?'
        }
        confirmLabel="Accept"
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
                // Update same officer's details (including status!)
                await api.updateOfficer(String(replaceOfficerId), {
                  position: pendingAssign.position,
                  startDate: pendingAssign.startDate,
                  endDate: pendingAssign.endDate,
                  status: (pendingAssign as any).status,
                  officerStatus: (pendingAssign as any).officerStatus,
                });
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
            
            const isUpdate = replaceOfficerId && String(pendingAssign.userId) === String(replaceOfficerId);
            addNotification({
              userId: 'current',
              title: isUpdate ? 'Officer Details Updated' : 'Officer Assigned',
              message: isUpdate ? 'Officer details and status updated successfully.' : 'Officer role assigned successfully.',
              type: 'success',
              isRead: false,
            });
            setConfirmAssign(false);
            setPendingAssign(null);
          } catch (err) {
            addNotification({
              userId: 'current',
              title: 'Error',
              message: err instanceof Error ? err.message : 'Failed to update/assign officer.',
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
    </MainLayout>
  );
};

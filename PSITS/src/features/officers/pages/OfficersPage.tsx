import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button } from '@/shared/components/Form';
import { Badge, Pagination } from '@/shared/components/Common';
import { Plus, Archive } from 'lucide-react';
import api from '@/shared/services/api';
import { useNotification } from '@/shared/context/NotificationContext';
import { AddOfficerModal } from '@/features/officers/components/AddOfficerModal';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { useAuth } from '@/shared/context/AuthContext';

export const OfficersPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [officers, setOfficers] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmAssign, setConfirmAssign] = useState(false);
  const [pendingAssign, setPendingAssign] = useState<{ userId: string; position: string; startDate?: string } | null>(null);
  const [changeTarget, setChangeTarget] = useState<{ id: string; name: string; position: string } | null>(null);

  const canManageOfficers = user?.role === 'super_admin' || user?.role === 'admin';
  const isMemberViewer = user?.role === 'member';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.getOfficers();
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
  }, []);

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
                ? 'Manage organization officers and their roles'
                : 'View-only list of active organization officers.'}
            </p>
          </div>
          {canManageOfficers && (
            <Button variant="primary" size="lg" onClick={() => setIsAddModalOpen(true)} className="w-full sm:w-auto">
              <Plus size={20} />
              Assign Officer
            </Button>
          )}
        </div>

        {!isMemberViewer && (
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
          </select>
        )}

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
                      {officer.termStart} {officer.termEnd && `- ${officer.termEnd}`}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={officer.officerStatus === 'active' ? 'success' : 'error'}>
                        {String(officer.officerStatus || '').charAt(0).toUpperCase() + String(officer.officerStatus || '').slice(1)}
                      </Badge>
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
                          className="ml-2 px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                          onClick={() =>
                            setChangeTarget({
                              id: String(officer.id),
                              name: officer.fullName || officer.email || 'this officer',
                              position: String(officer.position || '').trim(),
                            })
                          }
                          aria-label="Change officer"
                          title="Change officer"
                        >
                          Change
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
          title="Change Officer"
          initialPosition={changeTarget?.position}
          lockPosition
          onSubmit={async (data) => {
            if (!changeTarget) return;
            const isPositionTaken = officers.some(
              (o) =>
                o.officerStatus === 'active' &&
                o.position?.toLowerCase() === data.position?.toLowerCase() &&
                String(o.id) !== String(changeTarget.id)
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
            setPendingAssign({ ...data, replaceOfficerId: changeTarget.id, replaceOfficerName: changeTarget.name } as any);
            setConfirmAssign(true);
            setChangeTarget(null);
          }}
        />
      )}

      <VerifyActionModal
        isOpen={confirmAssign}
        title="Verify Officer Assignment"
        message={
          (pendingAssign as any)?.replaceOfficerId
            ? 'This will replace the current officer in this position. Continue?'
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
              await api.deleteOfficer(String(replaceOfficerId));
            }
            const { data: resp } = await api.assignOfficer(pendingAssign.userId, pendingAssign.position, pendingAssign.startDate);
            const created = resp?.officer;
            if (created) setOfficers((prev) => [created, ...prev]);
            addNotification({
              userId: 'current',
              title: 'Officer Assigned',
              message: 'Officer role assigned successfully.',
              type: 'success',
              isRead: false,
            });
            setConfirmAssign(false);
            setPendingAssign(null);
          } catch (err) {
            addNotification({
              userId: 'current',
              title: 'Error',
              message: err instanceof Error ? err.message : 'Failed to assign officer.',
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
            setOfficers((prev) => prev.filter((x) => String(x.id) !== String(confirmDelete.id)));
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
    </MainLayout>
  );
};

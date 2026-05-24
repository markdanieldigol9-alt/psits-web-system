import { useEffect, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button } from '@/shared/components/Form';
import { Plus, Trash2 } from 'lucide-react';
import { useNotification } from '@/shared/context/NotificationContext';
import { AddPartnerModal } from '@/features/partners/components/AddPartnerModal';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { useAuth } from '@/shared/context/AuthContext';
import api from '@/shared/services/api';

// Mock data - empty until partners are added
const mockPartners: any[] = [];

export const PartnersPage = () => {
  const [partners, setPartners] = useState(mockPartners);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; company: string } | null>(null);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [pendingPartnerData, setPendingPartnerData] = useState<any | null>(null);
  const { addNotification } = useNotification();
  const { user } = useAuth();

  const canManagePartners = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await api.getPartners();
        if (!cancelled && data?.success) {
          setPartners(data.partners || []);
        }
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">Industry Partners</h1>
            <p className="text-gray-600 mt-1">Manage partner companies and collaborations</p>
          </div>
        </div>
        {canManagePartners && (
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto">
              <Plus /> Add Partner
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {partners.map((p) => (
            <Card key={p.id} className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-lg">{p.company}</p>
                  <p className="text-sm text-gray-600 mt-1">{p.type} Partner</p>
                  <p className="mt-2 text-gray-700">{p.contactPerson} &middot; {p.phone}</p>
                  <p className="text-sm text-gray-500">{p.location}</p>
                  {p.website && (
                    <a href={p.website} className="text-blue-600 text-sm" target="_blank" rel="noreferrer">
                      {p.website}
                    </a>
                  )}
                  <p className="mt-2">{p.email}</p>
                </div>
                {canManagePartners && (
                  <button
                    aria-label="Delete partner"
                    onClick={() => setConfirmDelete({ id: p.id, company: p.company })}
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
      <VerifyActionModal
        isOpen={!!confirmDelete}
        title="Delete Partner"
        message={`Delete ${confirmDelete?.company}? This can't be undone.`}
        confirmLabel="Accept"
        confirmVariant="danger"
        onCancel={() => {
          if (isLoading) return;
          setConfirmDelete(null);
        }}
        onVerified={async () => {
          if (!confirmDelete) return;
          setIsLoading(true);
          try {
            await api.deletePartner(confirmDelete.id);
            setPartners((prev) => prev.filter((x: any) => x.id !== confirmDelete.id));
            addNotification({ userId:'current', title:'Partner Deleted', message:`${confirmDelete.company} removed`, type:'success', isRead:false });
            setConfirmDelete(null);
          } catch (err) {
            addNotification({ userId:'current', title:'Error', message: err instanceof Error ? err.message : 'Unable to delete partner', type:'error', isRead:false });
          } finally {
            setIsLoading(false);
          }
        }}
      />
      {canManagePartners && (
        <AddPartnerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          isLoading={isLoading}
          onSubmit={async (data) => {
            setPendingPartnerData(data);
            setConfirmCreate(true);
          }}
        />
      )}

      <VerifyActionModal
        isOpen={confirmCreate}
        title="Verify Partner Creation"
        message="Are you sure you want to add this partner?"
        confirmLabel="Accept"
        confirmVariant="primary"
        onCancel={() => {
          if (isLoading) return;
          setConfirmCreate(false);
          setPendingPartnerData(null);
        }}
        onVerified={async () => {
          if (!pendingPartnerData) return;
          setIsLoading(true);
          try {
            const resp = await api.createPartner(pendingPartnerData);
            const newPartner = resp.data?.partner;
            if (newPartner) setPartners((prev) => [newPartner, ...prev]);
            addNotification({ userId:'current', title:'Partner Added', message:`${pendingPartnerData.company} added`, type:'success', isRead:false });
            setIsModalOpen(false);
            setConfirmCreate(false);
            setPendingPartnerData(null);
          } catch (err) {
            addNotification({ userId:'current', title:'Error', message: err instanceof Error ? err.message : 'Unable to add partner', type:'error', isRead:false });
          } finally { setIsLoading(false); }
        }}
      />
    </MainLayout>
  );
};

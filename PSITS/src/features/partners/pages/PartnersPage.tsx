import { useEffect, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Input, Select, TextArea } from '@/shared/components/Form';
import { Badge, Modal } from '@/shared/components/Common';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useNotification } from '@/shared/context/NotificationContext';
import { AddPartnerModal } from '@/features/partners/components/AddPartnerModal';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { useAuth } from '@/shared/context/AuthContext';
import api from '@/shared/services/api';

export const PartnersPage = () => {
  const [partners, setPartners] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; company: string } | null>(null);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [pendingPartnerData, setPendingPartnerData] = useState<any | null>(null);
  
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);
  const [contributionsMap, setContributionsMap] = useState<Record<string, any[]>>({});
  const [events, setEvents] = useState<any[]>([]);
  
  const [isContribModalOpen, setIsContribModalOpen] = useState(false);
  const [contribPartnerId, setContribPartnerId] = useState<string | null>(null);
  const [newContrib, setNewContrib] = useState({
    dealTitle: '',
    contributionType: 'funds',
    valueAmount: '',
    description: '',
    eventId: '',
  });

  const { addNotification } = useNotification();
  const { user } = useAuth();

  const canManagePartners = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [partnersRes, eventsRes] = await Promise.all([
          api.getPartners(),
          api.getEvents({ status: 'all' }),
        ]);
        if (!cancelled && partnersRes.data?.success) {
          setPartners(partnersRes.data.partners || []);
        }
        if (!cancelled && eventsRes.data?.success) {
          setEvents(eventsRes.data.events || []);
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

  const handleToggleExpand = async (partnerId: string) => {
    if (expandedPartnerId === partnerId) {
      setExpandedPartnerId(null);
      return;
    }
    setExpandedPartnerId(partnerId);
    if (!contributionsMap[partnerId]) {
      try {
        const { data } = await api.getPartnerContributions(partnerId);
        if (data?.success) {
          setContributionsMap((prev) => ({ ...prev, [partnerId]: data.contributions || [] }));
        }
      } catch {
        // ignore
      }
    }
  };

  const handleAddContrib = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribPartnerId) return;

    if (!newContrib.dealTitle.trim()) {
      addNotification({ userId: 'current', title: 'Validation', message: 'Deal title is required.', type: 'error', isRead: false });
      return;
    }

    const payload = {
      dealTitle: newContrib.dealTitle.trim(),
      contributionType: newContrib.contributionType,
      valueAmount: newContrib.valueAmount ? Number(newContrib.valueAmount) : null,
      eventId: newContrib.eventId ? Number(newContrib.eventId) : null,
      description: newContrib.description.trim() || null,
    };

    setIsLoading(true);
    try {
      const { data } = await api.createPartnerContribution(contribPartnerId, payload);
      if (data?.success && data.contribution) {
        setContributionsMap((prev) => ({
          ...prev,
          [contribPartnerId]: [data.contribution, ...(prev[contribPartnerId] || [])],
        }));
        addNotification({ userId: 'current', title: 'Added', message: 'Contribution logged successfully.', type: 'success', isRead: false });
        setIsContribModalOpen(false);
        setNewContrib({ dealTitle: '', contributionType: 'funds', valueAmount: '', description: '', eventId: '' });
      }
    } catch (err: any) {
      addNotification({ userId: 'current', title: 'Error', message: err.message || 'Failed to add contribution.', type: 'error', isRead: false });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteContrib = async (contribId: string, partnerId: string) => {
    try {
      const { data } = await api.deletePartnerContribution(contribId);
      if (data?.success) {
        setContributionsMap((prev) => ({
          ...prev,
          [partnerId]: (prev[partnerId] || []).filter((c) => c.id !== contribId),
        }));
        addNotification({ userId: 'current', title: 'Deleted', message: 'Contribution removed.', type: 'success', isRead: false });
      }
    } catch (err: any) {
      addNotification({ userId: 'current', title: 'Error', message: err.message || 'Failed to delete contribution.', type: 'error', isRead: false });
    }
  };

  const calculateTotalContributions = (list?: any[]) => {
    if (!list) return 0;
    return list.reduce((sum, item) => sum + Number(item.valueAmount || 0), 0);
  };

  const getContribBadgeVariant = (type: string) => {
    switch (type) {
      case 'funds':
        return 'success';
      case 'prizes':
        return 'info';
      case 'equipment':
        return 'warning';
      case 'venue':
        return 'primary';
      case 'services':
        return 'info';
      default:
        return 'info';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">Industry Partners</h1>
            <p className="text-gray-600 mt-1">Manage partner companies, sponsorship deals, and resources</p>
          </div>
        </div>
        {canManagePartners && (
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto">
              <Plus size={18} /> Add Partner
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {partners.map((p) => (
            <Card key={p.id} className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-lg text-gray-900">{p.company}</p>
                    <p className="text-sm text-gray-600 mt-1">{p.type} Partner</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleToggleExpand(p.id)}
                      className="inline-flex items-center gap-1"
                    >
                      {expandedPartnerId === p.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      Deals
                    </Button>
                    {canManagePartners && (
                      <button
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        aria-label="Delete partner"
                        onClick={() => setConfirmDelete({ id: p.id, company: p.company })}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-sm text-gray-700 space-y-1">
                  <p><span className="font-medium text-gray-900">Contact:</span> {p.contactPerson} &middot; {p.phone}</p>
                  <p><span className="font-medium text-gray-900">Email:</span> {p.email}</p>
                  <p><span className="font-medium text-gray-900">Location:</span> {p.location}</p>
                  {p.website && (
                    <p>
                      <a href={p.website} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                        {p.website}
                      </a>
                    </p>
                  )}
                </div>
              </div>

              {expandedPartnerId === p.id && (
                <div className="border-t border-gray-150 pt-4 mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-950">Deals & Contributions</p>
                    {canManagePartners && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setContribPartnerId(p.id);
                          setIsContribModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1"
                      >
                        <Plus size={14} /> Log Deal
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {!(contributionsMap[p.id]?.length) ? (
                      <p className="text-xs text-gray-500 py-2 italic">No deals or contributions logged yet.</p>
                    ) : (
                      <>
                        <div className="text-xs font-semibold text-gray-700 bg-gray-100 p-2 rounded">
                          Total Value Logged: ₱{calculateTotalContributions(contributionsMap[p.id]).toLocaleString()}
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {contributionsMap[p.id].map((c: any) => (
                            <div key={c.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-sm text-gray-900 truncate">{c.dealTitle}</span>
                                  <Badge variant={getContribBadgeVariant(c.contributionType)}>
                                    {c.contributionType.toUpperCase()}
                                  </Badge>
                                </div>
                                {c.description && <p className="text-xs text-gray-700 whitespace-pre-wrap">{c.description}</p>}
                                <div className="flex flex-wrap gap-x-3 text-[10px] text-gray-500 mt-1">
                                  {c.valueAmount !== null && (
                                    <span className="font-semibold text-primary">Value: ₱{Number(c.valueAmount).toLocaleString()}</span>
                                  )}
                                  {c.eventTitle && <span className="italic">Event: {c.eventTitle}</span>}
                                </div>
                              </div>
                              {canManagePartners && (
                                <button
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded shrink-0"
                                  aria-label="Delete contribution"
                                  onClick={() => void handleDeleteContrib(c.id, p.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
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
            addNotification({ userId: 'current', title: 'Partner Deleted', message: `${confirmDelete.company} removed`, type: 'success', isRead: false });
            setConfirmDelete(null);
          } catch (err: any) {
            addNotification({ userId: 'current', title: 'Error', message: err.message || 'Unable to delete partner', type: 'error', isRead: false });
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
            addNotification({ userId: 'current', title: 'Partner Added', message: `${pendingPartnerData.company} added`, type: 'success', isRead: false });
            setIsModalOpen(false);
            setConfirmCreate(false);
            setPendingPartnerData(null);
          } catch (err: any) {
            addNotification({ userId: 'current', title: 'Error', message: err.message || 'Unable to add partner', type: 'error', isRead: false });
          } finally {
            setIsLoading(false);
          }
        }}
      />

      <Modal isOpen={isContribModalOpen} onClose={() => setIsContribModalOpen(false)} title="Log Partner Contribution" size="lg">
        <form onSubmit={handleAddContrib} className="space-y-4">
          <Input
            label="Deal / Contribution Title"
            required
            value={newContrib.dealTitle}
            onChange={(e) => setNewContrib((prev) => ({ ...prev, dealTitle: e.target.value }))}
            placeholder="e.g. Diamond Sponsorship Package / Event Venue Support"
          />
          <Select
            label="Contribution Type"
            options={[
              { value: 'funds', label: 'Funds / Cash Sponsorship' },
              { value: 'prizes', label: 'Prizes / Giveaways' },
              { value: 'equipment', label: 'Equipment / Hardware' },
              { value: 'venue', label: 'Venue / Facility Hosting' },
              { value: 'services', label: 'Services / Cloud Credits' },
              { value: 'other', label: 'Other Contribution' },
            ]}
            value={newContrib.contributionType}
            onChange={(e) => setNewContrib((prev) => ({ ...prev, contributionType: e.target.value }))}
          />
          <Input
            label="Monetary Value (PHP, Optional)"
            type="number"
            value={newContrib.valueAmount}
            onChange={(e) => setNewContrib((prev) => ({ ...prev, valueAmount: e.target.value }))}
            placeholder="e.g. 50000"
          />
          <Select
            label="Linked Event (Optional)"
            options={[
              { value: '', label: 'Select event...' },
              ...events.map((e) => ({ value: String(e.id), label: String(e.title) })),
            ]}
            value={newContrib.eventId}
            onChange={(e) => setNewContrib((prev) => ({ ...prev, eventId: e.target.value }))}
          />
          <TextArea
            label="Description / Agreement Details"
            rows={4}
            value={newContrib.description}
            onChange={(e) => setNewContrib((prev) => ({ ...prev, description: (e.target as HTMLTextAreaElement).value }))}
            placeholder="Enter specifics about the contribution..."
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsContribModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={isLoading}>Save contribution</Button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  );
};

import { useEffect, useState } from 'react';
import { Input, Button, Select } from '@/shared/components/Form';
import { Alert } from '@/shared/components/Common';
import api from '@/shared/services/api';
import { X } from 'lucide-react';

interface AddOfficerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading?: boolean;
  initialPosition?: string;
  lockPosition?: boolean;
  title?: string;
  initialMember?: MemberOption | null;
  initialStartDate?: string;
  initialEndDate?: string;
  initialStatus?: 'active' | 'inactive' | 'past';
}

type MemberOption = {
  id: string;
  fullName: string;
  email: string;
  sector?: string;
  status?: string;
  officerStatus?: string;
};

const formatDateForInput = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AddOfficerModal = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  initialPosition,
  lockPosition = false,
  title,
  initialMember = null,
  initialStartDate,
  initialEndDate,
  initialStatus = 'active',
}: AddOfficerModalProps) => {
  const [formData, setFormData] = useState({
    position: '',
    startDate: '',
    endDate: '',
    status: 'active',
  });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [error, setError] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<MemberOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberOption | null>(null);
  const [takenPositions, setTakenPositions] = useState<Set<string>>(new Set());

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!selectedMember) newErrors.member = 'Select a member';
    if (!formData.position) newErrors.position = 'Position is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (!isOpen) {
      setFormData({ position: '', startDate: '', endDate: '', status: 'active' });
      setSelectedMember(null);
      setMemberQuery('');
      setMemberResults([]);
      setErrors({});
      setError(null);
      return;
    }
    const resolvedStatus = initialStatus || (initialMember?.officerStatus as any) || (initialMember?.status as any) || 'active';
    setFormData({
      position: initialPosition || '',
      startDate: formatDateForInput(initialStartDate),
      endDate: formatDateForInput(initialEndDate),
      status: resolvedStatus === 'past' ? 'inactive' : resolvedStatus,
    });
    setSelectedMember(initialMember || null);
    setMemberQuery('');
    setMemberResults([]);
    setErrors({});
    setError(null);
  }, [isOpen, initialPosition, initialStartDate, initialEndDate, initialMember, initialStatus]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectedMember) return;

    const q = memberQuery.trim();
    if (q.length < 2) {
      setMemberResults([]);
      setIsSearching(false);
      return;
    }

    const handle = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await api.getMembers({ search: q, status: 'active' });
        const members = (data?.members || []) as any[];
        const normalized: MemberOption[] = members
          .map((m) => ({
            id: String(m.id),
            fullName: String(m.fullName || ''),
            email: String(m.email || ''),
            sector: m.sector,
            status: m.status,
          }))
          .filter((m) => m.fullName && m.email);
        setMemberResults(normalized.slice(0, 8));
      } catch {
        setMemberResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(handle);
    };
  }, [isOpen, memberQuery, selectedMember]);

  const [availablePositions, setAvailablePositions] = useState<string[]>([
    'President',
    'Vice President',
    'Treasurer',
    'Secretary',
    'Member',
  ]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadPositions = async () => {
      try {
        const [offResp, posResp] = await Promise.all([
          api.getOfficers(),
          api.getOfficerPositions(),
        ]);
        const officers = (offResp.data?.officers || []) as any[];
        const active = officers.filter((o) => o.status === 'active' || o.officerStatus === 'active');
        const positions = new Set(active.map((o) => String(o.position || '').trim()).filter(Boolean));
        if (!cancelled) setTakenPositions(positions);

        const fetchedPositions = posResp.data?.positions || [];
        if (fetchedPositions.length > 0) {
          const names = fetchedPositions.map((p: any) => p.name);
          if (!cancelled) setAvailablePositions(names);
        }
      } catch {
        if (!cancelled) setTakenPositions(new Set());
      }
    };

    void loadPositions();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setError(null);
      await onSubmit({
        userId: selectedMember!.id,
        position: formData.position,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        status: formData.status,
        officerStatus: formData.status,
      });
      // reset
      setFormData({ position: '', startDate: '', endDate: '', status: 'active' });
      setErrors({});
      setMemberQuery('');
      setMemberResults([]);
      setSelectedMember(null);
      onClose();
    } catch (err:any) {
      setError(err.message || 'Failed to add officer');
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">{title || (initialMember ? 'Edit Officer Details' : 'Assign Officer Position')}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <Alert type="error" message={error} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="w-full md:col-span-2 relative">
              <Input
                label={initialMember ? 'Officer Name' : 'Member (Search)'}
                placeholder="Search by full name or email..."
                value={selectedMember ? `${selectedMember.fullName} (${selectedMember.email})` : memberQuery}
                onChange={(e) => {
                  if (selectedMember) return;
                  setMemberQuery(e.target.value);
                  setErrors((prev) => ({ ...prev, member: '' }));
                }}
                onFocus={() => {
                  if (!selectedMember && memberQuery.trim().length >= 2) {
                    setMemberResults((prev) => prev);
                  }
                }}
                readOnly={!!selectedMember}
                error={errors.member}
                helperText={!initialMember ? (selectedMember ? 'Selected member will be promoted to officer.' : 'Type at least 2 characters.') : undefined}
              />

              {!initialMember && selectedMember && (
                <button
                  type="button"
                  className="mt-2 text-sm text-primary hover:underline"
                  onClick={() => {
                    setSelectedMember(null);
                    setMemberQuery('');
                    setMemberResults([]);
                  }}
                >
                  Change selected member
                </button>
              )}

              {!selectedMember && (isSearching || memberResults.length > 0) && (
                <div className="absolute z-10 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-auto">
                  {isSearching && (
                    <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
                  )}
                  {!isSearching && memberResults.length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500">No active members found.</div>
                  )}
                  {!isSearching &&
                    memberResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-gray-50"
                        onClick={() => {
                          setSelectedMember(m);
                          setMemberQuery('');
                          setMemberResults([]);
                          setErrors((prev) => ({ ...prev, member: '' }));
                        }}
                      >
                        <div className="text-sm font-medium text-gray-900">{m.fullName}</div>
                        <div className="text-xs text-gray-600">{m.email}</div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div>
              {lockPosition || initialMember ? (
                <Input
                  label="Position"
                  value={formData.position}
                  readOnly
                  className="bg-gray-50 font-semibold text-gray-900 cursor-not-allowed"
                />
              ) : (
                <Select
                  label="Position"
                  options={[
                    { value: '', label: 'Select an option' },
                    ...availablePositions.map((pos) => ({
                      value: pos,
                      label: takenPositions.has(pos) ? `${pos} (Assigned)` : pos,
                    })),
                  ]}
                  value={formData.position}
                  onChange={(e) => {
                    if (takenPositions.has(e.target.value)) {
                      setErrors((prev) => ({ ...prev, position: 'Position already assigned.' }));
                      return;
                    }
                    setErrors((prev) => ({ ...prev, position: '' }));
                    setFormData({ ...formData, position: e.target.value });
                  }}
                  error={errors.position}
                />
              )}
            </div>

            <Select
              label="Officer Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: (e.target as HTMLSelectElement).value })}
            />

            {!initialMember && takenPositions.size > 0 && (
              <p className="text-xs text-gray-500 md:col-span-2">Positions marked as assigned are unavailable until cleared.</p>
            )}

            <Input
              label="Service Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              helperText="Optional. Leave blank to use today."
            />

            <Input
              label="Service End Date"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              helperText="Optional. Leave blank to auto-calculate (5 years)."
            />

            <div className="md:col-span-2">
              <Input
                label="Email"
                placeholder="Select a member first"
                value={selectedMember?.email || ''}
                readOnly
                className="bg-gray-50"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="lg" type="submit" disabled={isLoading}>
              {isLoading ? (initialMember ? 'Saving...' : 'Assigning...') : (initialMember ? 'Update Officer' : 'Assign Officer')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

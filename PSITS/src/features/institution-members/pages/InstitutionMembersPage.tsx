import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Input, Button, Badge, Select, TextArea } from '@/shared/components/Form';
import { Pagination, Modal } from '@/shared/components/Common';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import { Upload, Users, Search, Download, Plus, Key, FileSpreadsheet } from 'lucide-react';
import { exportToCSV } from '@/shared/utils/export';

type InstitutionMember = {
  id: string;
  institutionName: string;
  fullName: string;
  email?: string;
  contactNumber?: string;
  gender?: string;
  position?: string;
  eventTitle?: string;
  status?: 'pending' | 'approved' | 'rejected';
  date: string;
};

const splitCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
};

const parseCsv = (text: string) => {
  const rows = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (rows.length < 2) return [];

  const headers = splitCsvLine(rows[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const get = (row: string[], keys: string[]) => {
    const idx = headers.findIndex((h) => keys.includes(h));
    return idx >= 0 ? row[idx] || '' : '';
  };

  return rows.slice(1).map((raw) => {
    const row = splitCsvLine(raw);
    return {
      fullName: get(row, ['fullname', 'name']),
      email: get(row, ['email']),
      password: get(row, ['password', 'pass', 'initialpassword', 'userpassword']),
      contactNumber: get(row, ['contactnumber', 'contact', 'phone']),
      gender: get(row, ['gender']),
      position: get(row, ['position']),
      eventTitle: get(row, ['eventtitle', 'event']),
      notes: get(row, ['notes', 'note']),
    };
  });
};

export const InstitutionMembersPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<InstitutionMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [singleForm, setSingleForm] = useState({
    fullName: '',
    email: '',
    password: '',
    contactNumber: '',
    gender: 'Male',
    position: 'Student',
    eventTitle: '',
    notes: '',
  });

  const handleDownloadTemplate = () => {
    const templateContent = 'fullName,email,password,contactNumber,gender,position,eventTitle,notes\n' +
      'Juan Dela Cruz,juan.delacruz@example.com,Password123!,09171234567,Male,Student,PSITS Regional Assembly,Participant\n' +
      'Maria Clara,maria.clara@example.com,Password123!,09181234567,Female,Student,PSITS Regional Assembly,Participant';
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'institution_members_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSingleAdd = async () => {
    if (!singleForm.fullName.trim()) {
      addNotification({ userId: 'current', title: 'Validation', message: 'Full Name is required.', type: 'error', isRead: false });
      return;
    }

    setIsUploading(true);
    try {
      await api.bulkUploadInstitutionMembers([singleForm]);
      const { data } = await api.getInstitutionMembers();
      if (data?.success) setMembers(data.members || []);
      addNotification({
        userId: 'current',
        title: 'Member Added',
        message: `${singleForm.fullName} added successfully & portal login account provisioned!`,
        type: 'success',
        isRead: false,
      });
      setShowAddModal(false);
      setSingleForm({
        fullName: '',
        email: '',
        password: '',
        contactNumber: '',
        gender: 'Male',
        position: 'Student',
        eventTitle: '',
        notes: '',
      });
    } catch (err) {
      addNotification({
        userId: 'current',
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Failed to add institution member.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const isInstitutionMember = user?.role === 'member' && user?.memberType === 'institution';
  const canViewAll = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';
  const canApprove = canViewAll;

  useEffect(() => {
    if (!user) return;
    if (!isInstitutionMember && !canViewAll) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.getInstitutionMembers();
        if (!cancelled && data?.success) setMembers(data.members || []);
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
  }, [user, isInstitutionMember, canViewAll]);

  const filteredMembers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.fullName, m.email, m.contactNumber, m.position, m.eventTitle, m.institutionName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [members, searchTerm]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const paginated = filteredMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const onUploadCsv = async (file: File) => {
    setIsUploading(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text).filter((x) => String(x.fullName || '').trim());
      if (!parsed.length) {
        addNotification({
          userId: 'current',
          title: 'Invalid CSV',
          message: 'No valid rows found. Use at least a Full Name column.',
          type: 'error',
          isRead: false,
        });
        return;
      }

      await api.bulkUploadInstitutionMembers(parsed);
      const { data } = await api.getInstitutionMembers();
      if (data?.success) setMembers(data.members || []);
      addNotification({
        userId: 'current',
        title: 'Upload Complete',
        message: `${parsed.length} institution members uploaded.`,
        type: 'success',
        isRead: false,
      });
    } catch (err) {
      addNotification({
        userId: 'current',
        title: 'Upload Failed',
        message: err instanceof Error ? err.message : 'Failed to upload CSV file.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const updateStatus = async (id: string, approve: boolean) => {
    try {
      const { data } = await api.approveInstitutionMember(id, { status: approve ? 'approved' : 'rejected' });
      const updated = data?.member;
      if (updated) {
        setMembers((prev) => prev.map((m) => (String(m.id) === String(updated.id) ? updated : m)));
      }
      addNotification({
        userId: 'current',
        title: approve ? 'Approved' : 'Rejected',
        message: `Member has been ${approve ? 'approved' : 'rejected'}.`,
        type: 'success',
        isRead: false,
      });
    } catch (err) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update member status.',
        type: 'error',
        isRead: false,
      });
    }
  };

  const handleExportCSV = () => {
    const dataToExport = filteredMembers.map(m => ({
      'Member Name': m.fullName || 'N/A',
      'Institution': m.institutionName || 'N/A',
      'Email': m.email || 'N/A',
      'Contact Number': m.contactNumber || 'N/A',
      'Position': m.position || 'N/A',
      'Event Title': m.eventTitle || 'N/A',
      'Status': m.status || 'pending',
      'Date Added': m.date || 'N/A',
    }));
    exportToCSV('Institution_Members_Export', dataToExport);
  };

  if (!isInstitutionMember && !canViewAll) {
    return (
      <MainLayout>
        <Card className="p-6">
          <p className="text-gray-700">You do not have access to Institution Members.</p>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">Institution Members</h1>
            <p className="text-gray-600 mt-2">
              {isInstitutionMember
                ? 'Upload and manage your institution members for event participation.'
                : 'View institution-uploaded member records.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {(isInstitutionMember || canViewAll) && (
              <Button variant="primary" size="lg" onClick={() => setShowAddModal(true)}>
                <Plus size={20} />
                Add Member
              </Button>
            )}
            <Button variant="secondary" size="lg" onClick={handleExportCSV}>
              <Download size={20} />
              Export CSV
            </Button>
          </div>
        </div>

        {(isInstitutionMember || canViewAll) && (
          <Card
            title="Upload Institution Members & Portal Login Setup"
            subtitle="Headers: fullName, email, password (optional), contactNumber, gender, position, eventTitle, notes"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-gray-700">
                  Upload your institution participants in bulk. Include an <strong>email</strong> and <strong>password</strong> so members can log in directly to the PSITS portal.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <FileSpreadsheet size={14} /> Download Sample CSV Template
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 shadow-sm transition-all">
                  <Upload size={16} />
                  {isUploading ? 'Uploading...' : 'Upload CSV File'}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={isUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await onUploadCsv(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <div className="p-6 border-b border-gray-200">
            <div className="relative w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search member, institution, event, email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Member</th>
                  {canViewAll && (
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Institution</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Event</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Date</th>
                  {canApprove && <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginated.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{member.fullName}</td>
                    {canViewAll && <td className="px-6 py-4 text-sm text-gray-600">{member.institutionName || '-'}</td>}
                    <td className="px-6 py-4 text-sm text-gray-600">{member.email || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{member.contactNumber || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{member.position || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{member.eventTitle || '-'}</td>
                    <td className="px-6 py-4">
                      <Badge variant={member.status === 'approved' ? 'success' : member.status === 'rejected' ? 'error' : 'warning'}>
                        {String(member.status || 'pending').charAt(0).toUpperCase() + String(member.status || 'pending').slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{member.date || '-'}</td>
                    {canApprove && (
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button size="sm" variant="success" onClick={() => updateStatus(String(member.id), true)} disabled={member.status === 'approved'}>
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => updateStatus(String(member.id), false)} disabled={member.status === 'rejected'}>
                            Reject
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paginated.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {isLoading ? 'Loading member list...' : 'No member records found.'}
            </div>
          )}

          <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <Users size={16} />
              {filteredMembers.length} member(s)
            </div>
            {totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            )}
          </div>
        </Card>
      </div>

      {/* Add Institution Member Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Institution Member" size="lg">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSingleAdd();
          }}
        >
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3">
            <Key size={20} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <strong>Portal Login Account Setup:</strong> Members uploaded here automatically receive a portal login account.
              Set an optional initial password below (or leave blank to allow login using the institution password).
            </div>
          </div>

          <Input
            label="Full Name *"
            placeholder="e.g. Juan Dela Cruz"
            required
            value={singleForm.fullName}
            onChange={(e) => setSingleForm((p) => ({ ...p, fullName: e.target.value }))}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email Address *"
              type="email"
              placeholder="e.g. member@institution.edu.ph"
              required
              value={singleForm.email}
              onChange={(e) => setSingleForm((p) => ({ ...p, email: e.target.value }))}
            />
            <Input
              label="Login Password (optional)"
              type="password"
              placeholder="Set custom login password..."
              value={singleForm.password}
              onChange={(e) => setSingleForm((p) => ({ ...p, password: e.target.value }))}
              helperText="If blank, member can log in using institution password."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Contact Number"
              placeholder="e.g. 09171234567"
              value={singleForm.contactNumber}
              onChange={(e) => setSingleForm((p) => ({ ...p, contactNumber: e.target.value }))}
            />
            <Select
              label="Gender"
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Prefer not to say', label: 'Prefer not to say' },
              ]}
              value={singleForm.gender}
              onChange={(e) => setSingleForm((p) => ({ ...p, gender: (e.target as HTMLSelectElement).value }))}
            />
            <Select
              label="Position / Role"
              options={[
                { value: 'Student', label: 'Student' },
                { value: 'Faculty', label: 'Faculty / Adviser' },
                { value: 'Officer', label: 'Student Officer' },
                { value: 'Member', label: 'Member' },
              ]}
              value={singleForm.position}
              onChange={(e) => setSingleForm((p) => ({ ...p, position: (e.target as HTMLSelectElement).value }))}
            />
          </div>

          <Input
            label="Event Title (optional)"
            placeholder="e.g. PSITS Regional Assembly 2026"
            value={singleForm.eventTitle}
            onChange={(e) => setSingleForm((p) => ({ ...p, eventTitle: e.target.value }))}
          />

          <TextArea
            label="Notes / Remarks (optional)"
            rows={2}
            placeholder="Add any specific notes or department details..."
            value={singleForm.notes}
            onChange={(e) => setSingleForm((p) => ({ ...p, notes: (e.target as HTMLTextAreaElement).value }))}
          />

          <div className="border-t border-gray-200 pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isUploading}>
              Add & Provision Account
            </Button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  );
};

import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Input, Button, Badge } from '@/shared/components/Form';
import { Pagination } from '@/shared/components/Common';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import api from '@/shared/services/api';
import { Upload, Users, Search, Download } from 'lucide-react';
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
          <Button variant="secondary" size="lg" onClick={handleExportCSV} className="w-full sm:w-auto">
            <Download size={20} />
            Export CSV
          </Button>
        </div>

        {isInstitutionMember && (
          <Card title="Upload CSV" subtitle="Headers: fullName,email,contactNumber,gender,position,eventTitle,notes">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-gray-600">
                Upload your institution members list in CSV format.
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-blue-900">
                <Upload size={16} />
                {isUploading ? 'Uploading...' : 'Upload CSV'}
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
    </MainLayout>
  );
};

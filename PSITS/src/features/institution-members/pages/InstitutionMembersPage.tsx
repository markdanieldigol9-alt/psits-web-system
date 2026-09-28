import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
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
  institutionUserId?: string;
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

const parseSpreadsheetFile = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const worksheet = workbook.Sheets[sheetName];
  const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  return rawData
    .map((row) => {
      const findField = (...names: string[]) => {
        for (const k of Object.keys(row)) {
          const norm = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const n of names) {
            if (norm === n.toLowerCase().replace(/[^a-z0-9]/g, '')) {
              return String(row[k] ?? '').trim();
            }
          }
        }
        return '';
      };

      return {
        fullName: findField('fullname', 'name', 'participantname', 'membername', 'studentname'),
        email: findField('email', 'emailaddress', 'institutionemail', 'useremail'),
        password: findField('password', 'pass', 'initialpassword', 'userpassword', 'loginpassword'),
        contactNumber: findField('contactnumber', 'contact', 'phone', 'phonenumber', 'mobile', 'mobilenumber', 'contactno'),
        gender: findField('gender', 'sex') || 'Male',
        position: findField('position', 'role', 'membertype', 'designation') || 'Student',
        eventTitle: findField('eventtitle', 'event', 'eventname'),
        notes: findField('notes', 'note', 'remarks', 'remark'),
      };
    })
    .filter((x) => Boolean(x.fullName));
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
    const templateRows = [
      {
        'Full Name': 'Juan Dela Cruz',
        'Email Address': 'juan.delacruz@example.com',
        'Login Password': 'Password123!',
        'Contact Number': '09171234567',
        'Gender': 'Male',
        'Position': 'Student',
        'Event Title': 'PSITS Regional Assembly 2026',
        'Notes': 'Participant',
      },
      {
        'Full Name': 'Maria Clara',
        'Email Address': 'maria.clara@example.com',
        'Login Password': 'Password123!',
        'Contact Number': '09181234567',
        'Gender': 'Female',
        'Position': 'Student',
        'Event Title': 'PSITS Regional Assembly 2026',
        'Notes': 'Participant',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'institution_members_template.xlsx');
  };

  const handleDownloadCsvTemplate = () => {
    const templateContent = 'fullName,email,password,contactNumber,gender,position,eventTitle,notes\n' +
      'Juan Dela Cruz,juan.delacruz@example.com,Password123!,09171234567,Male,Student,PSITS Regional Assembly 2026,Participant\n' +
      'Maria Clara,maria.clara@example.com,Password123!,09181234567,Female,Student,PSITS Regional Assembly 2026,Participant';
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
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to add institution member.';
      addNotification({
        userId: 'current',
        title: 'Failed',
        message: msg,
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

  const onUploadSpreadsheet = async (file: File) => {
    setIsUploading(true);
    try {
      const allowedExts = ['.csv', '.xlsx', '.xls'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedExts.includes(fileExt)) {
        addNotification({
          userId: 'current',
          title: 'Invalid File',
          message: 'Please upload a CSV (.csv) or Excel spreadsheet (.xlsx, .xls) file.',
          type: 'error',
          isRead: false,
        });
        return;
      }

      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.length) {
        addNotification({
          userId: 'current',
          title: 'Invalid Spreadsheet',
          message: 'No valid rows found. Please ensure the spreadsheet has at least a "Full Name" or "Name" column.',
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
        title: 'Upload Successful',
        message: `${parsed.length} institution member(s) uploaded successfully from ${file.name}.`,
        type: 'success',
        isRead: false,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to upload spreadsheet file.';
      addNotification({
        userId: 'current',
        title: 'Upload Failed',
        message: msg,
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
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update member status.';
      addNotification({
        userId: 'current',
        title: 'Error',
        message: msg,
        type: 'error',
        isRead: false,
      });
    }
  };

  const handleExportCSV = () => {
    const dataToExport = filteredMembers.map((m) => ({
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
                ? 'Upload and manage your institution members for event participation and system access.'
                : 'View and manage institution-uploaded member records.'}
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
            subtitle="Supported Formats: CSV (.csv), Excel (.xlsx, .xls) • Columns: fullName, email, password (optional), contactNumber, gender, position, eventTitle, notes"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-gray-700">
                  Upload your institution participants in bulk via Excel or CSV. Include an <strong>email</strong> and <strong>password</strong> so members can log in directly as <strong>Individual Members</strong> to the PSITS portal.
                </p>
                <div className="flex flex-wrap gap-4 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet size={14} /> Download Excel Template (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Download size={14} /> Download CSV Template (.csv)
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 shadow-sm transition-all">
                  <Upload size={16} />
                  {isUploading ? 'Uploading...' : 'Upload Excel / CSV File'}
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className="hidden"
                    disabled={isUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await onUploadSpreadsheet(file);
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
              <strong>Individual Member Login Account:</strong> Members added here automatically receive an Individual Member portal login account.
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

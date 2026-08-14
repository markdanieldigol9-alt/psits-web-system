import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Input } from '@/shared/components/Form';
import { Badge, EmptyState, Modal, Pagination, StatusBadge } from '@/shared/components/Common';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';
import { AddMemberModal } from '@/features/members/components/AddMemberModal';
import { Plus, Search, Edit2, Archive, Eye, CheckCircle, Building2, Factory, UserRound, Mail, XCircle, UserX, UserCheck, PauseCircle, Ban, Download } from 'lucide-react';
import { exportToCSV } from '@/shared/utils/export';
import api from '@/shared/services/api';

type MemberTypeFilter = 'all' | 'individual' | 'institution' | 'industry';

const normalizeMemberType = (value: string): Exclude<MemberTypeFilter, 'all'> => {
  const v = String(value || '').toLowerCase();
  if (v === 'institution') return 'institution';
  if (v === 'industry') return 'industry';
  return 'individual';
};

const typeMeta = {
  individual: { label: 'Individual', icon: UserRound },
  institution: { label: 'Institution', icon: Building2 },
  industry: { label: 'Industry', icon: Factory },
};

export const MembersPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'pending' | 'suspended' | 'banned' | 'archived' | 'rejected'>('all');
  const [filterType, setFilterType] = useState<MemberTypeFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<{ id: string; name: string } | null>(null);
  const [confirmStatusChange, setConfirmStatusChange] = useState<{
    id: string;
    name: string;
    status: string;
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant?: 'primary' | 'danger';
    requireText?: string;
  } | null>(null);
  const [confirmCreateMember, setConfirmCreateMember] = useState(false);
  const [pendingMemberData, setPendingMemberData] = useState<any | null>(null);
  const [viewingMember, setViewingMember] = useState<any | null>(null);
  const [viewingTab, setViewingTab] = useState<'profile' | 'status' | 'payments' | 'events' | 'activity'>('profile');
  const [statusLogs, setStatusLogs] = useState<any[]>([]);
  const [isLoadingStatusLogs, setIsLoadingStatusLogs] = useState(false);
  const navigate = useNavigate();
  const [memberHistory, setMemberHistory] = useState<{ payments: any[]; events: any[] } | null>(null);
  const [isLoadingMemberHistory, setIsLoadingMemberHistory] = useState(false);
  const [viewingProofUrl, setViewingProofUrl] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    contactNumber: '',
    address: '',
    gender: '',
    memberType: 'individual',
    sector: 'institution',
    sectorDetails: '',
    representativeName: '',
    representativeName2: '',
    position: '',
    representativePosition2: '',
    companyEmail: '',
    website: '',
    membershipMode: 'new',
    status: 'pending',
  });
  const [confirmArchive, setConfirmArchive] = useState<{ id: string; name: string } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const itemsPerPage = 10;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.getMembers();
        if (!cancelled && data?.success) {
          setMembers(data.members || []);
        }
      } catch {
        // ignore - UI will show empty state
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const openMemberDetails = async (member: any) => {
    setViewingMember(member);
    setViewingTab('profile');
    setStatusLogs([]);
    setMemberHistory(null);
    setIsLoadingStatusLogs(true);
    setIsLoadingMemberHistory(true);
    try {
      const [logsRes, detailsRes] = await Promise.all([
        api.getMemberStatusLogs(member.id),
        api.getMemberDetails(member.id),
      ]);
      if (logsRes.data?.success) setStatusLogs(logsRes.data.logs || []);
      if (detailsRes.data?.success) {
        const updated = detailsRes.data.member;
        if (updated) {
          setMembers((prev) => prev.map((m) => (String(m.id) === String(updated.id) ? { ...m, ...updated } : m)));
          setViewingMember((prev: any) => ({ ...(prev || {}), ...(updated || {}) }));
        }
        setMemberHistory(detailsRes.data.history || { payments: [], events: [] });
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingStatusLogs(false);
      setIsLoadingMemberHistory(false);
    }
  };

  const memberTypeCounts = useMemo(() => {
    const base = { individual: 0, institution: 0, industry: 0 };
    for (const m of members) {
      const t = normalizeMemberType(m.memberType);
      base[t] += 1;
    }
    return base;
  }, [members]);

  const filteredMembers = members.filter((member) => {
    const searchable = [
      member.fullName,
      member.email,
      member.contactNumber,
      member.sectorDetails,
      member.representativeName,
      member.representativeName2,
      member.companyEmail,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesSearch = searchable.includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || member.status === filterStatus;
    const normalizedType = normalizeMemberType(member.memberType);
    const matchesType = filterType === 'all' || normalizedType === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getEmailBadge = (member: any) => {
    if (member.status !== 'active') return null;
    if (member.approvalEmailStatus === 'sent') {
      return <Badge variant="success">Email Sent</Badge>;
    }
    if (member.approvalEmailStatus === 'failed') {
      return <Badge variant="warning">Email Not Sent</Badge>;
    }
    return <Badge variant="info">Email Not Sent</Badge>;
  };

  const handleAddMember = async (memberData: any) => {
    setPendingMemberData(memberData);
    setConfirmCreateMember(true);
  };

  const createMember = async (memberData: any) => {
    setIsLoading(true);
    try {
      const { data } = await api.createMember(memberData);
      const newMember = data?.member;
      if (newMember) {
        setMembers((prev) => {
          const exists = prev.some((m) => String(m.id) === String(newMember.id));
          if (exists) {
            return prev.map((m) => (String(m.id) === String(newMember.id) ? newMember : m));
          }
          return [newMember, ...prev];
        });
      }
      addNotification({
        userId: 'current',
        title: memberData.membershipMode === 'renew' ? 'Member Renewed' : 'Member Added',
        message: `${memberData.fullName} has been ${memberData.membershipMode === 'renew' ? 'renewed' : 'added'} successfully.`,
        type: 'success',
        isRead: false,
      });
      setIsLoading(false);
    } catch (error) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to add member. Please try again.',
        type: 'error',
        isRead: false,
      });
      setIsLoading(false);
      throw error;
    }
  };

  const handleApproveMember = async (memberId: string) => {
    setApprovingId(memberId);
    try {
      const existing = members.find((m) => String(m.id) === String(memberId));
      const { data } = await api.changeMemberStatus(memberId, 'active');
      const updated = data?.member;
      const targetEmail = updated?.email || existing?.email;
      if (updated) {
        setMembers((prev: any[]) => prev.map((m: any) => (m.id === memberId ? { ...m, ...updated } : m)));
      }

      const emailStatus = data?.notification?.emailSent
        ? `Approval email sent to ${targetEmail || 'the user'}`
        : `Email not sent (${data?.notification?.reason || 'SMTP not configured'})`;

      addNotification({
        userId: 'current',
        title: 'Member Approved',
        message: `Member account is now active. ${emailStatus}.`,
        type: 'success',
        isRead: false,
      });
    } catch (error) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to approve member. Please try again.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleConfirmStatusChange = async (reason?: string) => {
    if (!confirmStatusChange) return;
    const { id, status } = confirmStatusChange;
    setApprovingId(id);
    try {
      const { data } = await api.changeMemberStatus(id, status, reason);
      const updated = data?.member;
      if (updated) {
        setMembers((prev: any[]) => prev.map((m: any) => (String(m.id) === String(id) ? { ...m, ...updated } : m)));
      }

      addNotification({
        userId: 'current',
        title: 'Member Updated',
        message: `Member status updated to ${status}.`,
        type: 'success',
        isRead: false,
      });

      if (viewingMember && String(viewingMember.id) === String(id) && updated) {
        setViewingMember(updated);
        try {
          const { data: logsData } = await api.getMemberStatusLogs(id);
          if (logsData?.success) setStatusLogs(logsData.logs || []);
        } catch {
          // ignore
        }
      }
    } catch (error) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update member status. Please try again.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setApprovingId(null);
      setConfirmStatusChange(null);
    }
  };

  const handleResendApproval = async (member: any) => {
    setResendingId(member.id);
    try {
      const { data } = await api.resendApprovalEmail(member.id);
      const updated = data?.member;
      if (updated) {
        setMembers((prev) => prev.map((m) => (String(m.id) === String(updated.id) ? { ...m, ...updated } : m)));
      }

      const emailStatus = data?.notification?.emailSent
        ? `Approval email sent to ${updated?.email || member.email || 'the user'}`
        : `Email not sent (${data?.notification?.reason || 'SMTP not configured'})`;

      addNotification({
        userId: 'current',
        title: 'Approval Email',
        message: emailStatus,
        type: data?.notification?.emailSent ? 'success' : 'warning',
        isRead: false,
      });
    } catch (error) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to resend approval email.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setResendingId(null);
    }
  };

  const openEditMember = (member: any) => {
    setEditingMember(member);
    setEditForm({
      fullName: member.fullName || '',
      contactNumber: member.contactNumber || '',
      address: member.address || '',
      gender: member.gender || '',
      memberType: member.memberType || 'individual',
      sector: member.sector || 'institution',
      sectorDetails: member.sectorDetails || '',
      representativeName: member.representativeName || '',
      representativeName2: member.representativeName2 || '',
      position: member.position || '',
      representativePosition2: member.representativePosition2 || '',
      companyEmail: member.companyEmail || '',
      website: member.website || '',
      membershipMode: member.membershipMode || 'new',
      status: member.status || 'pending',
    });
  };

  const handleUpdateMember = async () => {
    if (!editingMember?.id) return;
    setIsSavingEdit(true);
    try {
      const { data } = await api.updateMember(editingMember.id, editForm);
      const updated = data?.member;
      if (updated) {
        setMembers((prev) => prev.map((m) => (String(m.id) === String(updated.id) ? { ...m, ...updated } : m)));
      }
      addNotification({
        userId: 'current',
        title: 'Member Updated',
        message: 'Member details were updated successfully.',
        type: 'success',
        isRead: false,
      });
      setEditingMember(null);
    } catch (error) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update member.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleArchiveMember = async () => {
    if (!confirmArchive?.id) return;
    setIsArchiving(true);
    try {
      const { data } = await api.changeMemberStatus(confirmArchive.id, 'archived', 'Archived by admin/officer');
      const updated = data?.member;
      if (updated) {
        setMembers((prev) => prev.map((m) => (String(m.id) === String(updated.id) ? { ...m, ...updated } : m)));
      } else {
        setMembers((prev) => prev.map((m) => (String(m.id) === String(confirmArchive.id) ? { ...m, status: 'archived' } : m)));
      }
      addNotification({
        userId: 'current',
        title: 'Member Archived',
        message: `${confirmArchive.name} was archived.`,
        type: 'success',
        isRead: false,
      });
      setConfirmArchive(null);
    } catch (error) {
      addNotification({
        userId: 'current',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to archive member.',
        type: 'error',
        isRead: false,
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const canManageMembers = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  const handleExportCSV = () => {
    const dataToExport = filteredMembers.map(m => ({
      'Name': m.fullName || m.firstName + ' ' + m.lastName,
      'Email': m.email,
      'Contact Number': m.contactNumber || 'N/A',
      'Sector/School': m.sector || 'N/A',
      'Member Type': normalizeMemberType(m.memberType),
      'Status': m.status,
      'Registration Date': new Date(m.createdAt).toLocaleDateString(),
    }));
    exportToCSV('Members_Export', dataToExport);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">Members Management</h1>
            <p className="mt-2 text-gray-600">Membership Management for individual, institution, and industry profiles.</p>
          </div>
          {canManageMembers && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="secondary" size="lg" onClick={handleExportCSV} className="w-full sm:w-auto">
                <Download size={20} />
                Export CSV
              </Button>
              <Button variant="primary" size="lg" onClick={() => setIsAddMemberModalOpen(true)} className="w-full sm:w-auto">
                <Plus size={20} />
                Add Member
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(Object.keys(typeMeta) as Array<Exclude<MemberTypeFilter, 'all'>>).map((key) => {
            const meta = typeMeta[key];
            const Icon = meta.icon;
            const active = filterType === key;
            return (
              <button
                type="button"
                key={key}
                onClick={() => {
                  setFilterType(key);
                  setCurrentPage(1);
                }}
                className={`rounded-lg border p-4 text-left transition ${
                  active ? 'border-primary bg-blue-50' : 'border-gray-200 bg-white hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Member Type</p>
                    <p className="text-lg font-bold text-gray-900">{meta.label}</p>
                    <p className="text-sm text-gray-600">{memberTypeCounts[key]} members</p>
                  </div>
                  <Icon className="text-primary" size={22} />
                </div>
              </button>
            );
          })}
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="relative w-full md:col-span-2">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search name, email, contact, representative..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            <select
              aria-label="Filter member status"
              value={filterStatus}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setFilterStatus(e.target.value as any);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
              <option value="archived">Archived</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              aria-label="Filter member type"
              value={filterType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setFilterType(e.target.value as MemberTypeFilter);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Types</option>
              <option value="individual">Individual</option>
              <option value="institution">Institution</option>
              <option value="industry">Industry</option>
            </select>
          </div>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Organization / Representative</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Expiry (1 Year Limit)</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Email Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedMembers.map((member) => {
                  const normalizedType = normalizeMemberType(member.memberType);
                  const expiryRaw = (member as any).membershipExpiresAt;
                  const expiryDate = expiryRaw ? new Date(String(expiryRaw)) : null;
                  const hasExpiryWindow = true;
                  const msDay = 1000 * 60 * 60 * 24;
                  const daysLeft = hasExpiryWindow && expiryDate && !Number.isNaN(expiryDate.getTime())
                    ? Math.ceil((expiryDate.getTime() - Date.now()) / msDay)
                    : null;
                  return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{member.fullName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{member.email}</td>
                      <td className="px-6 py-4">
                        <Badge variant="info">{typeMeta[normalizedType].label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{member.contactNumber || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {member.sectorDetails || '-'}
                        {member.representativeName ? ` / ${member.representativeName}` : ''}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={member.status} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {!hasExpiryWindow ? (
                          '-'
                        ) : !expiryDate || Number.isNaN(expiryDate.getTime()) ? (
                          <Badge variant="warning">Not Set</Badge>
                        ) : daysLeft !== null && daysLeft < 0 ? (
                          <div className="space-y-1">
                            <Badge variant="error">Expired</Badge>
                            <div className="text-xs text-gray-500">{expiryDate.toLocaleDateString()}</div>
                          </div>
                        ) : daysLeft !== null && daysLeft <= 30 ? (
                          <div className="space-y-1">
                            <Badge variant="warning">Expiring ({daysLeft}d)</Badge>
                            <div className="text-xs text-gray-500">{expiryDate.toLocaleDateString()}</div>
                          </div>
                        ) : (
                          expiryDate.toLocaleDateString()
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getEmailBadge(member)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            aria-label="View member"
                            className="rounded p-2 transition-colors hover:bg-gray-100"
                            onClick={() => void openMemberDetails(member)}
                          >
                            <Eye size={16} className="text-gray-600" />
                          </button>
                          {canManageMembers && (
                            <>
                              {member.status === 'pending' && (
                                <button
                                  aria-label="Approve member"
                                  className="rounded p-2 transition-colors hover:bg-gray-100 disabled:opacity-50"
                                  onClick={() => setConfirmApprove({ id: member.id, name: member.fullName || member.email })}
                                  disabled={approvingId === member.id}
                                  title="Approve member"
                                >
                                  <CheckCircle size={16} className="text-green-600" />
                                </button>
                              )}
                              {member.status === 'pending' && (
                                <button
                                  aria-label="Reject member"
                                  className="rounded p-2 transition-colors hover:bg-gray-100 disabled:opacity-50"
                                  onClick={() =>
                                    setConfirmStatusChange({
                                      id: member.id,
                                      name: member.fullName || member.email,
                                      status: 'rejected',
                                      title: 'Reject Member',
                                      message: `Reject ${member.fullName || member.email}? This will mark the registration as rejected.`,
                                      confirmLabel: 'Reject',
                                      confirmVariant: 'danger',
                                      requireText: 'REJECT',
                                    })
                                  }
                                  disabled={approvingId === member.id}
                                  title="Reject member"
                                >
                                  <XCircle size={16} className="text-red-600" />
                                </button>
                              )}
                              {member.status === 'active' && (
                                <button
                                  aria-label="Resend approval email"
                                  className="rounded p-2 transition-colors hover:bg-gray-100 disabled:opacity-50"
                                  onClick={() => handleResendApproval(member)}
                                  disabled={resendingId === member.id}
                                  title="Resend approval email"
                                >
                                  <Mail size={16} className="text-indigo-600" />
                                </button>
                              )}
                              {member.status === 'active' && (
                                <button
                                  aria-label="Deactivate member"
                                  className="rounded p-2 transition-colors hover:bg-gray-100 disabled:opacity-50"
                                  onClick={() =>
                                    setConfirmStatusChange({
                                      id: member.id,
                                      name: member.fullName || member.email,
                                      status: 'inactive',
                                      title: 'Deactivate Member',
                                      message: `Deactivate ${member.fullName || member.email}? They will no longer be treated as an active member.`,
                                      confirmLabel: 'Deactivate',
                                      confirmVariant: 'danger',
                                      requireText: 'DEACTIVATE',
                                    })
                                  }
                                  disabled={approvingId === member.id}
                                  title="Deactivate member"
                                >
                                  <UserX size={16} className="text-red-600" />
                                </button>
                              )}
                              {['inactive', 'suspended', 'banned', 'archived', 'rejected'].includes(String(member.status)) && (
                                <button
                                  aria-label="Restore member"
                                  className="rounded p-2 transition-colors hover:bg-gray-100 disabled:opacity-50"
                                  onClick={() =>
                                    setConfirmStatusChange({
                                      id: member.id,
                                      name: member.fullName || member.email,
                                      status: 'active',
                                      title: 'Restore Member',
                                      message: `Restore ${member.fullName || member.email} to Active status?`,
                                      confirmLabel: 'Restore',
                                      confirmVariant: 'primary',
                                    })
                                  }
                                  disabled={approvingId === member.id}
                                  title="Restore member"
                                >
                                  <UserCheck size={16} className="text-green-700" />
                                </button>
                              )}
                              {member.status === 'active' && (
                                <button
                                  aria-label="Suspend member"
                                  className="rounded p-2 transition-colors hover:bg-gray-100 disabled:opacity-50"
                                  onClick={() =>
                                    setConfirmStatusChange({
                                      id: member.id,
                                      name: member.fullName || member.email,
                                      status: 'suspended',
                                      title: 'Suspend Member',
                                      message: `Suspend ${member.fullName || member.email}? They can be restored later.`,
                                      confirmLabel: 'Suspend',
                                      confirmVariant: 'danger',
                                      requireText: 'SUSPEND',
                                    })
                                  }
                                  disabled={approvingId === member.id}
                                  title="Suspend member"
                                >
                                  <PauseCircle size={16} className="text-orange-600" />
                                </button>
                              )}
                              {member.status !== 'banned' && (
                                <button
                                  aria-label="Ban member"
                                  className="rounded p-2 transition-colors hover:bg-gray-100 disabled:opacity-50"
                                  onClick={() =>
                                    setConfirmStatusChange({
                                      id: member.id,
                                      name: member.fullName || member.email,
                                      status: 'banned',
                                      title: 'Ban Member',
                                      message: `Ban ${member.fullName || member.email}? This is a high-impact action (can be restored, but should be used sparingly).`,
                                      confirmLabel: 'Ban',
                                      confirmVariant: 'danger',
                                      requireText: 'BAN',
                                    })
                                  }
                                  disabled={approvingId === member.id}
                                  title="Ban member"
                                >
                                  <Ban size={16} className="text-gray-800" />
                                </button>
                              )}
                              <button
                                aria-label="Edit member"
                                className="rounded p-2 transition-colors hover:bg-gray-100"
                                onClick={() => openEditMember(member)}
                              >
                                <Edit2 size={16} className="text-blue-600" />
                              </button>
                              <button
                                aria-label="Archive member"
                                className="rounded p-2 transition-colors hover:bg-gray-100 disabled:opacity-50"
                                onClick={() => setConfirmArchive({ id: String(member.id), name: member.fullName || member.email || 'Member' })}
                                title={member.status === 'archived' ? 'Already archived' : 'Archive member'}
                                disabled={member.status === 'archived'}
                              >
                                <Archive size={16} className="text-amber-700" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {paginatedMembers.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {isLoading ? 'Loading members...' : 'No members found matching your filters.'}
            </div>
          )}

          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          )}
        </Card>
      </div>

      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        onSubmit={handleAddMember}
        isLoading={isLoading}
        existingMembers={members}
      />

      <VerifyActionModal
        isOpen={confirmCreateMember}
        title="Verify Member Creation"
        message="Are you sure you want to add this member?"
        confirmLabel="Accept"
        confirmVariant="primary"
        onCancel={() => {
          if (isLoading) return;
          setConfirmCreateMember(false);
          setPendingMemberData(null);
        }}
        onVerified={async () => {
          if (!pendingMemberData) return;
          await createMember(pendingMemberData);
          setConfirmCreateMember(false);
          setPendingMemberData(null);
        }}
      />

      <VerifyActionModal
        isOpen={!!confirmApprove}
        title="Approve Member"
        message={`Approve ${confirmApprove?.name}? This will activate the member account.`}
        confirmLabel="Accept"
        confirmVariant="primary"
        onCancel={() => {
          if (approvingId) return;
          setConfirmApprove(null);
        }}
        onVerified={async () => {
          if (!confirmApprove) return;
          await handleApproveMember(confirmApprove.id);
          setConfirmApprove(null);
        }}
      />

      <VerifyActionModal
        isOpen={!!confirmStatusChange}
        title={confirmStatusChange?.title || 'Update Member Status'}
        message={confirmStatusChange?.message || 'Are you sure you want to update this member status?'}
        confirmLabel={confirmStatusChange?.confirmLabel || 'Confirm'}
        confirmVariant={confirmStatusChange?.confirmVariant || 'primary'}
        requireText={confirmStatusChange?.requireText}
        requireReason={confirmStatusChange?.status === 'suspended' || confirmStatusChange?.status === 'banned'}
        reasonPlaceholder={confirmStatusChange?.status === 'suspended' ? 'Enter suspension reason / violation details...' : 'Enter ban reason / violation details...'}
        onCancel={() => {
          if (approvingId) return;
          setConfirmStatusChange(null);
        }}
        onVerified={handleConfirmStatusChange}
      />

      <VerifyActionModal
        isOpen={!!confirmArchive}
        title="Archive Member"
        message={`Archive ${confirmArchive?.name}? You can restore this member later by setting their status to Active.`}
        confirmLabel="Archive"
        confirmVariant="primary"
        onCancel={() => {
          if (isArchiving) return;
          setConfirmArchive(null);
        }}
        onVerified={handleArchiveMember}
      />

      <Modal
        isOpen={!!editingMember}
        onClose={() => {
          if (isSavingEdit) return;
          setEditingMember(null);
        }}
        title="Edit Member"
        size="lg"
      >
        {editingMember && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Full Name" value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} />
              <Input label="Contact Number" value={editForm.contactNumber} onChange={(e) => setEditForm((p) => ({ ...p, contactNumber: e.target.value }))} />
              <Input label="Address" value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
              <Input label="Gender" value={editForm.gender} onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))} />
              <Input label="Member Type" value={editForm.memberType} onChange={(e) => setEditForm((p) => ({ ...p, memberType: e.target.value }))} />
              <Input label="Sector" value={editForm.sector} onChange={(e) => setEditForm((p) => ({ ...p, sector: e.target.value }))} />
              <Input label="Institution/Company" value={editForm.sectorDetails} onChange={(e) => setEditForm((p) => ({ ...p, sectorDetails: e.target.value }))} />
              <Input label="Representative 1" value={editForm.representativeName} onChange={(e) => setEditForm((p) => ({ ...p, representativeName: e.target.value }))} />
              <Input label="Representative 2" value={editForm.representativeName2} onChange={(e) => setEditForm((p) => ({ ...p, representativeName2: e.target.value }))} />
              <Input label="Representative 1 Position" value={editForm.position} onChange={(e) => setEditForm((p) => ({ ...p, position: e.target.value }))} />
              <Input label="Representative 2 Position" value={editForm.representativePosition2} onChange={(e) => setEditForm((p) => ({ ...p, representativePosition2: e.target.value }))} />
              <Input label="Institution/Company Email" value={editForm.companyEmail} onChange={(e) => setEditForm((p) => ({ ...p, companyEmail: e.target.value }))} />
              <Input label="Website" value={editForm.website} onChange={(e) => setEditForm((p) => ({ ...p, website: e.target.value }))} />
              <Input label="Membership Mode" value={editForm.membershipMode} onChange={(e) => setEditForm((p) => ({ ...p, membershipMode: e.target.value }))} />
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                className="rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Edit member status"
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditingMember(null)} disabled={isSavingEdit}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={handleUpdateMember} isLoading={isSavingEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!viewingMember}
        onClose={() => {
          setViewingMember(null);
          setViewingTab('profile');
          setStatusLogs([]);
          setIsLoadingStatusLogs(false);
          setMemberHistory(null);
          setIsLoadingMemberHistory(false);
        }}
        title="Member Details"
        size="lg"
      >
        {viewingMember && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-900 truncate">{viewingMember.fullName || '-'}</p>
                  <p className="text-sm text-gray-600 truncate">{viewingMember.email || '-'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">{typeMeta[normalizeMemberType(viewingMember.memberType)].label}</Badge>
                  <StatusBadge status={viewingMember.status} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
              {[
                { key: 'profile', label: 'Profile' },
                { key: 'status', label: 'Membership Status' },
                { key: 'payments', label: 'Payments' },
                { key: 'events', label: 'Events' },
                { key: 'activity', label: 'Activity Logs' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setViewingTab(t.key as any)}
                  className={[
                    'rounded-full px-3 py-1.5 text-sm font-semibold',
                    viewingTab === t.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {viewingTab === 'profile' && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div><span className="font-semibold">Contact Number:</span> {viewingMember.contactNumber || '-'}</div>
                  <div><span className="font-semibold">Address:</span> {viewingMember.address || '-'}</div>
                  <div><span className="font-semibold">Gender:</span> {viewingMember.gender || '-'}</div>
                  <div><span className="font-semibold">Membership Mode:</span> {viewingMember.membershipMode || '-'}</div>
                </div>

                {(viewingMember.sectorDetails || viewingMember.representativeName || viewingMember.representativeName2 || viewingMember.position || viewingMember.representativePosition2 || viewingMember.companyEmail || viewingMember.website || viewingMember.occupation) && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Organization Details</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div><span className="font-semibold">Institution / Company:</span> {viewingMember.sectorDetails || '-'}</div>
                      <div><span className="font-semibold">Occupation:</span> {viewingMember.occupation || '-'}</div>
                      <div><span className="font-semibold">Representative 1:</span> {viewingMember.representativeName || '-'}</div>
                      <div><span className="font-semibold">Representative 2:</span> {viewingMember.representativeName2 || '-'}</div>
                      <div><span className="font-semibold">Representative 1 Position:</span> {viewingMember.position || '-'}</div>
                      <div><span className="font-semibold">Representative 2 Position:</span> {viewingMember.representativePosition2 || '-'}</div>
                      <div><span className="font-semibold">Institution/Company Email:</span> {viewingMember.companyEmail || '-'}</div>
                      <div className="md:col-span-2"><span className="font-semibold">Website:</span> {viewingMember.website || '-'}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewingTab === 'status' && (
              <div className="space-y-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900">Current Status</p>
                  <div className="mt-2">
                    <StatusBadge status={viewingMember.status} />
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900">Status History</p>
                  {isLoadingStatusLogs ? (
                    <p className="mt-3 text-sm text-gray-500">Loading status history...</p>
                  ) : statusLogs.length ? (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[600px] text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                          <tr>
                            <th className="px-4 py-2 text-left">From</th>
                            <th className="px-4 py-2 text-left">To</th>
                            <th className="px-4 py-2 text-left">By</th>
                            <th className="px-4 py-2 text-left">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {statusLogs.map((log) => (
                            <tr key={log.id}>
                              <td className="px-4 py-2"><StatusBadge status={log.oldStatus} /></td>
                              <td className="px-4 py-2"><StatusBadge status={log.newStatus} /></td>
                              <td className="px-4 py-2 text-gray-700">{log.changedByName || log.changedByEmail || '-'}</td>
                              <td className="px-4 py-2 text-gray-600">{log.createdAt ? String(log.createdAt).replace('T', ' ').slice(0, 19) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500">No status changes recorded yet.</p>
                  )}
                </div>
              </div>
            )}

            {viewingTab === 'payments' && (
              isLoadingMemberHistory ? (
                <p className="text-sm text-gray-500">Loading payment history...</p>
              ) : memberHistory?.payments?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Type / Event</th>
                        <th className="px-4 py-2 text-left">Amount</th>
                        <th className="px-4 py-2 text-left">Method & Ref</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Proof</th>
                        <th className="px-4 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {memberHistory.payments.map((p) => {
                        const statusStr = String(p.status || 'pending').toLowerCase();
                        const statusVariant =
                          statusStr === 'verified' ? 'success' : statusStr === 'rejected' ? 'error' : 'warning';
                        const methodStr = String(p.paymentMethod || p.method || '-').toUpperCase();

                        return (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600 text-xs">
                              {p.createdAt ? String(p.createdAt).slice(0, 10) : '-'}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {p.eventTitle || (p.paymentKind === 'membership_renewal' ? 'Membership Renewal' : 'Membership Fee')}
                            </td>
                            <td className="px-4 py-3 font-semibold text-primary">
                              ₱{Number(p.amount || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className="font-semibold text-gray-800">{methodStr}</span>
                              {p.referenceNumber && (
                                <div className="text-gray-500 font-mono">Ref: {p.referenceNumber}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={statusVariant}>
                                {statusStr.charAt(0).toUpperCase() + statusStr.slice(1)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {p.proofUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingProofUrl(p.proofUrl)}
                                  className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                                >
                                  <Eye size={14} /> View Proof
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">None</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setViewingMember(null);
                                  navigate(`/payments?search=${encodeURIComponent(viewingMember?.fullName || viewingMember?.id || '')}`);
                                }}
                              >
                                Track
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No payments found" description="This member has no payment records yet." />
              )
            )}

            {viewingTab === 'events' && (
              isLoadingMemberHistory ? (
                <p className="text-sm text-gray-500">Loading event history...</p>
              ) : memberHistory?.events?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Event</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Participants</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {memberHistory.events.map((r) => (
                        <tr key={r.registrationId}>
                          <td className="px-4 py-2 text-gray-600">{r.createdAt ? String(r.createdAt).slice(0, 10) : '-'}</td>
                          <td className="px-4 py-2 text-gray-700">{r.eventTitle || '-'}</td>
                          <td className="px-4 py-2 text-gray-700">{r.status || '-'}</td>
                          <td className="px-4 py-2 text-gray-700">{r.participantCount || 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No events found" description="This member has no event registrations yet." />
              )
            )}

            {viewingTab === 'activity' && (
              <EmptyState title="No activity logs yet" description="Audit and activity logs will appear here as the system modules are expanded." />
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setViewingMember(null);
                  setViewingTab('profile');
                  setStatusLogs([]);
                  setIsLoadingStatusLogs(false);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Proof Lightbox Modal */}
      <Modal
        isOpen={Boolean(viewingProofUrl)}
        onClose={() => setViewingProofUrl(null)}
        title="Transaction Payment Proof"
        size="lg"
      >
        {viewingProofUrl && (
          <div className="flex flex-col items-center justify-center p-4">
            <img
              src={viewingProofUrl}
              alt="Transaction Proof"
              className="max-h-[70vh] rounded-lg border object-contain bg-gray-50"
            />
            <div className="mt-4 flex justify-end w-full">
              <Button variant="secondary" onClick={() => setViewingProofUrl(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </MainLayout>
  );
};

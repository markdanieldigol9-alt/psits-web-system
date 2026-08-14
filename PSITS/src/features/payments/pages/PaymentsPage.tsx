import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/shared/layouts';

import { Card, Button, TextArea } from '@/shared/components/Form';
import { Badge, Pagination, Modal } from '@/shared/components/Common';
import { CheckCircle, XCircle, Clock, Eye, Edit2, Download, Search } from 'lucide-react';
import { exportToCSV } from '@/shared/utils/export';
import api from '@/shared/services/api';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import { VerifyActionModal } from '@/shared/components/VerifyActionModal';

const mockPayments: any[] = [];

export const PaymentsPage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || searchParams.get('member') || '';
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [payments, setPayments] = useState<any[]>(mockPayments);
  const [isLoading, setIsLoading] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ payment: any; status: 'verified' | 'rejected'; rejectionReason?: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [paymentLogs, setPaymentLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const isMember = user?.role === 'member';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.getPayments({ status: filterStatus });
        if (!cancelled && data?.success) setPayments(data.payments || []);
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

  useEffect(() => {
    if (!viewing?.id) {
      setPaymentLogs([]);
      return;
    }
    let cancelled = false;
    const loadLogs = async () => {
      setIsLoadingLogs(true);
      try {
        const { data } = await api.getPaymentStatusLogs(viewing.id);
        if (!cancelled && data?.success) {
          setPaymentLogs(data.logs || []);
        }
      } catch {
        if (!cancelled) setPaymentLogs([]);
      } finally {
        if (!cancelled) setIsLoadingLogs(false);
      }
    };
    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [viewing?.id]);

  const scopedPayments = isMember
    ? payments.filter((payment) => String(payment.memberId) === String(user?.id || ''))
    : payments;

  const getVerificationStatus = (payment: any) =>
    String(payment?.verificationStatus || payment?.status || 'pending').toLowerCase();

  const formatPaymentMethod = (method: string) => {
    if (!method) return '-';
    if (method === 'bank_transfer') return 'Bank Transfer';
    return method.toUpperCase();
  };

  const filteredPayments = scopedPayments.filter((payment) => {
    const status = getVerificationStatus(payment);
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    
    if (!searchTerm.trim()) return matchesStatus;

    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      (payment.memberName && String(payment.memberName).toLowerCase().includes(term)) ||
      (payment.event && String(payment.event).toLowerCase().includes(term)) ||
      (payment.referenceNumber && String(payment.referenceNumber).toLowerCase().includes(term)) ||
      (payment.method && String(payment.method).toLowerCase().includes(term)) ||
      (payment.paymentMethod && String(payment.paymentMethod).toLowerCase().includes(term)) ||
      (payment.memberId && String(payment.memberId) === term);

    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExportCSV = () => {
    const dataToExport = filteredPayments.map(p => ({
      'Member Name': p.memberName || 'N/A',
      'Event/Type': p.event || (p.paymentKind === 'membership_renewal' ? 'Membership Renewal' : 'Membership Fee'),
      'Amount': p.amount || 0,
      'Payment Method': String(p.method || p.paymentMethod || '').toUpperCase() || '-',
      'Status': getVerificationStatus(p),
      'Date Submitted': p.date || 'N/A',
    }));
    exportToCSV('Financial_Report_Export', dataToExport);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={18} className="text-green-600" />;
      case 'rejected':
        return <XCircle size={18} className="text-red-600" />;
      case 'pending':
        return <Clock size={18} className="text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'info';
    }
  };

  const totalRevenue = payments
    .filter((p) => getVerificationStatus(p) === 'verified')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const canVerify = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'officer';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isMember ? 'My Payment History' : 'Payment Tracking'}
            </h1>
            <p className="text-gray-600 mt-2">
              {isMember ? 'View your submitted payments and verification status.' : 'Monitor and verify member payments'}
            </p>
          </div>
          <Button variant="secondary" size="lg" onClick={handleExportCSV} className="w-full sm:w-auto shrink-0">
            <Download size={20} />
            Export CSV
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <p className="text-gray-600 text-sm">Total Revenue</p>
            <p className="text-2xl font-bold text-primary mt-2">PHP {totalRevenue.toLocaleString()}</p>
          </Card>
          <Card className="p-6">
            <p className="text-gray-600 text-sm">Pending Verification</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">
              {payments.filter((p) => getVerificationStatus(p) === 'pending').length}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-gray-600 text-sm">Verified Payments</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {payments.filter((p) => getVerificationStatus(p) === 'verified').length}
            </p>
          </Card>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by member, ref #, event, or method..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
                if (e.target.value) {
                  setSearchParams({ search: e.target.value });
                } else {
                  setSearchParams({});
                }
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="all">All Payments</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Payments Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {!isMember && (
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                      Member
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedPayments.map((payment) => {
                  const status = getVerificationStatus(payment);
                  const formattedMethod = formatPaymentMethod(payment.method || payment.paymentMethod || '');
                  const eventLabel =
                    payment.event ||
                    (payment.paymentKind === 'membership_renewal' ? 'Membership Renewal' : 'Membership Fee');

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                    {!isMember && (
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {payment.memberName}
                      </td>
                    )}
                    <td className="px-6 py-4 text-gray-600 text-sm">{eventLabel}</td>
                    <td className="px-6 py-4 font-bold text-primary">
                      ₱{payment.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="text-gray-950 font-medium">{formattedMethod}</span>
                      {payment.referenceNumber && (
                        <div className="text-xs text-gray-500 font-mono mt-0.5">Ref: {payment.referenceNumber}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        <Badge variant={getStatusColor(status)}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{payment.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          className="p-2 hover:bg-gray-100 rounded transition-colors"
                          aria-label="View payment"
                          onClick={() => setViewing(payment)}
                        >
                          <Eye size={16} className="text-gray-600" />
                        </button>
                        {canVerify && status === 'pending' && (
                          <button
                            className="p-2 hover:bg-gray-100 rounded transition-colors"
                            aria-label="Verify payment"
                            onClick={() => setConfirmAction({ payment, status: 'verified' })}
                          >
                            <Edit2 size={16} className="text-blue-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {paginatedPayments.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {isLoading ? 'Loading...' : 'No payments found matching your criteria.'}
            </div>
          )}

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </Card>
      </div>

      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title="Payment Details"
        size="lg"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {!isMember && <div><span className="font-semibold">Member:</span> {viewing.memberName}</div>}
              <div><span className="font-semibold">Event:</span> {viewing.event || '-'}</div>
              <div><span className="font-semibold">Amount:</span> ₱{Number(viewing.amount || 0).toLocaleString()}</div>
              <div><span className="font-semibold">Method:</span> {formatPaymentMethod(viewing.method || viewing.paymentMethod)}</div>
              <div><span className="font-semibold">Reference Number:</span> <span className="font-mono">{viewing.referenceNumber || 'N/A'}</span></div>
              <div><span className="font-semibold">Status:</span> {getVerificationStatus(viewing)}</div>
              <div><span className="font-semibold">Date:</span> {viewing.date}</div>
            </div>

            {viewing.proofUrl ? (
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-sm font-semibold text-gray-900 mb-2">Transaction Proof</div>
                <img
                  src={viewing.proofUrl}
                  alt="Transaction proof"
                  className="w-full max-h-96 object-contain rounded border"
                />
              </div>
            ) : (
              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded border">No transaction proof uploaded.</div>
            )}

            {/* Payment Audit Logs & Status History */}
            <div className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900">Payment Audit & Status Logs</h4>
                {viewing.memberName && (
                  <button
                    type="button"
                    onClick={() => {
                      const name = viewing.memberName;
                      setViewing(null);
                      setSearchTerm(name);
                      setSearchParams({ search: name });
                    }}
                    className="text-xs text-primary hover:underline font-semibold"
                  >
                    Filter All Payments for {viewing.memberName}
                  </button>
                )}
              </div>

              {isLoadingLogs ? (
                <p className="text-xs text-gray-500">Loading logs...</p>
              ) : paymentLogs.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {paymentLogs.map((log) => (
                    <div key={log.id} className="text-xs border-l-2 border-primary pl-3 py-1 bg-white rounded shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-800">
                          {log.oldStatus ? `${log.oldStatus.toUpperCase()} → ${log.newStatus.toUpperCase()}` : log.newStatus.toUpperCase()}
                        </span>
                        <span className="text-gray-400 text-[11px]">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                      <div className="text-gray-600 mt-0.5">By: {log.changedByName}</div>
                      {log.remarks && <div className="text-red-600 italic mt-0.5">Note: {log.remarks}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">No status changes logged yet for this payment.</p>
              )}
            </div>

            {canVerify && getVerificationStatus(viewing) === 'pending' && (
              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setRejecting(viewing);
                    setRejectionReason('');
                  }}
                >
                  Reject
                </Button>
                <Button type="button" variant="success" onClick={() => setConfirmAction({ payment: viewing, status: 'verified' })}>
                  Verify
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!rejecting}
        onClose={() => !isUpdating && setRejecting(null)}
        title="Reject Payment"
        size="lg"
      >
        {rejecting && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">Add a reason for rejection (shown to the member).</p>
            <TextArea
              label="Rejection Reason"
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason((e.target as HTMLTextAreaElement).value)}
              placeholder="e.g. Amount mismatch / unclear screenshot / wrong reference number"
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setRejecting(null)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setConfirmAction({ payment: rejecting, status: 'rejected', rejectionReason });
                  setRejecting(null);
                }}
                disabled={!rejectionReason.trim()}
              >
                Continue
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <VerifyActionModal
        isOpen={!!confirmAction}
        title={confirmAction?.status === 'verified' ? 'Verify Payment' : 'Reject Payment'}
        message={
          confirmAction?.status === 'verified'
            ? 'Are you sure you want to verify this payment?'
            : 'Are you sure you want to reject this payment?'
        }
        confirmLabel="Accept"
        confirmVariant={confirmAction?.status === 'verified' ? 'primary' : 'danger'}
        onCancel={() => {
          if (isUpdating) return;
          setConfirmAction(null);
        }}
        onVerified={async () => {
          if (!confirmAction) return;
          setIsUpdating(true);
          try {
            const payload: any = { status: confirmAction.status };
            if (confirmAction.status === 'rejected') payload.rejectionReason = String(confirmAction.rejectionReason || '').trim();
            const { data } = await api.verifyPayment(confirmAction.payment.id, payload);
            const updated = data?.payment;
            if (updated) setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            addNotification({
              userId: 'current',
              title: confirmAction.status === 'verified' ? 'Verified' : 'Rejected',
              message: confirmAction.status === 'verified' ? 'Payment verified.' : 'Payment rejected.',
              type: 'success',
              isRead: false,
            });
            setConfirmAction(null);
            setViewing(null);
          } catch (err) {
            addNotification({
              userId: 'current',
              title: 'Error',
              message: err instanceof Error ? err.message : 'Failed to update payment.',
              type: 'error',
              isRead: false,
            });
          } finally {
            setIsUpdating(false);
          }
        }}
      />
    </MainLayout>
  );
};

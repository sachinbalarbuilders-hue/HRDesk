import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { exportToCSV } from '../utils/csvHelper';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { DataToolbar } from '../components/ui/DataToolbar';
import {
  Plus,
  X,
  CalendarCheck2,
  Check,
} from 'lucide-react';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';

export const Leaves: React.FC = () => {
  const { user, hasPermission, isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();
  const [applications, setApplications] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [applyPanelOpen, setApplyPanelOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    dayType: 'Full Day',
    reason: '',
  });

  const fetchLeavesData = async () => {
    try {
      setLoading(true);
      const [appsRes, typesRes] = await Promise.all([
        apiClient.get('/leaves/applications', {
          params: {
            status: statusFilter !== 'all' ? statusFilter : undefined,
            search: search || undefined,
            page,
            pageSize,
          },
        }),
        apiClient.get('/leaves/types'),
      ]);

      setApplications(appsRes.data.items || []);
      setTotalCount(appsRes.data.totalCount || 0);
      setTotalPages(appsRes.data.totalPages || 1);
      setLeaveTypes(typesRes.data || []);

      if (user?.employeeId) {
        const balRes = await apiClient.get(`/leaves/balances/${user.employeeId}`);
        setBalances(balRes.data.balances || []);
      }
    } catch (err: any) {
      showError('Failed to load leaves', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeavesData();
  }, [statusFilter, search, page, pageSize]);

  const handleExportLeaves = () => {
    if (!applications.length) {
      showError('Export Empty', 'No leave applications to export.');
      return;
    }

    const headers = [
      { key: 'id', label: 'Request ID' },
      { key: 'employeeName', label: 'Employee Name' },
      { key: 'leaveTypeName', label: 'Leave Type' },
      { key: 'leaveTypeCode', label: 'Code' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate', label: 'End Date' },
      { key: 'totalDays', label: 'Total Days' },
      { key: 'dayType', label: 'Duration' },
      { key: 'reason', label: 'Reason' },
      { key: 'status', label: 'Status' },
    ];

    exportToCSV('Leave_Applications', applications, headers);
    showSuccess('Export Complete', 'Leave requests exported to CSV.');
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.leaveTypeId) return;

    try {
      setApplying(true);
      await apiClient.post('/leaves/apply', {
        leaveTypeId: parseInt(applyForm.leaveTypeId),
        startDate: applyForm.startDate,
        endDate: applyForm.endDate,
        dayType: applyForm.dayType,
        reason: applyForm.reason,
      });

      showSuccess('Application Submitted', 'Your leave request has been submitted.');
      setApplyPanelOpen(false);
      setApplyForm({
        leaveTypeId: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dayType: 'Full Day',
        reason: '',
      });
      fetchLeavesData();
    } catch (err: any) {
      showError('Application Failed', err.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setApplying(false);
    }
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await apiClient.put(`/leaves/${id}/status`, { status });
      showSuccess('Status Updated', `Leave request #${id} marked as ${status}.`);
      fetchLeavesData();
    } catch (err: any) {
      showError('Update Failed', err.response?.data?.message || 'Failed to update leave status');
    }
  };

  const canApprove = isAdmin || hasPermission('Leaves.Approve');

  return (
    <div className="space-y-6">
      {/* 1. Header with Display Serif and Divider */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Leaves
            </h1>
            <p className="text-xs text-[var(--ink-muted)] font-ui mt-0.5">
              Leave balances, requests & approval history
            </p>
          </div>

          <span className="text-xs font-data text-[var(--ink-muted)]">
            {totalCount} Total Requests
          </span>
        </div>

        {/* Signature Divider */}
        <div className="register-rule pt-1" />
      </div>

      {/* 2. Unified Common Action Toolbar with Search, Status Filters, Export, Import, and Primary Action */}
      <DataToolbar
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Search leaves by employee name, reason or ID..."
        filters={[
          {
            id: 'status',
            value: statusFilter,
            onChange: (val) => {
              setStatusFilter(val);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All Statuses' },
              { value: 'Pending', label: 'Pending Only' },
              { value: 'Approved', label: 'Approved Only' },
              { value: 'Rejected', label: 'Rejected Only' },
            ],
          },
        ]}
        onExport={handleExportLeaves}
        exportLabel="Export CSV"
        onImport={isAdmin ? () => setImportModalOpen(true) : undefined}
        importLabel="Import CSV"
        primaryAction={{
          label: 'Apply Leave',
          icon: <Plus size={14} />,
          onClick: () => setApplyPanelOpen(true),
        }}
      />

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Entitlement Quotas (1/3) */}
        <div className="space-y-4">
          <div className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[var(--rule)]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] font-ui">
                Leave Balances
              </h2>
              <CalendarCheck2 size={14} className="text-[var(--ink-muted)]" />
            </div>

            <div className="space-y-3">
              {balances.map((b) => (
                <div
                  key={b.leaveTypeId}
                  className="p-3 bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--ink)]">{b.name}</span>
                    <span className="font-data text-[11px] text-[var(--ink-muted)] font-semibold">{b.code}</span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs font-data">
                    <p className="text-base font-bold text-[var(--gold-500)]">
                      {b.remaining} <span className="text-xs font-normal text-[var(--ink-muted)]">remaining</span>
                    </p>
                    <span className="text-[11px] text-[var(--ink-muted)]">
                      Used: {b.used} / {b.allocated}
                    </span>
                  </div>
                </div>
              ))}

              {balances.length === 0 && (
                <p className="text-xs text-[var(--ink-muted)] font-data py-3 text-center">
                  No personal leave balances found.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Applications Log with 4px Left-Edge Status Bar (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Table with 4px Left-Edge Status Bar */}
          <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
            <div className="overflow-x-auto">
              <table className="register-table">
                <thead>
                  <tr>
                    <th className="w-1"></th>
                    <th>Employee</th>
                    <th>Type</th>
                    <th className="font-data">Period</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th className="text-right">Action / Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <TableSkeleton rows={6} />
                      </td>
                    </tr>
                  ) : applications.map((app) => {
                    const isApproved = app.status === 'Approved';
                    const isRejected = app.status === 'Rejected';
                    const isPending = app.status === 'Pending';

                    const barColor = isApproved ? 'bg-[var(--ok-600)]' : isRejected ? 'bg-[var(--err-600)]' : 'bg-[var(--warn-600)]';

                    return (
                      <tr key={app.id} className="relative">
                        {/* 4px Left-Edge Status Bar */}
                        <td className={`p-0 w-1 ${barColor}`} />

                        <td className="font-semibold text-[var(--ink)]">
                          {app.employeeName}
                        </td>
                        <td className="font-data text-xs text-[var(--ink-muted)]">
                          {app.leaveTypeCode}
                        </td>
                        <td className="text-xs font-data text-[var(--ink)]">
                          {app.startDate} to {app.endDate}
                        </td>
                        <td className="font-data text-xs text-[var(--ink)]">
                          {app.totalDays}d ({app.dayType})
                        </td>
                        <td className="text-xs text-[var(--ink-muted)] max-w-xs truncate">
                          {app.reason || '-'}
                        </td>
                        <td className="text-right text-xs">
                          {canApprove && isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleStatusUpdate(app.id, 'Approved')}
                                className="btn-primary py-0.5 px-2 text-[11px] flex items-center gap-1 cursor-pointer"
                                title="Approve"
                              >
                                <Check size={11} /> Approve
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(app.id, 'Rejected')}
                                className="btn-outline py-0.5 px-2 text-[11px] flex items-center gap-1 text-[var(--err-600)] cursor-pointer"
                                title="Reject"
                              >
                                <X size={11} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span className={`font-data text-xs font-bold ${isApproved ? 'text-[var(--ok-600)]' : isRejected ? 'text-[var(--err-600)]' : 'text-[var(--warn-600)]'}`}>
                              {app.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {applications.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-xs font-data text-[var(--ink-muted)]">
                        No leave requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <PaginationToolbar
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        </div>
      </div>

      {/* Slide-in Apply Panel (480px) */}
      {applyPanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-[var(--surface)] h-full p-6 shadow-2xl overflow-y-auto space-y-5 border-l border-[var(--rule)]">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[var(--gold-500)] font-data">
                  Leave Application
                </span>
                <h2 className="font-display text-2xl font-semibold text-[var(--ink)] mt-0.5">
                  Apply for Leave
                </h2>
                <p className="text-xs text-[var(--ink-muted)]">Submit time-off request for manager approval</p>
              </div>

              <button
                onClick={() => setApplyPanelOpen(false)}
                className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Leave Type *
                </label>
                <select
                  required
                  value={applyForm.leaveTypeId}
                  onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
                  className="register-input w-full"
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map((t: any) => (
                    <option key={t.leaveTypeId} value={t.leaveTypeId}>
                      {t.name} ({t.code}) {t.isPaid ? '— Paid Leave' : '— Unpaid'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={applyForm.startDate}
                    onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={applyForm.endDate}
                    onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                    className="register-input w-full font-data"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Duration
                </label>
                <select
                  value={applyForm.dayType}
                  onChange={(e) => setApplyForm({ ...applyForm, dayType: e.target.value })}
                  className="register-input w-full"
                >
                  <option value="Full Day">Full Day</option>
                  <option value="First Half">First Half (0.5)</option>
                  <option value="Second Half">Second Half (0.5)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Reason
                </label>
                <textarea
                  rows={4}
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                  placeholder="Enter reason for leave..."
                  className="register-input w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setApplyPanelOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applying}
                  className="btn-primary disabled:opacity-50 cursor-pointer"
                >
                  {applying ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Leaves Modal */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Leave Applications"
        templateFilename="HRDesk_Leave_Applications"
        templateHeaders={['EmployeeId', 'LeaveTypeCode', 'StartDate', 'EndDate', 'DayType', 'Reason']}
        templateSampleRow={['1042', 'PL', '2026-08-20', '2026-08-22', 'Full Day', 'Annual Vacation']}
        onImportComplete={() => {
          setImportModalOpen(false);
          fetchLeavesData();
        }}
      />
    </div>
  );
};

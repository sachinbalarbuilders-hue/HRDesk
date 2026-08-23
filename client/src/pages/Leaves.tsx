import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { DataToolbar } from '../components/ui/DataToolbar';
import { type ArchiveFilterValue } from '../components/ui/ArchiveToggle';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  Plus,
  X,
  CalendarCheck2,
  Check,
  Trash2,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { RowActionMenu, type RowAction } from '../components/ui/RowActionMenu';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';

export const Leaves: React.FC = () => {
  const { user, hasPermission, isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();
  const [applications, setApplications] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [applyPanelOpen, setApplyPanelOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyForm, setApplyForm] = useState({
    employeeId: user?.employeeId ? String(user.employeeId) : '',
    leaveTypeId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    dayType: 'Full Day',
    reason: '',
  });

  const fetchLeavesData = async () => {
    try {
      setLoading(true);
      const [appsRes, typesRes, empRes] = await Promise.all([
        apiClient.get('/leaves/applications', {
          params: {
            status: statusFilter !== 'all' ? statusFilter : undefined,
            archiveFilter: archiveFilter,
            search: search || undefined,
            branchId: currentBranch?.id || undefined,
            page,
            pageSize,
          },
        }),
        apiClient.get('/leaves/types', {
          params: {
            branchId: currentBranch?.id || undefined,
          },
        }),
        apiClient.get('/employees', {
          params: {
            pageSize: 300,
            branchId: currentBranch?.id || undefined,
          },
        }),
      ]);

      setApplications(appsRes.data.items || []);
      setTotalCount(appsRes.data.totalCount || 0);
      setTotalPages(appsRes.data.totalPages || 1);
      setLeaveTypes(typesRes.data || []);
      setEmployees(empRes.data.items || empRes.data || []);

      const activeEmpId = applyForm.employeeId || (user?.employeeId ? String(user.employeeId) : '');
      if (activeEmpId) {
        const balRes = await apiClient.get(`/leaves/balances/${activeEmpId}`);
        setBalances(balRes.data.balances || []);
      }
    } catch (err: any) {
      showError('Failed to load leaves', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeChange = async (empIdStr: string) => {
    setApplyForm((prev) => ({ ...prev, employeeId: empIdStr }));
    if (empIdStr) {
      try {
        const balRes = await apiClient.get(`/leaves/balances/${empIdStr}`);
        setBalances(balRes.data.balances || []);
      } catch {}
    }
  };

  useEffect(() => {
    fetchLeavesData();
  }, [statusFilter, archiveFilter, search, currentOrganization?.id, currentBranch?.id, page, pageSize]);

  useEffect(() => {
    const handleReload = () => {
      setPage(1);
      fetchLeavesData();
    };

    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);

    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, [statusFilter, search]);

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

    const targetEmpId = applyForm.employeeId ? parseInt(applyForm.employeeId) : (user?.employeeId || null);
    if (!targetEmpId) {
      showError('Employee Required', 'Please select an employee to apply leave for.');
      return;
    }

    try {
      setApplying(true);
      await apiClient.post('/leaves/apply', {
        employeeId: targetEmpId,
        leaveTypeId: parseInt(applyForm.leaveTypeId),
        startDate: applyForm.startDate,
        endDate: applyForm.endDate,
        dayType: applyForm.dayType,
        reason: applyForm.reason,
      });

      showSuccess('Application Submitted', 'Your leave request has been submitted.');
      setApplyPanelOpen(false);
      setApplyForm({
        employeeId: user?.employeeId ? String(user.employeeId) : '',
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

  const handleDeleteLeave = async (id: number, isPermanent: boolean) => {
    if (isPermanent) {
      if (!window.confirm(`Permanently delete leave application #${id}? This action cannot be undone.`)) return;
      try {
        await apiClient.delete(`/leaves/${id}?permanent=true`);
        showSuccess('Permanently Deleted', 'Leave application has been permanently removed.');
        fetchLeavesData();
      } catch (err: any) {
        showError('Delete Failed', err.response?.data?.message || 'Failed to delete leave');
      }
    } else {
      if (!window.confirm(`Archive leave application #${id}? It will be moved to the Archived tab.`)) return;
      try {
        await apiClient.delete(`/leaves/${id}`);
        showSuccess('Archived', 'Leave application has been moved to Archive.');
        fetchLeavesData();
      } catch (err: any) {
        showError('Archive Failed', err.response?.data?.message || 'Failed to archive leave');
      }
    }
  };

  const handleRestoreLeave = async (id: number) => {
    try {
      await apiClient.post(`/leaves/${id}/restore`);
      showSuccess('Restored', 'Leave application restored to Pending.');
      fetchLeavesData();
    } catch (err: any) {
      showError('Restore Failed', err.response?.data?.message || 'Failed to restore leave');
    }
  };

  const canApprove = isAdmin || hasPermission('Leaves.Approve');

  return (
    <PageContainer>
      <PageHeader title="Leave Management" description="Track and approve employee leave applications" />

      {/* 2. Unified Common Action Toolbar with Search, Status Filters, Export, Import, and Primary Action */}
      <DataToolbar
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Search leaves by employee name, reason or ID..."
        archiveFilter={{
          value: archiveFilter,
          onChange: (v) => { setArchiveFilter(v); setPage(1); },
        }}
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

      <div className="space-y-4">
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
                    const isArchived = app.status === 'Archived' || app.status === 'Cancelled';

                    const barColor = isArchived
                      ? 'bg-[var(--ink-muted)] opacity-50'
                      : isApproved
                      ? 'bg-[var(--ok-600)]'
                      : isRejected
                      ? 'bg-[var(--err-600)]'
                      : 'bg-[var(--warn-600)]';

                    return (
                      <tr key={app.id} className={`relative ${isArchived ? 'opacity-70 bg-[var(--surface-sunken)]/20' : ''}`}>
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
                          {canApprove ? (
                            <RowActionMenu actions={[
                              ...(isArchived ? [
                                { label: 'Restore Request', icon: <RotateCcw size={14} />, onClick: () => handleRestoreLeave(app.id), variant: 'default' as const },
                                { label: 'Permanent Delete', icon: <Trash2 size={14} />, onClick: () => handleDeleteLeave(app.id, true), variant: 'danger' as const },
                              ] : [
                                ...(isPending ? [
                                  { label: 'Approve', icon: <Check size={14} />, onClick: () => handleStatusUpdate(app.id, 'Approved'), variant: 'success' as const },
                                  { label: 'Reject', icon: <X size={14} />, onClick: () => handleStatusUpdate(app.id, 'Rejected'), variant: 'danger' as const },
                                ] : []),
                                { label: 'Archive', icon: <Archive size={14} />, onClick: () => handleDeleteLeave(app.id, false), variant: 'danger' as const },
                              ]),
                            ]} />
                          ) : (
                            <span className={`font-data text-xs font-bold ${isArchived ? 'text-[var(--ink-muted)]' : isApproved ? 'text-[var(--ok-600)]' : isRejected ? 'text-[var(--err-600)]' : 'text-[var(--warn-600)]'}`}>
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
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Employee *
                </label>
                <select
                  required
                  value={applyForm.employeeId}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  className="register-input w-full font-ui"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((emp: any) => (
                    <option key={emp.employeeId || emp.id} value={emp.employeeId || emp.id}>
                      {emp.employeeCode ? `${emp.employeeCode} — ` : ''}{emp.employeeName || emp.name} {emp.departmentName ? `(${emp.departmentName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

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
                <label className="block text-xs font-semibold text-[var(--ink)] mb-2">
                  Duration
                </label>
                <div className="flex items-center gap-2">
                  {['Full Day', 'First Half', 'Second Half'].map((opt) => (
                    <label
                      key={opt}
                      className={`flex-1 text-center py-2 px-3 rounded-[var(--radius-md)] border cursor-pointer text-xs font-medium transition-colors ${
                        applyForm.dayType === opt
                          ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--surface-secondary)]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="dayType"
                        value={opt}
                        checked={applyForm.dayType === opt}
                        onChange={(e) => setApplyForm({ ...applyForm, dayType: e.target.value })}
                        className="hidden"
                      />
                      {opt === 'Full Day' ? 'Full Day' : opt === 'First Half' ? '1st Half' : '2nd Half'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Reason *
                </label>
                <textarea
                  rows={4}
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                  placeholder="Enter reason for leave..."
                  className="register-input w-full"
                  required
                />
              </div>

              {/* Document Upload */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Supporting Document
                </label>
                <div className="border border-dashed border-[var(--border)] rounded-[var(--radius-md)] p-4 text-center hover:border-[var(--accent)] hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setApplyForm({ ...applyForm, document: e.target.files?.[0] || null } as any)}
                    className="hidden"
                    id="leave-doc-upload"
                  />
                  <label htmlFor="leave-doc-upload" className="cursor-pointer">
                    {(applyForm as any).document ? (
                      <div className="text-sm font-medium text-[var(--accent)]">{(applyForm as any).document.name}</div>
                    ) : (
                      <>
                        <div className="text-sm text-[var(--text-secondary)]">Click to upload proof</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">PDF, JPG, PNG (max 5MB)</div>
                      </>
                    )}
                  </label>
                </div>
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
    </PageContainer>
  );
};

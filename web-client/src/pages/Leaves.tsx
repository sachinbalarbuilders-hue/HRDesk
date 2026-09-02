import React, { useEffect, useState, useMemo, useRef } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { DataToolbar } from '../components/ui/DataToolbar';
import { DataTable } from '../components/ui/DataTable';
import { type ArchiveFilterValue } from '../components/ui/ArchiveToggle';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  Plus,
  X,
  CalendarCheck2,
  Check,
  CheckCheck,
  XCircle,
  Trash2,
  Archive,
  RotateCcw,
  Pencil,
  ChevronDown,
  Ban,
} from 'lucide-react';
import { RowActionMenu, type RowAction } from '../components/ui/RowActionMenu';
import { useArchiveActions, isRowArchived } from '../hooks/useArchiveActions';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';

interface StatusApprovalDropdownProps {
  row: any;
  canApprove: boolean;
  canCancel: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onCancel: (id: number) => void;
}

const StatusApprovalDropdown: React.FC<StatusApprovalDropdownProps> = ({
  row,
  canApprove,
  canCancel,
  onApprove,
  onReject,
  onCancel,
}) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  if (row.status === 'Approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span>Approved</span>
      </span>
    );
  }

  if (row.status === 'Rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <span>Rejected</span>
      </span>
    );
  }

  if (row.status === 'Cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20">
        <span className="w-2 h-2 rounded-full bg-gray-400" />
        <span>Cancelled</span>
      </span>
    );
  }

  if (row.status === 'Archived') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span>Archived</span>
      </span>
    );
  }

  // Pending Status
  if (!canApprove && !canCancel) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span>Pending</span>
      </span>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center justify-between gap-2 px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-[var(--ink)] shadow-2xs cursor-pointer transition-all hover:border-[var(--gold-500)]"
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="font-semibold">Pending</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--ink-muted)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-32 rounded-lg bg-[var(--paper)] border border-[var(--rule)] shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100 font-sans">
          {canApprove && (
            <>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onApprove(row.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left cursor-pointer transition-colors"
              >
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-semibold">Approve</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onReject(row.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5 text-rose-500" />
                <span className="font-semibold">Reject</span>
              </button>
            </>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCancel(row.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer transition-colors"
            >
              <Ban className="w-3.5 h-3.5 text-gray-500" />
              <span className="font-semibold">Cancel</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const Leaves: React.FC = () => {
  const { user, hasPermission, isAdmin, getPermissionScope } = useAuth();
  const applyScope = getPermissionScope('Leaves.Apply');
  const editScope = getPermissionScope('Leaves.Edit');
  const approveScope = getPermissionScope('Leaves.Approve');
  const deleteScope = getPermissionScope('Leaves.Delete') || (isAdmin ? 'Bulk Delete' : 'Soft Delete');

  const canApply = isAdmin || hasPermission('Leaves.Apply');
  const canEdit = isAdmin || hasPermission('Leaves.Edit');
  const canApprove = isAdmin || hasPermission('Leaves.Approve');
  const canDelete = isAdmin || hasPermission('Leaves.Delete');
  const canBulkDelete = isAdmin || (canDelete && (deleteScope === 'Bulk Delete' || deleteScope === 'All'));
  const canPermanentDelete = isAdmin || (canDelete && (deleteScope === 'Permanent Delete' || deleteScope === 'Bulk Delete' || deleteScope === 'All'));

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

  // Selection for bulk operations
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  // Modals
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [applyPanelOpen, setApplyPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
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
        apiClient.get('/leaves/employees', {
          params: {
            branchId: currentBranch?.id || undefined,
          },
        }),
      ]);

      const empList = Array.isArray(empRes.data)
        ? empRes.data
        : (Array.isArray(empRes.data?.items) ? empRes.data.items : []);
      const typeList = Array.isArray(typesRes.data)
        ? typesRes.data
        : (Array.isArray(typesRes.data?.items) ? typesRes.data.items : []);

      setApplications(appsRes.data?.items || (Array.isArray(appsRes.data) ? appsRes.data : []));
      setTotalCount(appsRes.data?.totalCount || 0);
      setTotalPages(appsRes.data?.totalPages || 1);
      setLeaveTypes(typeList);
      setEmployees(empList);

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

  const handleOpenEdit = (app: any) => {
    setEditingId(app.id);
    setApplyForm({
      employeeId: String(app.employeeId),
      leaveTypeId: String(app.leaveTypeId),
      startDate: app.startDate,
      endDate: app.endDate,
      dayType: app.dayType || 'Full Day',
      reason: app.reason || '',
    });
    setApplyPanelOpen(true);
  };

  const handleCancelLeave = async (id: number) => {
    try {
      await apiClient.post(`/leaves/${id}/cancel`);
      showSuccess('Cancelled', 'Leave request cancelled.');
      fetchLeavesData();
    } catch (err: any) {
      showError('Cancellation Failed', err.response?.data?.message || 'Failed to cancel leave');
    }
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
      if (editingId) {
        await apiClient.put(`/leaves/${editingId}`, {
          employeeId: targetEmpId,
          leaveTypeId: parseInt(applyForm.leaveTypeId),
          startDate: applyForm.startDate,
          endDate: applyForm.endDate,
          dayType: applyForm.dayType,
          reason: applyForm.reason,
        });
        showSuccess('Application Updated', 'Leave request updated successfully.');
      } else {
        await apiClient.post('/leaves/apply', {
          employeeId: targetEmpId,
          leaveTypeId: parseInt(applyForm.leaveTypeId),
          startDate: applyForm.startDate,
          endDate: applyForm.endDate,
          dayType: applyForm.dayType,
          reason: applyForm.reason,
        });
        showSuccess('Application Submitted', 'Your leave request has been submitted.');
      }
      setApplyPanelOpen(false);
      setEditingId(null);
      setApplyForm({
        employeeId: (applyScope === 'Own' && user?.employeeId) ? String(user.employeeId) : '',
        leaveTypeId: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dayType: 'Full Day',
        reason: '',
      });
      fetchLeavesData();
    } catch (err: any) {
      showError(editingId ? 'Update Failed' : 'Application Failed', err.response?.data?.message || 'Failed to submit leave request');
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

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const leaveArchive = useArchiveActions({
    endpoint: '/leaves',
    label: 'Leave Application',
    permissionKey: 'Leaves.Delete',
    onDone: fetchLeavesData,
  });

  const customBulkActions = useMemo(() => {
    if (archiveFilter === 'archived') {
      return leaveArchive.bulkActions(true);
    }
    return [
      ...(canApprove
        ? [
            {
              label: 'Bulk Approve',
              icon: <CheckCheck size={13} />,
              variant: 'primary' as const,
              onClick: async (_keys: (string | number)[], selectedRows: any[], clear: () => void) => {
                const pendingRows = selectedRows.filter((r) => r.status === 'Pending').map((r) => r.id);
                if (!pendingRows.length) {
                  showError('Selection Notice', 'Please select pending leave requests to approve.');
                  return;
                }
                try {
                  await apiClient.post('/leaves/bulk-approve', { ids: pendingRows });
                  showSuccess('Bulk Approved', `Successfully approved ${pendingRows.length} leave request(s).`);
                  clear();
                  fetchLeavesData();
                } catch (err: any) {
                  showError('Bulk Approval Failed', err.response?.data?.message || 'Server error');
                }
              },
            },
            {
              label: 'Bulk Reject',
              icon: <XCircle size={13} />,
              variant: 'danger' as const,
              onClick: async (_keys: (string | number)[], selectedRows: any[], clear: () => void) => {
                const pendingRows = selectedRows.filter((r) => r.status === 'Pending').map((r) => r.id);
                if (!pendingRows.length) {
                  showError('Selection Notice', 'Please select pending leave requests to reject.');
                  return;
                }
                try {
                  await apiClient.post('/leaves/bulk-reject', { ids: pendingRows, reason: 'Bulk rejected by operator' });
                  showSuccess('Bulk Rejected', `Successfully rejected ${pendingRows.length} leave request(s).`);
                  clear();
                  fetchLeavesData();
                } catch (err: any) {
                  showError('Bulk Rejection Failed', err.response?.data?.message || 'Server error');
                }
              },
            },
          ]
        : []),
      ...leaveArchive.bulkActions(false),
    ];
  }, [archiveFilter, leaveArchive, canApprove, showError, showSuccess]);

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
          onChange: (v) => { setArchiveFilter(v); setPage(1); setSelectedIds([]); },
        }}
        filters={[
          {
            id: 'status',
            value: statusFilter,
            onChange: (val) => {
              setStatusFilter(val);
              setPage(1);
              setSelectedIds([]);
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
        onImport={canApply ? () => setImportModalOpen(true) : undefined}
        importLabel="Import CSV"
        primaryAction={canApply ? {
          label: 'Apply Leave',
          icon: <Plus size={14} />,
          onClick: () => {
            setEditingId(null);
            setApplyForm({
              employeeId: (applyScope === 'Own' && user?.employeeId) ? String(user.employeeId) : '',
              leaveTypeId: '',
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date().toISOString().split('T')[0],
              dayType: 'Full Day',
              reason: '',
            });
            setApplyPanelOpen(true);
          },
        } : undefined}
      />

      {/* 3. Leaves Table */}
      <DataTable
        data={applications}
        loading={loading}
        keyExtractor={(app) => app.id}
        emptyMessage="No leave requests found."
        columns={[
          {
            key: 'employee',
            header: 'Employee',
            render: (app) => <span className="font-semibold text-[var(--ink)]">{app.employeeName}</span>,
          },
          {
            key: 'leaveType',
            header: 'Type',
            render: (app) => (
              <span className="font-data text-xs text-[var(--ink-muted)]">
                {app.leaveTypeCode || app.leaveTypeName}
              </span>
            ),
          },
          {
            key: 'period',
            header: 'Period',
            render: (app) => (
              <span className="text-xs font-data text-[var(--ink)]">
                {app.startDate} to {app.endDate}
              </span>
            ),
          },
          {
            key: 'duration',
            header: 'Days',
            render: (app) => (
              <span className="font-data text-xs text-[var(--ink)]">
                {app.totalDays}d ({app.dayType})
              </span>
            ),
          },
          {
            key: 'reason',
            header: 'Reason',
            render: (app) => (
              <span className="text-xs text-[var(--ink-muted)] max-w-xs truncate block" title={app.reason || ''}>
                {app.reason || '-'}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (app) => {
              const isArchived = app.status === 'Archived' || app.status === 'Cancelled';
              const isPending = app.status === 'Pending';
              const canApproveThis = canApprove && isPending && !isArchived && (approveScope !== 'Own' || app.employeeId === user?.employeeId);
              const canEditThis = canEdit && isPending && !isArchived && (editScope !== 'Own' || app.employeeId === user?.employeeId);
              const canCancelThis = isPending && !isArchived && (canApproveThis || canEditThis || app.employeeId === user?.employeeId);

              return (
                <StatusApprovalDropdown
                  row={app}
                  canApprove={canApproveThis}
                  canCancel={canCancelThis}
                  onApprove={(id) => handleStatusUpdate(id, 'Approved')}
                  onReject={(id) => handleStatusUpdate(id, 'Rejected')}
                  onCancel={handleCancelLeave}
                />
              );
            },
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (app) => {
              const isArchived = app.status === 'Archived' || app.status === 'Cancelled';
              const isPending = app.status === 'Pending';
              const canEditThis = canEdit && isPending && !isArchived && (editScope !== 'Own' || app.employeeId === user?.employeeId);

              return canDelete || canEditThis ? (
                <RowActionMenu
                  actions={[
                    ...(canEditThis
                      ? [{ label: 'Edit', icon: <Pencil size={14} />, onClick: () => handleOpenEdit(app) }]
                      : []),
                    ...(canDelete
                      ? leaveArchive.rowActions({
                          id: app.id,
                          name: `Leave Request #${app.id} (${app.employeeName})`,
                          isArchived: isArchived || isRowArchived(app),
                        })
                      : []),
                  ]}
                />
              ) : (
                <span className="font-data text-xs text-[var(--ink-muted)]">
                  {app.approvedBy ? `by ${app.approvedBy}` : '—'}
                </span>
              );
            },
          },
        ]}
        selection={
          canApprove || canBulkDelete
            ? {
                selectedRowKeys: selectedIds,
                onChange: (keys) => setSelectedIds(keys),
                bulkActions: customBulkActions,
              }
            : undefined
        }
        pagination={{
          page,
          pageSize,
          totalCount,
          totalPages,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      />

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
                  {editingId ? 'Edit Leave Application' : 'Apply for Leave'}
                </h2>
                <p className="text-xs text-[var(--ink-muted)]">Submit time-off request for manager approval</p>
              </div>

              <button
                onClick={() => { setApplyPanelOpen(false); setEditingId(null); }}
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
                  className={`register-input w-full font-ui ${applyScope === 'Own' || editingId !== null ? 'opacity-70 bg-gray-50 dark:bg-gray-900 cursor-not-allowed' : ''}`}
                  disabled={applyScope === 'Own' || editingId !== null}
                >
                  <option value="">-- Select Employee --</option>
                  {(Array.isArray(employees) ? employees : [])
                    .filter((emp: any) => applyScope !== 'Own' || String(emp.employeeId || emp.id) === String(user?.employeeId))
                    .map((emp: any) => (
                      <option key={emp.employeeId || emp.id} value={emp.employeeId || emp.id}>
                        {emp.employeeName || emp.name} {emp.departmentName ? `(${emp.departmentName})` : ''}
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
                  {(Array.isArray(leaveTypes) ? leaveTypes : []).map((t: any) => (
                    <option key={t.leaveTypeId || t.id} value={t.leaveTypeId || t.id}>
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
                  onClick={() => { setApplyPanelOpen(false); setEditingId(null); }}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applying}
                  className="btn-primary disabled:opacity-50 cursor-pointer"
                >
                  {applying ? 'Saving...' : editingId ? 'Update Leave Request' : 'Submit Request'}
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

      {/* Permanent-delete confirmation (only reachable from the Archive view) */}
      {leaveArchive.dialog}
    </PageContainer>
  );
};

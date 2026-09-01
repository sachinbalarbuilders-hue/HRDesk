import React, { useEffect, useState, useMemo, useRef } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { DataTable } from '../components/ui/DataTable';
import { type ArchiveFilterValue } from '../components/ui/ArchiveToggle';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  Plus,
  X,
  Check,
  CheckCheck,
  XCircle,
  Pencil,
  ChevronDown,
  Ban,
  Gift,
  Clock,
  Calendar,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { RowActionMenu } from '../components/ui/RowActionMenu';
import { useArchiveActions, isRowArchived } from '../hooks/useArchiveActions';

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

export const CompOff: React.FC = () => {
  const { user, hasPermission, isAdmin, getPermissionScope } = useAuth();
  const applyScope = getPermissionScope('CompOff.Apply');
  const editScope = getPermissionScope('CompOff.Edit');
  const approveScope = getPermissionScope('CompOff.Approve');
  const deleteScope = getPermissionScope('CompOff.Delete') || (isAdmin ? 'Bulk Delete' : 'Soft Delete');

  const canApply = isAdmin || hasPermission('CompOff.Apply');
  const canEdit = isAdmin || hasPermission('CompOff.Edit');
  const canApprove = isAdmin || hasPermission('CompOff.Approve');
  const canDelete = isAdmin || hasPermission('CompOff.Delete');
  const canBulkDelete = isAdmin || (canDelete && (deleteScope === 'Bulk Delete' || deleteScope === 'Permanent Delete' || deleteScope === 'All'));
  const canPermanentDelete = isAdmin || (canDelete && (deleteScope === 'Permanent Delete' || deleteScope === 'All'));

  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();
  const [requests, setRequests] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    archived: 0,
    totalDaysApproved: 0,
  });
  const [balanceInfo, setBalanceInfo] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
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

  // Modals & Panels
  const [applyPanelOpen, setApplyPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const [form, setForm] = useState({
    employeeId: user?.employeeId ? String(user.employeeId) : '',
    workedDate: new Date().toISOString().split('T')[0],
    shiftId: '',
    inTime: '',
    outTime: '',
    compOffDays: 1.0,
    reason: '',
  });

  const fetchCompOffData = async () => {
    try {
      setLoading(true);
      const [reqRes, statsRes, empRes, shiftsRes] = await Promise.all([
        apiClient.get('/compoff/requests', {
          params: {
            status: statusFilter !== 'all' ? statusFilter : undefined,
            archiveFilter: archiveFilter,
            search: search || undefined,
            branchId: currentBranch?.id || undefined,
            page,
            pageSize,
          },
        }),
        apiClient.get('/compoff/statistics', {
          params: {
            branchId: currentBranch?.id || undefined,
          },
        }),
        apiClient.get('/compoff/employees', {
          params: {
            branchId: currentBranch?.id || undefined,
          },
        }),
        apiClient.get('/shifts', {
          params: {
            branchId: currentBranch?.id || undefined,
          },
        }),
      ]);

      const empList = Array.isArray(empRes.data)
        ? empRes.data
        : (Array.isArray(empRes.data?.items) ? empRes.data.items : []);
      const shiftList = Array.isArray(shiftsRes.data)
        ? shiftsRes.data
        : (Array.isArray(shiftsRes.data?.items) ? shiftsRes.data.items : []);

      setRequests(reqRes.data?.items || (Array.isArray(reqRes.data) ? reqRes.data : []));
      setTotalCount(reqRes.data?.totalCount || 0);
      setTotalPages(reqRes.data?.totalPages || 1);
      setStatistics(statsRes.data || {});
      setEmployees(empList);
      setShifts(shiftList);

      const activeEmpId = form.employeeId || (user?.employeeId ? String(user.employeeId) : '');
      if (activeEmpId) {
        try {
          const balRes = await apiClient.get(`/compoff/balances/${activeEmpId}`);
          setBalanceInfo(balRes.data);
        } catch {}
      }
    } catch (err: any) {
      showError('Failed to load comp-off data', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeChange = async (empIdStr: string) => {
    setForm((prev) => ({ ...prev, employeeId: empIdStr }));
    if (empIdStr) {
      try {
        const balRes = await apiClient.get(`/compoff/balances/${empIdStr}`);
        setBalanceInfo(balRes.data);
      } catch {}
    }
  };

  useEffect(() => {
    fetchCompOffData();
  }, [statusFilter, archiveFilter, search, currentOrganization?.id, currentBranch?.id, page, pageSize]);

  useEffect(() => {
    const handleReload = () => {
      setPage(1);
      fetchCompOffData();
    };

    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);
    window.addEventListener('hrdesk:permissions_changed', handleReload);

    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
      window.removeEventListener('hrdesk:permissions_changed', handleReload);
    };
  }, [statusFilter, search]);

  const handleExportCSV = () => {
    if (!requests.length) {
      showError('Export Empty', 'No comp-off requests to export.');
      return;
    }

    const headers = [
      { key: 'id', label: 'Request ID' },
      { key: 'employeeName', label: 'Employee Name' },
      { key: 'department', label: 'Department' },
      { key: 'workedDate', label: 'Worked Date' },
      { key: 'shiftName', label: 'Shift' },
      { key: 'inTime', label: 'In Time' },
      { key: 'outTime', label: 'Out Time' },
      { key: 'compOffDays', label: 'Comp-Off Days' },
      { key: 'status', label: 'Status' },
      { key: 'approvedBy', label: 'Approved By' },
      { key: 'reason', label: 'Reason/Remarks' },
    ];

    exportToCSV('Comp_Off_Requests', requests, headers);
    showSuccess('Export Complete', 'Comp-off requests exported to CSV.');
  };

  const handleOpenEdit = (req: any) => {
    setEditingId(req.id);
    setForm({
      employeeId: String(req.employeeId),
      workedDate: req.workedDate,
      shiftId: req.shiftId ? String(req.shiftId) : '',
      inTime: req.inTime || '',
      outTime: req.outTime || '',
      compOffDays: req.compOffDays || 1.0,
      reason: req.reason || '',
    });
    setApplyPanelOpen(true);
  };

  const handleOpenReject = (id: number) => {
    setRejectingId(id);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectingId) return;
    try {
      await apiClient.post(`/compoff/requests/${rejectingId}/reject`, { reason: rejectionReason });
      showSuccess('Rejected', 'Comp-Off request rejected.');
      setRejectModalOpen(false);
      fetchCompOffData();
    } catch (err: any) {
      showError('Rejection Failed', err.response?.data?.message || 'Failed to reject request');
    }
  };

  const handleOpenCancel = (id: number) => {
    setCancellingId(id);
    setCancellationReason('');
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingId) return;
    try {
      await apiClient.post(`/compoff/requests/${cancellingId}/cancel`, { reason: cancellationReason });
      showSuccess('Cancelled', 'Comp-Off request cancelled.');
      setCancelModalOpen(false);
      fetchCompOffData();
    } catch (err: any) {
      showError('Cancellation Failed', err.response?.data?.message || 'Failed to cancel request');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await apiClient.post(`/compoff/requests/${id}/approve`);
      showSuccess('Approved', 'Comp-Off approved and credited to balance.');
      fetchCompOffData();
    } catch (err: any) {
      showError('Approval Failed', err.response?.data?.message || 'Failed to approve comp-off');
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmpId = form.employeeId ? parseInt(form.employeeId) : (user?.employeeId || null);
    if (!targetEmpId) {
      showError('Validation', 'Please select an employee.');
      return;
    }

    try {
      setApplying(true);
      const payload = {
        employeeId: targetEmpId,
        workedDate: form.workedDate,
        shiftId: form.shiftId ? parseInt(form.shiftId) : null,
        inTime: form.inTime || null,
        outTime: form.outTime || null,
        compOffDays: form.compOffDays,
        reason: form.reason || null,
      };

      if (editingId) {
        await apiClient.put(`/compoff/requests/${editingId}`, payload);
        showSuccess('Updated', 'Comp-Off request updated successfully.');
      } else {
        await apiClient.post('/compoff/requests', payload);
        showSuccess('Submitted', 'Comp-Off credit request submitted for approval.');
      }

      setApplyPanelOpen(false);
      setEditingId(null);
      fetchCompOffData();
    } catch (err: any) {
      showError('Operation Failed', err.response?.data?.message || 'Failed to save comp-off request');
    } finally {
      setApplying(false);
    }
  };

  // Archive Actions Hook
  const compOffArchive = useArchiveActions({
    endpoint: '/compoff/requests',
    label: 'Comp-Off Request',
    onDone: fetchCompOffData,
    canPermanentDelete,
    canBulkDelete,
  });

  const customBulkActions = useMemo(() => {
    if (archiveFilter === 'archived') {
      return compOffArchive.bulkActions(true);
    }
    return [
      ...(canApprove
        ? [
            {
              label: 'Bulk Approve',
              icon: <CheckCheck size={13} />,
              variant: 'primary' as const,
              onClick: async (_keys: (string | number)[], selectedRows: any[], clear: () => void) => {
                const pendingRows = selectedRows.filter((r) => r.status === 'Pending' || r.status === 'Draft').map((r) => r.id);
                if (!pendingRows.length) {
                  showError('Selection Notice', 'Please select pending comp-off requests to approve.');
                  return;
                }
                try {
                  await apiClient.post('/compoff/requests/bulk-approve', { ids: pendingRows });
                  showSuccess('Bulk Approved', `Successfully approved ${pendingRows.length} comp-off request(s).`);
                  clear();
                  fetchCompOffData();
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
                const pendingRows = selectedRows.filter((r) => r.status === 'Pending' || r.status === 'Draft').map((r) => r.id);
                if (!pendingRows.length) {
                  showError('Selection Notice', 'Please select pending comp-off requests to reject.');
                  return;
                }
                try {
                  await apiClient.post('/compoff/requests/bulk-reject', { ids: pendingRows, reason: 'Bulk rejected by operator' });
                  showSuccess('Bulk Rejected', `Successfully rejected ${pendingRows.length} comp-off request(s).`);
                  clear();
                  fetchCompOffData();
                } catch (err: any) {
                  showError('Bulk Rejection Failed', err.response?.data?.message || 'Server error');
                }
              },
            },
          ]
        : []),
      ...compOffArchive.bulkActions(false),
    ];
  }, [archiveFilter, compOffArchive, canApprove, showError, showSuccess]);

  return (
    <PageContainer>
      <PageHeader
        title="Comp-Off Management"
        description="Manage compensatory off duty credits, weekend work balances, and overtime grant requests"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-[var(--surface)] border border-[var(--rule)] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)] mb-1">
            <span>Total Requests</span>
            <Gift className="w-4 h-4 text-[var(--gold-500)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--ink)] font-mono">{statistics.total || 0}</div>
          <div className="text-[11px] text-[var(--ink-muted)] mt-1">Across active scopes</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--surface)] border border-[var(--rule)] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)] mb-1">
            <span>Pending Approvals</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
            {statistics.pending || 0}
          </div>
          <div className="text-[11px] text-[var(--ink-muted)] mt-1">Awaiting manager review</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--surface)] border border-[var(--rule)] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)] mb-1">
            <span>Approved Grants</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {statistics.approved || 0}
          </div>
          <div className="text-[11px] text-[var(--ink-muted)] mt-1">{statistics.totalDaysApproved || 0} days credited</div>
        </div>

        <div className="p-4 rounded-lg bg-[var(--surface)] border border-[var(--rule)] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)] mb-1">
            <span>{user?.employeeName ? 'Your Balance' : 'Rejected'}</span>
            <Sparkles className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono">
            {balanceInfo ? balanceInfo.balance : statistics.rejected || 0}
          </div>
          <div className="text-[11px] text-[var(--ink-muted)] mt-1">
            {balanceInfo ? `${balanceInfo.pendingDays || 0} days pending` : 'Rejected requests'}
          </div>
        </div>
      </div>

      {/* DataToolbar */}
      <DataToolbar
        searchValue={search}
        onSearchChange={(val: string) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Search comp-off by employee name, reason..."
        archiveFilter={{
          value: archiveFilter,
          onChange: (v: ArchiveFilterValue) => {
            setArchiveFilter(v);
            setPage(1);
            setSelectedIds([]);
          },
        }}
        filters={[
          {
            id: 'status',
            value: statusFilter,
            onChange: (val: string) => {
              setStatusFilter(val);
              setPage(1);
              setSelectedIds([]);
            },
            options: [
              { value: 'all', label: 'All Statuses' },
              { value: 'Pending', label: 'Pending Only' },
              { value: 'Approved', label: 'Approved Only' },
              { value: 'Rejected', label: 'Rejected Only' },
              { value: 'Cancelled', label: 'Cancelled Only' },
            ],
          },
        ]}
        onExport={handleExportCSV}
        exportLabel="Export CSV"
        primaryAction={
          canApply
            ? {
                label: 'Request Comp-Off',
                icon: <Plus size={14} />,
                onClick: () => {
                  setEditingId(null);
                  setForm({
                    employeeId: (applyScope === 'Own' && user?.employeeId) ? String(user.employeeId) : (employees[0]?.employeeId ? String(employees[0].employeeId) : ''),
                    workedDate: new Date().toISOString().split('T')[0],
                    shiftId: '',
                    inTime: '',
                    outTime: '',
                    compOffDays: 1.0,
                    reason: '',
                  });
                  setApplyPanelOpen(true);
                },
              }
            : undefined
        }
      />

      {/* DataTable */}
      <DataTable
        data={requests}
        loading={loading}
        keyExtractor={(req) => req.id}
        emptyMessage="No comp-off requests found."
        columns={[
          {
            key: 'employee',
            header: 'Employee',
            render: (req) => (
              <div>
                <span className="font-semibold text-[var(--ink)] block">{req.employeeName}</span>
                <span className="text-[11px] text-[var(--ink-muted)]">
                  {req.department || 'General'} {req.branch ? `• ${req.branch}` : ''}
                </span>
              </div>
            ),
          },
          {
            key: 'workedDate',
            header: 'Worked Date',
            render: (req) => (
              <div className="flex items-center gap-1.5 text-xs text-[var(--ink)] font-mono">
                <Calendar className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                <span>{req.workedDate}</span>
              </div>
            ),
          },
          {
            key: 'timing',
            header: 'Timing / Shift',
            render: (req) => (
              <div className="text-xs">
                {req.inTime || req.outTime ? (
                  <div className="flex items-center gap-1 text-[var(--ink)] font-mono">
                    <Clock className="w-3 h-3 text-[var(--ink-muted)]" />
                    <span>{req.inTime || '--:--'} - {req.outTime || '--:--'}</span>
                    {req.workMinutes ? (
                      <span className="text-[10px] text-[var(--ink-muted)]">({Math.floor(req.workMinutes / 60)}h {req.workMinutes % 60}m)</span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-[var(--ink-muted)] text-[11px]">Manual Duty Credit</span>
                )}
                {req.shiftName && (
                  <div className="text-[10px] text-[var(--ink-muted)]">{req.shiftName}</div>
                )}
              </div>
            ),
          },
          {
            key: 'compOffDays',
            header: 'Credit Days',
            render: (req) => (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono ${
                req.compOffDays >= 1
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
              }`}>
                +{req.compOffDays} Day{req.compOffDays > 1 ? 's' : ''}
              </span>
            ),
          },
          {
            key: 'reason',
            header: 'Reason / Remarks',
            render: (req) => (
              <span className="text-xs text-[var(--ink-muted)] max-w-xs truncate block" title={req.reason || ''}>
                {req.reason || '-'}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (req) => {
              const isArchived = req.status === 'Archived' || req.status === 'Cancelled';
              const isPending = req.status === 'Pending' || req.status === 'Draft';
              const canApproveThis = canApprove && isPending && !isArchived && (approveScope !== 'Own' || req.employeeId === user?.employeeId);
              const canEditThis = canEdit && isPending && !isArchived && (editScope !== 'Own' || req.employeeId === user?.employeeId);
              const canCancelThis = isPending && !isArchived && (canApproveThis || canEditThis || req.employeeId === user?.employeeId);

              return (
                <StatusApprovalDropdown
                  row={req}
                  canApprove={canApproveThis}
                  canCancel={canCancelThis}
                  onApprove={handleApprove}
                  onReject={handleOpenReject}
                  onCancel={handleOpenCancel}
                />
              );
            },
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (req) => {
              const isArchived = req.status === 'Archived' || req.status === 'Cancelled';
              const isPending = req.status === 'Pending' || req.status === 'Draft';
              const canEditThis = canEdit && isPending && !isArchived && (editScope !== 'Own' || req.employeeId === user?.employeeId);

              return canDelete || canEditThis ? (
                <RowActionMenu
                  actions={[
                    ...(canEditThis
                      ? [{ label: 'Edit', icon: <Pencil size={14} />, onClick: () => handleOpenEdit(req) }]
                      : []),
                    ...(canDelete
                      ? compOffArchive.rowActions({
                          id: req.id,
                          name: `Comp-Off Request #${req.id} (${req.employeeName})`,
                          isArchived: isArchived || isRowArchived(req),
                        })
                      : []),
                  ]}
                />
              ) : (
                <span className="font-data text-xs text-[var(--ink-muted)]">
                  {req.approvedBy ? `by ${req.approvedBy}` : '—'}
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

      {/* Archive Dialog from Hook */}
      {compOffArchive.dialog}

      {/* ═══════════════════════════════════════════
          REQUEST / EDIT COMP-OFF SLIDE-IN PANEL (480px)
          ═══════════════════════════════════════════ */}
      {applyPanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-[var(--surface)] h-full p-6 shadow-2xl overflow-y-auto space-y-5 border-l border-[var(--rule)]">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[var(--gold-500)] font-data">
                  {editingId ? 'Edit Credit' : 'New Grant Request'}
                </span>
                <h3 className="font-display font-semibold text-lg text-[var(--ink)]">
                  {editingId ? 'Modify Comp-Off Request' : 'Compensatory Off Request'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setApplyPanelOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4 font-ui">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Employee *</label>
                <select
                  value={form.employeeId}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  disabled={!isAdmin && applyScope === 'Own'}
                  className={`w-full h-9 px-3 rounded-md border border-[var(--rule)] bg-[var(--paper)] text-xs text-[var(--ink)] focus:border-[var(--gold-500)] outline-hidden cursor-pointer ${
                    !isAdmin && applyScope === 'Own' ? 'opacity-70 cursor-not-allowed bg-gray-50 dark:bg-gray-900' : ''
                  }`}
                  required
                >
                  <option value="">Select Employee...</option>
                  {(Array.isArray(employees) ? employees : [])
                    .filter((emp: any) => (!applyScope || applyScope !== 'Own') || String(emp.employeeId || emp.id) === String(user?.employeeId))
                    .map((emp: any) => (
                      <option key={emp.employeeId || emp.id} value={String(emp.employeeId || emp.id)}>
                        {emp.employeeName || emp.name} {emp.departmentName ? `(${emp.departmentName})` : ''}
                      </option>
                    ))}
                </select>
                {balanceInfo && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                    Current Balance: {balanceInfo.balance} Day(s) • Pending: {balanceInfo.pendingDays || 0} Day(s)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Worked Date */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Worked Date *</label>
                  <input
                    type="date"
                    value={form.workedDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, workedDate: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-[var(--rule)] bg-[var(--paper)] text-xs text-[var(--ink)] focus:border-[var(--gold-500)] outline-hidden font-mono"
                    required
                  />
                </div>

                {/* Comp-Off Days */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Credit Amount *</label>
                  <select
                    value={form.compOffDays}
                    onChange={(e) => setForm((prev) => ({ ...prev, compOffDays: parseFloat(e.target.value) }))}
                    className="w-full h-9 px-3 rounded-md border border-[var(--rule)] bg-[var(--paper)] text-xs text-[var(--ink)] focus:border-[var(--gold-500)] outline-hidden"
                  >
                    <option value={1.0}>1.0 Full Day Credit</option>
                    <option value={0.5}>0.5 Half Day Credit</option>
                  </select>
                </div>
              </div>

              {/* Timing / Punches (Optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">In Time (Optional)</label>
                  <input
                    type="time"
                    value={form.inTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, inTime: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-[var(--rule)] bg-[var(--paper)] text-xs text-[var(--ink)] focus:border-[var(--gold-500)] outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Out Time (Optional)</label>
                  <input
                    type="time"
                    value={form.outTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, outTime: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-[var(--rule)] bg-[var(--paper)] text-xs text-[var(--ink)] focus:border-[var(--gold-500)] outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Shift (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Shift (Optional)</label>
                <select
                  value={form.shiftId}
                  onChange={(e) => setForm((prev) => ({ ...prev, shiftId: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border border-[var(--rule)] bg-[var(--paper)] text-xs text-[var(--ink)] focus:border-[var(--gold-500)] outline-hidden"
                >
                  <option value="">Default Shift</option>
                  {shifts.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.shiftName} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason / Remarks */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Duty Reason / Project Remarks *</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Explain why weekend or extra duty was performed..."
                  className="w-full h-20 p-2.5 rounded-md border border-[var(--rule)] bg-[var(--paper)] text-xs text-[var(--ink)] focus:border-[var(--gold-500)] outline-hidden resize-none"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setApplyPanelOpen(false)}
                  className="btn-outline text-xs py-1.5 px-3 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applying}
                  className="btn-primary text-xs py-1.5 px-4 cursor-pointer disabled:opacity-50"
                >
                  {applying ? 'Saving...' : editingId ? 'Update Request' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          REJECT REASON MODAL
          ═══════════════════════════════════════════ */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--rule)] bg-[var(--surface-secondary)]">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-500" />
                <h3 className="font-semibold text-sm text-[var(--ink)]">Reject Comp-Off Request</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Rejection Reason *</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide reason for rejecting this credit request..."
                  className="w-full h-24 p-2.5 rounded-md border border-[var(--rule)] bg-[var(--paper)] text-xs text-[var(--ink)] focus:border-rose-500 outline-hidden resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="btn-outline text-xs py-1.5 px-3 cursor-pointer"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-4 py-1.5 rounded-md text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-xs cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          CANCEL MODAL
          ═══════════════════════════════════════════ */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--rule)] bg-[var(--surface-secondary)]">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-sm text-[var(--ink)]">Cancel Comp-Off Request</h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-[var(--ink-muted)]">
                Are you sure you want to cancel this pending comp-off request?
              </p>
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Reason (Optional)</label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Reason for cancellation..."
                  className="w-full h-20 p-2.5 rounded-md border border-[var(--rule)] bg-[var(--paper)] text-xs text-[var(--ink)] focus:border-[var(--gold-500)] outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="btn-outline text-xs py-1.5 px-3 cursor-pointer"
                >
                  Keep Request
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  className="px-4 py-1.5 rounded-md text-xs font-semibold bg-gray-700 text-white hover:bg-gray-800 shadow-xs cursor-pointer"
                >
                  Cancel Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

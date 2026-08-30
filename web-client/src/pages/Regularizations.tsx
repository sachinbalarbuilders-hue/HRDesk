import React, { useEffect, useState, useMemo, useRef } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { DataTable } from '../components/ui/DataTable';
import { type ArchiveFilterValue } from '../components/ui/ArchiveToggle';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  Clock,
  Plus,
  Check,
  X,
  CheckCheck,
  XCircle,
  FileText,
  CalendarCheck,
  Building2,
  Info,
  Trash2,
  Archive,
  RotateCcw,
  Pencil,
  ChevronDown,
  Ban,
} from 'lucide-react';
import { RowActionMenu, type RowAction } from '../components/ui/RowActionMenu';
import { useArchiveActions, isRowArchived } from '../hooks/useArchiveActions';

interface RegularizationItem {
  id: number;
  employeeId: number;
  employeeName: string;
  departmentName: string;
  requestType: string;
  requestDate: string;
  punchTimeIn: string | null;
  punchTimeOut: string | null;
  waivePenalty: boolean;
  reason: string | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Archived' | 'Cancelled';
  approvedBy: string | null;
  approveDate: string | null;
  createdAt: string;
}

interface StatusApprovalDropdownProps {
  row: RegularizationItem;
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

export const Regularizations: React.FC = () => {
  const { hasPermission, isAdmin, getPermissionScope, user } = useAuth();
  const createScope = getPermissionScope('Attendance.Regularize');
  const editScope = getPermissionScope('Regularizations.Edit');
  const approveScope = getPermissionScope('Regularizations.Approve');
  const canApprove = isAdmin || hasPermission('Regularizations.Approve');
  const canEdit = isAdmin || hasPermission('Regularizations.Edit');
  const canCreate = isAdmin || hasPermission('Attendance.Regularize');
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();

  const [items, setItems] = useState<RegularizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [metrics, setMetrics] = useState({ pending: 0, approved: 0, rejected: 0, archived: 0, total: 0 });

  // Selected row IDs for batch actions
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  // Employee list for modal selection
  const [employees, setEmployees] = useState<Array<{ employeeId: number; employeeName: string }>>([]);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Apply Regularization Form State
  const [regForm, setRegForm] = useState({
    employeeId: 0,
    requestType: 'Missed Punch',
    requestDate: new Date().toISOString().split('T')[0],
    punchTarget: 'both' as 'in' | 'out' | 'both',
    punchTimeIn: '09:00',
    punchTimeOut: '18:00',
    waivePenalty: true,
    reason: '',
    document: null as File | null,
  });

  // Live Punch Preview State
  const [punchPreview, setPunchPreview] = useState<{
    existingInTime: string | null;
    existingOutTime: string | null;
    currentStatus: string;
    shift: { name: string; startTime: string; endTime: string } | null;
    nextApplicationNumber: string;
  } | null>(null);

  // 1. Fetch Regularizations Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/regularizations', {
        params: {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          archiveFilter: archiveFilter,
          search: search || undefined,
          branchId: currentBranch?.id || undefined,
          page,
          pageSize,
        },
      });
      setItems(res.data.items || []);
      setTotalCount(res.data.totalCount || 0);
      setTotalPages(res.data.totalPages || 1);
      if (res.data.metrics) {
        setMetrics(res.data.metrics);
      }
    } catch (err: any) {
      showError('Failed to fetch data', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Employee List for Dropdown
  const fetchEmployees = async () => {
    try {
      const res = await apiClient.get('/regularizations/employees', {
        params: { branchId: currentBranch?.id || undefined }
      });
      const list = (res.data || []).map((e: any) => ({
        employeeId: e.employeeId || e.id,
        employeeName: e.employeeName || e.name,
      }));
      setEmployees(list);
      if (createScope === 'Own' && user?.employeeId) {
        setRegForm(prev => ({ ...prev, employeeId: user.employeeId! }));
      } else if (list.length > 0 && regForm.employeeId === 0) {
        setRegForm(prev => ({ ...prev, employeeId: list[0].employeeId }));
      }
    } catch (e) {
      console.error('Failed to fetch employees dropdown', e);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [currentOrganization?.id, currentBranch?.id]);

  useEffect(() => {
    setSelectedIds([]);
    fetchData();
  }, [statusFilter, archiveFilter, search, currentOrganization?.id, currentBranch?.id, page, pageSize]);

  useEffect(() => {
    const handleReload = () => {
      setPage(1);
      fetchData();
      fetchEmployees();
    };

    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);

    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, [statusFilter, search]);

  // Fetch Live Punch Preview when employee or date changes in form
  useEffect(() => {
    if (regForm.employeeId > 0 && regForm.requestDate && createModalOpen) {
      apiClient
        .get('/regularizations/preview-punch', {
          params: { employeeId: regForm.employeeId, date: regForm.requestDate },
        })
        .then(res => {
          setPunchPreview(res.data);
          if (res.data.shift) {
            setRegForm(prev => ({
              ...prev,
              punchTimeIn: res.data.existingInTime || res.data.shift.startTime || '09:00',
              punchTimeOut: res.data.existingOutTime || res.data.shift.endTime || '18:00',
            }));
          }
        })
        .catch(() => setPunchPreview(null));
    }
  }, [regForm.employeeId, regForm.requestDate, createModalOpen]);

  // Actions
  const handleApprove = async (id: number) => {
    try {
      await apiClient.post(`/regularizations/${id}/approve`);
      showSuccess('Approved', 'Attendance regularization approved and attendance recalculated.');
      fetchData();
    } catch (err: any) {
      showError('Approval Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await apiClient.post(`/regularizations/${id}/cancel`);
      showSuccess('Cancelled', 'Regularization request cancelled.');
      fetchData();
    } catch (err: any) {
      showError('Cancellation Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleOpenReject = (id: number) => {
    setRejectTargetId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectTargetId) return;
    try {
      await apiClient.post(`/regularizations/${rejectTargetId}/reject`, { reason: rejectReason });
      showSuccess('Rejected', 'Regularization request marked as rejected.');
      setRejectModalOpen(false);
      setRejectTargetId(null);
      fetchData();
    } catch (err: any) {
      showError('Rejection Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedIds.length) return;
    try {
      await apiClient.post('/regularizations/bulk-approve', { ids: selectedIds });
      showSuccess('Bulk Approved', `Successfully approved ${selectedIds.length} requests.`);
      setSelectedIds([]);
      fetchData();
    } catch (err: any) {
      showError('Bulk Approval Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleBulkReject = async () => {
    if (!selectedIds.length) return;
    try {
      await apiClient.post('/regularizations/bulk-reject', { ids: selectedIds, reason: 'Bulk rejected by operator' });
      showSuccess('Bulk Rejected', `Successfully rejected ${selectedIds.length} requests.`);
      setSelectedIds([]);
      fetchData();
    } catch (err: any) {
      showError('Bulk Rejection Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleOpenEdit = (r: RegularizationItem) => {
    setEditingId(r.id);
    const inTime = r.punchTimeIn ? new Date(r.punchTimeIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '09:00';
    const outTime = r.punchTimeOut ? new Date(r.punchTimeOut).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '18:00';
    const punchTarget = (r.punchTimeIn && r.punchTimeOut) ? 'both' : r.punchTimeIn ? 'in' : r.punchTimeOut ? 'out' : 'both';
    const reqDate = r.requestDate ? r.requestDate.split('T')[0] : new Date().toISOString().split('T')[0];

    setRegForm({
      employeeId: r.employeeId,
      requestType: r.requestType || 'Missed Punch',
      requestDate: reqDate,
      punchTarget,
      punchTimeIn: inTime,
      punchTimeOut: outTime,
      waivePenalty: r.waivePenalty ?? true,
      reason: r.reason || '',
      document: null,
    });
    setCreateModalOpen(true);
  };

  const handleSubmitRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.employeeId) {
      showError('Validation Error', 'Please select an employee.');
      return;
    }
    try {
      setSubmitting(true);
      if (editingId) {
        await apiClient.put(`/regularizations/${editingId}`, {
          requestDate: regForm.requestDate,
          requestType: regForm.requestType,
          punchTarget: regForm.punchTarget,
          punchTimeIn: regForm.punchTimeIn,
          punchTimeOut: regForm.punchTimeOut,
          waivePenalty: regForm.waivePenalty,
          reason: regForm.reason,
        });
        showSuccess('Updated', 'Regularization request updated successfully.');
      } else {
        await apiClient.post('/regularizations', {
          employeeId: regForm.employeeId,
          requestType: regForm.requestType,
          waivePenalty: regForm.waivePenalty,
          reason: regForm.reason,
          items: [
            {
              requestDate: regForm.requestDate,
              punchTarget: regForm.punchTarget,
              punchTimeIn: regForm.punchTimeIn,
              punchTimeOut: regForm.punchTimeOut,
              reason: regForm.reason,
            },
          ],
        });
        showSuccess('Submitted', 'Regularization request created successfully.');
      }
      setCreateModalOpen(false);
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      showError(editingId ? 'Update Failed' : 'Submission Failed', err.response?.data?.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteScope = getPermissionScope('Regularizations.Delete') || (isAdmin ? 'Bulk Delete' : 'Soft Delete');
  const canDelete = isAdmin || hasPermission('Regularizations.Delete');
  const canBulkDelete = isAdmin || (canDelete && (deleteScope === 'Bulk Delete' || deleteScope === 'Permanent Delete' || deleteScope === 'All'));
  const canPermanentDelete = isAdmin || (canDelete && (deleteScope === 'Permanent Delete' || deleteScope === 'All'));

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const regularizationArchive = useArchiveActions({
    endpoint: '/regularizations',
    label: 'Regularization Request',
    onDone: fetchData,
    canPermanentDelete,
    canBulkDelete,
  });

  const handleExport = () => {
    if (!items.length) return showError('Empty', 'No records to export.');
    exportToCSV(
      'Attendance_Regularizations',
      items.map((r, idx) => ({
        'Sr.': idx + 1,
        'Employee Name': r.employeeName,
        Department: r.departmentName,
        'Request Date': r.requestDate,
        'Type': r.requestType,
        'Punch In': r.punchTimeIn ? new Date(r.punchTimeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        'Punch Out': r.punchTimeOut ? new Date(r.punchTimeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        Status: r.status,
        Reason: r.reason || '',
        'Approved By': r.approvedBy || '',
      }))
    );
  };

  const canManage = canApprove;

  const customBulkActions = useMemo(() => {
    if (archiveFilter === 'archived') {
      return regularizationArchive.bulkActions(true);
    }
    return [
      ...(canManage ? [
        {
          label: 'Bulk Approve',
          icon: <CheckCheck size={13} />,
          variant: 'primary' as const,
        onClick: async (_keys: (string | number)[], selectedRows: RegularizationItem[], clear: () => void) => {
          const pendingIds = selectedRows.filter((r) => r.status === 'Pending').map((r) => r.id);
          if (!pendingIds.length) {
            showError('Selection Notice', 'Please select pending requests to approve.');
            return;
          }
          try {
            await apiClient.post('/regularizations/bulk-approve', { ids: pendingIds });
            showSuccess('Bulk Approved', `Successfully approved ${pendingIds.length} request(s).`);
            clear();
            fetchData();
          } catch (err: any) {
            showError('Bulk Approval Failed', err.response?.data?.message || 'Server error');
          }
        },
      },
      {
        label: 'Bulk Reject',
        icon: <XCircle size={13} />,
        variant: 'danger' as const,
        onClick: async (_keys: (string | number)[], selectedRows: RegularizationItem[], clear: () => void) => {
          const pendingIds = selectedRows.filter((r) => r.status === 'Pending').map((r) => r.id);
          if (!pendingIds.length) {
            showError('Selection Notice', 'Please select pending requests to reject.');
            return;
          }
          try {
            await apiClient.post('/regularizations/bulk-reject', { ids: pendingIds, reason: 'Bulk rejected by operator' });
            showSuccess('Bulk Rejected', `Successfully rejected ${pendingIds.length} request(s).`);
            clear();
            fetchData();
          } catch (err: any) {
            showError('Bulk Rejection Failed', err.response?.data?.message || 'Server error');
          }
        },
      }
      ] : []),
      ...regularizationArchive.bulkActions(false),
    ];
  }, [archiveFilter, regularizationArchive, showError, showSuccess, canManage]);

  return (
    <PageContainer>
      <PageHeader title="Regularizations" description="Attendance correction requests" />

      {/* 3. Toolbar & Filters */}
      <DataToolbar
        searchPlaceholder="Search employee, application #, or reason..."
        searchValue={search}
        onSearchChange={setSearch}
        archiveFilter={{
          value: archiveFilter,
          onChange: (v) => { setArchiveFilter(v); setPage(1); setSelectedIds([]); },
        }}
        filters={[
          {
            id: 'status',
            ariaLabel: 'Status Filter',
            value: statusFilter,
            onChange: (v) => { setStatusFilter(v); setPage(1); setSelectedIds([]); },
            options: [
              { label: 'All Statuses', value: 'all' },
              { label: 'Pending Approval', value: 'Pending' },
              { label: 'Approved', value: 'Approved' },
              { label: 'Rejected', value: 'Rejected' },
            ],
          },
        ]}
        onExport={handleExport}
        onImport={canManage ? () => setImportModalOpen(true) : undefined}
        primaryAction={canCreate ? {
          label: 'Apply Regularization',
          icon: <Plus className="w-3.5 h-3.5" />,
          onClick: () => {
            setEditingId(null);
            const defaultEmpId = (createScope === 'Own' && user?.employeeId) ? user.employeeId : (employees[0]?.employeeId || 0);
            setRegForm({
              employeeId: defaultEmpId,
              requestType: 'Missed Punch',
              requestDate: new Date().toISOString().split('T')[0],
              punchTarget: 'both',
              punchTimeIn: '09:00',
              punchTimeOut: '18:00',
              waivePenalty: true,
              reason: '',
              document: null,
            });
            setCreateModalOpen(true);
          },
        } : undefined}
      />

      {/* 4. Ledger Table Section */}
      <DataTable
        data={items}
        loading={loading}
        keyExtractor={(r) => r.id}
        emptyMessage="No attendance regularization requests matching your filter criteria."
        columns={[
          {
            key: 'employee',
            header: 'Employee',
            render: (r) => (
              <div>
                <div className="font-semibold text-[var(--ink)]">{r.employeeName}</div>
                <div className="text-[11px] text-[var(--ink-muted)] flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3 h-3" />
                  <span>{r.departmentName}</span>
                </div>
              </div>
            ),
          },
          {
            key: 'requestDate',
            header: 'Request Date',
            render: (r) => (
              <div className="font-mono">
                <div className="font-medium text-[var(--ink)]">{r.requestDate}</div>
                <div className="text-[10px] text-[var(--ink-muted)]">
                  Filed: {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
            ),
          },
          {
            key: 'timings',
            header: 'Adjusted Timings',
            render: (r) => (
              <div className="font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--ink-muted)]">In:</span>
                  <span className="font-bold text-emerald-600">
                    {r.punchTimeIn
                      ? new Date(r.punchTimeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[var(--ink-muted)]">Out:</span>
                  <span className="font-bold text-indigo-600">
                    {r.punchTimeOut
                      ? new Date(r.punchTimeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                      : '—'}
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: 'requestType',
            header: 'Type & Penalty',
            render: (r) => <div className="font-medium text-[var(--ink)]">{r.requestType}</div>,
          },
          {
            key: 'reason',
            header: 'Reason',
            render: (r) => (
              <div className="max-w-[200px] truncate text-[var(--ink-muted)]" title={r.reason || ''}>
                {r.reason || '—'}
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => {
              const isArchived = r.status === 'Archived' || r.status === 'Cancelled';
              const isPending = r.status === 'Pending';
              const canEditThis = canEdit && isPending && !isArchived && (editScope !== 'Own' || r.employeeId === user?.employeeId);
              const canApproveThis = canApprove && isPending && !isArchived && (approveScope !== 'Own' || r.employeeId === user?.employeeId);
              const canCancelThis = isPending && !isArchived && (canApproveThis || canEditThis || r.employeeId === user?.employeeId);

              return (
                <StatusApprovalDropdown
                  row={r}
                  canApprove={canApproveThis}
                  canCancel={canCancelThis}
                  onApprove={handleApprove}
                  onReject={handleOpenReject}
                  onCancel={handleCancel}
                />
              );
            },
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (r) => {
              const isArchived = r.status === 'Archived' || r.status === 'Cancelled';
              const isPending = r.status === 'Pending';
              const canEditThis = canEdit && isPending && !isArchived && (editScope !== 'Own' || r.employeeId === user?.employeeId);

              return canDelete || canEditThis ? (
                <RowActionMenu
                  actions={[
                    ...(canEditThis
                      ? [{ label: 'Edit', icon: <Pencil className="w-4 h-4" />, onClick: () => handleOpenEdit(r) }]
                      : []),
                    ...(canDelete
                      ? regularizationArchive.rowActions({
                          id: r.id,
                          name: `Regularization #${r.id} (${r.employeeName})`,
                          isArchived: isArchived || isRowArchived(r),
                        })
                      : []),
                  ]}
                />
              ) : (
                <div className="text-[10px] text-[var(--ink-muted)] font-mono">
                  {r.approvedBy ? `by ${r.approvedBy}` : '—'}
                </div>
              );
            },
          },
        ]}
        selection={
          canManage || canBulkDelete
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
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
        }}
      />

      {/* ========================================================================= */}
      {/* 5. APPLY REGULARIZATION MODAL */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-[var(--surface)] h-full shadow-[var(--shadow-xl)] flex flex-col border-l border-[var(--border)] animate-slide-in-right">
            <div className="p-5 pb-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {editingId ? 'Edit Attendance Regularization' : 'Apply Attendance Regularization'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Correct missed punches, early exit, or late arrivals.</p>
              </div>
              <button
                onClick={() => { setCreateModalOpen(false); setEditingId(null); }}
                className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRegularization} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Employee Selection */}
              <div>
                <label className="block font-semibold text-[var(--ink)] mb-1">Select Employee *</label>
                <select
                className={`register-input w-full ${createScope === 'Own' || editingId !== null ? 'opacity-70 bg-gray-50 dark:bg-gray-900 cursor-not-allowed' : ''}`}
                value={regForm.employeeId}
                onChange={(e) => setRegForm({ ...regForm, employeeId: Number(e.target.value) })}
                required
                disabled={createScope === 'Own' || editingId !== null}
              >
                {(Array.isArray(employees) ? employees : [])
                  .filter(emp => createScope !== 'Own' || emp.employeeId === user?.employeeId)
                  .map(emp => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.employeeName}
                  </option>
                ))}
              </select>
              </div>

              {/* Date & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Date *</label>
                  <input
                    type="date"
                    value={regForm.requestDate}
                    onChange={(e) => setRegForm({ ...regForm, requestDate: e.target.value })}
                    className="register-input w-full font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Adjustment Type *</label>
                  <select
                    value={regForm.requestType}
                    onChange={(e) => setRegForm({ ...regForm, requestType: e.target.value })}
                    className="register-input w-full"
                  >
                    <option value="Missed Punch">Missed Punch</option>
                    <option value="Late Coming">Late Arrival</option>
                    <option value="Early Go">Early Departure</option>
                  </select>
                </div>
              </div>

              {/* Live Punch Information Box */}
              {punchPreview && (
                <div className="bg-[var(--surface-secondary)] border border-[var(--border)] p-3 rounded-[var(--radius-md)] text-[11px] space-y-1.5 font-data">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 font-semibold text-[var(--text-primary)]">
                      <Info className="w-3.5 h-3.5 text-[var(--accent)]" /> Recorded Status:
                    </span>
                    <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--surface)] font-bold text-[var(--accent)]">
                      {punchPreview.currentStatus}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--border)] text-[10px]">
                    <div>
                      Existing In: <span className="font-bold text-[var(--success)]">{punchPreview.existingInTime || 'No punch'}</span>
                    </div>
                    <div>
                      Existing Out: <span className="font-bold text-[var(--text-primary)]">{punchPreview.existingOutTime || 'No punch'}</span>
                    </div>
                  </div>
                  {punchPreview.shift && (
                    <div className="text-[10px] text-[var(--text-muted)]">
                      Assigned Shift: {punchPreview.shift.name} ({punchPreview.shift.startTime} - {punchPreview.shift.endTime})
                    </div>
                  )}
                </div>
              )}

              {/* Punch Target — only for Missed Punch */}
              {regForm.requestType === 'Missed Punch' && (
              <div>
                <label className="block font-semibold text-[var(--ink)] mb-1">Correction Target *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegForm({ ...regForm, punchTarget: 'in' })}
                    className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                      regForm.punchTarget === 'in'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-bold'
                        : 'border-[var(--rule)] text-[var(--ink-muted)] hover:bg-[var(--paper-subtle)]'
                    }`}
                  >
                    Punch In Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegForm({ ...regForm, punchTarget: 'out' })}
                    className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                      regForm.punchTarget === 'out'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-bold'
                        : 'border-[var(--rule)] text-[var(--ink-muted)] hover:bg-[var(--paper-subtle)]'
                    }`}
                  >
                    Punch Out Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegForm({ ...regForm, punchTarget: 'both' })}
                    className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all ${
                      regForm.punchTarget === 'both'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-bold'
                        : 'border-[var(--rule)] text-[var(--ink-muted)] hover:bg-[var(--paper-subtle)]'
                    }`}
                  >
                    Both (In & Out)
                  </button>
                </div>
              </div>
              )}

              {/* Time Inputs — only for Missed Punch */}
              {regForm.requestType === 'Missed Punch' && (
              <div className="grid grid-cols-2 gap-3">
                {(regForm.punchTarget === 'in' || regForm.punchTarget === 'both') && (
                  <div>
                    <label className="block font-semibold text-[var(--text-primary)] mb-1">Corrected In-Time *</label>
                    <input
                      type="time"
                      value={regForm.punchTimeIn}
                      onChange={(e) => setRegForm({ ...regForm, punchTimeIn: e.target.value })}
                      className="register-input w-full font-mono"
                      required
                    />
                  </div>
                )}
                {(regForm.punchTarget === 'out' || regForm.punchTarget === 'both') && (
                  <div>
                    <label className="block font-semibold text-[var(--text-primary)] mb-1">Corrected Out-Time *</label>
                    <input
                      type="time"
                      value={regForm.punchTimeOut}
                      onChange={(e) => setRegForm({ ...regForm, punchTimeOut: e.target.value })}
                      className="register-input w-full font-mono"
                      required
                    />
                  </div>
                )}
              </div>
              )}


              {/* Reason */}
              <div>
                <label className="block font-semibold text-[var(--ink)] mb-1">Reason / Explanation *</label>
                <textarea
                  value={regForm.reason}
                  onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
                  placeholder="Explain why the punch was missed or needs adjustment..."
                  rows={2}
                  className="register-input w-full"
                  required
                />
              </div>

              {/* Document Upload */}
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-1">Supporting Document</label>
                <div className="border border-dashed border-[var(--border)] rounded-[var(--radius-md)] p-4 text-center hover:border-[var(--accent)] hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setRegForm({ ...regForm, document: e.target.files?.[0] || null })}
                    className="hidden"
                    id="reg-doc-upload"
                  />
                  <label htmlFor="reg-doc-upload" className="cursor-pointer">
                    {regForm.document ? (
                      <div className="text-sm font-medium text-[var(--accent)]">{regForm.document.name}</div>
                    ) : (
                      <>
                        <div className="text-sm text-[var(--text-secondary)]">Click to upload proof</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">PDF, JPG, PNG, DOC (max 5MB)</div>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-2 border-t border-[var(--rule)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setCreateModalOpen(false); setEditingId(null); }}
                  className="btn-secondary py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-1.5 px-4 flex items-center gap-1.5"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Regularization' : 'Submit Regularization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. REJECT REASON MODAL */}
      {/* ========================================================================= */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl shadow-2xl max-w-sm w-full p-4 space-y-3">
            <h3 className="font-serif font-bold text-base text-rose-600 flex items-center gap-1.5">
              <XCircle className="w-5 h-5" /> Reject Application
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              Please specify the reason for rejecting this adjustment request.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Unverified biometric punch / Inadequate documentation..."
              rows={3}
              className="register-input w-full text-xs"
              required
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 px-3.5 rounded-lg text-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. BULK IMPORT MODAL */}
      {/* ========================================================================= */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Bulk Import Attendance Regularizations"
        templateFilename="Attendance_Regularizations"
        templateHeaders={[
          'EmployeeCode',
          'RequestDate',
          'RequestType',
          'PunchTimeIn',
          'PunchTimeOut',
          'WaivePenalty',
          'Reason',
        ]}
        templateSampleRow={[
          'EMP-001',
          '2026-08-10',
          'Missed Punch',
          '09:15',
          '18:30',
          'true',
          'Biometric reader offline',
        ]}
        onImportComplete={() => {
          showSuccess('Import Complete', 'Attendance regularizations imported successfully.');
          fetchData();
        }}
      />

      {/* Permanent-delete confirmation (only reachable from the Archive view) */}
      {regularizationArchive.dialog}
    </PageContainer>
  );
};

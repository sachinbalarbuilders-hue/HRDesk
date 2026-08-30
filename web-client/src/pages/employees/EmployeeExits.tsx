import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useArchiveActions, isRowArchived } from '../../hooks/useArchiveActions';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { DataToolbar } from '../../components/ui/DataToolbar';
import { InitiateExitModal } from '../../components/employees/InitiateExitModal';
import { ExitDetailsDrawer } from '../../components/employees/ExitDetailsDrawer';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import { AuthImage } from '../../components/ui/AuthImage';
import {
  UserMinus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  FileText,
  Plus,
  Eye,
  CheckSquare,
} from 'lucide-react';

export const EmployeeExits: React.FC = () => {
  const { hasPermission, isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [exits, setExits] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [exitTypeFilter, setExitTypeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [isArchivedView, setIsArchivedView] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);

  // Selection for bulk operations
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  // Metrics
  const [metrics, setMetrics] = useState({
    total: 0,
    pendingApproval: 0,
    inNoticePeriod: 0,
    clearancePending: 0,
    completedThisMonth: 0,
  });

  // Modal / Drawer states
  const [initiateModalOpen, setInitiateModalOpen] = useState(false);
  const [drawerExitId, setDrawerExitId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const canEdit = isAdmin || hasPermission('Employees.Edit');
  const canDelete = isAdmin || hasPermission('Employees.Delete');

  const archive = useArchiveActions({
    endpoint: '/employee-exits',
    onDone: () => {
      fetchExits();
      fetchMetrics();
    },
    label: 'Exit Record',
  });

  const fetchMetrics = async () => {
    try {
      const res = await apiClient.get('/employee-exits/overview');
      if (res.data) setMetrics(res.data);
    } catch {}
  };

  const fetchDepartments = async () => {
    try {
      const res = await apiClient.get('/masters/departments');
      const items = Array.isArray(res.data?.items) ? res.data.items : Array.isArray(res.data) ? res.data : [];
      setDepartments(items);
    } catch {}
  };

  const fetchExits = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/employee-exits', {
        params: {
          search: search || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          exitType: exitTypeFilter !== 'all' ? exitTypeFilter : undefined,
          departmentId: departmentFilter ? Number(departmentFilter) : undefined,
          archiveStatus: isArchivedView ? 'archived' : 'active',
          page,
          pageSize,
        },
      });

      setExits(res.data?.items || []);
      setTotalCount(res.data?.totalCount || 0);
      setTotalPages(res.data?.totalPages || 1);
    } catch {
      showError('Failed to load exits', 'Unable to retrieve exit records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchMetrics();
  }, []);

  useEffect(() => {
    fetchExits();
    setSelectedIds([]);
  }, [page, pageSize, search, statusFilter, exitTypeFilter, departmentFilter, isArchivedView]);

  const handleOpenDrawer = (exitId: number) => {
    setDrawerExitId(exitId);
    setDrawerOpen(true);
  };

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: 'sr',
        header: 'Sr.',
        className: 'w-10 text-center font-mono text-[11px] text-[var(--ink-muted)]',
        render: (_item: any, idx?: number) => (page - 1) * pageSize + (idx ?? 0) + 1,
      },
      {
        key: 'employee',
        header: 'Employee',
        className: 'min-w-[200px]',
        render: (item: any) => (
          <div className="flex items-center gap-2.5">
            <AuthImage
              src={item.photoPath ? `/Thumbnail?employeeId=${item.employeeId}` : ''}
              alt={item.employeeName}
              fallbackInitial={item.employeeName ? item.employeeName.charAt(0) : 'E'}
              className="w-10 h-10 rounded-full border border-[var(--rule)] object-cover shrink-0 text-xs shadow-2xs"
            />
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => handleOpenDrawer(item.id)}
                className="font-bold text-xs text-[var(--ink)] hover:text-[var(--gold-600)] transition-colors block truncate text-left cursor-pointer"
              >
                {item.employeeName}
              </button>
              <div className="text-[11px] text-[var(--ink-muted)] flex items-center gap-1.5 font-mono">
                <span>{item.employeeCode}</span>
                {item.department && <span>· {item.department}</span>}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'exitType',
        header: 'Exit Type',
        className: 'w-28 text-xs',
        render: (item: any) => (
          <span
            className={`font-semibold text-xs ${
              item.exitType === 'Termination'
                ? 'text-[var(--err-500)]'
                : item.exitType === 'Resignation'
                ? 'text-[var(--ink)]'
                : 'text-[var(--gold-600)]'
            }`}
          >
            {item.exitType}
          </span>
        ),
      },
      {
        key: 'dates',
        header: 'Notice & LWD',
        className: 'w-44 text-xs',
        render: (item: any) => (
          <div className="text-xs space-y-0.5">
            <div className="flex items-center gap-1 text-[var(--ink)] font-semibold">
              <Calendar size={11} className="text-[var(--gold-500)] shrink-0" />
              <span>LWD: {item.lastWorkingDate}</span>
            </div>
            <div className="text-[11px] text-[var(--ink-muted)]">
              Notice Date: {item.resignationDate}
            </div>
          </div>
        ),
      },
      {
        key: 'countdown',
        header: 'Countdown',
        className: 'w-28 text-center text-xs',
        render: (item: any) => {
          if (item.status === 'Completed') {
            return (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200">
                Relieved
              </span>
            );
          }
          if (item.remainingDays > 0) {
            return (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {item.remainingDays}d left
              </span>
            );
          }
          if (item.status === 'InNoticePeriod' || item.status === 'ClearancePending') {
            return (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200">
                LWD Due
              </span>
            );
          }
          return <span className="text-[11px] text-[var(--ink-muted)]">—</span>;
        },
      },
      {
        key: 'status',
        header: 'Status',
        className: 'w-32 text-center',
        render: (item: any) => {
          const statusMap: Record<string, { label: string; bg: string; dot: string }> = {
            Submitted: { label: 'Pending Approval', bg: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800', dot: 'bg-yellow-500' },
            InNoticePeriod: { label: 'In Notice', bg: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800', dot: 'bg-amber-500' },
            ClearancePending: { label: 'Clearance Due', bg: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800', dot: 'bg-blue-500' },
            Completed: { label: 'Completed', bg: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800', dot: 'bg-purple-500' },
            Rejected: { label: 'Rejected', bg: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800', dot: 'bg-red-500' },
            Withdrawn: { label: 'Withdrawn', bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', dot: 'bg-slate-400' },
          };
          const conf = statusMap[item.status] || { label: item.status, bg: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' };

          return (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${conf.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
              <span>{conf.label}</span>
            </span>
          );
        },
      },
      {
        key: 'documents',
        header: 'Documents',
        className: 'w-24 text-center',
        render: (item: any) => {
          const docCount = [item.hasResignationDoc, item.hasRelievingDoc, item.hasExperienceDoc, item.hasClearanceDoc].filter(Boolean).length;
          return docCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--gold-600)] font-bold">
              <FileText size={12} />
              <span>{docCount} files</span>
            </span>
          ) : (
            <span className="text-[11px] text-[var(--ink-muted)]">None</span>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-12 text-center',
        render: (item: any) => {
          const isArchived = isRowArchived(item);
          return (
            <RowActionMenu
              actions={[
                { label: 'View Dossier', icon: <Eye size={14} />, onClick: () => handleOpenDrawer(item.id) },
                ...(canEdit
                  ? archive.rowActions({
                      id: item.id,
                      name: item.employeeName,
                      isArchived,
                    })
                  : []),
              ] as RowAction[]}
            />
          );
        },
      },
    ],
    [page, pageSize, canEdit, canDelete, archive]
  );

  return (
    <div className="space-y-4">
      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="ledger-card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-[var(--ink-muted)] tracking-wider">In Notice Period</span>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{metrics.inNoticePeriod}</div>
          </div>
          <div className="w-9 h-9 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock size={18} />
          </div>
        </div>

        <div className="ledger-card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-[var(--ink-muted)] tracking-wider">Pending Approval</span>
            <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400 mt-0.5">{metrics.pendingApproval}</div>
          </div>
          <div className="w-9 h-9 rounded bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
            <AlertCircle size={18} />
          </div>
        </div>

        <div className="ledger-card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-[var(--ink-muted)] tracking-wider">Clearance Pending</span>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">{metrics.clearancePending}</div>
          </div>
          <div className="w-9 h-9 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <CheckSquare size={18} />
          </div>
        </div>

        <div className="ledger-card p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-[var(--ink-muted)] tracking-wider">Relieved This Month</span>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">{metrics.completedThisMonth}</div>
          </div>
          <div className="w-9 h-9 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <DataToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search exits by employee name, EMP ID, or reason..."
        archiveFilter={{
          value: isArchivedView ? 'archived' : 'active',
          onChange: (val) => setIsArchivedView(val === 'archived'),
        }}
        primaryAction={
          canEdit
            ? {
                label: 'Initiate Exit',
                icon: <Plus size={14} />,
                onClick: () => setInitiateModalOpen(true),
              }
            : undefined
        }
        filters={[
          {
            id: 'status',
            value: statusFilter,
            onChange: (val) => {
              setStatusFilter(val);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All Stages' },
              { value: 'Submitted', label: 'Pending Approval' },
              { value: 'InNoticePeriod', label: 'In Notice Period' },
              { value: 'ClearancePending', label: 'Clearance Due' },
              { value: 'Completed', label: 'Relieved / Completed' },
              { value: 'Rejected', label: 'Rejected' },
              { value: 'Withdrawn', label: 'Withdrawn' },
            ],
          },
          {
            id: 'exitType',
            value: exitTypeFilter,
            onChange: (val) => {
              setExitTypeFilter(val);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All Exit Types' },
              { value: 'Resignation', label: 'Resignation' },
              { value: 'Termination', label: 'Termination' },
              { value: 'ContractEnd', label: 'Contract Expiry' },
              { value: 'Retirement', label: 'Retirement' },
              { value: 'Absconding', label: 'Absconding' },
            ],
          },
          {
            id: 'department',
            value: departmentFilter,
            onChange: (val) => {
              setDepartmentFilter(val);
              setPage(1);
            },
            options: [
              { value: '', label: 'All Departments' },
              ...departments.map((d) => ({
                value: String(d.departmentId || d.id),
                label: d.departmentName || d.name,
              })),
            ],
          },
        ]}
      />

      {/* Main Table with Selection & Bulk Operations */}
      <DataTable
        data={exits}
        columns={columns}
        loading={loading}
        keyExtractor={(item) => item.id}
        selection={
          canEdit
            ? {
                selectedRowKeys: selectedIds,
                onChange: (keys) => setSelectedIds(keys),
                bulkActions: archive.bulkActions(isArchivedView),
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

      {/* Initiate Exit Modal */}
      {initiateModalOpen && (
        <InitiateExitModal
          isOpen={initiateModalOpen}
          onClose={() => setInitiateModalOpen(false)}
          onSuccess={() => {
            fetchExits();
            fetchMetrics();
          }}
        />
      )}

      {/* Exit Dossier & Relieve Drawer */}
      <ExitDetailsDrawer
        isOpen={drawerOpen}
        exitId={drawerExitId}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerExitId(null);
        }}
        onRefresh={() => {
          fetchExits();
          fetchMetrics();
        }}
        canEdit={canEdit}
      />

      {/* Confirm permanent delete dialog (from useArchiveActions) */}
      {archive.dialog}
    </div>
  );
};

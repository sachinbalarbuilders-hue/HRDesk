import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import { BulkImportModal } from '../components/ui/BulkImportModal';
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
} from 'lucide-react';

interface RegularizationItem {
  id: number;
  employeeId: number;
  employeeName: string;
  departmentName: string;
  applicationNumber: string;
  requestType: string;
  requestDate: string;
  punchTimeIn: string | null;
  punchTimeOut: string | null;
  waivePenalty: boolean;
  reason: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy: string | null;
  approveDate: string | null;
  createdAt: string;
}

export const Regularizations: React.FC = () => {
  const { hasPermission, isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();

  const [items, setItems] = useState<RegularizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [metrics, setMetrics] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });

  // Selected row IDs for batch actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Employee list for modal selection
  const [employees, setEmployees] = useState<Array<{ employeeId: number; employeeName: string }>>([]);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
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
          search: search || undefined,
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
      const res = await apiClient.get('/employees?pageSize=200');
      const list = (res.data.items || []).map((e: any) => ({
        employeeId: e.employeeId || e.id,
        employeeName: e.employeeName || e.name,
      }));
      setEmployees(list);
      if (list.length > 0 && regForm.employeeId === 0) {
        setRegForm(prev => ({ ...prev, employeeId: list[0].employeeId }));
      }
    } catch (e) {
      console.error('Failed to fetch employees dropdown', e);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
    fetchData();
  }, [statusFilter, search, page, pageSize]);

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

  const handleSubmitRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.employeeId) {
      showError('Validation Error', 'Please select an employee.');
      return;
    }
    try {
      setSubmitting(true);
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
      setCreateModalOpen(false);
      fetchData();
    } catch (err: any) {
      showError('Submission Failed', err.response?.data?.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    if (!items.length) return showError('Empty', 'No records to export.');
    exportToCSV(
      'Attendance_Regularizations',
      items.map(r => ({
        'App No': r.applicationNumber,
        'Employee Name': r.employeeName,
        Department: r.departmentName,
        'Request Date': r.requestDate,
        'Type': r.requestType,
        'Punch In': r.punchTimeIn ? new Date(r.punchTimeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        'Punch Out': r.punchTimeOut ? new Date(r.punchTimeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        'Waive Penalty': r.waivePenalty ? 'Yes' : 'No',
        Status: r.status,
        Reason: r.reason || '',
        'Approved By': r.approvedBy || '',
      }))
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.filter(i => i.status === 'Pending').map(i => i.id));
    }
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const canManage = isAdmin || hasPermission('Attendance.Regularize');

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="border-b border-[var(--rule)] pb-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono tracking-widest text-[var(--accent)] uppercase font-semibold">
            Time & Attendance Register
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          <span className="text-[11px] font-mono text-[var(--ink-muted)]">Official Punch Adjustments</span>
        </div>
        <h1 className="text-2xl font-serif font-bold tracking-tight text-[var(--ink)] mt-1">
          Attendance Regularization Register
        </h1>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Audit and rectify missed biometric punches, waive penalties, and update official muster rolls.
        </p>
      </div>

      {/* 2. Top Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-amber-500">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Pending Approvals</div>
            <div className="text-xl font-bold font-data text-[var(--ink)]">{metrics.pending}</div>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-emerald-500">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Approved Adjustments</div>
            <div className="text-xl font-bold font-data text-[var(--ink)]">{metrics.approved}</div>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-rose-500">
          <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Rejected Requests</div>
            <div className="text-xl font-bold font-data text-[var(--ink)]">{metrics.rejected}</div>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3 border-l-4 border-l-[var(--accent)]">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[var(--accent)] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Total Ledger Entries</div>
            <div className="text-xl font-bold font-data text-[var(--ink)]">{metrics.total}</div>
          </div>
        </div>
      </div>

      {/* 3. Toolbar & Filters */}
      <div className="space-y-3">
        <DataToolbar
          searchPlaceholder="Search employee, application #, or reason..."
          searchValue={search}
          onSearchChange={setSearch}
          filters={[
            {
              id: 'status',
              ariaLabel: 'Status Filter',
              value: statusFilter,
              onChange: (v) => { setStatusFilter(v); setPage(1); },
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
          importLabel="Bulk Import"
          primaryAction={{
            label: 'Apply Regularization',
            icon: <Plus className="w-3.5 h-3.5" />,
            onClick: () => setCreateModalOpen(true),
          }}
        />

        {/* Batch Action Bar */}
        {selectedIds.length > 0 && canManage && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-medium">
              <span className="font-bold font-data text-sm">{selectedIds.length}</span> request(s) selected for bulk review.
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkApprove}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 shadow-sm text-xs"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Bulk Approve</span>
              </button>
              <button
                onClick={handleBulkReject}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 shadow-sm text-xs"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Bulk Reject</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Ledger Table Section */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--ink-muted)]">
            <Clock className="w-8 h-8 mx-auto mb-2 text-[var(--ink-muted)] opacity-50" />
            <div className="font-semibold text-sm text-[var(--ink)]">No Regularization Records Found</div>
            <p className="mt-1">There are no attendance regularization requests matching your filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--rule)] bg-[var(--paper-subtle)] text-[var(--ink-muted)] font-mono text-[11px] uppercase tracking-wider">
                  {canManage && (
                    <th className="p-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === items.filter(i => i.status === 'Pending').length}
                        onChange={toggleSelectAll}
                        className="rounded border-[var(--rule)] cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="p-3.5 font-semibold">Application #</th>
                  <th className="p-3.5 font-semibold">Employee</th>
                  <th className="p-3.5 font-semibold">Request Date</th>
                  <th className="p-3.5 font-semibold">Adjusted Timings</th>
                  <th className="p-3.5 font-semibold">Type & Penalty</th>
                  <th className="p-3.5 font-semibold">Reason</th>
                  <th className="p-3.5 font-semibold">Status</th>
                  <th className="p-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {items.map((r) => {
                  const isSelected = selectedIds.includes(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-[var(--paper-subtle)] transition-colors ${
                        isSelected ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      {canManage && (
                        <td className="p-3.5 text-center">
                          {r.status === 'Pending' ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectId(r.id)}
                              className="rounded border-[var(--rule)] cursor-pointer"
                            />
                          ) : (
                            <span className="text-[var(--ink-muted)] opacity-30">•</span>
                          )}
                        </td>
                      )}

                      <td className="p-3.5 font-mono font-semibold text-[var(--accent)]">
                        {r.applicationNumber || `#REG-${r.id}`}
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-[var(--ink)]">{r.employeeName}</div>
                        <div className="text-[11px] text-[var(--ink-muted)] flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" />
                          <span>{r.departmentName}</span>
                        </div>
                      </td>

                      <td className="p-3.5 font-mono">
                        <div className="font-medium text-[var(--ink)]">{r.requestDate}</div>
                        <div className="text-[10px] text-[var(--ink-muted)]">
                          Filed: {new Date(r.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="p-3.5 font-mono text-[11px]">
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
                      </td>

                      <td className="p-3.5">
                        <div className="font-medium text-[var(--ink)]">{r.requestType}</div>
                        <div className="mt-1">
                          {r.waivePenalty ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              Waive LOP
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                              Apply Penalty
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 max-w-[200px] truncate text-[var(--ink-muted)]" title={r.reason || ''}>
                        {r.reason || '—'}
                      </td>

                      <td className="p-3.5">
                        {r.status === 'Pending' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending
                          </span>
                        )}
                        {r.status === 'Approved' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Approved
                          </span>
                        )}
                        {r.status === 'Rejected' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                            <X className="w-3 h-3 text-rose-600" />
                            Rejected
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        {r.status === 'Pending' && canManage ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(r.id)}
                              title="Approve Request"
                              className="p-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenReject(r.id)}
                              title="Reject Request"
                              className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-[10px] text-[var(--ink-muted)] font-mono">
                            {r.approvedBy ? `by ${r.approvedBy}` : '—'}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {!loading && totalCount > 0 && (
          <div className="border-t border-[var(--rule)] p-3">
            <PaginationToolbar
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. APPLY REGULARIZATION MODAL */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--paper-subtle)]">
              <div>
                <h3 className="font-serif font-bold text-base text-[var(--ink)]">Apply Attendance Regularization</h3>
                <p className="text-[11px] text-[var(--ink-muted)]">Correct missed punches, early exit, or late arrivals.</p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--ink-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRegularization} className="p-5 space-y-4 text-xs">
              {/* Employee Selection */}
              <div>
                <label className="block font-semibold text-[var(--ink)] mb-1">Select Employee *</label>
                <select
                  value={regForm.employeeId}
                  onChange={(e) => setRegForm({ ...regForm, employeeId: parseInt(e.target.value) || 0 })}
                  className="input-field w-full font-medium"
                  required
                >
                  {employees.map((e) => (
                    <option key={e.employeeId} value={e.employeeId}>
                      {e.employeeName} (#{e.employeeId})
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
                    className="input-field w-full font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Adjustment Type *</label>
                  <select
                    value={regForm.requestType}
                    onChange={(e) => setRegForm({ ...regForm, requestType: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="Missed Punch">Missed Punch</option>
                    <option value="Late Coming">Late Arrival</option>
                    <option value="Early Go">Early Departure</option>
                    <option value="On Duty (OD)">Official Duty (OD)</option>
                    <option value="Machine Issue">Biometric Glitch</option>
                  </select>
                </div>
              </div>

              {/* Live Punch Information Box */}
              {punchPreview && (
                <div className="bg-[var(--paper-subtle)] border border-[var(--rule)] p-3 rounded-lg text-[11px] space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-[var(--ink-muted)]">
                    <span className="flex items-center gap-1 font-semibold text-[var(--ink)]">
                      <Info className="w-3.5 h-3.5 text-[var(--accent)]" /> Recorded Status:
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[var(--paper)] font-bold text-[var(--accent)]">
                      {punchPreview.currentStatus}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--rule)] text-[10px]">
                    <div>
                      Existing In: <span className="font-bold text-emerald-600">{punchPreview.existingInTime || 'No punch'}</span>
                    </div>
                    <div>
                      Existing Out: <span className="font-bold text-indigo-600">{punchPreview.existingOutTime || 'No punch'}</span>
                    </div>
                  </div>
                  {punchPreview.shift && (
                    <div className="text-[10px] text-[var(--ink-muted)]">
                      Assigned Shift: {punchPreview.shift.name} ({punchPreview.shift.startTime} - {punchPreview.shift.endTime})
                    </div>
                  )}
                </div>
              )}

              {/* Punch Target */}
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

              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-3">
                {(regForm.punchTarget === 'in' || regForm.punchTarget === 'both') && (
                  <div>
                    <label className="block font-semibold text-emerald-600 mb-1">Corrected In-Time *</label>
                    <input
                      type="time"
                      value={regForm.punchTimeIn}
                      onChange={(e) => setRegForm({ ...regForm, punchTimeIn: e.target.value })}
                      className="input-field w-full font-mono"
                      required
                    />
                  </div>
                )}
                {(regForm.punchTarget === 'out' || regForm.punchTarget === 'both') && (
                  <div>
                    <label className="block font-semibold text-indigo-600 mb-1">Corrected Out-Time *</label>
                    <input
                      type="time"
                      value={regForm.punchTimeOut}
                      onChange={(e) => setRegForm({ ...regForm, punchTimeOut: e.target.value })}
                      className="input-field w-full font-mono"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Waive Penalty Toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={regForm.waivePenalty}
                  onChange={(e) => setRegForm({ ...regForm, waivePenalty: e.target.checked })}
                  className="rounded border-[var(--rule)] text-[var(--accent)]"
                />
                <span className="font-medium text-[var(--ink)]">Waive Loss-of-Pay (LOP) penalty for this adjustment</span>
              </label>

              {/* Reason */}
              <div>
                <label className="block font-semibold text-[var(--ink)] mb-1">Reason / Explanation *</label>
                <textarea
                  value={regForm.reason}
                  onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
                  placeholder="Explain why the punch was missed or needs adjustment..."
                  rows={2}
                  className="input-field w-full"
                  required
                />
              </div>

              {/* Buttons */}
              <div className="pt-2 border-t border-[var(--rule)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn-secondary py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-1.5 px-4 flex items-center gap-1.5"
                >
                  {submitting ? 'Saving...' : 'Submit Regularization'}
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
              className="input-field w-full text-xs"
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
    </div>
  );
};

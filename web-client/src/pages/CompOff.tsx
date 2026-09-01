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
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Ban,
  Gift,
  Clock,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  CalendarCheck,
  Info,
} from 'lucide-react';
import { RowActionMenu } from '../components/ui/RowActionMenu';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { useArchiveActions, isRowArchived } from '../hooks/useArchiveActions';

interface OffDayDatePickerProps {
  value: string; // "YYYY-MM-DD"
  eligibleDays: any[];
  onChange: (dateStr: string) => void;
  disabled?: boolean;
}

const OffDayDatePicker: React.FC<OffDayDatePickerProps> = ({
  value,
  eligibleDays,
  onChange,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value);
    if (eligibleDays.length > 0) return new Date(eligibleDays[0].date);
    return new Date();
  });

  useEffect(() => {
    if (value) {
      setViewDate(new Date(value));
    }
  }, [value]);

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

  const eligibleMap = useMemo(() => {
    const map = new Map<string, any>();
    eligibleDays.forEach((d) => map.set(d.date, d));
    return map;
  }, [eligibleDays]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: ({ dayNum: number; dateStr: string; isCurrentMonth: boolean; eligibleInfo?: any })[] = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNum: 0, dateStr: '', isCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const eligibleInfo = eligibleMap.get(dateStr);
      days.push({ dayNum: day, dateStr, isCurrentMonth: true, eligibleInfo });
    }

    return days;
  }, [year, month, eligibleMap]);

  const selectedInfo = eligibleMap.get(value);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="relative font-ui" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full h-9 px-3 rounded-md border border-[var(--rule)] bg-[var(--paper)] text-xs text-[var(--ink)] flex items-center justify-between transition-colors outline-hidden cursor-pointer hover:border-[var(--gold-500)] ${
          open ? 'border-[var(--gold-500)] ring-1 ring-[var(--gold-500)]/30' : ''
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-900' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar size={14} className="text-[var(--gold-500)] shrink-0" />
          {value ? (
            <span className="font-mono text-xs text-[var(--ink)] truncate">
              {selectedInfo ? (
                <>
                  <strong className="font-semibold">{selectedInfo.formattedDate}</strong> ({selectedInfo.dayName}) — {selectedInfo.offType}
                </>
              ) : (
                value
              )}
            </span>
          ) : (
            <span className="text-[var(--ink-muted)]">Select an off-day (Week-Off or Holiday)...</span>
          )}
        </div>
        <ChevronDown size={14} className={`text-[var(--ink-muted)] transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Calendar Popover */}
      {open && (
        <div className="absolute left-0 top-full mt-1 w-[320px] bg-[var(--surface)] border border-[var(--rule)] rounded-lg shadow-2xl z-50 p-3 animate-in fade-in zoom-in-95 duration-100">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[var(--rule)]">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-md hover:bg-[var(--surface-secondary)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold text-[var(--ink)] font-sans">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-md hover:bg-[var(--surface-secondary)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 mb-1 text-center">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, idx) => (
              <span key={d} className={`text-[10px] font-semibold ${idx === 0 || idx === 6 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--ink-muted)]'}`}>
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return <div key={`pad-${idx}`} className="h-8" />;
              }

              const isEligible = !!cell.eligibleInfo;
              const isSelected = cell.dateStr === value;
              const hasPunches = cell.eligibleInfo?.hasAttendanceRecord;
              const isHoliday = cell.eligibleInfo?.isHoliday;

              if (!isEligible) {
                return (
                  <div
                    key={cell.dateStr}
                    title="Regular working day (Only declared Week-Offs & Holidays are eligible)"
                    className="h-8 flex items-center justify-center text-[11px] font-mono text-gray-300 dark:text-gray-700 select-none cursor-not-allowed rounded"
                  >
                    {cell.dayNum}
                  </div>
                );
              }

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => {
                    onChange(cell.dateStr);
                    setOpen(false);
                  }}
                  title={`${cell.eligibleInfo.offType} ${hasPunches ? `• In: ${cell.eligibleInfo.inTime} | Out: ${cell.eligibleInfo.outTime}` : '• Off-Day'}`}
                  className={`h-8 flex flex-col items-center justify-center text-[11px] font-mono rounded relative transition-all cursor-pointer font-medium ${
                    isSelected
                      ? 'bg-[var(--gold-500)] text-white font-bold shadow-xs'
                      : isHoliday
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
                  }`}
                >
                  <span>{cell.dayNum}</span>
                  {/* Indicator Dot */}
                  <span
                    className={`w-1 h-1 rounded-full ${
                      isSelected
                        ? 'bg-white'
                        : hasPunches
                        ? 'bg-emerald-500'
                        : isHoliday
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 pt-2 border-t border-[var(--rule)] grid grid-cols-2 gap-1 text-[10px] text-[var(--ink-muted)]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>With Attendance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Public Holiday</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Weekly Off</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-700" />
              <span>Regular Work Day</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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

  const isArchived = isRowArchived(row);
  if (isArchived) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
        <Ban size={12} />
        {row.status || 'Archived'}
      </span>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60';
      case 'Rejected':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60';
      case 'Cancelled':
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-emerald-500';
      case 'Rejected':
        return 'bg-rose-500';
      case 'Cancelled':
        return 'bg-gray-400';
      default:
        return 'bg-amber-500';
    }
  };

  const status = row.status || 'Pending';
  const isPending = status === 'Pending' || status === 'Draft';

  if (!canApprove && !canCancel) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${getStatusBadge(status)}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(status)}`} />
        {status}
      </span>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${getStatusBadge(
          status
        )} hover:opacity-90`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(status)}`} />
        <span>{status}</span>
        <ChevronDown size={13} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 rounded-md bg-[var(--surface)] border border-[var(--rule)] shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100 font-ui">
          {isPending && canApprove && (
            <>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onApprove(row.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer font-medium"
              >
                <Check size={14} />
                Approve & Credit
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onReject(row.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer font-medium"
              >
                <XCircle size={14} />
                Reject Request
              </button>
            </>
          )}

          {canCancel && (status === 'Pending' || status === 'Approved') && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCancel(row.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer font-medium border-t border-[var(--rule)]"
            >
              <Ban size={14} />
              Cancel Request
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const CompOff: React.FC = () => {
  const { user, isAdmin, hasPermission, getPermissionScope } = useAuth();
  const applyScope = getPermissionScope('CompOff.Apply');
  const deleteScope = getPermissionScope('CompOff.Delete');
  const canApply = isAdmin || hasPermission('CompOff.Apply');
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

  // Strict Biometric Off-Day Selection State
  const [eligibleWorkedDays, setEligibleWorkedDays] = useState<any[]>([]);
  const [loadingEligibleDays, setLoadingEligibleDays] = useState(false);
  const [selectedWorkedDay, setSelectedWorkedDay] = useState<any | null>(null);

  const [form, setForm] = useState({
    employeeId: user?.employeeId ? String(user.employeeId) : '',
    workedDate: '',
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

  const fetchEligibleWorkedDays = async (empIdStr: string) => {
    if (!empIdStr) {
      setEligibleWorkedDays([]);
      setSelectedWorkedDay(null);
      return;
    }
    try {
      setLoadingEligibleDays(true);
      const res = await apiClient.get('/compoff/eligible-worked-days', {
        params: { employeeId: empIdStr },
      });
      const days = Array.isArray(res.data) ? res.data : [];
      setEligibleWorkedDays(days);

      if (days.length > 0) {
        const defaultDay = days[0];
        setSelectedWorkedDay(defaultDay);
        setForm((prev) => ({
          ...prev,
          employeeId: empIdStr,
          workedDate: defaultDay.date,
          inTime: defaultDay.inTime || '',
          outTime: defaultDay.outTime || '',
          shiftId: defaultDay.shiftId ? String(defaultDay.shiftId) : '',
          compOffDays: defaultDay.suggestedCredit || 1.0,
        }));
      } else {
        setSelectedWorkedDay(null);
        setForm((prev) => ({
          ...prev,
          employeeId: empIdStr,
          workedDate: '',
          inTime: '',
          outTime: '',
          shiftId: '',
          compOffDays: 1.0,
        }));
      }
    } catch {
      setEligibleWorkedDays([]);
      setSelectedWorkedDay(null);
    } finally {
      setLoadingEligibleDays(false);
    }
  };

  const handleEmployeeChange = async (empIdStr: string) => {
    setForm((prev) => ({ ...prev, employeeId: empIdStr }));
    if (empIdStr) {
      try {
        const balRes = await apiClient.get(`/compoff/balances/${empIdStr}`);
        setBalanceInfo(balRes.data);
      } catch {}
      await fetchEligibleWorkedDays(empIdStr);
    } else {
      setEligibleWorkedDays([]);
      setSelectedWorkedDay(null);
    }
  };

  const handleWorkedDateChange = (dateVal: string) => {
    const matched = eligibleWorkedDays.find((d) => d.date === dateVal);
    if (matched) {
      setSelectedWorkedDay(matched);
      setForm((prev) => ({
        ...prev,
        workedDate: matched.date,
        inTime: matched.inTime || '',
        outTime: matched.outTime || '',
        shiftId: matched.shiftId ? String(matched.shiftId) : '',
        compOffDays: matched.suggestedCredit || 1.0,
      }));
    } else {
      setSelectedWorkedDay(null);
      setForm((prev) => ({ ...prev, workedDate: dateVal }));
    }
  };

  const handleOpenApply = (empId?: string) => {
    const targetEmp = empId || form.employeeId || (user?.employeeId ? String(user.employeeId) : (employees[0]?.employeeId ? String(employees[0].employeeId) : ''));
    setEditingId(null);
    setForm({
      employeeId: targetEmp,
      workedDate: '',
      shiftId: '',
      inTime: '',
      outTime: '',
      compOffDays: 1.0,
      reason: '',
    });
    setApplyPanelOpen(true);
    if (targetEmp) {
      fetchEligibleWorkedDays(targetEmp);
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
            <span>{user?.employeeName ? 'Your Balance' : 'Active Balance'}</span>
            <Sparkles className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono">
            {balanceInfo ? balanceInfo.balance : statistics.rejected || 0}
          </div>
          <div className="text-[11px] text-[var(--ink-muted)] mt-1 flex items-center justify-between">
            <span>{balanceInfo ? `${balanceInfo.pendingDays || 0}d pending` : 'Rejected requests'}</span>
            {balanceInfo?.expiringSoonDays > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold" title="Expiring within 15 days">
                ⚠️ {balanceInfo.expiringSoonDays}d expiring soon
              </span>
            )}
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
                onClick: () => handleOpenApply(),
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
                {req.inTime && req.outTime ? (
                  <div className="flex items-center gap-1 font-mono text-[var(--ink)]">
                    <Clock size={12} className="text-emerald-500" />
                    <span>{req.inTime} - {req.outTime}</span>
                  </div>
                ) : (
                  <span className="text-[var(--ink-muted)] font-mono">--:--</span>
                )}
                <span className="text-[10px] text-[var(--ink-muted)] block">
                  {req.shiftName || 'Default Shift'} {req.workMinutes ? `(${Math.floor(req.workMinutes / 60)}h ${req.workMinutes % 60}m)` : ''}
                </span>
              </div>
            ),
          },
          {
            key: 'compOffDays',
            header: 'Credit Days',
            render: (req) => (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                +{req.compOffDays} {req.compOffDays === 1 ? 'Day' : 'Days'}
              </span>
            ),
          },
          {
            key: 'expiry',
            header: 'Validity / Expiry',
            render: (req) => {
              if (req.status !== 'Approved') {
                return <span className="text-[11px] text-[var(--ink-muted)]">—</span>;
              }
              if (req.isExpired) {
                return (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                    Expired ({req.formattedExpiryDate || req.expiryDate})
                  </span>
                );
              }
              if (req.daysToExpiry <= 15 && req.daysToExpiry >= 0) {
                return (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title={`Expires on ${req.formattedExpiryDate}`}>
                    Expiring in {req.daysToExpiry}d
                  </span>
                );
              }
              return (
                <span className="text-[11px] font-mono text-[var(--ink-muted)]">
                  Till {req.formattedExpiryDate || req.expiryDate}
                </span>
              );
            },
          },
          {
            key: 'reason',
            header: 'Reason / Remarks',
            render: (req) => (
              <div className="max-w-[220px] truncate text-xs text-[var(--ink)]" title={req.reason}>
                {req.reason || '—'}
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (req) => (
              <StatusApprovalDropdown
                row={req}
                canApprove={canApprove}
                canCancel={canApply}
                onApprove={handleApprove}
                onReject={handleOpenReject}
                onCancel={handleOpenCancel}
              />
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (req) => (
              <div className="flex items-center justify-end">
                <RowActionMenu
                  actions={[
                    ...(!isRowArchived(req) && (req.status === 'Pending' || req.status === 'Draft')
                      ? [
                          {
                            label: 'Edit Request',
                            icon: <Pencil size={14} />,
                            onClick: () => handleOpenEdit(req),
                          },
                        ]
                      : []),
                    ...compOffArchive.rowActions(req),
                  ]}
                />
              </div>
            ),
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
      />

      {/* Pagination Toolbar */}
      <div className="mt-4">
        <PaginationToolbar
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(newSize: number) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════
          REQUEST / EDIT COMP-OFF SLIDE-IN PANEL (500px)
          ═══════════════════════════════════════════ */}
      {applyPanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[500px] bg-[var(--surface)] h-full p-6 shadow-2xl overflow-y-auto space-y-5 border-l border-[var(--rule)]">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[var(--gold-500)] font-data">
                  {editingId ? 'Edit Credit' : 'Off-Day Duty Claim'}
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

              {/* Strict Worked Off-Day Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[var(--ink)]">
                    Worked Off-Day (Week-Off or Holiday) *
                  </label>
                  {loadingEligibleDays && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono animate-pulse">
                      Loading off-days...
                    </span>
                  )}
                </div>

                {editingId ? (
                  /* Edit Mode: Fixed date input */
                  <input
                    type="date"
                    value={form.workedDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, workedDate: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-[var(--rule)] bg-[var(--paper)] text-xs text-[var(--ink)] focus:border-[var(--gold-500)] outline-hidden font-mono"
                    required
                  />
                ) : loadingEligibleDays ? (
                  <div className="h-9 px-3 rounded-md border border-[var(--rule)] bg-gray-50 dark:bg-gray-900 flex items-center text-xs text-[var(--ink-muted)]">
                    Loading declared off-days and attendance records...
                  </div>
                ) : eligibleWorkedDays.length > 0 ? (
                  <OffDayDatePicker
                    value={form.workedDate}
                    eligibleDays={eligibleWorkedDays}
                    onChange={handleWorkedDateChange}
                  />
                ) : (
                  <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertCircle size={14} className="text-amber-600 dark:text-amber-400" />
                      <span>No Uncredited Off-Days Found</span>
                    </div>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                      Comp-Off can only be claimed for declared <strong>Week-Offs</strong> or <strong>Public Holidays</strong> within the last 90 days.
                    </p>
                  </div>
                )}
              </div>

              {/* Verified Attendance Details Card */}
              {selectedWorkedDay && (
                <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--surface-secondary)] space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-[var(--rule)]">
                    <span className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
                      <CalendarCheck size={14} className="text-emerald-500" />
                      {selectedWorkedDay.formattedDate} ({selectedWorkedDay.dayName})
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                      {selectedWorkedDay.offType}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-[var(--paper)] border border-[var(--rule)]">
                      <span className="text-[10px] text-[var(--ink-muted)] block font-ui">In-Time</span>
                      <span className="text-[var(--ink)] font-semibold">{selectedWorkedDay.inTime || '--:--'}</span>
                    </div>
                    <div className="p-2 rounded bg-[var(--paper)] border border-[var(--rule)]">
                      <span className="text-[10px] text-[var(--ink-muted)] block font-ui">Out-Time</span>
                      <span className="text-[var(--ink)] font-semibold">{selectedWorkedDay.outTime || '--:--'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--ink-muted)] pt-1">
                    <span>Shift: <strong className="text-[var(--ink)]">{selectedWorkedDay.shiftName}</strong></span>
                    <span>Total Worked: <strong className="text-[var(--ink)] font-mono">{selectedWorkedDay.workedHoursText}</strong></span>
                  </div>

                  <div className="text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded border border-blue-200 dark:border-blue-900/40 flex items-center gap-1.5 font-ui">
                    <Sparkles size={13} className="shrink-0 text-blue-500" />
                    <span>
                      {selectedWorkedDay.hasAttendanceRecord
                        ? <>Auto-calculated credit: <strong>{selectedWorkedDay.suggestedCreditLabel}</strong> (based on shift half-time threshold)</>
                        : <>Default credit: <strong>{selectedWorkedDay.suggestedCreditLabel}</strong></>}
                    </span>
                  </div>
                </div>
              )}

              {/* Credit Amount (Auto-filled + Overridable by Manager/HOD) */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Credit Amount * <span className="font-normal text-[var(--ink-muted)]">(Pre-calculated, overridable)</span>
                </label>
                <select
                  value={form.compOffDays}
                  onChange={(e) => setForm((prev) => ({ ...prev, compOffDays: parseFloat(e.target.value) }))}
                  className="w-full h-9 px-3 rounded-md border border-[var(--rule)] bg-[var(--paper)] text-xs text-[var(--ink)] focus:border-[var(--gold-500)] outline-hidden cursor-pointer"
                  required
                >
                  <option value={1.0}>1.0 Full Day Credit</option>
                  <option value={0.5}>0.5 Half Day Credit</option>
                </select>
                <p className="text-[10px] text-[var(--ink-muted)] mt-1">
                  Suggested from shift half-time calculation. HOD / Admin can adjust the credit value before approval.
                </p>
              </div>

              {/* Duty Reason / Remarks */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Duty Reason / Project Remarks *</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Explain why weekend or extra holiday duty was performed..."
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
                  disabled={applying || (!editingId && eligibleWorkedDays.length === 0)}
                  className="btn-primary text-xs py-1.5 px-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

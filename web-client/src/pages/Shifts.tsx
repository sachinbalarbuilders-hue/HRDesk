import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { EmployeeMultiSelect } from '../components/ui/EmployeeMultiSelect';
import { useAuth } from '../context/AuthContext';
import { useArchiveActions, isRowArchived } from '../hooks/useArchiveActions';
import { type ArchiveFilterValue } from '../components/ui/ArchiveToggle';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Building2,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  User,
  Check,
  Layers,
  Trash2,
  RotateCcw,
} from 'lucide-react';

interface EmployeeShift {
  employeeId: number;
  employeeName: string;
  department: string;
  designation: string;
  schedule: Record<string, string>; // '0'..'6' -> shiftCode
}

interface ShiftMaster {
  id: number;
  shiftName: string;
  shiftCode: string;
  startTime: string;
  endTime: string;
  lateComingGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  colorCode: string;
  halfTime?: string;
}

export const Shifts: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();
  const { user, isAdmin, hasPermission, getPermissionScope } = useAuth();

  const canViewRoster = isAdmin || hasPermission('Shifts.Roster.View') || hasPermission('Attendance.Roster') || hasPermission('Shifts.View') || hasPermission('Shifts.Manage');
  const canAssignRoster = isAdmin || hasPermission('Shifts.Roster.Assign') || hasPermission('Attendance.Roster') || hasPermission('Shifts.Manage');
  const canViewRequests = isAdmin || hasPermission('Shifts.Requests.View') || hasPermission('Shifts.Manage');
  const canApplyRequest = isAdmin || hasPermission('Shifts.Requests.Apply') || hasPermission('Shifts.Manage');
  const canApproveRequest = isAdmin || hasPermission('Shifts.Requests.Approve') || hasPermission('Shifts.Manage');
  const applyScope = getPermissionScope('Shifts.Requests.Apply');
  const isOwnOnlyApply = !isAdmin && (applyScope === 'Own' || (!applyScope && !hasPermission('Shifts.Manage')));

  const [shifts, setShifts] = useState<ShiftMaster[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [useCycle, setUseCycle] = useState(false);
  const [cycleForm, setCycleForm] = useState({
    cycleId: 0,
    cycleStartDate: new Date().toISOString().split('T')[0],
    generateUntil: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0],
    overwrite: true,
  });
  const [roster, setRoster] = useState<EmployeeShift[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Array<{ employeeId: number; employeeName: string }>>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(d.setDate(diff));
  });

  // Modal States
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [empVisibleCount, setEmpVisibleCount] = useState(20);

  const [assignDeptFilter, setAssignDeptFilter] = useState<string>('');
  const [selectedEmployeesState, setSelectedEmployeesState] = useState<any[]>([]);
  const [assignForm, setAssignForm] = useState({
    employeeIds: [] as number[],
    shiftId: 1,
    isWeekOff: false,
    overwrite: true,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Shift Change Requests State
  const [activeMainTab, setActiveMainTab] = useState<'roster' | 'requests'>('roster');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const canDeleteRequest = isAdmin || hasPermission('Shifts.Requests.Delete') || hasPermission('Shifts.Manage');

  const requestsArchive = useArchiveActions({
    endpoint: '/shifts/requests',
    label: 'Shift Change Request',
    permissionKey: 'Shifts.Requests.Delete',
    onDone: () => fetchRequests(),
  });

  const [requests, setRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');
  const [requestSearch, setRequestSearch] = useState('');
  const [changeRequestModalOpen, setChangeRequestModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequestIdToReject, setSelectedRequestIdToReject] = useState<number | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [changeRequestForm, setChangeRequestForm] = useState({
    employeeId: 0,
    requestDate: new Date().toISOString().split('T')[0],
    currentShiftInfo: null as any,
    requestedShiftId: 1,
    isRequestedWeekOff: false,
    reason: '',
  });

  const [shiftForm, setShiftForm] = useState({
    shiftName: '',
    shiftCode: '',
    startTime: '09:00',
    endTime: '18:00',
    lateComingGraceMinutes: 15,
    earlyLeaveGraceMinutes: 15,
    halfTime: '13:30',
    colorCode: '#4e73df',
  });

  const fetchRequests = async () => {
    try {
      setRequestsLoading(true);
      const res = await apiClient.get('/shifts/requests', {
        params: {
          branchId: currentBranch?.id || undefined,
          status: requestStatusFilter !== 'all' ? requestStatusFilter : undefined,
          archived: archiveFilter === 'archived',
        }
      });
      setRequests(res.data || []);
    } catch (err) {
      console.error('Failed to load shift change requests', err);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'requests') {
      fetchRequests();
    }
  }, [activeMainTab, requestStatusFilter, archiveFilter, currentBranch?.id]);

  const lookupDateShift = async (empId: number, date: string) => {
    if (!empId || !date) return;
    try {
      const res = await apiClient.get('/shifts/roster/lookup-for-date', {
        params: { employeeId: empId, date }
      });
      setChangeRequestForm(prev => ({ ...prev, currentShiftInfo: res.data }));
    } catch {
      setChangeRequestForm(prev => ({ ...prev, currentShiftInfo: null }));
    }
  };

  const handleOpenChangeRequestModal = () => {
    let targetEmp = employees.length > 0 ? employees[0].employeeId : 0;
    if (isOwnOnlyApply && user?.employeeId) {
      targetEmp = Number(user.employeeId);
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const firstShift = shifts.length > 0 ? shifts[0].id : 1;
    setChangeRequestForm({
      employeeId: targetEmp,
      requestDate: todayStr,
      currentShiftInfo: null,
      requestedShiftId: firstShift,
      isRequestedWeekOff: false,
      reason: '',
    });
    if (targetEmp > 0) {
      lookupDateShift(targetEmp, todayStr);
    }
    setChangeRequestModalOpen(true);
  };

  const handleCreateChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeRequestForm.employeeId) {
      showError('Validation Error', 'Please select an employee.');
      return;
    }
    if (!changeRequestForm.isRequestedWeekOff && !changeRequestForm.requestedShiftId) {
      showError('Validation Error', 'Please select a requested shift.');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/shifts/requests', {
        employeeId: changeRequestForm.employeeId,
        requestDate: changeRequestForm.requestDate,
        requestedShiftId: changeRequestForm.isRequestedWeekOff ? null : changeRequestForm.requestedShiftId,
        isRequestedWeekOff: changeRequestForm.isRequestedWeekOff,
        reason: changeRequestForm.reason,
        branchId: currentBranch?.id ? parseInt(currentBranch.id) : undefined,
      });
      showSuccess('Request Submitted', 'Shift change request submitted successfully.');
      setChangeRequestModalOpen(false);
      fetchRequests();
      fetchRoster();
    } catch (err: any) {
      showError('Submission Failed', err.response?.data?.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveRequest = async (id: number) => {
    try {
      await apiClient.post(`/shifts/requests/${id}/approve`);
      showSuccess('Approved', 'Shift change request approved and roster updated.');
      fetchRequests();
      fetchRoster();
    } catch (err: any) {
      showError('Approval Failed', err.response?.data?.message || 'Could not approve request');
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedRequestIdToReject) return;
    try {
      setSubmitting(true);
      await apiClient.post(`/shifts/requests/${selectedRequestIdToReject}/reject`, {
        rejectionReason: rejectionReasonText
      });
      showSuccess('Rejected', 'Shift change request rejected.');
      setRejectModalOpen(false);
      setSelectedRequestIdToReject(null);
      setRejectionReasonText('');
      fetchRequests();
    } catch (err: any) {
      showError('Rejection Failed', err.response?.data?.message || 'Could not reject request');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [deptRes, empRes, shiftsRes, cyclesRes] = await Promise.all([
        apiClient.get('/masters', { params: { branchId: currentBranch?.id || undefined } }).catch(() => apiClient.get('/employees/lookups')),
        apiClient.get('/employees?pageSize=300', { params: { branchId: currentBranch?.id || undefined } }),
        apiClient.get('/shifts', { params: { branchId: currentBranch?.id || undefined } }),
        apiClient.get('/shifts/cycles', { params: { branchId: currentBranch?.id || undefined } }),
      ]);
      const rawDepts = deptRes.data?.departments || deptRes.data?.items || (Array.isArray(deptRes.data) ? deptRes.data : []);
      const normalizedDepts = rawDepts
        .filter((d: any) => !d.archivedAt && d.status !== 'Archived')
        .map((d: any) => ({
          id: d.departmentId ?? d.id ?? d.DepartmentId,
          name: d.departmentName ?? d.name ?? d.DepartmentName,
          branchId: d.branchId ?? d.BranchId ?? null,
        }));
      setDepartments(normalizedDepts);

      const rawEmps = empRes.data?.items || (Array.isArray(empRes.data) ? empRes.data : []);
      const emps = rawEmps.map((e: any) => ({
        employeeId: e.employeeId ?? e.id ?? e.EmployeeId,
        employeeName: e.employeeName ?? e.name ?? e.EmployeeName ?? `Employee #${e.employeeId || e.id}`,
        departmentId: e.departmentId ?? e.department?.id ?? e.deptId ?? e.DepartmentId,
        departmentName: e.departmentName ?? e.department?.departmentName ?? e.department?.name ?? e.DepartmentName,
      }));
      setEmployees(emps);

      const sList = shiftsRes.data || [];
      setShifts(sList);
      if (sList.length > 0) {
        setAssignForm(prev => ({ ...prev, shiftId: sList[0].id }));
      }
      const cList = cyclesRes.data || [];
      setCycles(cList);
      if (cList.length > 0) {
        setCycleForm(prev => ({ ...prev, cycleId: cList[0].id }));
      }
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  useEffect(() => {
    fetchLookups();
  }, [currentOrganization?.id, currentBranch?.id]);

  const weekStartStr = currentWeekStart.toISOString().split('T')[0];

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/shifts/roster', {
        params: {
          startDate: weekStartStr,
          branchId: currentBranch?.id || undefined,
          departmentId: departmentFilter ? parseInt(departmentFilter) : undefined,
          search: search || undefined,
          page,
          pageSize,
        },
      });
      setRoster(res.data.items || []);
      setTotalCount(res.data.totalCount || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err: any) {
      showError('Failed to fetch roster', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [weekStartStr, departmentFilter, search, currentOrganization?.id, currentBranch?.id, page, pageSize]);

  useEffect(() => {
    const handleReload = () => {
      setPage(1);
      fetchLookups();
      fetchRoster();
    };

    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);

    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, [weekStartStr, departmentFilter, search, currentOrganization?.id, currentBranch?.id]);

  // Helper: Get 7 days of the active week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const handlePrevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.employeeIds.length) {
      showError('Validation Error', 'Please select at least one employee.');
      return;
    }

    try {
      setSubmitting(true);

      if (useCycle) {
        if (!cycleForm.cycleId) {
          showError('Validation Error', 'Please select a shift cycle.');
          return;
        }
        await apiClient.post('/shifts/roster/generate-from-cycle', {
          employeeIds: assignForm.employeeIds,
          cycleId: cycleForm.cycleId,
          cycleStartDate: cycleForm.cycleStartDate,
          generateUntil: cycleForm.generateUntil,
          overwrite: cycleForm.overwrite,
          branchId: currentBranch?.id ? parseInt(currentBranch.id) : undefined,
        });
        showSuccess('Cycle Roster Generated', 'Rotation-based roster saved successfully.');
      } else {
        await apiClient.post('/shifts/roster/assign', {
          ...assignForm,
          branchId: currentBranch?.id ? parseInt(currentBranch.id) : undefined
        });
        showSuccess('Roster Assigned', 'Shift assignments saved to roster database.');
      }

      setAssignModalOpen(false);
      fetchRoster();
    } catch (err: any) {
      showError('Assignment Failed', err.response?.data?.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.shiftName) {
      showError('Validation Error', 'Shift name is required.');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/shifts', {
        ...shiftForm,
        branchId: currentBranch?.id ? parseInt(currentBranch.id) : undefined
      });
      showSuccess('Shift Created', `Shift master "${shiftForm.shiftName}" registered.`);
      setShiftModalOpen(false);
      fetchLookups();
    } catch (err: any) {
      showError('Failed to create shift', err.response?.data?.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    if (!roster.length) return showError('Empty', 'No roster records to export.');
    exportToCSV(
      `Weekly_Shift_Roster_${weekStartStr}`,
      roster.map(r => ({
        'Employee Name': r.employeeName,
        Department: r.department,
        Designation: r.designation,
        Mon: r.schedule['0'] || 'GEN',
        Tue: r.schedule['1'] || 'GEN',
        Wed: r.schedule['2'] || 'GEN',
        Thu: r.schedule['3'] || 'GEN',
        Fri: r.schedule['4'] || 'GEN',
        Sat: r.schedule['5'] || 'W/O',
        Sun: r.schedule['6'] || 'W/O',
      }))
    );
  };

  const filteredRequests = requests.filter(r => {
    if (requestStatusFilter !== 'all' && r.status?.toLowerCase() !== requestStatusFilter.toLowerCase()) return false;
    if (requestSearch) {
      const q = requestSearch.toLowerCase();
      return (
        r.employeeName?.toLowerCase().includes(q) ||
        r.employeeCode?.toLowerCase().includes(q) ||
        r.departmentName?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <PageContainer>
      <PageHeader title="Shift Management" description="Configure duty shifts, roster schedules, and employee shift requests" />

      {/* 1. Main Sub Tabs */}
      <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3 mb-6">
        <div className="flex items-center gap-1.5 bg-[var(--surface-sunken)] p-1 rounded-[var(--radius-md)] border border-[var(--rule)]">
          {canViewRoster && (
            <button
              type="button"
              onClick={() => setActiveMainTab('roster')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all cursor-pointer ${
                activeMainTab === 'roster'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs border border-[var(--rule)] font-bold'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Layers size={14} className={activeMainTab === 'roster' ? 'text-[var(--gold-500)]' : 'opacity-60'} />
              <span>Shift Roster Matrix</span>
            </button>
          )}

          {canViewRequests && (
            <button
              type="button"
              onClick={() => {
                setActiveMainTab('requests');
                fetchRequests();
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all cursor-pointer ${
                activeMainTab === 'requests'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs border border-[var(--rule)] font-bold'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Clock size={14} className={activeMainTab === 'requests' ? 'text-[var(--gold-500)]' : 'opacity-60'} />
              <span>Shift Change Requests</span>
              {requests.filter(r => r.status?.toLowerCase() === 'pending').length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-data font-bold animate-pulse">
                  {requests.filter(r => r.status?.toLowerCase() === 'pending').length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {activeMainTab === 'roster' ? (
        <>
          {/* 2. Unified Data Toolbar with Week Navigation */}
          <DataToolbar
            searchPlaceholder="Search employee name in roster..."
            searchValue={search}
            onSearchChange={setSearch}
            filters={[
              {
                id: 'department',
                ariaLabel: 'Department Filter',
                value: departmentFilter,
                onChange: (v) => { setDepartmentFilter(v); setPage(1); },
                options: [
                  { value: '', label: 'All Departments' },
                  ...departments
                    .filter((d: any) => !currentBranch?.id || d.branchId == null || String(d.branchId) === String(currentBranch.id))
                    .map((d: any) => ({ value: String(d.id), label: d.name })),
                ],
              },
            ]}
            onExport={handleExport}
            onImport={canAssignRoster ? () => setImportModalOpen(true) : undefined}
            primaryAction={
              canAssignRoster
                ? {
                    label: 'Assign Shifts / Week-Off',
                    icon: <Plus className="w-3.5 h-3.5" />,
                    onClick: () => {
                      setAssignDeptFilter('');
                      setSelectedEmployeesState([]);
                      setAssignForm(prev => ({ ...prev, employeeIds: [] }));
                      setAssignModalOpen(true);
                    },
                  }
                : undefined
            }
          >
            <div className="flex items-center gap-1.5 bg-[var(--paper)] border border-[var(--rule)] rounded-lg p-1">
              <button
                onClick={handlePrevWeek}
                className="p-1 rounded hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-serif font-bold text-xs px-2 text-[var(--ink)] whitespace-nowrap">
                {weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <button
                onClick={handleNextWeek}
                className="p-1 rounded hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors cursor-pointer"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </DataToolbar>

          {/* 3. Shifts Master Legend */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] p-3 rounded-lg bg-[var(--paper-subtle)] border border-[var(--rule)] mb-4">
            <span className="font-mono text-[var(--ink-muted)] uppercase tracking-wider font-semibold">Configured Shifts:</span>
            {shifts.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium border border-[var(--rule)] bg-[var(--paper)]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.colorCode || '#4e73df' }} />
                <span className="font-bold text-[var(--ink)]">{s.shiftCode}</span>
                <span className="text-[var(--ink-muted)] text-[10px]">({s.startTime}-{s.endTime})</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium border border-[var(--rule)] bg-[var(--paper)]">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="font-bold text-[var(--ink)]">W/O</span>
              <span className="text-[var(--ink-muted)] text-[10px]">(Weekly Off)</span>
            </span>
          </div>

          {/* 4. Roster Schedule Matrix Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-6">
                <TableSkeleton rows={8} />
              </div>
            ) : roster.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--ink-muted)]">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-[var(--ink-muted)] opacity-50" />
                <div className="font-semibold text-sm text-[var(--ink)]">No Shift Rosters Found</div>
                <p className="mt-1">No employee shift schedules found for this week.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                      <th className="p-3.5 font-semibold w-12 text-center">Sr.</th>
                      <th className="p-3.5 font-semibold min-w-[200px] text-left">Employee</th>
                      {weekDays.map((d, i) => {
                        const isToday = d.toDateString() === new Date().toDateString();
                        const isSunday = d.getDay() === 0;
                        return (
                          <th key={i} className={`p-3.5 text-center font-semibold ${isToday ? 'bg-[var(--accent-light)]' : ''} ${isSunday ? 'text-[var(--danger)]' : ''}`}>
                            <div>{d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</div>
                            <div className="text-[10px] font-data font-normal mt-0.5">{d.getDate()}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {roster.map((r, idx) => (
                      <tr key={r.employeeId} className="hover:bg-[var(--surface-hover)]">
                        <td className="p-3.5 font-mono text-center text-xs text-[var(--text-muted)] w-12">
                          {(page - 1) * pageSize + idx + 1}
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-sm text-[var(--text-primary)]">{r.employeeName}</div>
                          <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" />
                            <span>{r.department} • {r.designation}</span>
                          </div>
                        </td>

                        {weekDays.map((d, i) => {
                          const code = r.schedule[String(i)] || 'GEN';
                          const isWo = code === 'W/O' || code === 'WO';
                          const isToday = d.toDateString() === new Date().toDateString();
                          const shift = shifts.find(s => s.shiftCode === code);

                          return (
                            <td key={i} className={`p-2 text-center ${isToday ? 'bg-[var(--accent-light)]/30' : ''}`}>
                              <span
                                className={`inline-flex items-center justify-center px-2.5 py-1 rounded-[var(--radius-md)] text-[11px] font-semibold min-w-[48px] ${
                                  isWo
                                    ? 'bg-[var(--surface-secondary)] text-[var(--text-muted)] border border-[var(--border)]'
                                    : ''
                                }`}
                                style={!isWo ? {
                                  backgroundColor: `${shift?.colorCode || '#0D9488'}15`,
                                  color: shift?.colorCode || 'var(--accent)',
                                  border: `1px solid ${shift?.colorCode || 'var(--accent)'}40`,
                                } : undefined}
                              >
                                {code}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
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
        </>
      ) : (
        /* SHIFT CHANGE REQUESTS TAB */
        <div className="space-y-4">
          <DataToolbar
            searchPlaceholder="Search request by employee name, code, reason..."
            searchValue={requestSearch}
            onSearchChange={setRequestSearch}
            filters={[
              {
                id: 'requestStatus',
                ariaLabel: 'Request Status Filter',
                value: requestStatusFilter,
                onChange: (v) => setRequestStatusFilter(v),
                options: [
                  { value: 'all', label: 'All Statuses' },
                  { value: 'pending', label: '⏳ Pending Review' },
                  { value: 'approved', label: '✓ Approved' },
                  { value: 'rejected', label: '✕ Rejected' },
                ],
              },
            ]}
            archiveFilter={{
              value: archiveFilter,
              onChange: setArchiveFilter,
            }}
            primaryAction={
              canApplyRequest && archiveFilter === 'active'
                ? {
                    label: 'Submit Shift Request',
                    icon: <Clock className="w-3.5 h-3.5" />,
                    onClick: handleOpenChangeRequestModal,
                  }
                : undefined
            }
          />

          <div className="card overflow-hidden">
            {requestsLoading ? (
              <div className="p-6">
                <TableSkeleton rows={5} />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--ink-muted)]">
                <Clock className="w-8 h-8 mx-auto mb-2 text-[var(--ink-muted)] opacity-50" />
                <div className="font-semibold text-sm text-[var(--ink)]">
                  {archiveFilter === 'archived' ? 'No Archived Shift Requests' : 'No Shift Requests Found'}
                </div>
                <p className="mt-1">
                  {archiveFilter === 'archived'
                    ? 'There are no archived shift change requests.'
                    : 'There are no shift change or swap requests matching your filter.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                      <th className="p-3.5 font-semibold w-12 text-center">Sr.</th>
                      <th className="p-3.5 font-semibold min-w-[180px]">Employee</th>
                      <th className="p-3.5 font-semibold min-w-[120px]">Target Date</th>
                      <th className="p-3.5 font-semibold min-w-[220px]">Shift Change</th>
                      <th className="p-3.5 font-semibold min-w-[180px]">Reason</th>
                      <th className="p-3.5 font-semibold text-center min-w-[100px]">Status</th>
                      <th className="p-3.5 font-semibold min-w-[160px]">Review Info</th>
                      <th className="p-3.5 font-semibold text-right min-w-[140px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rule)]">
                    {filteredRequests.map((req, idx) => {
                      const isPending = req.status?.toLowerCase() === 'pending';
                      const isApproved = req.status?.toLowerCase() === 'approved';
                      const isRejected = req.status?.toLowerCase() === 'rejected';

                      return (
                        <tr key={req.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                          <td className="p-3.5 font-mono text-center text-xs text-[var(--ink-muted)] w-12">
                            {idx + 1}
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-xs text-[var(--ink)]">{req.employeeName}</div>
                            <div className="text-[11px] text-[var(--ink-muted)] flex items-center gap-1 mt-0.5">
                              {req.employeeCode && <span className="font-mono font-medium">[{req.employeeCode}]</span>}
                              {req.departmentName && <span>{req.departmentName}</span>}
                            </div>
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            <div className="font-semibold text-xs text-[var(--ink)]">
                              {new Date(req.requestDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            <div className="text-[10px] text-[var(--ink-muted)] mt-0.5 font-mono">
                              Req: {new Date(req.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              {/* Current Shift Badge */}
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border shadow-2xs whitespace-nowrap ${
                                req.isCurrentWeekOff
                                  ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                              }`}>
                                {req.isCurrentWeekOff ? '☕ W/O' : req.currentShiftName}
                              </span>

                              <ArrowRight size={13} className="text-[var(--ink-muted)] flex-shrink-0" />

                              {/* Requested Shift Badge */}
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border shadow-2xs whitespace-nowrap ${
                                req.isRequestedWeekOff
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                              }`}>
                                {req.isRequestedWeekOff ? '☕ Weekly Off' : req.requestedShiftName}
                              </span>
                            </div>
                          </td>

                          <td className="p-3.5 text-xs text-[var(--ink-secondary)]">
                            <p className="line-clamp-2 italic">{req.reason || '—'}</p>
                          </td>

                          <td className="p-3.5 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                              isPending
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                : isApproved
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            }`}>
                              {isPending && <Clock size={12} className="text-amber-600 dark:text-amber-400" />}
                              {isApproved && <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />}
                              {isRejected && <XCircle size={12} className="text-rose-600 dark:text-rose-400" />}
                              <span>{req.status}</span>
                            </span>
                          </td>

                          <td className="p-3.5 text-xs text-[var(--ink-muted)]">
                            {req.reviewedBy ? (
                              <div>
                                <div className="font-medium text-[var(--ink)]">By {req.reviewedBy}</div>
                                {req.reviewedAt && <div>{new Date(req.reviewedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>}
                                {req.rejectionReason && (
                                  <div className="text-[11px] text-rose-500 italic mt-0.5 line-clamp-1">"{req.rejectionReason}"</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] italic text-[var(--ink-muted)]">Awaiting review</span>
                            )}
                          </td>

                          <td className="p-3.5 text-right whitespace-nowrap">
                            {archiveFilter === 'archived' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => requestsArchive.restore({ id: req.id, name: `${req.employeeName}'s Shift Request`, isArchived: true })}
                                  className="px-2.5 py-1 rounded bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Restore request"
                                >
                                  <RotateCcw size={12} />
                                  <span>Restore</span>
                                </button>
                                {requestsArchive.canPermanentDelete && (
                                  <button
                                    type="button"
                                    onClick={() => requestsArchive.confirmPermanentDelete({ id: req.id, name: `${req.employeeName}'s Shift Request`, isArchived: true })}
                                    className="px-2.5 py-1 rounded bg-rose-600/10 text-rose-600 hover:bg-rose-600/20 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Permanently delete request"
                                  >
                                    <Trash2 size={12} />
                                    <span>Delete Permanently</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                {isPending && canApproveRequest && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveRequest(req.id)}
                                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                                      title="Approve shift change and update roster"
                                    >
                                      <Check size={13} strokeWidth={2.5} />
                                      <span>Approve</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRequestIdToReject(req.id);
                                        setRejectionReasonText('');
                                        setRejectModalOpen(true);
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                                      title="Reject request"
                                    >
                                      <X size={13} strokeWidth={2.5} />
                                      <span>Reject</span>
                                    </button>
                                  </>
                                )}
                                {isPending && !canApproveRequest && (
                                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Pending Review</span>
                                )}
                                {!isPending && (
                                  <span className="text-[11px] text-[var(--ink-muted)] italic mr-1">Completed</span>
                                )}
                                {canDeleteRequest && (
                                  <button
                                    type="button"
                                    onClick={() => requestsArchive.archive({ id: req.id, name: `${req.employeeName}'s Shift Request`, isArchived: false })}
                                    className="p-1.5 rounded-md hover:bg-rose-500/10 text-[var(--ink-muted)] hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Archive shift request"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
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
          </div>
        </div>
      )}

      {/* 5. Assign Shift / Week-Off Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-[var(--surface)] h-full shadow-[var(--shadow-xl)] flex flex-col border-l border-[var(--border)] animate-slide-in-right">
            <div className="p-5 pb-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Assign Shift Schedule</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Assign duty shifts or designate weekly off for employee(s).</p>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              {/* Mode Selector */}
              <div className="flex rounded-[var(--radius-md)] p-1 bg-[var(--surface-secondary)] border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setUseCycle(false)}
                  className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                    !useCycle
                      ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Single Shift / W/O
                </button>
                <button
                  type="button"
                  onClick={() => setUseCycle(true)}
                  className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-[var(--radius-sm)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    useCycle
                      ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Shift Cycle Pattern
                </button>
              </div>

              {/* Department Selector */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Department Filter</label>
                <div className="flex gap-2">
                  <select
                    value={assignDeptFilter}
                    onChange={(e) => setAssignDeptFilter(e.target.value)}
                    className="register-input flex-1"
                  >
                    <option value="">— All Departments —</option>
                    {departments
                      .filter((d: any) => !currentBranch?.id || d.branchId == null || String(d.branchId) === String(currentBranch.id))
                      .map((d: any) => (
                        <option key={d.id} value={String(d.id)}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                  {assignDeptFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        const deptEmps = employees.filter((e: any) => {
                          const empDeptId = e.departmentId;
                          return empDeptId != null && String(empDeptId) === String(assignDeptFilter);
                        });
                        const deptEmpIds = deptEmps.map((e: any) => e.employeeId);
                        const mergedIds = Array.from(new Set([...assignForm.employeeIds, ...deptEmpIds]));
                        setAssignForm(prev => ({ ...prev, employeeIds: mergedIds }));
                        setSelectedEmployeesState(employees.filter(e => mergedIds.includes(e.employeeId)));
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-md)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--accent)] border border-[var(--border)] whitespace-nowrap transition-colors cursor-pointer"
                    >
                      + Select All in Dept
                    </button>
                  )}
                </div>
              </div>

              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Select Employees *</label>
                <EmployeeMultiSelect
                  selectedIds={assignForm.employeeIds}
                  selectedEmployees={selectedEmployeesState}
                  departmentId={assignDeptFilter ? parseInt(assignDeptFilter) : undefined}
                  onChange={(ids, selectedEmps) => {
                    setSelectedEmployeesState(selectedEmps);
                    setAssignForm({
                      ...assignForm,
                      employeeIds: ids,
                    });
                  }}
                  branchId={currentBranch?.id ? parseInt(currentBranch.id) : undefined}
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  {assignForm.employeeIds.length} employee(s) selected
                </p>
              </div>

              {!useCycle ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Start Date *</label>
                      <input
                        type="date"
                        value={assignForm.startDate}
                        onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                        className="register-input font-data"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">End Date *</label>
                      <input
                        type="date"
                        value={assignForm.endDate}
                        onChange={(e) => setAssignForm({ ...assignForm, endDate: e.target.value })}
                        className="register-input font-data"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Shift Assignment</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignForm.isWeekOff}
                          onChange={(e) => setAssignForm({ ...assignForm, isWeekOff: e.target.checked })}
                          className="rounded border-[var(--border)] text-[var(--accent)]"
                        />
                        <span className="text-sm font-medium text-[var(--text-primary)]">Designate as Weekly Off (W/O)</span>
                      </label>

                      {!assignForm.isWeekOff && (
                        <div>
                          <label className="block text-xs text-[var(--text-secondary)] mb-1">Select Shift *</label>
                          <select
                            value={assignForm.shiftId}
                            onChange={(e) => setAssignForm({ ...assignForm, shiftId: parseInt(e.target.value) })}
                            className="register-input"
                            required={!assignForm.isWeekOff}
                          >
                            {shifts.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.shiftName} ({s.shiftCode}) [{s.startTime} - {s.endTime}]
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignForm.overwrite}
                      onChange={(e) => setAssignForm({ ...assignForm, overwrite: e.target.checked })}
                      className="rounded border-[var(--border)] text-[var(--accent)]"
                    />
                    <span className="text-sm font-medium text-[var(--text-primary)]">Overwrite existing shifts on these dates</span>
                  </label>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Select Rotation Cycle *</label>
                    {cycles.length === 0 ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded border border-amber-500/20">
                        No shift cycles found. Please create a shift cycle in Settings &gt; Work Shifts tab first.
                      </p>
                    ) : (
                      <select
                        value={cycleForm.cycleId}
                        onChange={(e) => setCycleForm({ ...cycleForm, cycleId: parseInt(e.target.value) || 0 })}
                        className="register-input"
                        required
                      >
                        <option value={0}>— Select a Rotation Cycle —</option>
                        {cycles.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.cycleLengthDays} days cycle)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Cycle Start Date (Day 1) *</label>
                      <input
                        type="date"
                        value={cycleForm.cycleStartDate}
                        onChange={(e) => setCycleForm({ ...cycleForm, cycleStartDate: e.target.value })}
                        className="register-input font-data"
                        required
                      />
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">Calendar date that maps to Slot 1.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Generate Roster Until *</label>
                      <input
                        type="date"
                        value={cycleForm.generateUntil}
                        onChange={(e) => setCycleForm({ ...cycleForm, generateUntil: e.target.value })}
                        className="register-input font-data"
                        required
                      />
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">Auto-repeats until this date.</p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cycleForm.overwrite}
                      onChange={(e) => setCycleForm({ ...cycleForm, overwrite: e.target.checked })}
                      className="rounded border-[var(--border)] text-[var(--accent)]"
                    />
                    <span className="text-sm font-medium text-[var(--text-primary)]">Overwrite existing roster in this range</span>
                  </label>
                </>
              )}

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (useCycle && cycles.length === 0)}
                  className="btn-primary"
                >
                  {submitting ? 'Generating...' : (useCycle ? 'Generate Cycle Roster' : 'Apply Assignment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Request Shift Change Modal */}
      {changeRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-[var(--surface)] h-full shadow-[var(--shadow-xl)] flex flex-col border-l border-[var(--border)] animate-slide-in-right">
            <div className="p-5 pb-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Request Shift Change</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Submit an employee request to change shift or weekoff for a specific date.</p>
              </div>
              <button
                onClick={() => setChangeRequestModalOpen(false)}
                className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChangeRequest} className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Employee *</label>
                {isOwnOnlyApply && user?.employeeId ? (
                  <div className="p-2.5 rounded-lg bg-[var(--paper-subtle)] border border-[var(--rule)] font-semibold text-xs text-[var(--ink)]">
                    {user?.employeeName || user?.fullName || user?.username || `Employee #${user.employeeId}`}
                  </div>
                ) : (
                  <select
                    value={changeRequestForm.employeeId}
                    onChange={(e) => {
                      const empId = parseInt(e.target.value) || 0;
                      setChangeRequestForm(prev => ({ ...prev, employeeId: empId }));
                      lookupDateShift(empId, changeRequestForm.requestDate);
                    }}
                    className="register-input"
                    required
                  >
                    <option value={0}>— Select Employee —</option>
                    {employees.map((e) => (
                      <option key={e.employeeId} value={e.employeeId}>
                        {e.employeeName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Target Date */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Target Date *</label>
                <input
                  type="date"
                  value={changeRequestForm.requestDate}
                  onChange={(e) => {
                    const date = e.target.value;
                    setChangeRequestForm(prev => ({ ...prev, requestDate: date }));
                    lookupDateShift(changeRequestForm.employeeId, date);
                  }}
                  className="register-input font-data"
                  required
                />
              </div>

              {/* Current Shift Display */}
              {changeRequestForm.currentShiftInfo && (
                <div className="p-3 rounded-lg bg-[var(--paper-subtle)] border border-[var(--rule)]">
                  <div className="text-[11px] font-mono uppercase text-[var(--ink-muted)]">Currently Scheduled on this Date:</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-sm text-[var(--ink)]">
                      {changeRequestForm.currentShiftInfo.shiftName}
                    </span>
                    <span className="text-xs font-mono text-[var(--ink-muted)]">
                      ({changeRequestForm.currentShiftInfo.shiftCode})
                    </span>
                    {changeRequestForm.currentShiftInfo.timing && (
                      <span className="text-xs text-[var(--ink-muted)] font-data">
                        [{changeRequestForm.currentShiftInfo.timing}]
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Requested Shift Selection */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Requested Shift Assignment</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={changeRequestForm.isRequestedWeekOff}
                      onChange={(e) => setChangeRequestForm(prev => ({ ...prev, isRequestedWeekOff: e.target.checked }))}
                      className="rounded border-[var(--border)] text-[var(--accent)]"
                    />
                    <span className="text-sm font-medium text-[var(--text-primary)]">Request Weekly Off (W/O)</span>
                  </label>

                  {!changeRequestForm.isRequestedWeekOff && (
                    <div>
                      <label className="block text-xs text-[var(--text-secondary)] mb-1">Select New Shift *</label>
                      <select
                        value={changeRequestForm.requestedShiftId}
                        onChange={(e) => setChangeRequestForm(prev => ({ ...prev, requestedShiftId: parseInt(e.target.value) || 0 }))}
                        className="register-input"
                        required={!changeRequestForm.isRequestedWeekOff}
                      >
                        {shifts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.shiftName} ({s.shiftCode}) [{s.startTime} - {s.endTime}]
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Reason for Request</label>
                <textarea
                  value={changeRequestForm.reason}
                  onChange={(e) => setChangeRequestForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Explain why you need this shift change or swap..."
                  rows={3}
                  className="register-input"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setChangeRequestModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Reject Request Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[var(--surface)] max-w-md w-full rounded-xl shadow-xl border border-[var(--border)] p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Reject Shift Change Request</h3>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="p-1 rounded hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Please enter the reason for rejecting this shift change request so the employee understands why:
            </p>

            <textarea
              value={rejectionReasonText}
              onChange={(e) => setRejectionReasonText(e.target.value)}
              placeholder="e.g. Critical deployment on this date, shift coverage unavailable..."
              rows={3}
              className="register-input"
              required
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleRejectRequest}
                className="px-4 py-2 rounded-[var(--radius-md)] bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
              >
                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Bulk Import Modal */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Shift Rosters"
        templateFilename="Shift_Roster"
        templateHeaders={['EmployeeId', 'RosterDate', 'ShiftCode', 'IsWeekOff']}
        templateSampleRow={['1042', '2026-08-16', 'GEN', 'false']}
        onImportComplete={() => {
          showSuccess('Imported', 'Shift roster imported successfully.');
          fetchRoster();
        }}
      />

      {/* Confirm Permanent Delete Dialog */}
      {requestsArchive.dialog}
    </PageContainer>
  );
};

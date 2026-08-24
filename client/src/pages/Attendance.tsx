import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { exportToCSV } from '../utils/csvHelper';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { DataToolbar } from '../components/ui/DataToolbar';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/CompanyContext';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Activity,
  Sparkles,
  Plus,
  Check,
  X,
  XCircle,
  Award,
  Clock,
  Calendar,
  Umbrella,
} from 'lucide-react';
import { RowActionMenu, type RowAction } from '../components/ui/RowActionMenu';
import { DayActivityDrawer } from '../components/attendance/DayActivityDrawer';

interface CompOffItem {
  id: number;
  employeeId: number;
  employeeName: string;
  departmentName: string;
  workedDate: string;
  shiftName: string | null;
  inTime: string | null;
  outTime: string | null;
  workMinutes: number | null;
  compOffDays: number | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Draft';
  approvedBy: string | null;
  approvedDate: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

const LeftHalfStar: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <defs>
      <clipPath id="star-left-clip">
        <rect x="0" y="0" width="12" height="24" />
      </clipPath>
    </defs>
    {/* Base Outline Star */}
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Filled Left Half */}
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill="currentColor"
      clipPath="url(#star-left-clip)"
    />
  </svg>
);

const RightHalfStar: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <defs>
      <clipPath id="star-right-clip">
        <rect x="12" y="0" width="12" height="24" />
      </clipPath>
    </defs>
    {/* Base Outline Star */}
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Filled Right Half */}
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill="currentColor"
      clipPath="url(#star-right-clip)"
    />
  </svg>
);

export const Attendance: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const { hasPermission, isAdmin } = useAuth();
  const { currentOrganization, currentBranch } = useOrganization();

  const [activeTab, setActiveTab] = useState<'matrix' | 'daily_logs' | 'compoff'>('matrix');
  const [data, setData] = useState<any>(null);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [compOffItems, setCompOffItems] = useState<CompOffItem[]>([]);
  const [compOffTotal, setCompOffTotal] = useState(0);
  const [compOffPages, setCompOffPages] = useState(1);
  const [compOffStatus, setCompOffStatus] = useState('all');

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Array<{ employeeId: number; employeeName: string }>>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Day Activity Timeline Drawer state
  const [dayDrawerOpen, setDayDrawerOpen] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ employeeId: number; date: string; initialData?: any } | null>(null);

  const handleOpenDayActivity = (row: any, dayNumber: number) => {
    const formattedMonth = String(month).padStart(2, '0');
    const formattedDay = String(dayNumber).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
    const dayStr = String(dayNumber);
    const record = row.dailyRecords?.[dayStr];
    const status = row.dailyStatus?.[dayStr] || (typeof record === 'object' ? record?.status : record) || '';

    const dDate = new Date(year, month - 1, dayNumber);
    const formattedDate = dDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    const inTime = typeof record === 'object' ? record?.inTime : null;
    const outTime = typeof record === 'object' ? record?.outTime : null;

    setSelectedDayInfo({
      employeeId: row.employee.employeeId,
      date: dateStr,
      initialData: {
        employee: {
          employeeId: row.employee.employeeId,
          name: row.employee.employeeName,
          code: row.employee.employeeCode || `EMP#${String(row.employee.employeeId).padStart(3, '0')}`,
          department: row.employee.departmentName || row.employee.department || 'General',
          branch: row.employee.branchName || row.employee.branch || currentBranch?.name || 'Main Branch',
        },
        date: dateStr,
        formattedDate,
        status: status || '—',
        inTime: inTime,
        outTime: outTime,
        totalPunches: inTime ? (outTime ? 2 : 1) : 0,
        workMinutes: 0,
        breakMinutes: 0,
      }
    });
    setDayDrawerOpen(true);
  };

  const handleOpenDailyLogRow = (log: any) => {
    const dDate = new Date(selectedDate);
    const formattedDate = isNaN(dDate.getTime()) ? selectedDate : dDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    setSelectedDayInfo({
      employeeId: log.employeeId,
      date: selectedDate,
      initialData: {
        employee: {
          employeeId: log.employeeId,
          name: log.employeeName,
          code: log.employeeCode || `EMP#${String(log.employeeId).padStart(3, '0')}`,
          department: log.department || 'General',
          branch: log.branch || currentBranch?.name || 'Main Branch',
        },
        date: selectedDate,
        formattedDate,
        status: log.status || '—',
        inTime: log.inTime,
        outTime: log.outTime,
        totalPunches: log.inTime ? (log.outTime ? 2 : 1) : 0,
        workMinutes: log.workMinutes || 0,
        breakMinutes: 0,
      }
    });
    setDayDrawerOpen(true);
  };

  // Comp Off Modal states
  const [compOffModalOpen, setCompOffModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingCompOff, setSubmittingCompOff] = useState(false);
  const [compOffForm, setCompOffForm] = useState({
    employeeId: 0,
    workedDate: new Date().toISOString().split('T')[0],
    inTime: '09:00',
    outTime: '18:00',
    compOffDays: 1.0,
    reason: '',
  });

  const fetchLookups = async () => {
    try {
      const [deptRes, empRes] = await Promise.all([
        apiClient.get('/employees/lookups'),
        apiClient.get('/employees', {
          params: { pageSize: 200, branchId: currentBranch?.id || undefined }
        }),
      ]);
      setDepartments(deptRes.data?.departments || []);
      const empList = (empRes.data?.items || []).map((e: any) => ({
        employeeId: e.employeeId || e.id,
        employeeName: e.employeeName || e.name,
      }));
      setEmployees(empList);
      if (empList.length > 0) {
        setCompOffForm(prev => ({ ...prev, employeeId: empList[0].employeeId }));
      }
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  useEffect(() => {
    fetchLookups();
  }, [currentOrganization?.id, currentBranch?.id]);

  const fetchAttendanceSheet = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/attendance/monthly-sheet', {
        params: {
          year,
          month,
          search: search || undefined,
          departmentId: departmentId ? parseInt(departmentId) : undefined,
          branchId: currentBranch?.id || undefined,
          page,
          pageSize,
        },
      });
      setData(res.data);
    } catch (err: any) {
      showError('Failed to fetch ledger', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyLogs = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/attendance/daily-logs', {
        params: {
          date: selectedDate,
          search: search || undefined,
          departmentId: departmentId ? parseInt(departmentId) : undefined,
          branchId: currentBranch?.id || undefined,
        },
      });
      setDailyLogs(res.data?.items || res.data?.logs || (Array.isArray(res.data) ? res.data : []));
    } catch (err: any) {
      showError('Failed to fetch biometric feed', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompOff = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/regularizations/compoff', {
        params: {
          status: compOffStatus !== 'all' ? compOffStatus : undefined,
          branchId: currentBranch?.id || undefined,
          page,
          pageSize,
        },
      });
      setCompOffItems(res.data?.items || []);
      setCompOffTotal(res.data?.totalCount || 0);
      setCompOffPages(res.data?.totalPages || 1);
    } catch (err: any) {
      showError('Failed to fetch comp-off records', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'matrix') {
      fetchAttendanceSheet();
    } else if (activeTab === 'daily_logs') {
      fetchDailyLogs();
    } else {
      fetchCompOff();
    }
  }, [activeTab, year, month, selectedDate, search, departmentId, compOffStatus, currentOrganization?.id, currentBranch?.id, page, pageSize]);

  useEffect(() => {
    const handleReload = () => {
      setPage(1);
      if (activeTab === 'matrix') fetchAttendanceSheet();
      else if (activeTab === 'daily_logs') fetchDailyLogs();
      else fetchCompOff();
    };

    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);

    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, [activeTab, year, month, selectedDate, search, departmentId, compOffStatus]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setPage(1);
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    setPage(1);
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const handleApproveCompOff = async (id: number) => {
    try {
      await apiClient.post(`/regularizations/compoff/${id}/approve`);
      showSuccess('Approved', 'Comp Off credit approved and credited to balance.');
      fetchCompOff();
    } catch (err: any) {
      showError('Approval Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleOpenRejectCompOff = (id: number) => {
    setRejectTargetId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmRejectCompOff = async () => {
    if (!rejectTargetId) return;
    try {
      await apiClient.post(`/regularizations/compoff/${rejectTargetId}/reject`, { reason: rejectReason });
      showSuccess('Rejected', 'Comp Off request rejected.');
      setRejectModalOpen(false);
      setRejectTargetId(null);
      fetchCompOff();
    } catch (err: any) {
      showError('Rejection Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleSubmitCompOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compOffForm.employeeId) {
      showError('Validation Error', 'Please select an employee.');
      return;
    }
    try {
      setSubmittingCompOff(true);
      await apiClient.post('/regularizations/compoff', compOffForm);
      showSuccess('Submitted', 'Comp Off request created successfully.');
      setCompOffModalOpen(false);
      fetchCompOff();
    } catch (err: any) {
      showError('Submission Failed', err.response?.data?.message || 'Server error');
    } finally {
      setSubmittingCompOff(false);
    }
  };

  const handleExportAttendance = () => {
    if (activeTab === 'matrix') {
      if (!data?.items?.length) {
        showError('Export Empty', 'No attendance matrix records to export.');
        return;
      }

      const rows = data.items.map((item: any) => ({
        employeeId: item.employee.employeeId,
        employeeName: item.employee.employeeName,
        department: item.employee.departmentName || item.employee.department || 'General',
        presentDays: item.summary?.presentDays || 0,
        absentDays: item.summary?.absentDays || 0,
        weekoffDays: item.summary?.weekoffDays || 0,
        payableDays: item.summary?.payableDays || 0,
      }));

      const headers = [
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'employeeName', label: 'Employee Name' },
        { key: 'department', label: 'Department' },
        { key: 'presentDays', label: 'Present Days (P)' },
        { key: 'absentDays', label: 'Absent Days (A)' },
        { key: 'weekoffDays', label: 'Week Off Days (WO)' },
        { key: 'payableDays', label: 'Total Payable Days' },
      ];

      exportToCSV(`Attendance_Matrix_${monthNames[month - 1]}_${year}`, rows, headers);
      showSuccess('Ledger Exported', `Monthly sheet for ${monthNames[month - 1]} ${year} downloaded.`);
    } else if (activeTab === 'daily_logs') {
      if (!dailyLogs.length) {
        showError('Export Empty', 'No raw biometric punches to export for this date.');
        return;
      }

      const rows = dailyLogs.map((log: any) => ({
        employeeId: log.employeeId,
        employeeName: log.employeeName,
        department: log.department || 'General',
        inTime: log.inTime || '--:--',
        outTime: log.outTime || '--:--',
        shiftName: log.shiftName || 'General',
        status: log.status,
        lateMinutes: log.lateMinutes || 0,
      }));

      const headers = [
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'employeeName', label: 'Employee Name' },
        { key: 'department', label: 'Department' },
        { key: 'inTime', label: 'In Time' },
        { key: 'outTime', label: 'Out Time' },
        { key: 'shiftName', label: 'Shift' },
        { key: 'status', label: 'Muster Status' },
        { key: 'lateMinutes', label: 'Late (Mins)' },
      ];

      exportToCSV(`Biometric_Feed_${selectedDate}`, rows, headers);
      showSuccess('Feed Exported', `Daily punches for ${selectedDate} downloaded.`);
    } else {
      if (!compOffItems.length) {
        showError('Export Empty', 'No comp-off records to export.');
        return;
      }
      exportToCSV(
        'CompOff_Duty_Credits',
        compOffItems.map(c => ({
          'Employee Name': c.employeeName,
          Department: c.departmentName,
          'Worked Date': c.workedDate,
          Shift: c.shiftName || 'General',
          'In Time': c.inTime || '-',
          'Out Time': c.outTime || '-',
          'Comp Off Days': c.compOffDays || 1.0,
          Status: c.status,
          'Approved By': c.approvedBy || '',
        }))
      );
    }
  };

  const getStatusBadge = (code: string) => {
    if (!code || code === '-' || code.trim() === '') {
      return <span className="text-[var(--ink-muted)] opacity-30 text-xs font-mono select-none">—</span>;
    }

    const c = code.trim().toUpperCase();

    switch (c) {
      case 'P':
      case 'PRESENT':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500 text-white font-bold shadow-xs hover:brightness-110 transition-all select-none"
            title="Present"
          >
            <Check size={14} strokeWidth={3.5} />
          </span>
        );

      case 'A':
      case 'ABSENT':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-rose-500 text-white font-bold shadow-xs hover:brightness-110 transition-all select-none"
            title="Absent (Loss of Pay)"
          >
            <X size={14} strokeWidth={3.5} />
          </span>
        );

      case 'W/O':
      case 'WO':
      case 'WEEKOFF':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-600 text-white font-bold shadow-xs hover:brightness-110 transition-all select-none"
            title="Week Off"
          >
            <Calendar size={13} strokeWidth={2.5} />
          </span>
        );

      case 'W/OP':
      case 'WOP':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500 text-white ring-2 ring-amber-400 font-extrabold text-[9px] shadow-xs hover:brightness-110 transition-all select-none"
            title="Worked on Week Off (Comp Off Earned)"
          >
            WO+
          </span>
        );

      case 'W/OHF':
      case 'WOHF':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-500 text-white ring-2 ring-emerald-400 font-extrabold text-[9px] shadow-xs hover:brightness-110 transition-all select-none"
            title="Worked Half Day on Week Off"
          >
            WO½
          </span>
        );

      case 'HLD':
      case 'HOLIDAY':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-purple-500 text-white font-bold shadow-xs hover:brightness-110 transition-all select-none"
            title="Public Holiday"
          >
            <Sparkles size={13} strokeWidth={2.5} />
          </span>
        );

      case 'CO':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-500 text-white font-bold shadow-xs hover:brightness-110 transition-all select-none"
            title="Comp Off Full Day"
          >
            <Award size={13} strokeWidth={2.5} />
          </span>
        );

      case 'COHF':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-500 text-white font-extrabold font-data text-[9px] shadow-xs hover:brightness-110 transition-all select-none"
            title="Comp Off Half Day"
          >
            CO½
          </span>
        );

      // First Half Leave -> Left-filled Star (Amber solid badge + Left half filled white star)
      case '1H':
      case 'FH':
      case '1HF':
      case 'HF-1':
      case 'FIRST HALF':
      case 'PL-1H':
      case 'SL-1H':
      case 'CO-1H':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-500 text-white shadow-xs hover:brightness-110 transition-all select-none"
            title={code.includes('PL') ? 'Paid Leave (1st Half - Left Star)' : code.includes('SL') ? 'Sick Leave (1st Half - Left Star)' : code.includes('CO') ? 'Comp Off (1st Half - Left Star)' : 'First Half Leave (Left Star Filled)'}
          >
            <LeftHalfStar size={15} />
          </span>
        );

      // Second Half Leave -> Right-filled Star (Amber solid badge + Right half filled white star)
      case '2H':
      case 'SH':
      case '2HF':
      case 'HF-2':
      case 'SECOND HALF':
      case 'PL-2H':
      case 'SL-2H':
      case 'CO-2H':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-500 text-white shadow-xs hover:brightness-110 transition-all select-none"
            title={code.includes('PL') ? 'Paid Leave (2nd Half - Right Star)' : code.includes('SL') ? 'Sick Leave (2nd Half - Right Star)' : code.includes('CO') ? 'Comp Off (2nd Half - Right Star)' : 'Second Half Leave (Right Star Filled)'}
          >
            <RightHalfStar size={15} />
          </span>
        );

      // Full Day Leaves -> Universal Beach Umbrella Icon (bg-teal-500)
      case 'PL':
      case 'SL':
      case 'CL':
      case 'ML':
      case 'EL':
      case 'LWP':
      case 'LEAVE':
      case 'PAID LEAVE':
      case 'SICK LEAVE':
      case 'CASUAL LEAVE':
      case 'UNPAID LEAVE':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-teal-500 text-white font-bold shadow-xs hover:brightness-110 transition-all select-none"
            title="Leave"
          >
            <Umbrella size={13} strokeWidth={2.5} />
          </span>
        );

      // Generic Half Day / Unspecified Half Leave
      case 'PHF':
      case 'PL½':
      case 'PLHF':
      case 'SHF':
      case 'SL½':
      case 'SLHF':
      case 'HF':
      case 'HALF DAY':
      case 'HALFDAY':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-500 text-white font-bold shadow-xs hover:brightness-110 transition-all select-none"
            title="Half Day"
          >
            <LeftHalfStar size={15} />
          </span>
        );

      default:
        return (
          <span
            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1 rounded-md bg-blue-600 text-white font-bold font-mono text-[9px] shadow-xs select-none"
            title={code}
          >
            {code}
          </span>
        );
    }
  };

  const canManageCompOff = isAdmin || hasPermission('CompOff.Approve') || hasPermission('Attendance.Regularize');

  return (
    <PageContainer>
      <PageHeader title="Attendance" description="Daily attendance records and biometric logs" />

      {/* Tab Switcher */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="inline-flex rounded-lg border border-[var(--rule)] p-0.5 bg-[var(--paper-subtle)]">
          <button
            onClick={() => { setActiveTab('matrix'); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'matrix'
                ? 'bg-[var(--paper)] text-[var(--accent)] shadow-xs border border-[var(--rule)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Monthly Matrix</span>
          </button>
          <button
            onClick={() => { setActiveTab('daily_logs'); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'daily_logs'
                ? 'bg-[var(--paper)] text-[var(--accent)] shadow-xs border border-[var(--rule)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Daily Punch Feed</span>
          </button>
          <button
            onClick={() => { setActiveTab('compoff'); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'compoff'
                ? 'bg-[var(--paper)] text-[var(--accent)] shadow-xs border border-[var(--rule)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Comp-Off Credits</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Data Toolbar */}
      <DataToolbar
        searchPlaceholder={activeTab === 'matrix' ? 'Search employee in monthly muster...' : activeTab === 'daily_logs' ? 'Search daily punch logs...' : 'Search comp-off records...'}
        searchValue={search}
        onSearchChange={setSearch}
        filters={activeTab === 'compoff' ? [
          {
            id: 'compoff-status',
            ariaLabel: 'Status Filter',
            value: compOffStatus,
            onChange: (v) => { setCompOffStatus(v); setPage(1); },
            options: [
              { label: 'All Statuses', value: 'all' },
              { label: 'Pending Approval', value: 'Pending' },
              { label: 'Approved', value: 'Approved' },
              { label: 'Rejected', value: 'Rejected' },
            ],
          }
        ] : [
          {
            id: 'department',
            ariaLabel: 'Department Filter',
            value: departmentId,
            onChange: setDepartmentId,
            options: [
              { value: '', label: 'All Departments' },
              ...departments.filter((d: any) => !currentBranch?.id || String(d.branchId) === String(currentBranch.id)).map((d: any) => ({ value: String(d.departmentId || d.id), label: d.departmentName })),
            ],
          },
        ]}
        onExport={handleExportAttendance}
        onImport={activeTab === 'matrix' || activeTab === 'daily_logs' ? () => setImportModalOpen(true) : undefined}
        primaryAction={activeTab === 'compoff' ? {
          label: 'Apply Comp-Off',
          icon: <Plus className="w-3.5 h-3.5" />,
          onClick: () => setCompOffModalOpen(true),
        } : undefined}
      >
        {activeTab === 'matrix' && (
          <div className="flex items-center gap-1.5 bg-[var(--paper)] border border-[var(--rule)] rounded-lg p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-serif font-bold text-xs px-2 text-[var(--ink)] whitespace-nowrap min-w-[130px] text-center">
              {monthNames[month - 1]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeTab === 'daily_logs' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="register-input text-xs font-mono py-1.5"
            />
          </div>
        )}
      </DataToolbar>

      {/* 3. Main Views */}
      {loading ? (
        <div className="p-6 card">
          <TableSkeleton rows={10} />
        </div>
      ) : activeTab === 'matrix' ? (
        /* View 1: Monthly Attendance Matrix */
        <div className="card overflow-hidden">
          {/* Attendance Status Legend (Moved to Top) */}
          <div className="border-b border-[var(--rule)] px-4 py-2.5 bg-[var(--paper-subtle)]/50 flex items-center justify-between gap-4 flex-wrap text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">Legend:</span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500 text-white shadow-2xs">
                  <Check size={11} strokeWidth={3.5} />
                </span>
                <span>Present</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-rose-500 text-white shadow-2xs">
                  <X size={11} strokeWidth={3.5} />
                </span>
                <span>Absent</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white shadow-2xs">
                  <Calendar size={10} strokeWidth={2.5} />
                </span>
                <span>Week Off</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-purple-500 text-white shadow-2xs">
                  <Sparkles size={10} strokeWidth={2.5} />
                </span>
                <span>Holiday</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-indigo-500 text-white shadow-2xs">
                  <Award size={10} strokeWidth={2.5} />
                </span>
                <span>Comp Off</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500 text-white shadow-2xs">
                  <LeftHalfStar size={11} />
                </span>
                <span>1st Half Leave</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500 text-white shadow-2xs">
                  <RightHalfStar size={11} />
                </span>
                <span>2nd Half Leave</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-teal-500 text-white shadow-2xs">
                  <Umbrella size={11} strokeWidth={2.5} />
                </span>
                <span>Leave</span>
              </span>
            </div>
            <span className="text-[11px] text-[var(--ink-muted)] italic">
              Click any date to inspect punch timeline
            </span>
          </div>

          <div className="overflow-x-auto max-h-[72vh] border border-[var(--rule)] rounded-b-lg">
            <table className="ledger-table min-w-max w-full text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-[var(--surface)]">
                <tr>
                  <th className="sticky left-0 z-30 bg-[var(--surface)] border-r border-[var(--rule)] w-12 min-w-[48px] text-center font-mono text-[11px] text-[var(--ink-muted)] shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                    Sr.
                  </th>
                  <th className="sticky left-12 z-30 bg-[var(--surface)] border-r-2 border-[var(--rule)] min-w-[190px] max-w-[220px] text-left py-2 px-3 font-semibold text-[var(--ink)] shadow-[4px_0_8px_rgba(0,0,0,0.15)]">
                    Employee Name
                  </th>

                  {data?.daysInMonth &&
                    Array.from({ length: data.daysInMonth }, (_, i) => i + 1).map((d) => (
                      <th key={d} className="w-9 min-w-[34px] max-w-[36px] text-center p-1 font-mono text-[11px] text-[var(--ink-muted)] border-r border-[var(--rule)]/40">
                        {d}
                      </th>
                    ))}
                  <th className="border-l-2 border-[var(--rule)] text-center font-bold text-[var(--ok-600)] w-11 min-w-[44px]">P</th>
                  <th className="text-center font-bold text-[var(--err-600)] w-11 min-w-[44px]">A</th>
                  <th className="text-center font-bold text-[var(--ink-muted)] w-11 min-w-[44px]">WO</th>
                  <th className="text-center font-bold text-[var(--accent)] w-16 min-w-[64px] bg-[var(--surface-secondary)]">Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {data?.items?.map((row: any, idx: number) => {
                  const srNo = ((page - 1) * pageSize) + idx + 1;
                  return (
                    <tr key={row.employee.employeeId} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="sticky left-0 z-10 bg-[var(--surface)] border-r border-[var(--rule)] font-mono text-xs text-center text-[var(--ink-muted)] py-2 px-1 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                        {srNo}
                      </td>
                      <td className="sticky left-12 z-10 bg-[var(--surface)] border-r-2 border-[var(--rule)] font-semibold text-[var(--ink)] whitespace-nowrap py-2 px-3 shadow-[4px_0_8px_rgba(0,0,0,0.15)]">
                        {row.employee.employeeName}
                      </td>

                      {Array.from({ length: data.daysInMonth }, (_, i) => i + 1).map((d) => {
                        const dayStr = String(d);
                        const record = row.dailyRecords?.[dayStr];
                        const status = row.dailyStatus?.[dayStr] || (typeof record === 'object' ? record?.status : record) || '';
                        const tooltip = typeof record === 'object' ? (record?.tooltip || (record?.inTime ? `In: ${record.inTime} | Out: ${record.outTime || '—'}` : '')) : '';

                        return (
                          <td
                            key={d}
                            title={tooltip ? `${tooltip} • Click to view all punch logs` : `Day ${d} • Click to view all punch logs`}
                            onClick={() => handleOpenDayActivity(row, d)}
                            className="w-9 min-w-[34px] max-w-[36px] text-center p-1 font-data text-xs border-r border-[var(--rule)]/40 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:outline hover:outline-1 hover:outline-[var(--accent)] transition-all select-none"
                          >
                            {getStatusBadge(status)}
                          </td>
                        );
                      })}
                      <td className="border-l-2 border-[var(--rule)] text-center font-data font-bold text-[var(--ok-600)] px-2">
                        {row.summary?.presentDays || 0}
                      </td>
                      <td className="text-center font-data font-bold text-[var(--err-600)] px-2">
                        {row.summary?.absentDays || 0}
                      </td>
                      <td className="text-center font-data text-[var(--ink-muted)] px-2">
                        {row.summary?.weekoffDays || 0}
                      </td>
                      <td className="text-center font-data font-bold text-[var(--accent)] bg-[var(--paper-subtle)] px-2">
                        {row.summary?.payableDays || 0}
                      </td>
                    </tr>
                  );
                })}
                {(!data?.items || data.items.length === 0) && (
                  <tr>
                    <td colSpan={data?.daysInMonth ? data.daysInMonth + 6 : 37} className="py-12 text-center text-xs text-[var(--ink-muted)]">
                      No attendance records found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          {data?.totalCount > 0 && (
            <div className="border-t border-[var(--rule)] p-3">
              <PaginationToolbar
                page={page}
                pageSize={pageSize}
                totalCount={data.totalCount}
                totalPages={data.totalPages || 1}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              />
            </div>
          )}
        </div>
      ) : activeTab === 'daily_logs' ? (
        /* View 2: Daily Biometric Logs */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ledger-table w-full text-xs">
              <thead>
                <tr>
                  <th className="w-12 text-center font-mono text-xs uppercase text-[var(--ink-muted)]">Sr.</th>
                  <th>Employee Name</th>

                  <th className="text-right font-data">In Time</th>
                  <th className="text-right font-data">Out Time</th>
                  <th>Shift</th>
                  <th>Muster Status</th>
                  <th className="text-right">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {dailyLogs.map((log: any, idx: number) => (
                  <tr
                    key={log.id}
                    onClick={() => handleOpenDailyLogRow(log)}
                    className="hover:bg-[var(--paper-subtle)] cursor-pointer transition-colors"
                    title="Click to view all punch logs and audit timeline"
                  >
                    <td className="font-mono text-xs text-center text-[var(--ink-muted)]">{idx + 1}</td>
                    <td className="font-semibold text-[var(--ink)]">{log.employeeName}</td>

                    <td className="text-right font-data text-xs text-[var(--ink)]">{log.inTime || '--:--'}</td>
                    <td className="text-right font-data text-xs text-[var(--ink)]">{log.outTime || '--:--'}</td>
                    <td className="text-xs text-[var(--ink-muted)]">{log.shiftName || 'General'}</td>
                    <td className="text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={log.status === 'Present' ? 'status-dot-ok' : log.status === 'Absent' ? 'status-dot-err' : 'status-dot-warn'} />
                        <span className={log.status === 'Present' ? 'text-[var(--ok-600)]' : log.status === 'Absent' ? 'text-[var(--err-600)]' : 'text-[var(--warn-600)]'}>
                          {log.status}
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-data text-xs text-[var(--ink-muted)]">
                      {log.lateMinutes > 0 ? `Late +${log.lateMinutes}m` : '-'}
                    </td>
                  </tr>
                ))}
                {dailyLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-[var(--ink-muted)]">
                      No raw biometric punches recorded for {selectedDate}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* View 3: Comp-Off Duty Credits */
        <div className="card overflow-hidden">
          {compOffItems.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--ink-muted)]">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-[var(--ink-muted)] opacity-50" />
              <div className="font-semibold text-sm text-[var(--ink)]">No Comp-Off Records Found</div>
              <p className="mt-1">No overtime or weekend work duty credits found matching filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--rule)] bg-[var(--paper-subtle)] text-[var(--ink-muted)] font-mono text-[11px] uppercase tracking-wider">
                    <th className="p-3.5 font-semibold w-12 text-center">Sr.</th>
                    <th className="p-3.5 font-semibold">Employee</th>
                    <th className="p-3.5 font-semibold">Worked Date</th>
                    <th className="p-3.5 font-semibold">Shift Timing</th>
                    <th className="p-3.5 font-semibold">Actual Timings</th>
                    <th className="p-3.5 font-semibold">Credit Days</th>
                    <th className="p-3.5 font-semibold">Status</th>
                    <th className="p-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                  {compOffItems.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-[var(--paper-subtle)] transition-colors">
                      <td className="p-3.5 font-mono text-center text-xs text-[var(--ink-muted)]">{idx + 1}</td>
                      <td className="p-3.5">
                        <div className="font-semibold text-[var(--ink)]">{c.employeeName}</div>
                      </td>

                      <td className="p-3.5 font-mono">
                        <div className="font-medium text-[var(--ink)]">{c.workedDate}</div>
                        <div className="text-[10px] text-[var(--ink-muted)]">
                          Filed: {new Date(c.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="p-3.5 font-mono text-[11px] text-[var(--ink-muted)]">
                        {c.shiftName || 'General Shift'}
                      </td>

                      <td className="p-3.5 font-mono text-[11px]">
                        <div>In: <span className="font-semibold text-[var(--ink)]">{c.inTime || '—'}</span></div>
                        <div>Out: <span className="font-semibold text-[var(--ink)]">{c.outTime || '—'}</span></div>
                      </td>

                      <td className="p-3.5 font-mono font-bold text-[var(--accent)]">
                        +{c.compOffDays || 1.0} Day(s)
                      </td>

                      <td className="p-3.5">
                        {c.status === 'Pending' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending
                          </span>
                        )}
                        {c.status === 'Approved' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Approved
                          </span>
                        )}
                        {c.status === 'Rejected' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                            <X className="w-3 h-3 text-rose-600" />
                            Rejected
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        {c.status === 'Pending' && canManageCompOff ? (
                          <RowActionMenu actions={[
                            { label: 'Approve', icon: <Check className="w-4 h-4" />, onClick: () => handleApproveCompOff(c.id), variant: 'success' },
                            { label: 'Reject', icon: <X className="w-4 h-4" />, onClick: () => handleOpenRejectCompOff(c.id), variant: 'danger' },
                          ]} />
                        ) : (
                          <div className="text-[10px] text-[var(--ink-muted)] font-mono">
                            {c.approvedBy ? `by ${c.approvedBy}` : '—'}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Toolbar */}
          {compOffTotal > 0 && (
            <div className="border-t border-[var(--rule)] p-3">
              <PaginationToolbar
                page={page}
                pageSize={pageSize}
                totalCount={compOffTotal}
                totalPages={compOffPages}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. APPLY COMP-OFF MODAL */}
      {/* ========================================================================= */}
      {compOffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--paper-subtle)]">
              <div>
                <h3 className="font-serif font-bold text-base text-[var(--ink)]">Apply Comp-Off Duty Credit</h3>
                <p className="text-[11px] text-[var(--ink-muted)]">Credit compensatory leave for working on week-offs or public holidays.</p>
              </div>
              <button
                onClick={() => setCompOffModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--ink-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCompOff} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--ink)] mb-1">Select Employee *</label>
                <select
                  value={compOffForm.employeeId}
                  onChange={(e) => setCompOffForm({ ...compOffForm, employeeId: parseInt(e.target.value) || 0 })}
                  className="register-input w-full font-medium"
                  required
                >
                  {employees.map((e) => (
                    <option key={e.employeeId} value={e.employeeId}>
                      {e.employeeName} (#{e.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Worked Date *</label>
                  <input
                    type="date"
                    value={compOffForm.workedDate}
                    onChange={(e) => setCompOffForm({ ...compOffForm, workedDate: e.target.value })}
                    className="register-input w-full font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Credit Days *</label>
                  <select
                    value={compOffForm.compOffDays}
                    onChange={(e) => setCompOffForm({ ...compOffForm, compOffDays: parseFloat(e.target.value) || 1.0 })}
                    className="register-input w-full font-mono font-bold"
                  >
                    <option value={1.0}>1.0 Full Day</option>
                    <option value={0.5}>0.5 Half Day</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">In-Time</label>
                  <input
                    type="time"
                    value={compOffForm.inTime}
                    onChange={(e) => setCompOffForm({ ...compOffForm, inTime: e.target.value })}
                    className="register-input w-full font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Out-Time</label>
                  <input
                    type="time"
                    value={compOffForm.outTime}
                    onChange={(e) => setCompOffForm({ ...compOffForm, outTime: e.target.value })}
                    className="register-input w-full font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--ink)] mb-1">Reason / Task Description</label>
                <textarea
                  value={compOffForm.reason}
                  onChange={(e) => setCompOffForm({ ...compOffForm, reason: e.target.value })}
                  placeholder="Details of official task or overtime performed on week-off/holiday..."
                  rows={2}
                  className="register-input w-full"
                />
              </div>

              <div className="pt-2 border-t border-[var(--rule)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompOffModalOpen(false)}
                  className="btn-secondary py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCompOff}
                  className="btn-primary py-1.5 px-4 flex items-center gap-1.5"
                >
                  {submittingCompOff ? 'Saving...' : 'Submit Comp-Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. REJECT REASON MODAL */}
      {/* ========================================================================= */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl shadow-2xl max-w-sm w-full p-4 space-y-3">
            <h3 className="font-serif font-bold text-base text-rose-600 flex items-center gap-1.5">
              <XCircle className="w-5 h-5" /> Reject Comp-Off
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              Please specify the reason for rejecting this comp-off request.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Inadequate justification / Punch unverified..."
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
                onClick={handleConfirmRejectCompOff}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 px-3.5 rounded-lg text-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. BULK IMPORT MODAL */}
      {/* ========================================================================= */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Biometric Punch Ledger"
        templateFilename="HRDesk_Biometric_Punches"
        templateHeaders={['EmployeeId', 'PunchDate', 'InTime', 'OutTime', 'MachineCode']}
        templateSampleRow={['1042', '2026-08-15', '09:12:00', '18:05:00', 'DEVICE_01']}
        onImportComplete={() => {
          setImportModalOpen(false);
          if (activeTab === 'matrix') fetchAttendanceSheet();
          else if (activeTab === 'daily_logs') fetchDailyLogs();
          else fetchCompOff();
        }}
      />

      {/* ========================================================================= */}
      {/* 7. DAY ACTIVITY & IN/OUT AUDIT TIMELINE DRAWER */}
      {/* ========================================================================= */}
      <DayActivityDrawer
        open={dayDrawerOpen}
        onClose={() => setDayDrawerOpen(false)}
        employeeId={selectedDayInfo?.employeeId}
        date={selectedDayInfo?.date}
        initialData={selectedDayInfo?.initialData}
      />
    </PageContainer>
  );
};


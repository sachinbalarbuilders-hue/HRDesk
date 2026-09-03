import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { exportToCSV } from '../utils/csvHelper';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { DataToolbar } from '../components/ui/DataToolbar';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Calendar,
  Sparkles,
  Umbrella,
} from 'lucide-react';
import { DayActivityDrawer } from '../components/attendance/DayActivityDrawer';

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
  const { currentOrganization, currentBranch } = useOrganization();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
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
      case 'H':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-purple-500 text-white font-bold shadow-xs hover:brightness-110 transition-all select-none"
            title="Public Holiday"
          >
            <Sparkles size={13} strokeWidth={2.5} />
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
      case 'COHF':
      case 'CHF':
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-500 text-white shadow-xs hover:brightness-110 transition-all select-none"
            title={code.includes('PL') ? 'Paid Leave (1st Half)' : code.includes('SL') ? 'Sick Leave (1st Half)' : code.includes('CO') || code.includes('CHF') ? 'Comp Off (Half Day)' : 'First Half Leave'}
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
            title={code.includes('PL') ? 'Paid Leave (2nd Half)' : code.includes('SL') ? 'Sick Leave (2nd Half)' : code.includes('CO') ? 'Comp Off (2nd Half)' : 'Second Half Leave'}
          >
            <RightHalfStar size={15} />
          </span>
        );

      // Full Day Leaves & Comp-Off -> Universal Beach Umbrella Icon (bg-teal-500)
      case 'CO':
      case 'COMP OFF':
      case 'COMPOFF':
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
            title={code === 'CO' || code === 'COMP OFF' || code === 'COMPOFF' ? 'Comp Off' : 'Leave'}
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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const fetchLookups = async () => {
    try {
      const deptRes = await apiClient.get('/masters/departments', {
        params: { branchId: currentBranch?.id || undefined }
      });
      setDepartments(deptRes.data?.items || (Array.isArray(deptRes.data) ? deptRes.data : []));
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

  useEffect(() => {
    fetchAttendanceSheet();
  }, [year, month, search, departmentId, currentOrganization?.id, currentBranch?.id, page, pageSize]);

  useEffect(() => {
    const handleReload = () => {
      setPage(1);
      fetchAttendanceSheet();
    };

    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);

    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, []);

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

  const handleExportAttendance = () => {
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
  };

  return (
    <PageContainer>
      <PageHeader
        title="Attendance"
        description="Daily attendance records and biometric logs"
      />

      {/* Unified Data Toolbar */}
      <DataToolbar
        searchPlaceholder="Search employee in monthly muster..."
        searchValue={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        filters={[
          {
            id: 'department',
            ariaLabel: 'Department Filter',
            value: departmentId,
            onChange: (v: string) => { setDepartmentId(v); setPage(1); },
            options: [
              { value: '', label: 'All Departments' },
              ...departments
                .filter((d: any) => !currentBranch?.id || String(d.branchId) === String(currentBranch.id))
                .map((d: any) => ({ value: String(d.departmentId || d.id), label: d.departmentName })),
            ],
          },
        ]}
        onExport={handleExportAttendance}
        exportLabel="Export CSV"
        onImport={() => setImportModalOpen(true)}
        importLabel="Import CSV"
      >
        <div className="flex items-center gap-1.5 bg-[var(--paper)] border border-[var(--rule)] rounded-lg p-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-serif font-bold text-xs px-2 text-[var(--ink)] whitespace-nowrap min-w-[130px] text-center">
            {monthNames[month - 1]} {year}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </DataToolbar>

      {/* Main Monthly Muster Ledger Matrix Card */}
      {loading ? (
        <div className="card p-6">
          <TableSkeleton rows={10} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Attendance Status Legend (Top Bar) */}
          <div className="border-b border-[var(--rule)] px-4 py-2 bg-[var(--surface-secondary)]/40 flex items-center justify-between gap-4 text-xs overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[11px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">Legend:</span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium shrink-0">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500 text-white shadow-2xs">
                  <Check size={11} strokeWidth={3.5} />
                </span>
                <span>Present</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium shrink-0">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-rose-500 text-white shadow-2xs">
                  <X size={11} strokeWidth={3.5} />
                </span>
                <span>Absent</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium shrink-0">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white shadow-2xs">
                  <Calendar size={10} strokeWidth={2.5} />
                </span>
                <span>Week Off</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium shrink-0">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-purple-500 text-white shadow-2xs">
                  <Sparkles size={10} strokeWidth={2.5} />
                </span>
                <span>Holiday</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium shrink-0">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500 text-white shadow-2xs">
                  <LeftHalfStar size={11} />
                </span>
                <span>1st Half Leave</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium shrink-0">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500 text-white shadow-2xs">
                  <RightHalfStar size={11} />
                </span>
                <span>2nd Half Leave</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--ink)] font-medium shrink-0">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-teal-500 text-white shadow-2xs">
                  <Umbrella size={10} strokeWidth={2.5} />
                </span>
                <span>Leave</span>
              </span>
            </div>
            <span className="text-[11px] text-[var(--ink-muted)] italic shrink-0 whitespace-nowrap ml-auto">
              Click any date to inspect punch timeline
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="ledger-table w-full text-xs">
              <thead>
                <tr>
                  <th className="w-12 min-w-[48px] max-w-[48px] text-center sticky left-0 z-20 bg-[var(--paper)] font-mono text-[11px] uppercase tracking-wider text-[var(--ink-muted)] border-r border-[var(--rule)]">
                    Sr.
                  </th>
                  <th className="min-w-[190px] max-w-[220px] sticky left-[48px] z-20 bg-[var(--paper)] shadow-[2px_0_4px_rgba(0,0,0,0.06)] text-left font-semibold text-xs text-[var(--ink)] border-r border-[var(--rule)] px-3">
                    Employee Name
                  </th>
                  {Array.from({ length: data?.daysInMonth || 31 }, (_, i) => i + 1).map((d) => (
                    <th
                      key={d}
                      className="w-9 min-w-[34px] max-w-[36px] text-center p-1 font-data text-[11px] text-[var(--ink-muted)] border-r border-[var(--rule)]/40"
                    >
                      {d}
                    </th>
                  ))}
                  <th className="w-14 text-center font-data text-xs border-l-2 border-[var(--rule)] text-[var(--ok-600)]" title="Present Days">
                    P
                  </th>
                  <th className="w-14 text-center font-data text-xs text-[var(--err-600)]" title="Absent Days">
                    A
                  </th>
                  <th className="w-14 text-center font-data text-xs text-[var(--ink-muted)]" title="Week Off Days">
                    WO
                  </th>
                  <th className="w-16 text-center font-data text-xs font-bold text-[var(--accent)] bg-[var(--paper-subtle)]" title="Total Payable Days">
                    Payable
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.items?.map((row: any, idx: number) => {
                  const empIndex = (page - 1) * pageSize + idx + 1;
                  return (
                    <tr key={row.employee.employeeId} className="hover:bg-[var(--paper-subtle)] transition-colors">
                      <td className="w-12 min-w-[48px] max-w-[48px] sticky left-0 z-10 bg-[var(--paper)] text-center font-mono text-[11px] text-[var(--ink-muted)] border-r border-[var(--rule)]">
                        {empIndex}
                      </td>
                      <td className="min-w-[190px] max-w-[220px] sticky left-[48px] z-10 bg-[var(--paper)] shadow-[2px_0_4px_rgba(0,0,0,0.06)] px-3 py-2 border-r border-[var(--rule)]">
                        <div className="font-semibold text-xs text-[var(--ink)] truncate max-w-[180px]">
                          {row.employee.employeeName}
                        </div>
                      </td>

                      {Array.from({ length: data?.daysInMonth || 31 }, (_, i) => i + 1).map((d) => {
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
      )}

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Biometric Punch Ledger"
        templateFilename="HRDesk_Biometric_Punches"
        templateHeaders={['EmployeeId', 'PunchDate', 'InTime', 'OutTime', 'MachineCode']}
        templateSampleRow={['1042', '2026-08-15', '09:12:00', '18:05:00', 'DEVICE_01']}
        onImportComplete={() => {
          setImportModalOpen(false);
          fetchAttendanceSheet();
        }}
      />

      {/* Day Activity & In/Out Audit Timeline Drawer */}
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

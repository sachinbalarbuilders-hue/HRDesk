import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { exportToCSV } from '../utils/csvHelper';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { DataToolbar } from '../components/ui/DataToolbar';
import { useToast } from '../context/ToastContext';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Activity,
} from 'lucide-react';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';

export const Attendance: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'matrix' | 'daily_logs'>('matrix');
  const [data, setData] = useState<any>(null);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const fetchDepartments = async () => {
    try {
      const res = await apiClient.get('/employees/lookups');
      setDepartments(res.data?.departments || []);
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchAttendanceSheet = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/attendance/monthly-sheet', {
        params: {
          year,
          month,
          search: search || undefined,
          departmentId: departmentId || undefined,
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
          departmentId: departmentId || undefined,
        },
      });
      setDailyLogs(res.data || []);
    } catch (err: any) {
      showError('Failed to fetch biometric feed', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'matrix') {
      fetchAttendanceSheet();
    } else {
      fetchDailyLogs();
    }
  }, [activeTab, year, month, selectedDate, search, departmentId, page, pageSize]);

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

  const handleExportAttendance = () => {
    if (activeTab === 'matrix') {
      if (!data?.items?.length) {
        showError('Export Empty', 'No attendance matrix records to export.');
        return;
      }

      const rows = data.items.map((item: any) => ({
        employeeId: item.employee.employeeId,
        employeeName: item.employee.employeeName,
        department: item.employee.department || 'General',
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
    } else {
      if (!dailyLogs.length) {
        showError('Export Empty', 'No raw biometric punches to export for this date.');
        return;
      }

      const headers = [
        { key: 'employeeName', label: 'Employee Name' },
        { key: 'department', label: 'Department' },
        { key: 'inTime', label: 'Punch In Time' },
        { key: 'outTime', label: 'Punch Out Time' },
        { key: 'status', label: 'Daily Status' },
        { key: 'lateMinutes', label: 'Late Minutes' },
      ];

      exportToCSV(`Biometric_Punch_Feed_${selectedDate}`, dailyLogs, headers);
      showSuccess('Punch Feed Exported', `Biometric logs for ${selectedDate} downloaded.`);
    }
  };

  const daysInMonth = data?.daysInMonth || 31;
  const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* 1. Header with Display Serif, Register Rule, and View Tabs */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Attendance Sheet
            </h1>
            <p className="text-xs text-[var(--ink-muted)] font-ui mt-0.5">
              Monthly muster register & daily biometric punch records
            </p>
          </div>

          {/* View Switcher */}
          <div className="flex items-center gap-1 bg-[var(--surface-header)] p-0.5 rounded-[4px] border border-[var(--rule)]">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1 text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-1.5 ${
                activeTab === 'matrix'
                  ? 'bg-[var(--surface)] text-[var(--gold-500)] shadow-sm'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Layers size={13} />
              <span>31-Day Ledger</span>
            </button>
            <button
              onClick={() => setActiveTab('daily_logs')}
              className={`px-3 py-1 text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-1.5 ${
                activeTab === 'daily_logs'
                  ? 'bg-[var(--surface)] text-[var(--gold-500)] shadow-sm'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Activity size={13} />
              <span>Biometric Feed</span>
            </button>
          </div>
        </div>

        {/* Signature Register Rule */}
        <div className="register-rule pt-1" />
      </div>

      {/* 2. Unified Common Action Toolbar with Search, Department Filter, Month Picker, Export, and Import */}
      <DataToolbar
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder={activeTab === 'matrix' ? 'Search attendance by staff name or record ID...' : 'Filter biometric logs...'}
        filters={[
          {
            id: 'department',
            value: departmentId,
            onChange: (val) => {
              setDepartmentId(val);
              setPage(1);
            },
            options: [
              { value: '', label: 'All Departments' },
              ...departments.map((d) => ({ value: d.departmentId.toString(), label: d.departmentName })),
            ],
          },
        ]}
        onExport={handleExportAttendance}
        exportLabel={activeTab === 'matrix' ? 'Export Ledger' : 'Export Punches'}
        onImport={() => setImportModalOpen(true)}
        importLabel="Import Punches"
      >
        {/* Custom Section Control: Month Picker for Matrix or Date for Daily Logs */}
        {activeTab === 'matrix' ? (
          <div className="flex items-center gap-1 bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] px-1.5 py-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-[2px] hover:bg-[var(--surface)] text-[var(--ink)] cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="px-2 font-semibold text-xs text-[var(--ink)] font-data">
              {monthNames[month - 1]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-[2px] hover:bg-[var(--surface)] text-[var(--ink)] cursor-pointer"
              title="Next Month"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--ink-muted)] font-ui">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="register-input py-1 px-2 text-xs font-data"
            />
          </div>
        )}
      </DataToolbar>

      {/* 31-Day Ledger View */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Status Legend Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] text-xs font-ui">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="status-dot-ok" />
                <span className="font-data text-[11px] text-[var(--ok-600)]">P : Present</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="status-dot-err" />
                <span className="font-data text-[11px] text-[var(--err-600)]">A : Absent (LOP)</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--navy-700)]" />
                <span className="font-data text-[11px] text-[var(--ink-muted)]">W/O : Week Off</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="status-dot-warn" />
                <span className="font-data text-[11px] text-[var(--warn-600)]">COHF : Comp-Off Half</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7]" />
                <span className="font-data text-[11px] text-[#A855F7]">H : Holiday</span>
              </span>
            </div>

            <span className="font-data text-[11px] text-[var(--ink-muted)]">
              {data?.totalCount || 0} Staff on Roster
            </span>
          </div>

          {/* Ruled 31-Day Ledger Grid */}
          <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
            {loading ? (
              <div className="p-6 space-y-3 animate-pulse bg-[var(--surface)]">
                <div className="h-4 w-48 bg-[var(--rule)]/60 rounded-[2px]" />
                <div className="divide-y divide-[var(--rule)]">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-9 flex items-center justify-between px-2">
                      <div className="h-3 w-40 bg-[var(--rule)]/50 rounded-[2px]" />
                      <div className="flex gap-2">
                        <div className="h-3 w-6 bg-[var(--rule)]/40 rounded-[2px]" />
                        <div className="h-3 w-6 bg-[var(--rule)]/40 rounded-[2px]" />
                        <div className="h-3 w-6 bg-[var(--rule)]/40 rounded-[2px]" />
                        <div className="h-3 w-10 bg-[var(--rule)]/50 rounded-[2px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--surface-header)] text-[var(--ink-muted)] font-semibold border-b border-[var(--rule)]">
                        <th className="sticky left-0 z-20 bg-[var(--surface-header)] py-2 px-3 text-left min-w-[180px] border-r border-[var(--rule)] font-ui uppercase tracking-wider text-[11px]">
                          Staff Member
                        </th>
                        {dayColumns.map((day) => {
                          const dayOfWeek = new Date(year, month - 1, day).getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                          return (
                            <th
                              key={day}
                              className={`py-1.5 px-0.5 min-w-[30px] border-r border-[var(--rule)]/60 font-data text-[11px] ${
                                isWeekend ? 'bg-[var(--surface-weekend)]' : ''
                              }`}
                            >
                              <span className="block text-[8px] text-[var(--ink-muted)] font-ui">
                                {new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'narrow' })}
                              </span>
                              <span>{day}</span>
                            </th>
                          );
                        })}
                        <th className="py-1 px-1.5 bg-[var(--surface-header)] text-[var(--ok-600)] font-data font-bold min-w-[35px] border-l border-[var(--rule)]">P</th>
                        <th className="py-1 px-1.5 bg-[var(--surface-header)] text-[var(--err-600)] font-data font-bold min-w-[35px]">A</th>
                        <th className="py-1 px-1.5 bg-[var(--surface-header)] text-[var(--ink-muted)] font-data font-bold min-w-[35px]">WO</th>
                        <th className="py-1 px-2 bg-[var(--gold-100)] text-[var(--gold-500)] font-data font-bold min-w-[55px] border-l border-[var(--gold-500)]">
                          Payable
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--rule)]">
                      {data?.items?.map((item: any) => (
                        <tr key={item.employee.employeeId} className="hover:bg-[var(--surface-hover)]">
                          <td className="sticky left-0 z-10 bg-[var(--surface)] py-2 px-3 text-left border-r border-[var(--rule)]">
                            <p className="font-semibold text-[var(--ink)] truncate max-w-[160px] font-ui">
                              {item.employee.employeeName}
                            </p>
                            <p className="text-[10px] text-[var(--ink-muted)] font-data truncate">
                              #{item.employee.employeeId} · {item.employee.department || 'General'}
                            </p>
                          </td>
                          {dayColumns.map((day) => {
                            const rec = item.dailyRecords?.[day.toString()];
                            const status = rec?.status || '-';
                            const dayOfWeek = new Date(year, month - 1, day).getDay();
                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                            let markColor = 'text-[var(--rule)]';
                            if (status === 'P') markColor = 'text-[var(--ok-600)] font-bold';
                            else if (status === 'A') markColor = 'text-[var(--err-600)] font-bold';
                            else if (status === 'W/O') markColor = 'text-[var(--ink-muted)] font-medium';
                            else if (status.endsWith('HF')) markColor = 'text-[var(--warn-600)] font-bold';
                            else if (status === 'H') markColor = 'text-[#A855F7] font-bold';

                            return (
                              <td
                                key={day}
                                title={rec?.tooltip || (rec?.inTime ? `In: ${rec.inTime} | Out: ${rec.outTime || 'None'}` : '')}
                                className={`py-1 px-0.5 border-r border-[var(--rule)]/40 font-data text-[10px] cursor-default ${
                                  isWeekend ? 'bg-[var(--surface-weekend-cell)]' : ''
                                } ${markColor}`}
                              >
                                {status}
                              </td>
                            );
                          })}
                          <td className="py-1 px-1 font-data font-bold text-[var(--ok-600)] border-l border-[var(--rule)]">
                            {item.summary?.presentDays}
                          </td>
                          <td className="py-1 px-1 font-data font-bold text-[var(--err-600)]">
                            {item.summary?.absentDays}
                          </td>
                          <td className="py-1 px-1 font-data font-bold text-[var(--ink-muted)]">
                            {item.summary?.weekoffDays}
                          </td>
                          <td className="py-1 px-1.5 font-data font-bold text-[var(--gold-500)] bg-[var(--gold-100)] border-l border-[var(--gold-500)]">
                            {item.summary?.payableDays}
                          </td>
                        </tr>
                      ))}

                      {data?.items?.length === 0 && !loading && (
                        <tr>
                          <td colSpan={daysInMonth + 5} className="py-10 text-center text-xs font-data text-[var(--ink-muted)]">
                            0 attendance records matching criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {data && (
                  <PaginationToolbar
                    page={page}
                    pageSize={pageSize}
                    totalCount={data.totalCount || 0}
                    totalPages={data.totalPages || 1}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    pageSizeOptions={[20, 50, 100, 200]}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Daily Raw Biometric Feed */}
      {activeTab === 'daily_logs' && (
        <div className="space-y-4">
          <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
            <table className="register-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th className="text-right font-data">In Time</th>
                  <th className="text-right font-data">Out Time</th>
                  <th>Shift</th>
                  <th>Muster Status</th>
                  <th className="text-right">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {dailyLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="font-semibold text-[var(--ink)]">
                      {log.employeeName}
                    </td>
                    <td className="text-[var(--ink-muted)] text-xs">{log.department || 'General'}</td>
                    <td className="text-right font-data text-xs text-[var(--ink)]">
                      {log.inTime || '--:--'}
                    </td>
                    <td className="text-right font-data text-xs text-[var(--ink)]">
                      {log.outTime || '--:--'}
                    </td>
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

                {dailyLogs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs font-data text-[var(--ink-muted)]">
                      No raw punches recorded for {selectedDate}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Import Biometric Punches Modal */}
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
          else fetchDailyLogs();
        }}
      />
    </div>
  );
};

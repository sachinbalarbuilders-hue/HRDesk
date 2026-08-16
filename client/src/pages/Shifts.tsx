import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Building2,
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
}

export const Shifts: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [shifts, setShifts] = useState<ShiftMaster[]>([]);
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

  const [assignForm, setAssignForm] = useState({
    employeeIds: [] as number[],
    shiftId: 1,
    isWeekOff: false,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [shiftForm, setShiftForm] = useState({
    shiftName: '',
    shiftCode: '',
    startTime: '09:00',
    endTime: '18:00',
    lateComingGraceMinutes: 15,
    earlyLeaveGraceMinutes: 15,
    colorCode: '#4e73df',
  });

  const fetchLookups = async () => {
    try {
      const [deptRes, empRes, shiftsRes] = await Promise.all([
        apiClient.get('/employees/lookups'),
        apiClient.get('/employees?pageSize=200'),
        apiClient.get('/shifts'),
      ]);
      setDepartments(deptRes.data?.departments || []);
      const emps = (empRes.data.items || []).map((e: any) => ({
        employeeId: e.employeeId || e.id,
        employeeName: e.employeeName || e.name,
      }));
      setEmployees(emps);
      const sList = shiftsRes.data || [];
      setShifts(sList);
      if (sList.length > 0) {
        setAssignForm(prev => ({ ...prev, shiftId: sList[0].id }));
      }
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  useEffect(() => {
    fetchLookups();
  }, []);

  const weekStartStr = currentWeekStart.toISOString().split('T')[0];

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/shifts/roster', {
        params: {
          startDate: weekStartStr,
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
  }, [weekStartStr, departmentFilter, search, page, pageSize]);

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
      await apiClient.post('/shifts/roster/assign', assignForm);
      showSuccess('Roster Assigned', 'Shift assignments saved to roster database.');
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
      await apiClient.post('/shifts', shiftForm);
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

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="border-b border-[var(--rule)] pb-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono tracking-widest text-[var(--accent)] uppercase font-semibold">
            Shift & Roster Register
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          <span className="text-[11px] font-mono text-[var(--ink-muted)]">Weekly Roster Scheduling</span>
        </div>
        <h1 className="text-2xl font-serif font-bold tracking-tight text-[var(--ink)] mt-1">
          Shift Roster & Master Register
        </h1>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Assign shift timings, grace periods, rotating weekly rosters, and designated week-offs.
        </p>
      </div>

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
              ...departments.map((d: any) => ({ value: String(d.departmentId || d.id), label: d.departmentName })),
            ],
          },
        ]}
        onExport={handleExport}
        onImport={() => setImportModalOpen(true)}
        importLabel="Import Roster"
        primaryAction={{
          label: 'Assign Shifts / Week-Off',
          icon: <Plus className="w-3.5 h-3.5" />,
          onClick: () => setAssignModalOpen(true),
        }}
      >
        <button
          type="button"
          onClick={() => setShiftModalOpen(true)}
          className="btn-outline text-xs flex items-center gap-1 py-1.5 px-2.5 cursor-pointer"
        >
          <Plus className="w-3 h-3 text-[var(--accent)]" />
          <span>New Shift</span>
        </button>

        <div className="flex items-center gap-1.5 bg-[var(--paper)] border border-[var(--rule)] rounded-lg p-1">
          <button
            onClick={handlePrevWeek}
            className="p-1 rounded hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors"
            title="Previous Week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-serif font-bold text-xs px-2 text-[var(--ink)] whitespace-nowrap">
            {weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button
            onClick={handleNextWeek}
            className="p-1 rounded hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors"
            title="Next Week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </DataToolbar>

      {/* 3. Shifts Master Legend */}
      <div className="flex items-center gap-2 flex-wrap text-[11px] p-3 rounded-lg bg-[var(--paper-subtle)] border border-[var(--rule)]">
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
                <tr className="border-b border-[var(--rule)] bg-[var(--paper-subtle)] text-[var(--ink-muted)] font-mono text-[11px] uppercase tracking-wider">
                  <th className="p-3.5 font-semibold min-w-[200px]">Employee</th>
                  {weekDays.map((d, i) => (
                    <th key={i} className="p-3.5 text-center font-semibold">
                      <div>{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                      <div className="text-[10px] text-[var(--ink-muted)] font-normal">{d.getDate()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {roster.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-[var(--paper-subtle)] transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-[var(--ink)]">{r.employeeName}</div>
                      <div className="text-[11px] text-[var(--ink-muted)] flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        <span>{r.department} • {r.designation}</span>
                      </div>
                    </td>

                    {weekDays.map((_, i) => {
                      const code = r.schedule[String(i)] || 'GEN';
                      const isWo = code === 'W/O' || code === 'WO';

                      return (
                        <td key={i} className="p-3.5 text-center font-mono">
                          <span
                            className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${
                              isWo
                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                : 'bg-indigo-50 dark:bg-indigo-950/60 text-[var(--accent)] border border-indigo-200 dark:border-indigo-800'
                            }`}
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

      {/* 5. Assign Shift / Week-Off Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--paper-subtle)]">
              <div>
                <h3 className="font-serif font-bold text-base text-[var(--ink)]">Assign Shift Schedule</h3>
                <p className="text-[11px] text-[var(--ink-muted)]">Assign duty shifts or designate weekly off for employee(s).</p>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--ink-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--ink)] mb-1">Select Employees *</label>
                <select
                  multiple
                  value={assignForm.employeeIds.map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, o => parseInt(o.value));
                    setAssignForm({ ...assignForm, employeeIds: selected });
                  }}
                  className="input-field w-full font-medium h-28"
                  required
                >
                  {employees.map((e) => (
                    <option key={e.employeeId} value={e.employeeId}>
                      {e.employeeName} (#{e.employeeId})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-[var(--ink-muted)] mt-1 block">Hold Ctrl (Windows) / Cmd (Mac) to select multiple.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={assignForm.startDate}
                    onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value, endDate: e.target.value >= assignForm.endDate ? e.target.value : assignForm.endDate })}
                    className="input-field w-full font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">End Date *</label>
                  <input
                    type="date"
                    value={assignForm.endDate}
                    onChange={(e) => setAssignForm({ ...assignForm, endDate: e.target.value })}
                    className="input-field w-full font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--ink)] mb-1">Target Shift *</label>
                <select
                  disabled={assignForm.isWeekOff}
                  value={assignForm.shiftId}
                  onChange={(e) => setAssignForm({ ...assignForm, shiftId: parseInt(e.target.value) || 1 })}
                  className="input-field w-full font-medium disabled:opacity-50"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shiftName} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={assignForm.isWeekOff}
                  onChange={(e) => setAssignForm({ ...assignForm, isWeekOff: e.target.checked })}
                  className="rounded border-[var(--rule)] text-[var(--accent)]"
                />
                <span className="font-medium text-[var(--ink)]">Designate as Weekly Off (W/O)</span>
              </label>

              <div className="pt-2 border-t border-[var(--rule)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="btn-secondary py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-1.5 px-4 flex items-center gap-1.5"
                >
                  {submitting ? 'Saving...' : 'Apply Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. New Shift Master Modal */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--paper-subtle)]">
              <div>
                <h3 className="font-serif font-bold text-base text-[var(--ink)]">Create Shift Master</h3>
                <p className="text-[11px] text-[var(--ink-muted)]">Configure start/end timings and grace periods.</p>
              </div>
              <button
                onClick={() => setShiftModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--ink-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-[var(--ink)] mb-1">Shift Name *</label>
                  <input
                    type="text"
                    value={shiftForm.shiftName}
                    onChange={(e) => setShiftForm({ ...shiftForm, shiftName: e.target.value })}
                    placeholder="e.g. General Shift, Night Shift"
                    className="input-field w-full font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Code *</label>
                  <input
                    type="text"
                    value={shiftForm.shiftCode}
                    onChange={(e) => setShiftForm({ ...shiftForm, shiftCode: e.target.value.toUpperCase() })}
                    placeholder="GEN"
                    className="input-field w-full font-mono uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    className="input-field w-full font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">End Time *</label>
                  <input
                    type="time"
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    className="input-field w-full font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Late Grace (Mins)</label>
                  <input
                    type="number"
                    value={shiftForm.lateComingGraceMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, lateComingGraceMinutes: parseInt(e.target.value) || 0 })}
                    className="input-field w-full font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ink)] mb-1">Early Grace (Mins)</label>
                  <input
                    type="number"
                    value={shiftForm.earlyLeaveGraceMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, earlyLeaveGraceMinutes: parseInt(e.target.value) || 0 })}
                    className="input-field w-full font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--rule)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShiftModalOpen(false)}
                  className="btn-secondary py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-1.5 px-4 flex items-center gap-1.5"
                >
                  {submitting ? 'Creating...' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Bulk Import Modal */}
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
    </div>
  );
};

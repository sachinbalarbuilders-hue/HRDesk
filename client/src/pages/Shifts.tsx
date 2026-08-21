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
  halfTime?: string;
}

export const Shifts: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();
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
  const [empVisibleCount, setEmpVisibleCount] = useState(20);

  const [assignForm, setAssignForm] = useState({
    employeeIds: [] as number[],
    shiftId: 1,
    isWeekOff: false,
    overwrite: false,
    updateMasterShift: false,
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
    halfTime: '13:30',
    colorCode: '#4e73df',
  });

  const fetchLookups = async () => {
    try {
      const [deptRes, empRes, shiftsRes] = await Promise.all([
        apiClient.get('/employees/lookups', { params: { branchId: currentBranch?.id || undefined } }),
        apiClient.get('/employees?pageSize=200', { params: { branchId: currentBranch?.id || undefined } }),
        apiClient.get('/shifts', { params: { branchId: currentBranch?.id || undefined } }),
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
      await apiClient.post('/shifts/roster/assign', {
        ...assignForm,
        branchId: currentBranch?.id ? parseInt(currentBranch.id) : undefined
      });
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

  return (
    <PageContainer>
      <PageHeader title="Shift Management" description="Configure shifts and assign rosters" />

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
              ...departments.filter((d: any) => !currentBranch?.id || String(d.branchId) === String(currentBranch.id)).map((d: any) => ({ value: String(d.departmentId || d.id), label: d.departmentName })),
            ],
          },
        ]}
        onExport={handleExport}
        onImport={() => setImportModalOpen(true)}
        primaryAction={{
          label: 'Assign Shifts / Week-Off',
          icon: <Plus className="w-3.5 h-3.5" />,
          onClick: () => setAssignModalOpen(true),
        }}
      >
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
                <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
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
                {roster.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-[var(--surface-hover)]">
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
              <EmployeeMultiSelect
                label="Select Employees"
                selectedIds={assignForm.employeeIds}
                onChange={(ids) => setAssignForm({ ...assignForm, employeeIds: ids })}
                required
                pageSize={20}
                branchId={currentBranch?.id}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Start Date *</label>
                  <input
                    type="date"
                    value={assignForm.startDate}
                    onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value, endDate: e.target.value >= assignForm.endDate ? e.target.value : assignForm.endDate })}
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
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Target Shift *</label>
                <select
                  disabled={assignForm.isWeekOff}
                  value={assignForm.shiftId}
                  onChange={(e) => setAssignForm({ ...assignForm, shiftId: parseInt(e.target.value) || 1 })}
                  className="register-input disabled:opacity-50"
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
                  className="rounded border-[var(--border)] text-[var(--accent)]"
                />
                <span className="text-sm font-medium text-[var(--text-primary)]">Designate as Weekly Off (W/O)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignForm.overwrite}
                  onChange={(e) => setAssignForm({ ...assignForm, overwrite: e.target.checked })}
                  className="rounded border-[var(--border)] text-[var(--accent)]"
                />
                <span className="text-sm font-medium text-[var(--text-primary)]">Overwrite existing roster entries</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignForm.updateMasterShift}
                  onChange={(e) => setAssignForm({ ...assignForm, updateMasterShift: e.target.checked })}
                  className="rounded border-[var(--border)] text-[var(--accent)]"
                />
                <span className="text-sm font-medium text-[var(--text-primary)]">Update master shift assignment</span>
              </label>
              <p className="text-[11px] text-[var(--text-muted)] -mt-2 ml-6">Changes the employee's default shift going forward.</p>

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
                  disabled={submitting}
                  className="btn-primary"
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
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-[var(--surface)] h-full shadow-[var(--shadow-xl)] flex flex-col border-l border-[var(--border)] animate-slide-in-right">
            <div className="p-5 pb-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Create Shift Master</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Configure start/end timings and grace periods.</p>
              </div>
              <button
                onClick={() => setShiftModalOpen(false)}
                className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Shift Name *</label>
                  <input
                    type="text"
                    value={shiftForm.shiftName}
                    onChange={(e) => setShiftForm({ ...shiftForm, shiftName: e.target.value })}
                    placeholder="e.g. General Shift, Night Shift"
                    className="register-input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Code *</label>
                  <input
                    type="text"
                    value={shiftForm.shiftCode}
                    onChange={(e) => setShiftForm({ ...shiftForm, shiftCode: e.target.value.toUpperCase() })}
                    placeholder="GEN"
                    className="register-input font-data uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Start Time *</label>
                  <input
                    type="time"
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    className="register-input font-data"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">End Time *</label>
                  <input
                    type="time"
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    className="register-input font-data"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Late Grace (Mins)</label>
                  <input
                    type="number"
                    value={shiftForm.lateComingGraceMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, lateComingGraceMinutes: parseInt(e.target.value) || 0 })}
                    className="register-input font-data"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Early Grace (Mins)</label>
                  <input
                    type="number"
                    value={shiftForm.earlyLeaveGraceMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, earlyLeaveGraceMinutes: parseInt(e.target.value) || 0 })}
                    className="register-input font-data"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">Half Day Cutoff Time</label>
                <input
                  type="time"
                  value={shiftForm.halfTime || ''}
                  onChange={(e) => setShiftForm({ ...shiftForm, halfTime: e.target.value })}
                  className="register-input font-data w-full"
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1">If not set, it is calculated automatically as the exact midpoint of the shift.</p>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShiftModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
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
    </PageContainer>
  );
};


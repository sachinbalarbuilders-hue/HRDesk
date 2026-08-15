import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
} from 'lucide-react';

interface EmployeeShift {
  employeeId: number;
  employeeName: string;
  department: string;
  designation: string;
  schedule: Record<string, string>; // date string YYYY-MM-DD -> shiftCode (GEN, MORN, EVE, NIGHT, WO)
}

export const Shifts: React.FC = () => {
  const { showSuccess } = useToast();
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(d.setDate(diff));
  });

  // Modal States
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [bulkShiftForm, setBulkShiftForm] = useState({
    targetDepartment: '',
    shiftCode: 'GEN',
    effectiveFrom: new Date().toISOString().split('T')[0],
  });

  // Shift Definitions Master
  const SHIFTS_LIST = [
    { code: 'GEN', name: 'General Shift (09:00 - 18:00)', color: 'bg-[var(--navy-900)] text-[var(--gold-500)]' },
    { code: 'MORN', name: 'Morning Shift (06:00 - 15:00)', color: 'bg-[var(--ok-600)]/15 text-[var(--ok-600)] border border-[var(--ok-600)]/30' },
    { code: 'EVE', name: 'Evening Shift (14:00 - 23:00)', color: 'bg-[var(--warn-600)]/15 text-[var(--warn-600)] border border-[var(--warn-600)]/30' },
    { code: 'NIGHT', name: 'Night Shift (22:00 - 07:00)', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30' },
    { code: 'W/O', name: 'Weekly Off', color: 'bg-[var(--paper)] text-[var(--ink-muted)] border border-[var(--rule)]' },
  ];

  // Helper: Get 7 days of the active week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Initial Mock Roster
  const [roster, setRoster] = useState<EmployeeShift[]>([
    {
      employeeId: 1,
      employeeName: 'Ramesh Patel',
      department: 'Engineering & Technology',
      designation: 'Lead Architect',
      schedule: {
        '0': 'GEN', '1': 'GEN', '2': 'GEN', '3': 'GEN', '4': 'GEN', '5': 'GEN', '6': 'W/O'
      }
    },
    {
      employeeId: 2,
      employeeName: 'Priya Sharma',
      department: 'Human Resources & People',
      designation: 'HR Specialist',
      schedule: {
        '0': 'GEN', '1': 'GEN', '2': 'GEN', '3': 'GEN', '4': 'GEN', '5': 'W/O', '6': 'W/O'
      }
    },
    {
      employeeId: 3,
      employeeName: 'Anil Kumar',
      department: 'Operations & Logistics',
      designation: 'Site Supervisor',
      schedule: {
        '0': 'MORN', '1': 'MORN', '2': 'MORN', '3': 'MORN', '4': 'MORN', '5': 'MORN', '6': 'W/O'
      }
    },
    {
      employeeId: 4,
      employeeName: 'Sunita Reddy',
      department: 'Engineering & Technology',
      designation: 'Senior Developer',
      schedule: {
        '0': 'EVE', '1': 'EVE', '2': 'EVE', '3': 'EVE', '4': 'EVE', '5': 'EVE', '6': 'W/O'
      }
    },
    {
      employeeId: 5,
      employeeName: 'Vikram Mehta',
      department: 'Finance & Accounts',
      designation: 'Financial Controller',
      schedule: {
        '0': 'GEN', '1': 'GEN', '2': 'GEN', '3': 'GEN', '4': 'GEN', '5': 'W/O', '6': 'W/O'
      }
    },
    {
      employeeId: 6,
      employeeName: 'Kavita Joshi',
      department: 'Operations & Logistics',
      designation: 'Night Dispatch Officer',
      schedule: {
        '0': 'NIGHT', '1': 'NIGHT', '2': 'NIGHT', '3': 'NIGHT', '4': 'NIGHT', '5': 'W/O', '6': 'W/O'
      }
    }
  ]);

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

  const handleToggleCellShift = (empId: number, dayIdx: number) => {
    const shiftCycle = ['GEN', 'MORN', 'EVE', 'NIGHT', 'W/O'];
    setRoster((prev) =>
      prev.map((emp) => {
        if (emp.employeeId === empId) {
          const current = emp.schedule[dayIdx.toString()] || 'GEN';
          const nextIdx = (shiftCycle.indexOf(current) + 1) % shiftCycle.length;
          const nextShift = shiftCycle[nextIdx];
          return {
            ...emp,
            schedule: {
              ...emp.schedule,
              [dayIdx.toString()]: nextShift,
            },
          };
        }
        return emp;
      })
    );
  };

  const handleExportRoster = () => {
    const headers = [
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee Name' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'mon', label: `Mon (${weekDays[0].toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })})` },
      { key: 'tue', label: `Tue (${weekDays[1].toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })})` },
      { key: 'wed', label: `Wed (${weekDays[2].toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })})` },
      { key: 'thu', label: `Thu (${weekDays[3].toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })})` },
      { key: 'fri', label: `Fri (${weekDays[4].toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })})` },
      { key: 'sat', label: `Sat (${weekDays[5].toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })})` },
      { key: 'sun', label: `Sun (${weekDays[6].toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })})` },
    ];

    const rows = filteredRoster.map((emp) => ({
      employeeId: emp.employeeId,
      employeeName: emp.employeeName,
      department: emp.department,
      designation: emp.designation,
      mon: emp.schedule['0'] || 'GEN',
      tue: emp.schedule['1'] || 'GEN',
      wed: emp.schedule['2'] || 'GEN',
      thu: emp.schedule['3'] || 'GEN',
      fri: emp.schedule['4'] || 'GEN',
      sat: emp.schedule['5'] || 'W/O',
      sun: emp.schedule['6'] || 'W/O',
    }));

    exportToCSV(`Shift_Roster_${weekDays[0].toISOString().split('T')[0]}`, rows, headers);
    showSuccess('Roster Exported', 'Weekly shift schedule downloaded to CSV.');
  };

  const handleBulkAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkShiftForm.shiftCode) return;

    setRoster((prev) =>
      prev.map((emp) => {
        if (!bulkShiftForm.targetDepartment || emp.department === bulkShiftForm.targetDepartment) {
          const updated: Record<string, string> = {};
          for (let i = 0; i < 6; i++) updated[i.toString()] = bulkShiftForm.shiftCode;
          updated['6'] = 'W/O';
          return { ...emp, schedule: updated };
        }
        return emp;
      })
    );

    showSuccess('Shift Assigned', `Assigned ${bulkShiftForm.shiftCode} shift to ${bulkShiftForm.targetDepartment || 'all departments'}.`);
    setAssignModalOpen(false);
  };

  // Filtered Roster
  const filteredRoster = roster.filter((emp) => {
    const matchesSearch = !search || emp.employeeName.toLowerCase().includes(search.toLowerCase()) || emp.employeeId.toString().includes(search);
    const matchesDept = !departmentFilter || emp.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const totalCount = filteredRoster.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedRoster = filteredRoster.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 font-ui">
      {/* 1. Header with Display Serif and Divider */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Shift Roster
            </h1>
            <p className="text-xs text-[var(--ink-muted)] font-ui mt-0.5">
              Weekly shift timetable & employee schedule allocation
            </p>
          </div>

          <span className="text-xs font-data text-[var(--ink-muted)]">
            {filteredRoster.length} Staff on Roster
          </span>
        </div>

        {/* Signature Divider */}
        <div className="register-rule pt-1" />
      </div>

      {/* 2. Unified DataToolbar with Week Navigator, Filters, Export, Import, and Assign Shift CTA */}
      <DataToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search roster by staff name or ID..."
        filters={[
          {
            id: 'department',
            value: departmentFilter,
            onChange: setDepartmentFilter,
            options: [
              { value: '', label: 'All Departments' },
              { value: 'Engineering & Technology', label: 'Engineering & Technology' },
              { value: 'Human Resources & People', label: 'Human Resources & People' },
              { value: 'Operations & Logistics', label: 'Operations & Logistics' },
              { value: 'Finance & Accounts', label: 'Finance & Accounts' },
            ],
          },
        ]}
        onExport={handleExportRoster}
        exportLabel="Export Roster"
        onImport={() => setImportModalOpen(true)}
        importLabel="Import Roster"
        primaryAction={{
          label: 'Bulk Assign Shift',
          icon: <Plus size={14} />,
          onClick: () => setAssignModalOpen(true),
        }}
      >
        {/* Custom Section Control: Week Picker Navigator */}
        <div className="flex items-center gap-1 bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] px-1.5 py-0.5">
          <button
            onClick={handlePrevWeek}
            className="p-1 rounded-[2px] hover:bg-[var(--surface)] text-[var(--ink)] cursor-pointer"
            title="Previous Week"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="px-2 font-semibold text-xs text-[var(--ink)] font-data">
            {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button
            onClick={handleNextWeek}
            className="p-1 rounded-[2px] hover:bg-[var(--surface)] text-[var(--ink)] cursor-pointer"
            title="Next Week"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </DataToolbar>

      {/* 3. Shift Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] text-xs font-ui">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider">
            Shift Legend:
          </span>
          {SHIFTS_LIST.map((s) => (
            <span key={s.code} className="inline-flex items-center gap-1.5 font-data text-[11px]">
              <span className={`px-1.5 py-0.5 rounded-[2px] font-bold text-[10px] ${s.color}`}>
                {s.code}
              </span>
              <span className="text-[var(--ink-muted)]">{s.name.split(' (')[0]}</span>
            </span>
          ))}
        </div>

        <span className="text-[11px] text-[var(--ink-muted)] font-ui italic">
          💡 Click any shift pill to rotate schedule
        </span>
      </div>

      {/* 4. Weekly Roster Matrix Grid */}
      <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--surface-header)] text-[var(--ink-muted)] font-semibold border-b border-[var(--rule)]">
                <th className="sticky left-0 z-20 bg-[var(--surface-header)] py-2 px-3 text-left min-w-[200px] border-r border-[var(--rule)] font-ui uppercase tracking-wider text-[11px]">
                  Staff Member
                </th>
                {weekDays.map((day, idx) => {
                  const isWeekend = idx === 5 || idx === 6;
                  const isToday = new Date().toDateString() === day.toDateString();

                  return (
                    <th
                      key={idx}
                      className={`py-2 px-2 min-w-[100px] border-r border-[var(--rule)]/60 font-data text-xs ${
                        isToday
                          ? 'bg-[var(--gold-100)] text-[var(--gold-500)] font-bold'
                          : isWeekend
                          ? 'bg-[var(--surface-weekend)]'
                          : ''
                      }`}
                    >
                      <span className="block text-[9px] uppercase tracking-wider text-[var(--ink-muted)] font-ui">
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span>
                        {day.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {paginatedRoster.map((emp) => (
                <tr key={emp.employeeId} className="hover:bg-[var(--surface-hover)]">
                  {/* Sticky Employee Identity Cell */}
                  <td className="sticky left-0 z-10 bg-[var(--surface)] py-2.5 px-3 text-left border-r border-[var(--rule)]">
                    <p className="font-semibold text-[var(--ink)] truncate max-w-[180px] font-ui">
                      {emp.employeeName}
                    </p>
                    <p className="text-[10px] text-[var(--ink-muted)] font-data truncate">
                      #{emp.employeeId} · {emp.designation}
                    </p>
                  </td>

                  {/* 7 Day Shift Schedule Cells */}
                  {weekDays.map((day, dayIdx) => {
                    const shiftCode = emp.schedule[dayIdx.toString()] || 'GEN';
                    const shiftDef = SHIFTS_LIST.find((s) => s.code === shiftCode) || SHIFTS_LIST[0];
                    const isWeekend = dayIdx === 5 || dayIdx === 6;

                    return (
                      <td
                        key={dayIdx}
                        onClick={() => handleToggleCellShift(emp.employeeId, dayIdx)}
                        className={`py-2 px-1 border-r border-[var(--rule)]/40 text-center cursor-pointer transition-colors hover:bg-[var(--paper)] ${
                          isWeekend ? 'bg-[var(--surface-weekend-cell)]' : ''
                        }`}
                        title={`Click to rotate shift for ${emp.employeeName} on ${day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                      >
                        <span className={`inline-block px-2 py-1 rounded-[2px] font-data text-[11px] font-bold select-none ${shiftDef.color}`}>
                          {shiftCode}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {paginatedRoster.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs font-data text-[var(--ink-muted)]">
                    No staff records found for the selected department/filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ruled Pagination Toolbar */}
        <PaginationToolbar
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      </div>

      {/* 5. Bulk Assign Shift Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">
                  Bulk Assign Shift
                </h3>
                <p className="text-xs text-[var(--ink-muted)]">Allocate shift schedule across department or staff</p>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleBulkAssign} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Target Department
                </label>
                <select
                  value={bulkShiftForm.targetDepartment}
                  onChange={(e) => setBulkShiftForm({ ...bulkShiftForm, targetDepartment: e.target.value })}
                  className="register-input w-full"
                >
                  <option value="">All Departments (Entire Organization)</option>
                  <option value="Engineering & Technology">Engineering & Technology</option>
                  <option value="Human Resources & People">Human Resources & People</option>
                  <option value="Operations & Logistics">Operations & Logistics</option>
                  <option value="Finance & Accounts">Finance & Accounts</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Assigned Shift Schedule *
                </label>
                <select
                  value={bulkShiftForm.shiftCode}
                  onChange={(e) => setBulkShiftForm({ ...bulkShiftForm, shiftCode: e.target.value })}
                  className="register-input w-full font-data"
                >
                  {SHIFTS_LIST.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Effective Week Commencing
                </label>
                <input
                  type="date"
                  value={bulkShiftForm.effectiveFrom}
                  onChange={(e) => setBulkShiftForm({ ...bulkShiftForm, effectiveFrom: e.target.value })}
                  className="register-input w-full font-data text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary cursor-pointer"
                >
                  Apply Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Bulk Import Roster Modal */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Shift Roster"
        templateFilename="HRDesk_Shift_Roster"
        templateHeaders={['EmployeeId', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
        templateSampleRow={['1042', 'GEN', 'GEN', 'GEN', 'GEN', 'GEN', 'GEN', 'W/O']}
        onImportComplete={() => {
          setImportModalOpen(false);
          showSuccess('Roster Imported', 'Staff shift schedules updated from CSV.');
        }}
      />
    </div>
  );
};

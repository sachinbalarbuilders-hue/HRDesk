import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { exportToCSV } from '../utils/csvHelper';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { DataToolbar } from '../components/ui/DataToolbar';
import {
  Plus,
  Phone,
  X,
  FileText,
  Calendar,
} from 'lucide-react';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { TableSkeleton } from '../components/ui/PageSkeleton';

export const Employees: React.FC = () => {
  const { hasPermission, isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [lookups, setLookups] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [status, setStatus] = useState<string>('active');
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [profileTab, setProfileTab] = useState<'details' | 'attendance' | 'records'>('details');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    employeeName: '',
    phone: '',
    departmentId: '',
    designationId: '',
    reportingManagerId: '',
    weekoff: 'Sunday',
    joiningDate: new Date().toISOString().split('T')[0],
  });

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/employees', {
        params: {
          search: search || undefined,
          departmentId: departmentId || undefined,
          status: status || undefined,
          page,
          pageSize,
        },
      });
      setEmployees(res.data.items || []);
      setTotalCount(res.data.totalCount || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err: any) {
      showError('Failed to load roster', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const res = await apiClient.get('/employees/lookups');
      setLookups(res.data);
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [search, departmentId, status, page, pageSize]);

  const handleExportCSV = () => {
    if (!employees.length) {
      showError('Export Empty', 'No employee records currently available to export.');
      return;
    }

    const headers = [
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'employeeName', label: 'Full Legal Name' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'reportingManager', label: 'Reporting Manager' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'joiningDate', label: 'Joining Date' },
      { key: 'status', label: 'Status' },
    ];

    exportToCSV('Employees_Directory', employees, headers);
    showSuccess('Export Complete', 'Employee directory downloaded successfully.');
  };

  const handleToggleStatus = async (id: number) => {
    try {
      await apiClient.post(`/employees/${id}/toggle-status`);
      showSuccess('Status Updated', `Employee #${id} status updated.`);
      fetchEmployees();
      if (selectedEmployee?.employeeId === id) {
        setSelectedEmployee((prev: any) => ({
          ...prev,
          status: prev.status === 'Active' ? 'Inactive' : 'Active',
        }));
      }
    } catch (err: any) {
      showError('Status update failed', err.response?.data?.message || 'Could not update status');
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.employeeName.trim()) return;

    try {
      setCreating(true);
      await apiClient.post('/employees', {
        employeeName: createForm.employeeName,
        phone: createForm.phone || null,
        departmentId: createForm.departmentId ? parseInt(createForm.departmentId) : null,
        designationId: createForm.designationId ? parseInt(createForm.designationId) : null,
        reportingManagerId: createForm.reportingManagerId ? parseInt(createForm.reportingManagerId) : null,
        weekoff: createForm.weekoff,
        joiningDate: createForm.joiningDate || null,
      });
      showSuccess('Employee Added', `${createForm.employeeName} added to directory.`);
      setCreateModalOpen(false);
      setCreateForm({
        employeeName: '',
        phone: '',
        departmentId: '',
        designationId: '',
        reportingManagerId: '',
        weekoff: 'Sunday',
        joiningDate: new Date().toISOString().split('T')[0],
      });
      fetchEmployees();
    } catch (err: any) {
      showError('Failed to add employee', err.response?.data?.message || 'Could not create employee record.');
    } finally {
      setCreating(false);
    }
  };

  const canCreate = isAdmin || hasPermission('Employees.Create');
  const canEdit = isAdmin || hasPermission('Employees.Edit');

  return (
    <div className="space-y-6">
      {/* 1. Header with Display Serif and Divider */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Employees
            </h1>
            <p className="text-xs text-[var(--ink-muted)] font-ui mt-0.5">
              Manage employee directory, profiles & reporting structure
            </p>
          </div>

          <span className="text-xs font-data text-[var(--ink-muted)]">
            {totalCount} Total Employees
          </span>
        </div>

        {/* Signature Divider */}
        <div className="register-rule pt-1" />
      </div>

      {/* 2. Unified Common Action Toolbar */}
      <DataToolbar
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Search employees by name, phone or ID..."
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
              ...(lookups?.departments?.map((d: any) => ({
                value: d.departmentId.toString(),
                label: d.departmentName,
              })) || []),
            ],
          },
          {
            id: 'status',
            value: status,
            onChange: (val) => {
              setStatus(val);
              setPage(1);
            },
            options: [
              { value: 'active', label: 'Active Employees' },
              { value: 'inactive', label: 'Inactive / Relieved' },
              { value: 'all', label: 'All Records' },
            ],
          },
        ]}
        onExport={handleExportCSV}
        exportLabel="Export CSV"
        onImport={canCreate ? () => setImportModalOpen(true) : undefined}
        importLabel="Import CSV"
        primaryAction={
          canCreate
            ? {
                label: 'Add Employee',
                icon: <Plus size={14} />,
                onClick: () => setCreateModalOpen(true),
              }
            : undefined
        }
      />

      {/* 3. Primary Table: Ruled Ledger Table */}
      <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="register-table">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th>Employee Name</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Reporting Manager</th>
                <th className="text-right">Joining Date</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <TableSkeleton rows={8} />
                  </td>
                </tr>
              ) : employees.map((emp) => {
                const isActive = emp.status?.toLowerCase() === 'active';

                return (
                  <tr
                    key={emp.employeeId}
                    onClick={() => setSelectedEmployee(emp)}
                    className="cursor-pointer"
                  >
                    <td className="text-center font-data text-xs text-[var(--ink-muted)]">
                      <div className="w-6 h-6 rounded-[2px] bg-[var(--navy-900)] text-[var(--gold-500)] font-bold flex items-center justify-center text-[10px] mx-auto">
                        {emp.employeeName.charAt(0)}
                      </div>
                    </td>
                    <td className="font-semibold text-[var(--ink)]">
                      {emp.employeeName}
                    </td>
                    <td className="font-data text-xs text-[var(--ink-muted)]">
                      #{emp.employeeId}
                    </td>
                    <td className="text-xs text-[var(--ink)]">
                      {emp.department || 'General'}
                    </td>
                    <td className="text-xs text-[var(--ink-muted)]">
                      {emp.designation || 'Staff'}
                    </td>
                    <td className="text-xs text-[var(--ink-muted)]">
                      {emp.reportingManager || 'None'}
                    </td>
                    <td className="text-right font-data text-xs text-[var(--ink-muted)]">
                      {emp.joiningDate || '-'}
                    </td>
                    <td className="text-right text-xs">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <span className={isActive ? 'status-dot-ok' : 'status-dot-err'} />
                        <span className={isActive ? 'text-[var(--ok-600)]' : 'text-[var(--err-600)]'}>
                          {emp.status}
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}

              {employees.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs font-data text-[var(--ink-muted)]">
                    No employees found matching search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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

      {/* 4. Slide-in Profile Record Sheet (480px) */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-[480px] bg-[var(--surface)] h-full p-6 shadow-2xl overflow-y-auto space-y-5 border-l border-[var(--rule)]">
            {/* Header with Serif Name */}
            <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[var(--gold-500)] font-data">
                  Employee Profile
                </span>
                <h2 className="font-display text-2xl font-semibold text-[var(--ink)] mt-0.5">
                  {selectedEmployee.employeeName}
                </h2>
                <p className="text-xs font-data text-[var(--ink-muted)]">
                  ID: #{selectedEmployee.employeeId} &nbsp;|&nbsp; Joined: {selectedEmployee.joiningDate || '-'}
                </p>
              </div>

              <button
                onClick={() => setSelectedEmployee(null)}
                className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile Tabs */}
            <div className="flex items-center gap-1 border-b border-[var(--rule)] text-xs font-ui">
              <button
                onClick={() => setProfileTab('details')}
                className={`pb-2 px-2 font-semibold transition-colors cursor-pointer ${
                  profileTab === 'details'
                    ? 'border-b-2 border-[var(--gold-500)] text-[var(--gold-500)]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setProfileTab('attendance')}
                className={`pb-2 px-2 font-semibold transition-colors cursor-pointer ${
                  profileTab === 'attendance'
                    ? 'border-b-2 border-[var(--gold-500)] text-[var(--gold-500)]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                Attendance Summary
              </button>
              <button
                onClick={() => setProfileTab('records')}
                className={`pb-2 px-2 font-semibold transition-colors cursor-pointer ${
                  profileTab === 'records'
                    ? 'border-b-2 border-[var(--gold-500)] text-[var(--gold-500)]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                Documents
              </button>
            </div>

            {/* Tab 1: Details */}
            {profileTab === 'details' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Department & Designation</span>
                  <p className="font-semibold text-[var(--ink)] text-sm">{selectedEmployee.department || 'General'}</p>
                  <p className="text-[var(--ink-muted)]">{selectedEmployee.designation || 'Staff Member'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Reporting Manager</span>
                    <p className="font-semibold text-[var(--ink)] mt-0.5">{selectedEmployee.reportingManager || 'None'}</p>
                  </div>
                  <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Weekly Off</span>
                    <p className="font-semibold text-[var(--ink)] mt-0.5">{selectedEmployee.weekoff || 'Sunday'}</p>
                  </div>
                </div>

                <div className="p-3 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Phone Number</span>
                    <p className="font-data font-semibold text-[var(--ink)] mt-0.5">{selectedEmployee.phone || '-'}</p>
                  </div>
                  <Phone size={14} className="text-[var(--ink-muted)]" />
                </div>
              </div>
            )}

            {/* Tab 2: Attendance */}
            {profileTab === 'attendance' && (
              <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                  <Calendar size={14} className="text-[var(--gold-500)]" />
                  <span>Attendance Overview</span>
                </div>
                <p className="text-xs text-[var(--ink-muted)] font-ui">
                  Attendance is computed automatically via the backend attendance service.
                </p>
              </div>
            )}

            {/* Tab 3: Documents */}
            {profileTab === 'records' && (
              <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                  <FileText size={14} className="text-[var(--gold-500)]" />
                  <span>Employee Documents</span>
                </div>
                <p className="text-[var(--ink-muted)] font-data text-xs">
                  No electronic documents uploaded.
                </p>
              </div>
            )}

            {/* Action Bar */}
            {canEdit && (
              <div className="pt-3 border-t border-[var(--rule)]">
                <button
                  onClick={() => handleToggleStatus(selectedEmployee.employeeId)}
                  className="btn-outline w-full text-center cursor-pointer"
                >
                  Mark Employee as {selectedEmployee.status === 'Active' ? 'Inactive / Relieved' : 'Active'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Add Employee Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-lg rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">
                  Add New Employee
                </h3>
                <p className="text-xs text-[var(--ink-muted)]">Enter employee details to create profile</p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.employeeName}
                  onChange={(e) => setCreateForm({ ...createForm, employeeName: e.target.value })}
                  placeholder="e.g. Ramesh Patel"
                  className="register-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="9876543210"
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={createForm.joiningDate}
                    onChange={(e) => setCreateForm({ ...createForm, joiningDate: e.target.value })}
                    className="register-input w-full font-data"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Department
                  </label>
                  <select
                    value={createForm.departmentId}
                    onChange={(e) => setCreateForm({ ...createForm, departmentId: e.target.value })}
                    className="register-input w-full"
                  >
                    <option value="">Select Department</option>
                    {lookups?.departments?.map((d: any) => (
                      <option key={d.departmentId} value={d.departmentId}>
                        {d.departmentName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Designation
                  </label>
                  <select
                    value={createForm.designationId}
                    onChange={(e) => setCreateForm({ ...createForm, designationId: e.target.value })}
                    className="register-input w-full"
                  >
                    <option value="">Select Designation</option>
                    {lookups?.designations?.map((des: any) => (
                      <option key={des.designationId} value={des.designationId}>
                        {des.designationName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Reporting Manager
                  </label>
                  <select
                    value={createForm.reportingManagerId}
                    onChange={(e) => setCreateForm({ ...createForm, reportingManagerId: e.target.value })}
                    className="register-input w-full"
                  >
                    <option value="">None (Top Level)</option>
                    {lookups?.managers?.map((m: any) => (
                      <option key={m.employeeId} value={m.employeeId}>
                        {m.employeeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Weekly Off
                  </label>
                  <select
                    value={createForm.weekoff}
                    onChange={(e) => setCreateForm({ ...createForm, weekoff: e.target.value })}
                    className="register-input w-full"
                  >
                    <option value="Sunday">Sunday</option>
                    <option value="Monday">Monday</option>
                    <option value="Saturday">Saturday</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary disabled:opacity-50 cursor-pointer"
                >
                  {creating ? 'Saving...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Bulk Import Modal */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Employees"
        templateFilename="HRDesk_Employees"
        templateHeaders={['FullName', 'Phone', 'Department', 'Designation', 'JoiningDate', 'WeeklyOff']}
        templateSampleRow={['Ramesh Patel', '9876543210', 'Engineering', 'Software Engineer', '2026-01-15', 'Sunday']}
        onImportComplete={() => {
          setImportModalOpen(false);
          fetchEmployees();
        }}
      />
    </div>
  );
};

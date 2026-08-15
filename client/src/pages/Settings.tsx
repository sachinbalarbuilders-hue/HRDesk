import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import {
  Building2,
  Clock,
  CalendarCheck,
  FolderTree,
  Save,
  Plus,
  Trash2,
  MapPin,
  MessageSquare,
  X,
  Edit2,
  Layers,
  Award,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'company' | 'departments' | 'designations' | 'leaves' | 'shifts' | 'attendance'>('company');
  const [saving, setSaving] = useState(false);

  // Common Search & Filter States for Settings Tabs
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [leavePaidFilter, setLeavePaidFilter] = useState('');

  // Modals
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [desigModalOpen, setDesigModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
  const [bulkImportConfig, setBulkImportConfig] = useState({ title: '', filename: '', headers: [] as string[], sampleRow: [] as string[] });

  // 1. Organizations State
  const [organizations, setOrganizations] = useState([
    {
      id: 1,
      name: 'HRDesk Builders & Developers',
      code: 'HBD',
      address: 'Plot 42, Cyber Gateway, Tech Park, Hyderabad, 500081',
      whatsAppGroupId: '120363028192847192@g.us',
      latitude: 17.4483,
      longitude: 78.3742,
      radiusMeters: 150,
      isActive: true,
    },
    {
      id: 2,
      name: 'HRDesk Infra & Projects',
      code: 'HIP',
      address: 'Outer Ring Road, Bellandur, Bengaluru, Karnataka, 560103',
      whatsAppGroupId: '120363098274619283@g.us',
      latitude: 12.9279,
      longitude: 77.6828,
      radiusMeters: 100,
      isActive: true,
    },
  ]);
  const [editingOrgId, setEditingOrgId] = useState<number | null>(null);
  const [orgForm, setOrgForm] = useState({
    name: '',
    code: '',
    address: '',
    whatsAppGroupId: '',
    latitude: 17.4483,
    longitude: 78.3742,
    radiusMeters: 100,
    isActive: true,
  });

  // 2. Attendance Policy State
  const [attendancePolicy, setAttendancePolicy] = useState({
    gracePeriodMinutes: 15,
    halfDayThresholdHours: 4.5,
    fullDayThresholdHours: 8.0,
    autoSyncIntervalMinutes: 5,
    defaultWeekoff: 'Sunday',
  });

  // 3. Departments Master
  const [departments, setDepartments] = useState([
    { id: 1, name: 'Executive Leadership', code: 'EXEC', head: 'Managing Director' },
    { id: 2, name: 'Engineering & Technology', code: 'ENG', head: 'Lead Architect' },
    { id: 3, name: 'Human Resources & People', code: 'HR', head: 'HR Manager' },
    { id: 4, name: 'Finance & Accounts', code: 'FIN', head: 'Financial Controller' },
    { id: 5, name: 'Operations & Logistics', code: 'OPS', head: 'Site Operations Lead' },
  ]);
  const [newDept, setNewDept] = useState({ name: '', code: '', head: '' });

  // 4. Designations Master
  const [designations, setDesignations] = useState([
    { id: 1, title: 'Managing Director', code: 'MD', department: 'Executive Leadership', level: 'L5 (Executive)' },
    { id: 2, title: 'Lead Software Architect', code: 'ARCH', department: 'Engineering & Technology', level: 'L4 (Lead)' },
    { id: 3, title: 'Senior Software Engineer', code: 'SSE', department: 'Engineering & Technology', level: 'L3 (Senior)' },
    { id: 4, title: 'HR Operations Specialist', code: 'HROS', department: 'Human Resources & People', level: 'L2 (Mid)' },
    { id: 5, title: 'Financial Controller', code: 'FC', department: 'Finance & Accounts', level: 'L3 (Senior)' },
    { id: 6, title: 'Site Operations Supervisor', code: 'SOS', department: 'Operations & Logistics', level: 'L2 (Mid)' },
  ]);
  const [newDesignation, setNewDesignation] = useState({ title: '', code: '', department: 'Engineering & Technology', level: 'L2 (Mid)' });

  // 5. Leave Types Master
  const [leaveTypes, setLeaveTypes] = useState([
    { id: 1, name: 'Paid Leave', code: 'PL', quota: 18, isPaid: true },
    { id: 2, name: 'Sick Leave', code: 'SL', quota: 12, isPaid: true },
    { id: 3, name: 'Compensatory Off', code: 'CO', quota: 0, isPaid: true },
    { id: 4, name: 'Casual Leave', code: 'CL', quota: 10, isPaid: true },
    { id: 5, name: 'Leave Without Pay', code: 'LWP', quota: 0, isPaid: false },
  ]);
  const [newLeaveType, setNewLeaveType] = useState({ name: '', code: '', quota: 12, isPaid: true });

  // 6. Work Shifts Master
  const [shifts, setShifts] = useState([
    { id: 1, name: 'General Shift', code: 'GEN', startTime: '09:00', endTime: '18:00', breakMinutes: 60 },
    { id: 2, name: 'Morning Shift', code: 'MORN', startTime: '06:00', endTime: '15:00', breakMinutes: 45 },
    { id: 3, name: 'Evening Shift', code: 'EVE', startTime: '14:00', endTime: '23:00', breakMinutes: 45 },
    { id: 4, name: 'Night Shift', code: 'NIGHT', startTime: '22:00', endTime: '07:00', breakMinutes: 60 },
  ]);
  const [newShift, setNewShift] = useState({ name: '', code: '', startTime: '09:00', endTime: '18:00', breakMinutes: 60 });

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Tab switcher helper to reset page & search
  const handleTabSwitch = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setSearch('');
    setDeptFilter('');
    setLeavePaidFilter('');
    setPage(1);
  };

  // --- Handlers ---
  const handleOpenCreateOrg = () => {
    setEditingOrgId(null);
    setOrgForm({
      name: '',
      code: '',
      address: '',
      whatsAppGroupId: '',
      latitude: 17.4483,
      longitude: 78.3742,
      radiusMeters: 100,
      isActive: true,
    });
    setOrgModalOpen(true);
  };

  const handleOpenEditOrg = (org: any) => {
    setEditingOrgId(org.id);
    setOrgForm({
      name: org.name,
      code: org.code,
      address: org.address,
      whatsAppGroupId: org.whatsAppGroupId || '',
      latitude: org.latitude || 17.4483,
      longitude: org.longitude || 78.3742,
      radiusMeters: org.radiusMeters || 100,
      isActive: org.isActive,
    });
    setOrgModalOpen(true);
  };

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgForm.name.trim()) {
      showError('Validation Error', 'Organisation name is required.');
      return;
    }

    if (editingOrgId) {
      setOrganizations(organizations.map(o => o.id === editingOrgId ? { ...o, ...orgForm } : o));
      showSuccess('Organisation Updated', `${orgForm.name} profile saved.`);
    } else {
      const newOrg = {
        id: Date.now(),
        ...orgForm,
        code: orgForm.code || `ORG-${organizations.length + 1}`,
      };
      setOrganizations([...organizations, newOrg]);
      showSuccess('Organisation Registered', `${orgForm.name} added to workspace.`);
    }
    setOrgModalOpen(false);
  };

  const handleDeleteOrg = (id: number) => {
    if (organizations.length <= 1) {
      showError('Cannot Delete', 'At least one primary organisation is required.');
      return;
    }
    setOrganizations(organizations.filter(o => o.id !== id));
    showSuccess('Organisation Deleted', 'Organisation profile removed.');
  };

  const handleSaveAttendancePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      showSuccess('Policy Saved', 'Attendance counting and late rules updated.');
    }, 500);
  };

  const handleAddDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.name.trim()) return;
    setDepartments([
      ...departments,
      { id: Date.now(), name: newDept.name, code: newDept.code || newDept.name.substring(0, 3).toUpperCase(), head: newDept.head || 'Staff' },
    ]);
    setNewDept({ name: '', code: '', head: '' });
    setDeptModalOpen(false);
    showSuccess('Department Added', `${newDept.name} registered.`);
  };

  const handleAddDesignation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesignation.title.trim()) return;
    setDesignations([
      ...designations,
      {
        id: Date.now(),
        title: newDesignation.title,
        code: newDesignation.code || newDesignation.title.substring(0, 3).toUpperCase(),
        department: newDesignation.department,
        level: newDesignation.level,
      },
    ]);
    setNewDesignation({ title: '', code: '', department: 'Engineering & Technology', level: 'L2 (Mid)' });
    setDesigModalOpen(false);
    showSuccess('Designation Added', `${newDesignation.title} registered.`);
  };

  const handleAddLeaveType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeaveType.name.trim()) return;
    setLeaveTypes([
      ...leaveTypes,
      { id: Date.now(), name: newLeaveType.name, code: newLeaveType.code || 'LV', quota: newLeaveType.quota, isPaid: newLeaveType.isPaid },
    ]);
    setNewLeaveType({ name: '', code: '', quota: 12, isPaid: true });
    setLeaveModalOpen(false);
    showSuccess('Leave Category Added', `${newLeaveType.name} configured.`);
  };

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShift.name.trim()) return;
    setShifts([
      ...shifts,
      { id: Date.now(), name: newShift.name, code: newShift.code || 'SHF', startTime: newShift.startTime, endTime: newShift.endTime, breakMinutes: newShift.breakMinutes },
    ]);
    setNewShift({ name: '', code: '', startTime: '09:00', endTime: '18:00', breakMinutes: 60 });
    setShiftModalOpen(false);
    showSuccess('Shift Registered', `${newShift.name} added to roster.`);
  };

  // --- Export Handlers ---
  const handleExportDepartments = () => {
    exportToCSV('HRDesk_Departments', departments, [
      { key: 'name', label: 'Department Name' },
      { key: 'code', label: 'Department Code' },
      { key: 'head', label: 'Primary Officer' },
    ]);
    showSuccess('Exported', 'Departments exported to CSV.');
  };

  const handleExportDesignations = () => {
    exportToCSV('HRDesk_Designations', designations, [
      { key: 'title', label: 'Designation Title' },
      { key: 'code', label: 'Code' },
      { key: 'department', label: 'Department' },
      { key: 'level', label: 'Job Grade' },
    ]);
    showSuccess('Exported', 'Designations exported to CSV.');
  };

  const handleExportLeaveTypes = () => {
    exportToCSV('HRDesk_Leave_Types', leaveTypes, [
      { key: 'name', label: 'Leave Category' },
      { key: 'code', label: 'Code' },
      { key: 'quota', label: 'Annual Quota' },
      { key: 'isPaid', label: 'Is Paid' },
    ]);
    showSuccess('Exported', 'Leave categories exported to CSV.');
  };

  const handleExportShifts = () => {
    exportToCSV('HRDesk_Work_Shifts', shifts, [
      { key: 'name', label: 'Shift Name' },
      { key: 'code', label: 'Code' },
      { key: 'startTime', label: 'Start Time' },
      { key: 'endTime', label: 'End Time' },
      { key: 'breakMinutes', label: 'Break Minutes' },
    ]);
    showSuccess('Exported', 'Work shifts exported to CSV.');
  };

  const handleExportOrganisations = () => {
    exportToCSV('HRDesk_Organisations', organizations, [
      { key: 'name', label: 'Organisation Name' },
      { key: 'code', label: 'Code' },
      { key: 'address', label: 'Address' },
      { key: 'latitude', label: 'Latitude' },
      { key: 'longitude', label: 'Longitude' },
      { key: 'radiusMeters', label: 'Geofence Radius (m)' },
    ]);
    showSuccess('Exported', 'Organisations exported to CSV.');
  };

  // --- Filtering & Pagination Calculations ---
  const filteredDepts = departments.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase()));
  const paginatedDepts = filteredDepts.slice((page - 1) * pageSize, page * pageSize);

  const filteredDesigs = designations.filter(d => {
    const matchesSearch = !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase());
    const matchesDept = !deptFilter || d.department === deptFilter;
    return matchesSearch && matchesDept;
  });
  const paginatedDesigs = filteredDesigs.slice((page - 1) * pageSize, page * pageSize);

  const filteredLeaves = leaveTypes.filter(l => {
    const matchesSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.code.toLowerCase().includes(search.toLowerCase());
    const matchesPaid = !leavePaidFilter || (leavePaidFilter === 'paid' ? l.isPaid : !l.isPaid);
    return matchesSearch && matchesPaid;
  });
  const paginatedLeaves = filteredLeaves.slice((page - 1) * pageSize, page * pageSize);

  const filteredShifts = shifts.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()));
  const paginatedShifts = filteredShifts.slice((page - 1) * pageSize, page * pageSize);

  const filteredOrgs = organizations.filter(o => !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 font-ui">
      {/* 1. Header with Display Serif and Divider */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Settings & Organization Masters
            </h1>
            <p className="text-xs text-[var(--ink-muted)] font-ui mt-0.5">
              Organisations, departments, designations, leave quotas, shifts & attendance policies
            </p>
          </div>

          <span className="text-xs font-data text-[var(--ink-muted)]">
            Workspace Configuration
          </span>
        </div>

        {/* Signature Divider */}
        <div className="register-rule pt-1" />
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-[4px] border border-[var(--rule)] overflow-x-auto">
        <button
          onClick={() => handleTabSwitch('company')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer flex-shrink-0 ${
            activeTab === 'company'
              ? 'bg-[var(--navy-900)] text-[var(--gold-500)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
          }`}
        >
          <Building2 size={14} />
          <span>Organisations</span>
        </button>

        <button
          onClick={() => handleTabSwitch('departments')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer flex-shrink-0 ${
            activeTab === 'departments'
              ? 'bg-[var(--navy-900)] text-[var(--gold-500)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
          }`}
        >
          <FolderTree size={14} />
          <span>Departments</span>
        </button>

        <button
          onClick={() => handleTabSwitch('designations')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer flex-shrink-0 ${
            activeTab === 'designations'
              ? 'bg-[var(--navy-900)] text-[var(--gold-500)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
          }`}
        >
          <Award size={14} />
          <span>Designations</span>
        </button>

        <button
          onClick={() => handleTabSwitch('leaves')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer flex-shrink-0 ${
            activeTab === 'leaves'
              ? 'bg-[var(--navy-900)] text-[var(--gold-500)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
          }`}
        >
          <CalendarCheck size={14} />
          <span>Leave Types</span>
        </button>

        <button
          onClick={() => handleTabSwitch('shifts')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer flex-shrink-0 ${
            activeTab === 'shifts'
              ? 'bg-[var(--navy-900)] text-[var(--gold-500)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
          }`}
        >
          <Layers size={14} />
          <span>Work Shifts</span>
        </button>

        <button
          onClick={() => handleTabSwitch('attendance')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer flex-shrink-0 ${
            activeTab === 'attendance'
              ? 'bg-[var(--navy-900)] text-[var(--gold-500)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
          }`}
        >
          <Clock size={14} />
          <span>Attendance Policy</span>
        </button>
      </div>

      {/* 3. Tab Views */}

      {/* Tab 1: Organisations Studio */}
      {activeTab === 'company' && (
        <div className="space-y-4">
          <DataToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search organisation by name or code..."
            onExport={handleExportOrganisations}
            exportLabel="Export Organisations"
            onImport={() => {
              setBulkImportConfig({
                title: 'Import Organisations',
                filename: 'HRDesk_Organisations_Template',
                headers: ['Name', 'Code', 'Address', 'Latitude', 'Longitude', 'RadiusMeters'],
                sampleRow: ['HRDesk Hyderabad Campus', 'HYD-01', 'Tech Park, Hyderabad', '17.4483', '78.3742', '100'],
              });
              setBulkImportModalOpen(true);
            }}
            importLabel="Import Organisations"
            primaryAction={{
              label: 'Add Organisation',
              icon: <Plus size={14} />,
              onClick: handleOpenCreateOrg,
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrgs.map((org) => (
              <div
                key={org.id}
                className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] space-y-3 relative hover:border-[var(--gold-500)]/60 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[4px] bg-[var(--navy-900)] text-[var(--gold-500)] flex items-center justify-center font-bold text-xs flex-shrink-0">
                      <Building2 size={16} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-xs text-[var(--ink)]">{org.name}</h3>
                      <p className="font-data text-[10px] text-[var(--ink-muted)]">{org.code}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditOrg(org)}
                      className="p-1 text-[var(--ink-muted)] hover:text-[var(--gold-500)] cursor-pointer"
                      title="Edit Organisation"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteOrg(org.id)}
                      className="p-1 text-[var(--ink-muted)] hover:text-[var(--err-600)] cursor-pointer"
                      title="Delete Organisation"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[var(--ink-muted)] leading-snug">
                  {org.address}
                </p>

                {/* Geofence & WhatsApp Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--rule)] text-[11px] font-data">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink)]">
                    <MapPin size={12} className="text-[var(--gold-500)]" />
                    <span>{org.latitude.toFixed(4)}, {org.longitude.toFixed(4)} (±{org.radiusMeters}m)</span>
                  </span>

                  {org.whatsAppGroupId ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[var(--ok-600)]/10 border border-[var(--ok-600)]/30 text-[var(--ok-600)] font-semibold">
                      <MessageSquare size={12} />
                      <span>WhatsApp Linked</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[var(--paper)] text-[var(--ink-muted)]">
                      <MessageSquare size={12} />
                      <span>No WhatsApp</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Departments Master */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <DataToolbar
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search departments by name or code..."
            onExport={handleExportDepartments}
            exportLabel="Export Departments"
            onImport={() => {
              setBulkImportConfig({
                title: 'Import Departments',
                filename: 'HRDesk_Departments_Template',
                headers: ['DepartmentName', 'Code', 'Head'],
                sampleRow: ['Quality Assurance', 'QA', 'QA Lead'],
              });
              setBulkImportModalOpen(true);
            }}
            importLabel="Import Departments"
            primaryAction={{
              label: 'Add Department',
              icon: <Plus size={14} />,
              onClick: () => setDeptModalOpen(true),
            }}
          />

          <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
            <table className="register-table">
              <thead>
                <tr>
                  <th>Department Name</th>
                  <th className="font-data">Code</th>
                  <th>Primary Officer</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDepts.map((d) => (
                  <tr key={d.id}>
                    <td className="font-semibold text-[var(--ink)]">{d.name}</td>
                    <td className="font-data text-xs text-[var(--ink-muted)] font-semibold">{d.code}</td>
                    <td className="text-xs text-[var(--ink-muted)]">{d.head}</td>
                    <td className="text-right">
                      <button
                        onClick={() => setDepartments(departments.filter(dept => dept.id !== d.id))}
                        className="text-[var(--ink-muted)] hover:text-[var(--err-600)] p-1 cursor-pointer"
                        title="Delete Department"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {paginatedDepts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-xs font-data text-[var(--ink-muted)]">
                      No departments match search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Ruled Pagination Toolbar */}
            <PaginationToolbar
              page={page}
              pageSize={pageSize}
              totalCount={filteredDepts.length}
              totalPages={Math.ceil(filteredDepts.length / pageSize) || 1}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 20]}
            />
          </div>
        </div>
      )}

      {/* Tab 3: Designations Master */}
      {activeTab === 'designations' && (
        <div className="space-y-4">
          <DataToolbar
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search designations by title or code..."
            filters={[
              {
                id: 'dept',
                value: deptFilter,
                onChange: (v) => { setDeptFilter(v); setPage(1); },
                options: [
                  { value: '', label: 'All Departments' },
                  ...departments.map(d => ({ value: d.name, label: d.name })),
                ],
              },
            ]}
            onExport={handleExportDesignations}
            exportLabel="Export Designations"
            onImport={() => {
              setBulkImportConfig({
                title: 'Import Designations',
                filename: 'HRDesk_Designations_Template',
                headers: ['Title', 'Code', 'Department', 'Level'],
                sampleRow: ['DevOps Engineer', 'DEVOPS', 'Engineering & Technology', 'L3 (Senior)'],
              });
              setBulkImportModalOpen(true);
            }}
            importLabel="Import Designations"
            primaryAction={{
              label: 'Add Designation',
              icon: <Plus size={14} />,
              onClick: () => setDesigModalOpen(true),
            }}
          />

          <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
            <table className="register-table">
              <thead>
                <tr>
                  <th>Designation Title</th>
                  <th className="font-data">Code</th>
                  <th>Department</th>
                  <th className="font-data">Job Grade</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDesigs.map((des) => (
                  <tr key={des.id}>
                    <td className="font-semibold text-[var(--ink)]">{des.title}</td>
                    <td className="font-data text-xs text-[var(--ink-muted)] font-semibold">{des.code}</td>
                    <td className="text-xs text-[var(--ink)]">{des.department}</td>
                    <td className="font-data text-xs text-[var(--ink-muted)] font-semibold">{des.level}</td>
                    <td className="text-right">
                      <button
                        onClick={() => setDesignations(designations.filter(d => d.id !== des.id))}
                        className="text-[var(--ink-muted)] hover:text-[var(--err-600)] p-1 cursor-pointer"
                        title="Delete Designation"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {paginatedDesigs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs font-data text-[var(--ink-muted)]">
                      No designations match filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Ruled Pagination Toolbar */}
            <PaginationToolbar
              page={page}
              pageSize={pageSize}
              totalCount={filteredDesigs.length}
              totalPages={Math.ceil(filteredDesigs.length / pageSize) || 1}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 20]}
            />
          </div>
        </div>
      )}

      {/* Tab 4: Leave Types Master */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <DataToolbar
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search leave category by name or code..."
            filters={[
              {
                id: 'paid',
                value: leavePaidFilter,
                onChange: (v) => { setLeavePaidFilter(v); setPage(1); },
                options: [
                  { value: '', label: 'All Leave Categories' },
                  { value: 'paid', label: 'Paid Leaves' },
                  { value: 'unpaid', label: 'Unpaid / LWP' },
                ],
              },
            ]}
            onExport={handleExportLeaveTypes}
            exportLabel="Export Leave Types"
            onImport={() => {
              setBulkImportConfig({
                title: 'Import Leave Categories',
                filename: 'HRDesk_Leave_Types_Template',
                headers: ['Name', 'Code', 'Quota', 'IsPaid'],
                sampleRow: ['Maternity Leave', 'ML', '180', 'TRUE'],
              });
              setBulkImportModalOpen(true);
            }}
            importLabel="Import Categories"
            primaryAction={{
              label: 'Add Category',
              icon: <Plus size={14} />,
              onClick: () => setLeaveModalOpen(true),
            }}
          />

          <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
            <table className="register-table">
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th className="font-data">Code</th>
                  <th className="text-right font-data">Default Quota</th>
                  <th>Salary Impact</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeaves.map((t) => (
                  <tr key={t.id}>
                    <td className="font-semibold text-[var(--ink)]">{t.name}</td>
                    <td className="font-data text-xs text-[var(--ink-muted)] font-semibold">{t.code}</td>
                    <td className="text-right font-data text-xs text-[var(--ink)]">{t.quota > 0 ? `${t.quota} days/yr` : 'Credit-based'}</td>
                    <td className="text-xs">
                      <span className={`px-1.5 py-0.5 rounded-[2px] font-data text-[10px] font-bold ${t.isPaid ? 'bg-[var(--ok-600)]/10 text-[var(--ok-600)]' : 'bg-[var(--err-600)]/10 text-[var(--err-600)]'}`}>
                        {t.isPaid ? 'Paid Leave' : 'Unpaid (LOP)'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setLeaveTypes(leaveTypes.filter(l => l.id !== t.id))}
                        className="text-[var(--ink-muted)] hover:text-[var(--err-600)] p-1 cursor-pointer"
                        title="Delete Leave Type"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {paginatedLeaves.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs font-data text-[var(--ink-muted)]">
                      No leave categories match search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Ruled Pagination Toolbar */}
            <PaginationToolbar
              page={page}
              pageSize={pageSize}
              totalCount={filteredLeaves.length}
              totalPages={Math.ceil(filteredLeaves.length / pageSize) || 1}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 20]}
            />
          </div>
        </div>
      )}

      {/* Tab 5: Work Shifts Master */}
      {activeTab === 'shifts' && (
        <div className="space-y-4">
          <DataToolbar
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search work shifts by name or code..."
            onExport={handleExportShifts}
            exportLabel="Export Shifts"
            onImport={() => {
              setBulkImportConfig({
                title: 'Import Work Shifts',
                filename: 'HRDesk_Shifts_Template',
                headers: ['ShiftName', 'Code', 'StartTime', 'EndTime', 'BreakMinutes'],
                sampleRow: ['Weekend Shift', 'WKND', '08:00', '17:00', '60'],
              });
              setBulkImportModalOpen(true);
            }}
            importLabel="Import Shifts"
            primaryAction={{
              label: 'Add Shift',
              icon: <Plus size={14} />,
              onClick: () => setShiftModalOpen(true),
            }}
          />

          <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
            <table className="register-table">
              <thead>
                <tr>
                  <th>Shift Name</th>
                  <th className="font-data">Code</th>
                  <th className="font-data">Timings</th>
                  <th className="text-right font-data">Break Window</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedShifts.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold text-[var(--ink)]">{s.name}</td>
                    <td className="font-data text-xs text-[var(--ink-muted)] font-semibold">{s.code}</td>
                    <td className="font-data text-xs text-[var(--ink)]">
                      {s.startTime} — {s.endTime}
                    </td>
                    <td className="text-right font-data text-xs text-[var(--ink-muted)]">
                      {s.breakMinutes} mins
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setShifts(shifts.filter(sh => sh.id !== s.id))}
                        className="text-[var(--ink-muted)] hover:text-[var(--err-600)] p-1 cursor-pointer"
                        title="Delete Shift"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {paginatedShifts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs font-data text-[var(--ink-muted)]">
                      No shifts match search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Ruled Pagination Toolbar */}
            <PaginationToolbar
              page={page}
              pageSize={pageSize}
              totalCount={filteredShifts.length}
              totalPages={Math.ceil(filteredShifts.length / pageSize) || 1}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 20]}
            />
          </div>
        </div>
      )}

      {/* Tab 6: Attendance Policy */}
      {activeTab === 'attendance' && (
        <form onSubmit={handleSaveAttendancePolicy} className="space-y-6">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-5 space-y-4">
            <div className="pb-2 border-b border-[var(--rule)]">
              <h2 className="font-semibold text-sm text-[var(--ink)]">Attendance & Work Hours Policy</h2>
              <p className="text-xs text-[var(--ink-muted)]">Thresholds for calculating present, half-day, and late mark deductions</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Late In Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  value={attendancePolicy.gracePeriodMinutes}
                  onChange={(e) => setAttendancePolicy({ ...attendancePolicy, gracePeriodMinutes: Number(e.target.value) })}
                  className="register-input w-full font-data"
                />
                <p className="text-[11px] text-[var(--ink-muted)] mt-1">Punches within grace time will not trigger a late flag.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Half-Day Threshold (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={attendancePolicy.halfDayThresholdHours}
                  onChange={(e) => setAttendancePolicy({ ...attendancePolicy, halfDayThresholdHours: Number(e.target.value) })}
                  className="register-input w-full font-data"
                />
                <p className="text-[11px] text-[var(--ink-muted)] mt-1">Minimum hours required to count 0.5 payable present day.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Full-Day Shift Threshold (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={attendancePolicy.fullDayThresholdHours}
                  onChange={(e) => setAttendancePolicy({ ...attendancePolicy, fullDayThresholdHours: Number(e.target.value) })}
                  className="register-input w-full font-data"
                />
                <p className="text-[11px] text-[var(--ink-muted)] mt-1">Minimum working hours required for 1.0 full present day.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Biometric Terminal Polling Interval (Minutes)
                </label>
                <input
                  type="number"
                  value={attendancePolicy.autoSyncIntervalMinutes}
                  onChange={(e) => setAttendancePolicy({ ...attendancePolicy, autoSyncIntervalMinutes: Number(e.target.value) })}
                  className="register-input w-full font-data"
                />
                <p className="text-[11px] text-[var(--ink-muted)] mt-1">Telemetry polling frequency from physical fingerprint/face terminals.</p>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--rule)] flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={14} />
                <span>{saving ? 'Saving...' : 'Save Policy'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Modal 1: Organisation Add / Edit */}
      {orgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-lg rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">
                  {editingOrgId ? 'Edit Organisation' : 'Register New Organisation'}
                </h3>
                <p className="text-xs text-[var(--ink-muted)]">Organisation particulars & location parameters</p>
              </div>
              <button
                onClick={() => setOrgModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveOrg} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Organisation Name *
                </label>
                <input
                  type="text"
                  required
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  placeholder="e.g. HRDesk Builders & Developers"
                  className="register-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Organisation Code
                  </label>
                  <input
                    type="text"
                    value={orgForm.code}
                    onChange={(e) => setOrgForm({ ...orgForm, code: e.target.value })}
                    placeholder="HBD"
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    WhatsApp Group ID
                  </label>
                  <input
                    type="text"
                    value={orgForm.whatsAppGroupId}
                    onChange={(e) => setOrgForm({ ...orgForm, whatsAppGroupId: e.target.value })}
                    placeholder="120363xxxxxx@g.us"
                    className="register-input w-full font-data"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Physical Address
                </label>
                <textarea
                  rows={2}
                  value={orgForm.address}
                  onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                  placeholder="Street address, city, state, postal code"
                  className="register-input w-full"
                />
              </div>

              {/* Geofencing Coordinates */}
              <div className="p-3 bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                  <MapPin size={14} className="text-[var(--gold-500)]" />
                  <span>GPS Geofencing Parameters</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[var(--ink-muted)] mb-1">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={orgForm.latitude}
                      onChange={(e) => setOrgForm({ ...orgForm, latitude: Number(e.target.value) })}
                      className="register-input w-full font-data text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[var(--ink-muted)] mb-1">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={orgForm.longitude}
                      onChange={(e) => setOrgForm({ ...orgForm, longitude: Number(e.target.value) })}
                      className="register-input w-full font-data text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-[var(--ink-muted)] mb-1">
                      Radius (m)
                    </label>
                    <input
                      type="number"
                      value={orgForm.radiusMeters}
                      onChange={(e) => setOrgForm({ ...orgForm, radiusMeters: Number(e.target.value) })}
                      className="register-input w-full font-data text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setOrgModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary cursor-pointer"
                >
                  {editingOrgId ? 'Save Changes' : 'Register Organisation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Department */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">
                  Add Department
                </h3>
                <p className="text-xs text-[var(--ink-muted)]">Register a new organizational unit</p>
              </div>
              <button
                onClick={() => setDeptModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddDept} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quality Assurance"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  className="register-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Department Code</label>
                  <input
                    type="text"
                    placeholder="QA"
                    value={newDept.code}
                    onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Lead / Officer</label>
                  <input
                    type="text"
                    placeholder="QA Lead"
                    value={newDept.head}
                    onChange={(e) => setNewDept({ ...newDept, head: e.target.value })}
                    className="register-input w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setDeptModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary cursor-pointer"
                >
                  Add Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Add Designation */}
      {desigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">
                  Add Designation
                </h3>
                <p className="text-xs text-[var(--ink-muted)]">Configure job title and career hierarchy</p>
              </div>
              <button
                onClick={() => setDesigModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddDesignation} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Designation Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior DevOps Engineer"
                  value={newDesignation.title}
                  onChange={(e) => setNewDesignation({ ...newDesignation, title: e.target.value })}
                  className="register-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Code</label>
                  <input
                    type="text"
                    placeholder="SDE"
                    value={newDesignation.code}
                    onChange={(e) => setNewDesignation({ ...newDesignation, code: e.target.value })}
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Job Grade</label>
                  <select
                    value={newDesignation.level}
                    onChange={(e) => setNewDesignation({ ...newDesignation, level: e.target.value })}
                    className="register-input w-full text-xs font-data"
                  >
                    <option value="L1 (Associate)">L1 (Associate)</option>
                    <option value="L2 (Mid)">L2 (Mid Level)</option>
                    <option value="L3 (Senior)">L3 (Senior)</option>
                    <option value="L4 (Lead)">L4 (Lead / Principal)</option>
                    <option value="L5 (Executive)">L5 (Executive)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Department</label>
                <select
                  value={newDesignation.department}
                  onChange={(e) => setNewDesignation({ ...newDesignation, department: e.target.value })}
                  className="register-input w-full"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setDesigModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary cursor-pointer"
                >
                  Add Designation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Add Leave Type */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">
                  Add Leave Category
                </h3>
                <p className="text-xs text-[var(--ink-muted)]">Configure quota policy & salary impact</p>
              </div>
              <button
                onClick={() => setLeaveModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddLeaveType} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Leave Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maternity Leave"
                  value={newLeaveType.name}
                  onChange={(e) => setNewLeaveType({ ...newLeaveType, name: e.target.value })}
                  className="register-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Code</label>
                  <input
                    type="text"
                    placeholder="ML"
                    value={newLeaveType.code}
                    onChange={(e) => setNewLeaveType({ ...newLeaveType, code: e.target.value })}
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Annual Quota (Days)</label>
                  <input
                    type="number"
                    value={newLeaveType.quota}
                    onChange={(e) => setNewLeaveType({ ...newLeaveType, quota: Number(e.target.value) })}
                    className="register-input w-full font-data"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Salary Impact</label>
                <select
                  value={newLeaveType.isPaid ? 'true' : 'false'}
                  onChange={(e) => setNewLeaveType({ ...newLeaveType, isPaid: e.target.value === 'true' })}
                  className="register-input w-full font-data"
                >
                  <option value="true">Paid Leave (100% Payable)</option>
                  <option value="false">Unpaid Leave (Loss of Pay / LOP)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary cursor-pointer"
                >
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Add Work Shift */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">
                  Add Work Shift
                </h3>
                <p className="text-xs text-[var(--ink-muted)]">Configure shift timings and break windows</p>
              </div>
              <button
                onClick={() => setShiftModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddShift} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Shift Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekend Shift"
                  value={newShift.name}
                  onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                  className="register-input w-full"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Code</label>
                  <input
                    type="text"
                    placeholder="WKND"
                    value={newShift.code}
                    onChange={(e) => setNewShift({ ...newShift, code: e.target.value })}
                    className="register-input w-full font-data"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Start</label>
                  <input
                    type="time"
                    value={newShift.startTime}
                    onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                    className="register-input w-full font-data text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">End</label>
                  <input
                    type="time"
                    value={newShift.endTime}
                    onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                    className="register-input w-full font-data text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">Break Duration (Minutes)</label>
                <input
                  type="number"
                  value={newShift.breakMinutes}
                  onChange={(e) => setNewShift({ ...newShift, breakMinutes: Number(e.target.value) })}
                  className="register-input w-full font-data"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setShiftModalOpen(false)}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary cursor-pointer"
                >
                  Add Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Bulk Import Modal for Settings */}
      <BulkImportModal
        isOpen={bulkImportModalOpen}
        onClose={() => setBulkImportModalOpen(false)}
        title={bulkImportConfig.title}
        templateFilename={bulkImportConfig.filename}
        templateHeaders={bulkImportConfig.headers}
        templateSampleRow={bulkImportConfig.sampleRow}
        onImportComplete={() => {
          setBulkImportModalOpen(false);
          showSuccess('Import Complete', `${bulkImportConfig.title} processed successfully.`);
        }}
      />
    </div>
  );
};

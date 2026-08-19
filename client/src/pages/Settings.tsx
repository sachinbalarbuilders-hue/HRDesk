import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useOrganization } from '../context/CompanyContext';
import { exportToCSV } from '../utils/csvHelper';
import { DataToolbar } from '../components/ui/DataToolbar';
import { DataTable, type ColumnDef } from '../components/ui/DataTable';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import { ArchiveActionButton } from '../components/ui/ArchiveActionButton';
import { type ArchiveFilterValue } from '../components/ui/ArchiveToggle';
import {
  Building2,
  CalendarCheck,
  FolderTree,
  Plus,
  Trash2,
  MapPin,
  X,
  Edit2,
  Layers,
  Award,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const { currentOrganization, currentBranch } = useOrganization();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'company' | 'departments' | 'designations' | 'leaves' | 'shifts'>('company');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['company', 'branches', 'departments', 'designations', 'leaves', 'shifts'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  // Common Search & Filter States
  const [search, setSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [deptFilter, setDeptFilter] = useState('');
  const [leavePaidFilter, setLeavePaidFilter] = useState('');

  // 0. Company Master State
  const [company, setCompany] = useState<any>({
    legalName: 'Sachin Balar Builders Pvt. Ltd.',
    tradeName: 'Hue Builders',
    code: 'SBB',
    gstin: '24AAAAA0000A1Z5',
    cin: 'U45200GJ2015PTC085123',
    pan: 'AAAAA0000A',
    email: 'contact@sachinbalar.com',
    phone: '+91 98765 43210',
    headquartersAddress: 'Surat, Gujarat, India',
    website: 'https://sachinbalarbuilders.com',
    branchCount: 0,
  });
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState({ ...company });

  // Modals

  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [desigModalOpen, setDesigModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
  const [bulkImportConfig, setBulkImportConfig] = useState({ title: '', filename: '', headers: [] as string[], sampleRow: [] as string[] });

  // 1. Organizations (parent company sites / legal entities)
  const [organizations, setOrganizations] = useState<any[]>([]);

  // 1b. Branches (sub-locations under an organization)
  const [branches, setBranches] = useState<any[]>([]);



  // 3. Departments Master
  const [departments, setDepartments] = useState<any[]>([]);
  const [newDept, setNewDept] = useState({ name: '', code: '', head: '' });

  // 4. Designations Master
  const [designations, setDesignations] = useState<any[]>([]);
  const [newDesignation, setNewDesignation] = useState({ title: '', code: '', department: 'Engineering & Technology', level: 'L2 (Mid)' });

  // 5. Leave Types Master
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [newLeaveType, setNewLeaveType] = useState({ name: '', code: '', quota: 12, isPaid: true });

  // 6. Work Shifts Master
  const [shifts, setShifts] = useState<any[]>([]);
  const [newShift, setNewShift] = useState({ name: '', code: '', startTime: '09:00', endTime: '18:00', breakMinutes: 60 });

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const [overviewRes, companyRes] = await Promise.allSettled([
        apiClient.get('/masters/overview', {
          params: { branchId: currentBranch?.id || undefined }
        }),
        apiClient.get('/masters/company'),
      ]);

      if (companyRes.status === 'fulfilled' && companyRes.value.data) {
        setCompany(companyRes.value.data);
        setCompanyForm(companyRes.value.data);
      }

      if (overviewRes.status === 'fulfilled' && overviewRes.value.data) {
        const res = overviewRes.value;
        if (res.data.organizations) {
          const orgList = res.data.organizations.map((o: any) => ({
            id: o.id,
            name: o.name,
            code: o.code || (o.name.length > 3 ? o.name.split(' ').map((w: string) => w[0]).join('').toUpperCase() : o.name.toUpperCase()),
            address: o.address || '',
            whatsAppGroupId: o.whatsAppGroupId || '',
            latitude: o.latitude || 21.1702,
            longitude: o.longitude || 72.8311,
            radiusMeters: o.radiusMeters || 100,
            isActive: o.isActive !== false,
            status: o.isActive !== false ? 'Active' : 'Inactive',
          }));
          setOrganizations(orgList);
        }
        if (res.data.branches) {
          setBranches(res.data.branches.map((b: any) => ({
            id: b.id,
            organizationId: b.organizationId,
            name: b.name,
            code: b.code || (b.name.length > 3 ? b.name.split(' ').map((w: string) => w[0]).join('').toUpperCase() : b.name.toUpperCase()),
            address: b.address || '',
            city: b.city || '',
            state: b.state || '',
            pincode: b.pincode || '',
            whatsAppGroupId: b.whatsAppGroupId || '',
            latitude: b.latitude || 21.1702,
            longitude: b.longitude || 72.8311,
            radiusMeters: b.radiusMeters || 100,
            isActive: b.isActive !== false,
            status: b.isActive !== false ? 'Active' : 'Inactive',
          })));
        }
        if (res.data.departments) setDepartments(res.data.departments.map((d: any) => ({ id: d.id, name: d.name, code: `DEP-${d.id}`, head: 'HOD', status: d.status || 'Active', branchId: d.branchId })));
        if (res.data.designations) setDesignations(res.data.designations.map((d: any) => ({ id: d.id, title: d.name, code: `DSG-${d.id}`, department: 'General', level: 'L2 (Mid)', status: d.status || 'Active', branchId: d.branchId })));
        if (res.data.leaveTypes) setLeaveTypes(res.data.leaveTypes.map((l: any) => ({ id: l.id, name: l.name, code: l.code || 'LV', quota: l.defaultDays, isPaid: l.isPaid, status: l.status || 'Active', branchId: l.branchId })));
        if (res.data.shifts) setShifts(res.data.shifts.map((s: any) => ({ id: s.id, name: s.name, code: s.code || 'SHF', startTime: s.startTime, endTime: s.endTime, breakMinutes: 60, status: 'Active', branchId: s.branchId })));
      }
    } catch (e) {
      console.error('Failed to load masters overview', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [currentOrganization?.id, currentBranch?.id]);

  useEffect(() => {
    const handleReload = () => {
      fetchOverview();
    };

    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);
    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, []);

  const handleTabSwitch = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setSearch('');
    setArchiveFilter('active');
    setDeptFilter('');
    setLeavePaidFilter('');
    setPage(1);
  };

  // --- Handlers ---
  const handleOpenCreateOrg = () => {
    navigate('/settings/organizations/new');
  };

  const handleOpenEditOrg = (org: any) => {
    navigate(`/settings/organizations/${org.id}`);
  };


  const handleDeleteOrg = (id: number) => {
    if (organizations.length <= 1) {
      showError('Cannot Delete', 'At least one primary Organization is required.');
      return;
    }
    setOrganizations(organizations.filter(o => o.id !== id));
    showSuccess('Organization Deleted', 'Organization profile removed.');
  };


  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await apiClient.put('/masters/company', companyForm);
      setCompany(companyForm);
      setCompanyModalOpen(false);
      showSuccess('Company Profile Updated', 'Corporate profile updated successfully.');
    } catch (err: any) {
      showError('Save Failed', err.response?.data?.message || 'Could not update company profile');
    } finally {
      setSaving(false);
    }
  };



  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.name.trim()) return;
    try {
      await apiClient.post('/masters/departments', {
        departmentName: newDept.name,
        branchId: currentBranch?.id ? parseInt(currentBranch.id) : null
      });
      setNewDept({ name: '', code: '', head: '' });
      setDeptModalOpen(false);
      showSuccess('Department Added', `${newDept.name} registered.`);
      fetchOverview();
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleAddDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesignation.title.trim()) return;
    try {
      await apiClient.post('/masters/designations', {
        designationName: newDesignation.title,
        branchId: currentBranch?.id ? parseInt(currentBranch.id) : null
      });
      setNewDesignation({ title: '', code: '', department: 'Engineering & Technology', level: 'L2 (Mid)' });
      setDesigModalOpen(false);
      showSuccess('Designation Added', `${newDesignation.title} registered.`);
      fetchOverview();
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleAddLeaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeaveType.name.trim()) return;
    try {
      await apiClient.post('/masters/leave-types', {
        name: newLeaveType.name,
        code: newLeaveType.code || 'LV',
        defaultYearlyQuota: newLeaveType.quota,
        isPaid: newLeaveType.isPaid,
        status: 'Active',
        branchId: currentBranch?.id ? parseInt(currentBranch.id) : null
      });
      setNewLeaveType({ name: '', code: '', quota: 12, isPaid: true });
      setLeaveModalOpen(false);
      showSuccess('Leave Category Added', `${newLeaveType.name} configured.`);
      fetchOverview();
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShift.name.trim()) return;
    try {
      await apiClient.post('/masters/shifts', {
        name: newShift.name,
        code: newShift.code || 'SHF',
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        breakMinutes: newShift.breakMinutes,
        branchId: currentBranch?.id ? parseInt(currentBranch.id) : null
      });
      setNewShift({ name: '', code: '', startTime: '09:00', endTime: '18:00', breakMinutes: 60 });
      setShiftModalOpen(false);
      showSuccess('Shift Registered', `${newShift.name} added to roster.`);
      fetchOverview();
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Server error');
    }
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

  // --- Filtering Calculations ---
  const s = search.trim().toLowerCase();

  const filteredOrgs = organizations.filter(o => {
    const matchesSearch = !s || (o.name?.toLowerCase().includes(s)) || (o.code?.toLowerCase().includes(s));
    const isAct = o.isActive !== false;
    const matchesArchive = archiveFilter === 'all' || (archiveFilter === 'active' ? isAct : !isAct);
    return matchesSearch && matchesArchive;
  });

  const filteredDepts = departments.filter(d => {
    const matchesSearch = !s || (d.name?.toLowerCase().includes(s)) || (d.code?.toLowerCase().includes(s));
    const isAct = d.status?.toLowerCase() !== 'inactive' && d.status?.toLowerCase() !== 'archived';
    const matchesArchive = archiveFilter === 'all' || (archiveFilter === 'active' ? isAct : !isAct);
    return matchesSearch && matchesArchive;
  });
  const paginatedDepts = filteredDepts.slice((page - 1) * pageSize, page * pageSize);

  const filteredDesigs = designations.filter(d => {
    const matchesSearch = !s || (d.title?.toLowerCase().includes(s)) || (d.code?.toLowerCase().includes(s));
    const matchesDept = !deptFilter || d.department === deptFilter;
    const isAct = d.status?.toLowerCase() !== 'inactive' && d.status?.toLowerCase() !== 'archived';
    const matchesArchive = archiveFilter === 'all' || (archiveFilter === 'active' ? isAct : !isAct);
    return matchesSearch && matchesDept && matchesArchive;
  });
  const paginatedDesigs = filteredDesigs.slice((page - 1) * pageSize, page * pageSize);

  const filteredLeaves = leaveTypes.filter(l => {
    const matchesSearch = !s || (l.name?.toLowerCase().includes(s)) || (l.code?.toLowerCase().includes(s));
    const matchesPaid = !leavePaidFilter || (leavePaidFilter === 'paid' ? l.isPaid : !l.isPaid);
    return matchesSearch && matchesPaid;
  });
  const paginatedLeaves = filteredLeaves.slice((page - 1) * pageSize, page * pageSize);

  const filteredShifts = shifts.filter(st => !s || (st.name?.toLowerCase().includes(s)) || (st.code?.toLowerCase().includes(s)));
  const paginatedShifts = filteredShifts.slice((page - 1) * pageSize, page * pageSize);

  // =========================================================================
  // REUSABLE COLUMN DEFINITIONS
  // =========================================================================

  // 2. Departments Columns
  const deptColumns: ColumnDef<any>[] = [
    {
      key: 'id',
      header: '#',
      width: '50px',
      align: 'center',
      className: 'font-data text-xs text-[var(--ink-muted)]',
      render: (item) => `#${item.id}`,
    },
    {
      key: 'name',
      header: 'Department Name',
      render: (item) => (
        <div className="flex items-center gap-2">
          <FolderTree size={14} className="text-[var(--gold-500)]" />
          <span className="font-semibold text-xs text-[var(--ink)]">{item.name}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (item) => (
        <span className="inline-block px-1.5 py-0.5 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)] font-data text-[10px] font-bold text-[var(--ink)]">
          {item.code}
        </span>
      ),
    },
    {
      key: 'head',
      header: 'Primary Officer / HOD',
      className: 'text-xs text-[var(--ink-muted)]',
      render: (item) => item.head || 'HOD',
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) =>
        item.status?.toLowerCase() !== 'inactive' && item.status?.toLowerCase() !== 'archived' ? (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Active
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Archived
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <ArchiveActionButton
            isArchived={item.status?.toLowerCase() === 'inactive' || item.status?.toLowerCase() === 'archived'}
            onArchive={() => {
              setDepartments(departments.map(d => d.id === item.id ? { ...d, status: 'inactive' } : d));
              showSuccess('Department Archived', `${item.name} moved to archive.`);
            }}
            onRestore={() => {
              setDepartments(departments.map(d => d.id === item.id ? { ...d, status: 'active' } : d));
              showSuccess('Department Restored', `${item.name} restored.`);
            }}
            itemName={item.name}
          />
          <button
            onClick={() => {
              setDepartments(departments.filter(d => d.id !== item.id));
              showSuccess('Department Deleted', 'Department removed.');
            }}
            className="p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-rose-600 cursor-pointer transition-colors"
            title="Delete Department"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  // 3. Designations Columns
  const desigColumns: ColumnDef<any>[] = [
    {
      key: 'id',
      header: '#',
      width: '50px',
      align: 'center',
      className: 'font-data text-xs text-[var(--ink-muted)]',
      render: (item) => `#${item.id}`,
    },
    {
      key: 'title',
      header: 'Designation Title',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Award size={14} className="text-[var(--gold-500)]" />
          <span className="font-semibold text-xs text-[var(--ink)]">{item.title}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (item) => (
        <span className="inline-block px-1.5 py-0.5 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)] font-data text-[10px] font-bold text-[var(--ink)]">
          {item.code}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      className: 'text-xs text-[var(--ink-muted)]',
      render: (item) => item.department || 'General',
    },
    {
      key: 'level',
      header: 'Job Grade',
      render: (item) => (
        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          {item.level || 'L2 (Mid)'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) =>
        item.status?.toLowerCase() !== 'inactive' && item.status?.toLowerCase() !== 'archived' ? (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Active
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Archived
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <ArchiveActionButton
            isArchived={item.status?.toLowerCase() === 'inactive' || item.status?.toLowerCase() === 'archived'}
            onArchive={() => {
              setDesignations(designations.map(d => d.id === item.id ? { ...d, status: 'inactive' } : d));
              showSuccess('Designation Archived', `${item.title} moved to archive.`);
            }}
            onRestore={() => {
              setDesignations(designations.map(d => d.id === item.id ? { ...d, status: 'active' } : d));
              showSuccess('Designation Restored', `${item.title} restored.`);
            }}
            itemName={item.title}
          />
          <button
            onClick={() => {
              setDesignations(designations.filter(d => d.id !== item.id));
              showSuccess('Designation Deleted', 'Designation removed.');
            }}
            className="p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-rose-600 cursor-pointer transition-colors"
            title="Delete Designation"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  // 4. Leave Types Columns
  const leaveColumns: ColumnDef<any>[] = [
    {
      key: 'id',
      header: '#',
      width: '50px',
      align: 'center',
      className: 'font-data text-xs text-[var(--ink-muted)]',
      render: (item) => `#${item.id}`,
    },
    {
      key: 'name',
      header: 'Leave Category',
      render: (item) => (
        <div className="flex items-center gap-2">
          <CalendarCheck size={14} className="text-[var(--gold-500)]" />
          <span className="font-semibold text-xs text-[var(--ink)]">{item.name}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (item) => (
        <span className="inline-block px-1.5 py-0.5 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)] font-data text-[10px] font-bold text-[var(--ink)]">
          {item.code}
        </span>
      ),
    },
    {
      key: 'quota',
      header: 'Annual Quota',
      align: 'center',
      className: 'font-data font-bold text-xs text-[var(--ink)]',
      render: (item) => `${item.quota} Days`,
    },
    {
      key: 'isPaid',
      header: 'Compensation Type',
      render: (item) =>
        item.isPaid ? (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Paid Leave
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
            Loss of Pay (Unpaid)
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <button
          onClick={() => {
            setLeaveTypes(leaveTypes.filter(l => l.id !== item.id));
            showSuccess('Leave Type Removed', 'Category deleted.');
          }}
          className="p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-rose-600 cursor-pointer transition-colors"
          title="Delete Leave Type"
        >
          <Trash2 size={13} />
        </button>
      ),
    },
  ];

  // 5. Work Shifts Columns
  const shiftColumns: ColumnDef<any>[] = [
    {
      key: 'id',
      header: '#',
      width: '50px',
      align: 'center',
      className: 'font-data text-xs text-[var(--ink-muted)]',
      render: (item) => `#${item.id}`,
    },
    {
      key: 'name',
      header: 'Shift Name',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[var(--gold-500)]" />
          <span className="font-semibold text-xs text-[var(--ink)]">{item.name}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (item) => (
        <span className="inline-block px-1.5 py-0.5 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)] font-data text-[10px] font-bold text-[var(--ink)]">
          {item.code}
        </span>
      ),
    },
    {
      key: 'timing',
      header: 'Timing',
      render: (item) => (
        <span className="font-data font-semibold text-xs text-emerald-700 dark:text-emerald-300">
          {item.startTime} – {item.endTime}
        </span>
      ),
    },
    {
      key: 'breakMinutes',
      header: 'Break Duration',
      align: 'center',
      className: 'font-data text-xs text-[var(--ink-muted)]',
      render: (item) => `${item.breakMinutes || 60} mins`,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <button
          onClick={() => {
            setShifts(shifts.filter(s => s.id !== item.id));
            showSuccess('Shift Removed', 'Shift removed from roster.');
          }}
          className="p-1 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] hover:text-rose-600 cursor-pointer transition-colors"
          title="Delete Shift"
        >
          <Trash2 size={13} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-ui">
      {/* 1. Header */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Settings & Organization Masters
            </h1>
            <p className="text-xs text-[var(--ink-muted)] font-ui mt-0.5">
              Organizations, departments, designations, leave quotas, shifts & attendance policies
            </p>
          </div>

          <span className="text-xs font-data text-[var(--ink-muted)]">
            Workspace Configuration
          </span>
        </div>

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
          <span>Organizations</span>
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


      </div>

      {/* 3. Tab Views */}

      {/* Tab 1: Organizations list */}
      {activeTab === 'company' && (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                  <Building2 size={15} className="text-[var(--gold-500)]" />
                  <span>Organizations</span>
                </h3>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  Open an organization to manage its branches and branch settings.
                </p>
              </div>
              <button onClick={handleOpenCreateOrg} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer">
                <Plus size={13} /><span>Add Organization</span>
              </button>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search organizations…"
              className="input-field w-full max-w-xs text-xs"
            />

            {loading ? (
              <div className="text-xs text-[var(--ink-muted)] py-6 text-center">Loading…</div>
            ) : filteredOrgs.length === 0 ? (
              <div className="text-xs text-[var(--ink-muted)] py-6 text-center border border-dashed border-[var(--rule)] rounded-[4px]">
                No Organizations found. Add one to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrgs.map((org) => {
                  const orgBranches = branches.filter(b => b.organizationId === org.id);
                  return (
                    <div key={org.id} className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
                      <div
                        className="flex items-center gap-3 px-4 py-3 bg-[var(--paper)] cursor-pointer hover:bg-[var(--surface)] transition-colors"
                        onClick={() => handleOpenEditOrg(org)}
                      >
                        <div className="w-8 h-8 rounded-[3px] bg-[var(--navy-900)] text-[var(--gold-500)] flex items-center justify-center shrink-0">
                          <Building2 size={14} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-[var(--ink)]">{org.name}</span>
                            {org.isActive !== false
                              ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Active</span>
                              : <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">Archived</span>
                            }
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[var(--ink-muted)]">
                            {org.address && <span className="flex items-center gap-1"><MapPin size={10} />{org.address}</span>}
                            <span>{orgBranches.length} {orgBranches.length === 1 ? 'branch' : 'branches'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleOpenEditOrg(org)} className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--gold-500)] cursor-pointer transition-colors" title="Open Organization"><Edit2 size={13} /></button>
                          <ArchiveActionButton
                            isArchived={org.isActive === false}
                            onArchive={async () => { try { await apiClient.put(`/masters/organizations/${org.id}`, { ...org, isActive: false }); setOrganizations(organizations.map(o => o.id === org.id ? { ...o, isActive: false } : o)); showSuccess('Archived', `${org.name} archived.`); } catch (err: any) { showError('Error', err.response?.data?.message || 'Failed'); } }}
                            onRestore={async () => { try { await apiClient.put(`/masters/organizations/${org.id}`, { ...org, isActive: true }); setOrganizations(organizations.map(o => o.id === org.id ? { ...o, isActive: true } : o)); showSuccess('Restored', `${org.name} restored.`); } catch (err: any) { showError('Error', err.response?.data?.message || 'Failed'); } }}
                            itemName={org.name}
                          />
                          <button onClick={() => handleDeleteOrg(org.id)} className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--ink-muted)] hover:text-rose-600 cursor-pointer transition-colors" title="Delete Organization"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Tab 2: Departments */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <DataToolbar
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search departments by name or code..."
            archiveFilter={{
              value: archiveFilter,
              onChange: (v) => { setArchiveFilter(v); setPage(1); },
            }}
            onExport={handleExportDepartments}
            exportLabel="Export CSV"
            onImport={() => {
              setBulkImportConfig({
                title: 'Import Departments',
                filename: 'HRDesk_Departments_Template',
                headers: ['Name', 'Code', 'Head'],
                sampleRow: ['Quality Assurance', 'QA', 'QA Lead'],
              });
              setBulkImportModalOpen(true);
            }}
            importLabel="Import CSV"
            primaryAction={{
              label: 'Add Department',
              icon: <Plus size={14} />,
              onClick: () => setDeptModalOpen(true),
            }}
          />

          <DataTable
            columns={deptColumns}
            data={paginatedDepts}
            loading={loading}
            emptyMessage="No departments found matching your search."
            pagination={{
              page,
              pageSize,
              totalCount: filteredDepts.length,
              totalPages: Math.ceil(filteredDepts.length / pageSize),
              onPageChange: setPage,
              onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
            }}
          />
        </div>
      )}

      {/* Tab 3: Designations */}
      {activeTab === 'designations' && (
        <div className="space-y-4">
          <DataToolbar
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search designations by title or code..."
            archiveFilter={{
              value: archiveFilter,
              onChange: (v) => { setArchiveFilter(v); setPage(1); },
            }}
            filters={[
              {
                id: 'department',
                ariaLabel: 'Department Filter',
                value: deptFilter,
                onChange: (v) => { setDeptFilter(v); setPage(1); },
                options: [
                  { value: '', label: 'All Departments' },
                  ...departments.map(d => ({ value: d.name, label: d.name })),
                ],
              },
            ]}
            onExport={handleExportDesignations}
            exportLabel="Export CSV"
            onImport={() => {
              setBulkImportConfig({
                title: 'Import Designations',
                filename: 'HRDesk_Designations_Template',
                headers: ['Title', 'Code', 'Department', 'Level'],
                sampleRow: ['DevOps Specialist', 'DEVOPS', 'Engineering & Technology', 'L3 (Senior)'],
              });
              setBulkImportModalOpen(true);
            }}
            importLabel="Import CSV"
            primaryAction={{
              label: 'Add Designation',
              icon: <Plus size={14} />,
              onClick: () => setDesigModalOpen(true),
            }}
          />

          <DataTable
            columns={desigColumns}
            data={paginatedDesigs}
            loading={loading}
            emptyMessage="No designations found matching your search."
            pagination={{
              page,
              pageSize,
              totalCount: filteredDesigs.length,
              totalPages: Math.ceil(filteredDesigs.length / pageSize),
              onPageChange: setPage,
              onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
            }}
          />
        </div>
      )}

      {/* Tab 4: Leave Types */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <DataToolbar
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search leave categories by name or code..."
            filters={[
              {
                id: 'isPaid',
                ariaLabel: 'Paid Status Filter',
                value: leavePaidFilter,
                onChange: (v) => { setLeavePaidFilter(v); setPage(1); },
                options: [
                  { value: '', label: 'All Leave Types' },
                  { value: 'paid', label: 'Paid Leaves Only' },
                  { value: 'unpaid', label: 'Unpaid Leaves Only' },
                ],
              },
            ]}
            onExport={handleExportLeaveTypes}
            exportLabel="Export CSV"
            onImport={() => {
              setBulkImportConfig({
                title: 'Import Leave Types',
                filename: 'HRDesk_Leave_Types_Template',
                headers: ['Name', 'Code', 'AnnualQuota', 'IsPaid'],
                sampleRow: ['Paternity Leave', 'PAT', '15', 'true'],
              });
              setBulkImportModalOpen(true);
            }}
            importLabel="Import CSV"
            primaryAction={{
              label: 'Add Leave Category',
              icon: <Plus size={14} />,
              onClick: () => setLeaveModalOpen(true),
            }}
          />

          <DataTable
            columns={leaveColumns}
            data={paginatedLeaves}
            loading={loading}
            emptyMessage="No leave categories configured."
            pagination={{
              page,
              pageSize,
              totalCount: filteredLeaves.length,
              totalPages: Math.ceil(filteredLeaves.length / pageSize),
              onPageChange: setPage,
              onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
            }}
          />
        </div>
      )}

      {/* Tab 5: Work Shifts */}
      {activeTab === 'shifts' && (
        <div className="space-y-4">
          <DataToolbar
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search shifts by name or code..."
            onExport={handleExportShifts}
            exportLabel="Export CSV"
            onImport={() => {
              setBulkImportConfig({
                title: 'Import Work Shifts',
                filename: 'HRDesk_Work_Shifts_Template',
                headers: ['ShiftName', 'ShiftCode', 'StartTime', 'EndTime', 'BreakMinutes'],
                sampleRow: ['Rotational Shift', 'ROT', '10:00', '19:00', '60'],
              });
              setBulkImportModalOpen(true);
            }}
            importLabel="Import CSV"
            primaryAction={{
              label: 'Add Work Shift',
              icon: <Plus size={14} />,
              onClick: () => setShiftModalOpen(true),
            }}
          />

          <DataTable
            columns={shiftColumns}
            data={paginatedShifts}
            loading={loading}
            emptyMessage="No work shifts defined."
            pagination={{
              page,
              pageSize,
              totalCount: filteredShifts.length,
              totalPages: Math.ceil(filteredShifts.length / pageSize),
              onPageChange: setPage,
              onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
            }}
          />
        </div>
      )}



      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}



      {/* 2. Add Department Modal */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <FolderTree size={16} className="text-[var(--gold-500)]" />
                <span>Create Department</span>
              </h3>
              <button onClick={() => setDeptModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddDept} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Department Name *</label>
                <input
                  type="text"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  placeholder="e.g. Civil Engineering"
                  className="input-field w-full"
                  required
                />
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => setDeptModalOpen(false)} className="btn-secondary py-1.5 px-3 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Designation Modal */}
      {desigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <Award size={16} className="text-[var(--gold-500)]" />
                <span>Create Designation</span>
              </h3>
              <button onClick={() => setDesigModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddDesignation} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Designation Title *</label>
                <input
                  type="text"
                  value={newDesignation.title}
                  onChange={(e) => setNewDesignation({ ...newDesignation, title: e.target.value })}
                  placeholder="e.g. Senior Project Manager"
                  className="input-field w-full"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Department</label>
                <select
                  value={newDesignation.department}
                  onChange={(e) => setNewDesignation({ ...newDesignation, department: e.target.value })}
                  className="input-field w-full text-xs"
                >
                  <option value="General">General / All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => setDesigModalOpen(false)} className="btn-secondary py-1.5 px-3 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                  Save Designation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Leave Type Modal */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <CalendarCheck size={16} className="text-[var(--gold-500)]" />
                <span>Configure Leave Category</span>
              </h3>
              <button onClick={() => setLeaveModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddLeaveType} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Category Name *</label>
                <input
                  type="text"
                  value={newLeaveType.name}
                  onChange={(e) => setNewLeaveType({ ...newLeaveType, name: e.target.value })}
                  placeholder="e.g. Paternity Leave"
                  className="input-field w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Code</label>
                  <input
                    type="text"
                    value={newLeaveType.code}
                    onChange={(e) => setNewLeaveType({ ...newLeaveType, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. PAT"
                    className="input-field w-full font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Annual Quota (Days)</label>
                  <input
                    type="number"
                    value={newLeaveType.quota}
                    onChange={(e) => setNewLeaveType({ ...newLeaveType, quota: Number(e.target.value) })}
                    className="input-field w-full font-data"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newLeaveType.isPaid}
                  onChange={(e) => setNewLeaveType({ ...newLeaveType, isPaid: e.target.checked })}
                  className="rounded border-[var(--rule)]"
                />
                <span className="font-medium text-[var(--ink)]">Is Paid Leave (No salary deduction)</span>
              </label>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => setLeaveModalOpen(false)} className="btn-secondary py-1.5 px-3 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Shift Modal */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <Layers size={16} className="text-[var(--gold-500)]" />
                <span>Create Work Shift</span>
              </h3>
              <button onClick={() => setShiftModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddShift} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Shift Name *</label>
                <input
                  type="text"
                  value={newShift.name}
                  onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                  placeholder="e.g. Night Shift"
                  className="input-field w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newShift.startTime}
                    onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                    className="input-field w-full font-data"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">End Time</label>
                  <input
                    type="time"
                    value={newShift.endTime}
                    onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                    className="input-field w-full font-data"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => setShiftModalOpen(false)} className="btn-secondary py-1.5 px-3 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Bulk Import Modal */}
      <BulkImportModal
        isOpen={bulkImportModalOpen}
        onClose={() => setBulkImportModalOpen(false)}
        title={bulkImportConfig.title}
        templateFilename={bulkImportConfig.filename}
        templateHeaders={bulkImportConfig.headers}
        templateSampleRow={bulkImportConfig.sampleRow}
        onImportComplete={() => {
          showSuccess('Import Complete', 'Records imported successfully.');
          fetchOverview();
        }}
      />

      {/* 8. Edit Corporate Profile Modal */}
      {companyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <Building2 size={16} className="text-[var(--gold-500)]" />
                <span>Edit Corporate Entity Profile</span>
              </h3>
              <button onClick={() => setCompanyModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-3 text-xs overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-medium text-[var(--ink)] mb-1">Legal Company Name *</label>
                  <input
                    type="text"
                    value={companyForm.legalName}
                    onChange={(e) => setCompanyForm({ ...companyForm, legalName: e.target.value })}
                    placeholder="e.g. Sachin Balar Builders Pvt. Ltd."
                    className="input-field w-full"
                    required
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-medium text-[var(--ink)] mb-1">Brand / Trade Name</label>
                  <input
                    type="text"
                    value={companyForm.tradeName || ''}
                    onChange={(e) => setCompanyForm({ ...companyForm, tradeName: e.target.value })}
                    placeholder="e.g. Hue Builders"
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Company Code</label>
                  <input
                    type="text"
                    value={companyForm.code || ''}
                    onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value })}
                    placeholder="SBB"
                    className="input-field w-full font-data"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">GSTIN / Tax ID</label>
                  <input
                    type="text"
                    value={companyForm.gstin || ''}
                    onChange={(e) => setCompanyForm({ ...companyForm, gstin: e.target.value })}
                    placeholder="24AAAAA0000A1Z5"
                    className="input-field w-full font-data"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={companyForm.pan || ''}
                    onChange={(e) => setCompanyForm({ ...companyForm, pan: e.target.value })}
                    placeholder="AAAAA0000A"
                    className="input-field w-full font-data"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">CIN / Registration No</label>
                  <input
                    type="text"
                    value={companyForm.cin || ''}
                    onChange={(e) => setCompanyForm({ ...companyForm, cin: e.target.value })}
                    placeholder="U45200GJ2015PTC085123"
                    className="input-field w-full font-data"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Official Website</label>
                  <input
                    type="text"
                    value={companyForm.website || ''}
                    onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                    placeholder="https://sachinbalarbuilders.com"
                    className="input-field w-full font-data"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Official Email</label>
                  <input
                    type="email"
                    value={companyForm.email || ''}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    placeholder="contact@sachinbalar.com"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--ink)] mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={companyForm.phone || ''}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="input-field w-full font-data"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Registered Headquarters Address</label>
                <textarea
                  value={companyForm.headquartersAddress || ''}
                  onChange={(e) => setCompanyForm({ ...companyForm, headquartersAddress: e.target.value })}
                  placeholder="Full Corporate Headquarters Address..."
                  rows={2}
                  className="input-field w-full resize-none"
                />
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => setCompanyModalOpen(false)} className="btn-secondary py-1.5 px-3 text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary py-1.5 px-4 text-xs">
                  {saving ? 'Saving...' : 'Save Corporate Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



    </div>
  );
};

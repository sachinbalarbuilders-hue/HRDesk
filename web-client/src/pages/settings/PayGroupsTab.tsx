import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useArchiveActions, isRowArchived } from '../../hooks/useArchiveActions';
import { type ArchiveFilterValue } from '../../components/ui/ArchiveToggle';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { DataToolbar } from '../../components/ui/DataToolbar';
import {
  Users, Plus, Pencil, X, UserPlus, Trash2,
} from 'lucide-react';
import { Switch } from '../../components/ui/Switch';

interface PayGroupComponent {
  id?: number;
  componentId: number;
  componentName: string;
  componentCode: string;
  componentType: 'Earning' | 'Deduction' | 'Informational';
  calculationType: string;
  value?: number | null;
  baseComponentCode?: string | null;
  displayOrder: number;
  selected?: boolean;
}

interface MasterSalaryComponent {
  id: number;
  componentName: string;
  componentCode: string;
  componentType: 'Earning' | 'Deduction' | 'Informational';
  calculationType?: string;
  defaultValue?: number | null;
  baseComponentCode?: string | null;
  displayOrder: number;
  isActive: boolean;
}

interface PayGroup {
  id: number;
  name: string;
  description?: string;
  salaryBasis: string;
  lopRounding: string;
  pfApplicable: boolean;
  capEmployeePf: boolean;
  capEmployerPf: boolean;
  pfWageCeiling: number;
  esiApplicable: boolean;
  ptApplicable: boolean;
  ptState?: string;
  isActive: boolean;
  employeeCount: number;
  componentCount?: number;
  components?: PayGroupComponent[];
  archivedAt?: string;
}

interface GroupEmployee {
  employeeId: number;
  employeeName: string;
  department?: string;
  designation?: string;
  photoPath?: string;
}

interface AllEmployee {
  employeeId: number;
  employeeName: string;
  employeeCode?: string;
  department?: string;
  designation?: string;
  photoPath?: string;
}

const BASIS_LABELS: Record<string, string> = {
  CalendarDays: 'Calendar Days (÷ days in month)',
  Fixed26: 'Fixed 26 Days',
  Fixed30: 'Fixed 30 Days',
  ActualWorkingDays: 'Actual Working Days',
  PerDay: 'Per Day Rate',
};

const STATES = [
  'Andhra Pradesh', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Telangana',
  'West Bengal', 'Kerala', 'Gujarat', 'Rajasthan', 'Madhya Pradesh',
  'Bihar', 'Odisha', 'Assam', 'Punjab', 'Uttarakhand',
];

function renderRuleBadge(c: { calculationType?: string; value?: number | null; defaultValue?: number | null; baseComponentCode?: string | null }) {
  const type = c.calculationType || 'FixedAmount';
  const val = c.value != null ? c.value : c.defaultValue;
  if (type === 'PercentOfCTC') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
        {val ?? 0}% of CTC
      </span>
    );
  }
  if (type === 'PercentOfComponent') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300">
        {val ?? 0}% of {c.baseComponentCode || 'BASIC'}
      </span>
    );
  }
  if (type === 'FixedAmount') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
        ₹{Number(val || 0).toLocaleString('en-IN')}/mo
      </span>
    );
  }
  if (type === 'Remainder') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
        Remainder
      </span>
    );
  }
  if (type === 'Statutory') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
        Statutory
      </span>
    );
  }
  return null;
}

const emptyForm = {
  name: '', description: '', salaryBasis: 'CalendarDays',
  pfApplicable: true, capEmployeePf: true, capEmployerPf: true, pfWageCeiling: 15000,
  esiApplicable: true, ptApplicable: true,
  ptState: 'Telangana',
};

// ── Avatar helpers ───────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-slate-400', 'bg-stone-400', 'bg-zinc-500', 'bg-neutral-500',
  'bg-blue-400', 'bg-indigo-400', 'bg-violet-400', 'bg-teal-400',
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function Avatar({ emp, size = 24 }: { emp: { employeeId: number; employeeName: string; photoPath?: string }; size?: number }) {
  const px = `${size}px`;
  if (emp.photoPath) {
    return (
      <img
        src={emp.photoPath}
        alt={emp.employeeName}
        title={emp.employeeName}
        className="rounded-full object-cover border border-[var(--rule)] ring-1 ring-[var(--surface)]"
        style={{ width: px, height: px, minWidth: px }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div
      title={emp.employeeName}
      className={`${avatarColor(emp.employeeId)} rounded-full flex items-center justify-center text-white font-semibold border border-[var(--rule)] ring-1 ring-[var(--surface)] shrink-0`}
      style={{ width: px, height: px, minWidth: px, fontSize: size * 0.38 }}
    >
      {initials(emp.employeeName)}
    </div>
  );
}

// ── Avatar stack (up to maxShow, then +N badge) ──────────────────────────────

function AvatarStack({ employees, maxShow = 4 }: { employees: GroupEmployee[]; maxShow?: number }) {
  if (!employees.length) {
    return <span className="text-xs font-normal text-[var(--text-secondary)] italic">—</span>;
  }
  const shown = employees.slice(0, maxShow);
  const extra = employees.length - shown.length;
  return (
    <div className="flex items-center" style={{ gap: 0 }}>
      {shown.map((emp, i) => (
        <div key={emp.employeeId} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: shown.length - i }}>
          <Avatar emp={emp} size={22} />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="rounded-full bg-[var(--paper-subtle)] border border-[var(--rule)] ring-1 ring-[var(--surface)] flex items-center justify-center text-[var(--text-secondary)] font-semibold"
          style={{ width: 22, height: 22, minWidth: 22, fontSize: 9, marginLeft: -6, zIndex: 0 }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

// ── Inline employee assignment panel (used inside the modal) ─────────────────

function EmployeeAssignPanel({
  payGroupId,
  onCountChange,
}: {
  payGroupId: number;
  onCountChange?: (n: number) => void;
}) {
  const { showSuccess, showError } = useToast();
  const [assigned, setAssigned] = useState<GroupEmployee[]>([]);
  const [allEmployees, setAllEmployees] = useState<AllEmployee[]>([]);
  const [search, setSearch] = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const [assignedRes, allRes] = await Promise.all([
        apiClient.get(`/pay-groups/${payGroupId}/employees`),
        apiClient.get('/employees/salary-overview'),
      ]);
      const a: GroupEmployee[] = assignedRes.data || [];
      setAssigned(a);
      onCountChange?.(a.length);
      setAllEmployees(allRes.data || []);
    } catch {
      showError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [payGroupId]);

  useEffect(() => { reload(); }, [reload]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const assignedIds = new Set(assigned.map(e => e.employeeId));

  const unassignedEmployees = allEmployees.filter(e => {
    if (assignedIds.has(e.employeeId)) return false;
    if (!search) return true;
    return (
      e.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      (e.employeeCode?.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const handleAssign = async (emp: AllEmployee) => {
    try {
      await apiClient.post(`/pay-groups/${payGroupId}/assign`, { employeeIds: [emp.employeeId] });
      showSuccess(`${emp.employeeName} assigned`);
      setDropOpen(false);
      setSearch('');
      reload();
    } catch { showError('Failed to assign employee'); }
  };

  const handleRemove = async (emp: GroupEmployee) => {
    try {
      await apiClient.post('/pay-groups/unassign', { employeeIds: [emp.employeeId] });
      showSuccess(`${emp.employeeName} removed`);
      reload();
    } catch { showError('Failed to remove employee'); }
  };

  return (
    <div className="space-y-3">
      <p className="font-semibold text-[var(--text-primary)] text-xs font-normal uppercase tracking-wider border-b border-[var(--rule)] pb-2 flex items-center gap-1.5">
        <Users size={12} className="text-[var(--accent)]" />
        Assigned Employees ({assigned.length})
      </p>

      {/* Search / add dropdown */}
      <div className="relative" ref={dropRef}>
        <button
          type="button"
          onClick={() => { setDropOpen(o => !o); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--text-secondary)] hover:border-[var(--gold-400)] transition-colors cursor-pointer text-left"
        >
          <UserPlus size={12} />
          Add employee to this group…
        </button>

        {dropOpen && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-lg">
            <div className="p-2 border-b border-[var(--rule)]">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search employees…"
                className="w-full px-2 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="max-h-44 overflow-y-auto">
              {unassignedEmployees.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)] p-3 text-center italic">
                  {search ? 'No matches' : 'All employees already assigned'}
                </p>
              ) : (
                unassignedEmployees.slice(0, 30).map(emp => (
                  <button
                    key={emp.employeeId}
                    type="button"
                    onClick={() => handleAssign(emp)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--paper-hover)] text-left cursor-pointer transition-colors"
                  >
                    <Avatar emp={emp} size={20} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{emp.employeeName}</p>
                      {emp.department && (
                        <p className="text-xs font-normal text-[var(--text-secondary)] truncate">{emp.department}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assigned list */}
      {loading ? (
        <p className="text-xs text-[var(--text-secondary)] italic py-2">Loading…</p>
      ) : assigned.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)] italic py-2">No employees assigned yet.</p>
      ) : (
        <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
          {assigned.map(emp => (
            <div
              key={emp.employeeId}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] group"
            >
              <Avatar emp={emp} size={24} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{emp.employeeName}</p>
                {(emp.department || emp.designation) && (
                  <p className="text-xs font-normal text-[var(--text-secondary)] truncate">
                    {[emp.designation, emp.department].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(emp)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-secondary)] hover:text-red-500 cursor-pointer p-0.5"
                title="Remove from group"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main PayGroupsTab ────────────────────────────────────────────────────────

export const PayGroupsTab: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [groups, setGroups] = useState<PayGroup[]>([]);
  const [masterComponents, setMasterComponents] = useState<MasterSalaryComponent[]>([]);
  const [assignedComponents, setAssignedComponents] = useState<PayGroupComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<typeof emptyForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Avatar stacks pre-loaded per group id
  const [groupAvatars, setGroupAvatars] = useState<Record<number, GroupEmployee[]>>({});

  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  // Fetch all active master salary components
  useEffect(() => {
    apiClient.get('/salary-components', { params: { archiveStatus: 'active' } })
      .then(res => {
        const activeOnly = (res.data || []).filter((c: MasterSalaryComponent) => c.isActive);
        setMasterComponents(activeOnly);
      })
      .catch(() => {});
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const grpRes = await apiClient.get('/pay-groups', { params: { archiveStatus: archiveFilter } });
      const groups: PayGroup[] = grpRes.data || [];
      setGroups(groups);

      // Preload avatars for all groups that have employees
      const groupsWithEmp = groups.filter(g => g.employeeCount > 0);
      if (groupsWithEmp.length > 0) {
        const avatarResults = await Promise.allSettled(
          groupsWithEmp.map(g => apiClient.get(`/pay-groups/${g.id}/employees`))
        );
        const map: Record<number, GroupEmployee[]> = {};
        groupsWithEmp.forEach((g, i) => {
          const r = avatarResults[i];
          map[g.id] = r.status === 'fulfilled' ? (r.value.data || []) : [];
        });
        setGroupAvatars(map);
      } else {
        setGroupAvatars({});
      }
    } catch { showError('Failed to load pay groups'); }
    finally { setLoading(false); }
  }, [archiveFilter]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    // Default: select all active master components
    setAssignedComponents(
      masterComponents.map(mc => ({
        componentId: mc.id,
        componentName: mc.componentName,
        componentCode: mc.componentCode,
        componentType: mc.componentType,
        calculationType: mc.calculationType || 'FixedAmount',
        value: mc.defaultValue,
        baseComponentCode: mc.baseComponentCode,
        displayOrder: mc.displayOrder,
        selected: true,
      }))
    );
    setModalOpen(true);
  };

  const openEdit = async (g: PayGroup) => {
    setEditId(g.id);
    setForm({
      name: g.name,
      description: g.description || '',
      salaryBasis: g.salaryBasis,
      pfApplicable: g.pfApplicable,
      capEmployeePf: g.capEmployeePf,
      capEmployerPf: g.capEmployerPf,
      pfWageCeiling: g.pfWageCeiling ?? 15000,
      esiApplicable: g.esiApplicable,
      ptApplicable: g.ptApplicable,
      ptState: g.ptState || 'Telangana',
    });

    try {
      const res = await apiClient.get(`/pay-groups/${g.id}`);
      const existingComps: any[] = res.data?.components || [];
      const existingMap = new Map(existingComps.map(ec => [ec.componentId, ec]));

      const comps = masterComponents.map(mc => {
        const match = existingMap.get(mc.id);
        return {
          id: match?.id,
          componentId: mc.id,
          componentName: mc.componentName,
          componentCode: mc.componentCode,
          componentType: mc.componentType,
          calculationType: mc.calculationType || match?.calculationType || 'FixedAmount',
          value: mc.defaultValue != null ? mc.defaultValue : match?.value,
          baseComponentCode: mc.baseComponentCode || match?.baseComponentCode,
          displayOrder: match?.displayOrder || mc.displayOrder,
          selected: existingComps.length === 0 ? true : Boolean(match),
        };
      });
      setAssignedComponents(comps);
    } catch {
      setAssignedComponents(
        masterComponents.map(mc => ({
          componentId: mc.id,
          componentName: mc.componentName,
          componentCode: mc.componentCode,
          componentType: mc.componentType,
          calculationType: mc.calculationType || 'FixedAmount',
          value: mc.defaultValue,
          baseComponentCode: mc.baseComponentCode,
          displayOrder: mc.displayOrder,
          selected: true,
        }))
      );
    }

    setModalOpen(true);
  };

  const payGroupArchive = useArchiveActions({
    endpoint: '/pay-groups',
    label: 'Pay Group',
    onDone: fetchGroups,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      setSaving(true);
      const selectedComps = assignedComponents.filter(c => c.selected);
      const hasPf = selectedComps.some(c => c.componentCode.toUpperCase().includes('PF'));
      const hasEsi = selectedComps.some(c => c.componentCode.toUpperCase().includes('ESI'));
      const hasPt = selectedComps.some(c => c.componentCode.toUpperCase() === 'PT' || c.componentCode.toUpperCase().includes('PROFESSIONAL_TAX'));

      const payload = {
        ...form,
        pfApplicable: hasPf,
        esiApplicable: hasEsi,
        ptApplicable: hasPt,
        components: selectedComps.map((c, idx) => ({
          componentId: c.componentId,
          calculationType: c.calculationType,
          value: c.value,
          baseComponentCode: c.baseComponentCode,
          displayOrder: idx + 1,
        })),
      };

      if (editId) {
        await apiClient.put(`/pay-groups/${editId}`, payload);
        showSuccess('Pay group updated');
      } else {
        await apiClient.post('/pay-groups', payload);
        showSuccess('Pay group created');
      }
      setModalOpen(false);
      fetchGroups();
    } catch { showError('Failed to save pay group'); }
    finally { setSaving(false); }
  };

  const F = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const filteredGroups = groups.filter(g => {
    const isAct = !Boolean(g.archivedAt);
    const matchesArchive = archiveFilter === 'all' || (archiveFilter === 'active' ? isAct : !isAct);
    const s = search.trim().toLowerCase();
    const matchesSearch = !s || g.name.toLowerCase().includes(s) || (g.description && g.description.toLowerCase().includes(s));
    return matchesArchive && matchesSearch;
  });

  const paginatedGroups = filteredGroups.slice((page - 1) * pageSize, page * pageSize);

  const columns: ColumnDef<PayGroup>[] = [
    {
      key: 'name',
      header: 'Group Name',
      render: (g: PayGroup) => (
        <div>
          <p className="font-semibold text-[var(--text-primary)] text-xs">{g.name}</p>
          {g.description && <p className="text-xs font-normal text-[var(--text-secondary)] mt-0.5">{g.description}</p>}
        </div>
      ),
    },
    {
      key: 'salaryBasis',
      header: 'Salary Basis',
      render: (g: PayGroup) => (
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {BASIS_LABELS[g.salaryBasis] ?? g.salaryBasis}
        </span>
      ),
    },
    {
      key: 'components',
      header: 'Components',
      render: (g: PayGroup) => {
        const count = g.componentCount ?? g.components?.length ?? 0;
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[var(--paper-subtle)] text-[var(--text-primary)] border border-[var(--rule)]">
            {count} {count === 1 ? 'component' : 'components'}
          </span>
        );
      },
    },
    {
      key: 'employees',
      header: 'Employees',
      align: 'left',
      render: (g: PayGroup) => (
        <div className="flex items-center gap-2">
          <AvatarStack employees={groupAvatars[g.id] || []} maxShow={5} />
          {g.employeeCount > 0 && (
            <span className="text-xs font-normal text-[var(--text-secondary)]  tabular-nums">
              {g.employeeCount}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '100px',
      render: (g: PayGroup) => (
        <RowActionMenu
          actions={[
            { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(g) },
            ...payGroupArchive.rowActions({ id: g.id, name: g.name, isArchived: Boolean(g.archivedAt) }),
          ] as RowAction[]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)] ">Pay Groups</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Configure salary calculation basis, statutory deduction applicability, and link templates.
        </p>
      </div>

      <DataToolbar
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search pay groups..."
        archiveFilter={{
          value: archiveFilter,
          onChange: (v) => { setArchiveFilter(v); setPage(1); },
        }}
        primaryAction={{
          label: 'New Pay Group',
          icon: <Plus size={14} />,
          onClick: openCreate,
        }}
      />

      <DataTable
        columns={columns}
        data={paginatedGroups}
        loading={loading}
        keyExtractor={(g) => g.id}
        selection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys),
          bulkActions: payGroupArchive.bulkActions(archiveFilter === 'archived'),
        }}
        emptyMessage="No pay groups found. Click 'New Pay Group' to create one."
        pagination={{
          page,
          pageSize,
          totalCount: filteredGroups.length,
          totalPages: Math.ceil(filteredGroups.length / pageSize) || 1,
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
        }}
      />

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex flex-shrink-0 items-center justify-between p-4 border-b border-[var(--rule)]">
              <div>
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                  {editId ? 'Edit Pay Group & Salary Structure' : 'New Pay Group & Salary Structure'}
                </h3>
                <p className="text-xs font-normal text-[var(--text-secondary)] mt-0.5">
                  Assign salary components and deduction rules that apply to this group of employees.
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto">

                {/* Column 1: Basic Info & Statutory Tuning */}
                <div className="space-y-4">
                  <p className="font-semibold text-[var(--text-primary)] text-xs font-normal uppercase tracking-wider border-b border-[var(--rule)] pb-2">
                    Group Details
                  </p>
                  <div>
                    <label className="font-semibold text-[var(--text-primary)] block mb-1.5 text-xs">Group Name *</label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={F}
                      required
                      placeholder="e.g. Corporate Staff, Factory Workers"
                      className="w-full px-3 py-2 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] "
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[var(--text-primary)] block mb-1.5 text-xs">Description</label>
                    <input
                      name="description"
                      value={form.description}
                      onChange={F}
                      placeholder="Optional notes"
                      className="w-full px-3 py-2 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] "
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[var(--text-primary)] block mb-1.5 text-xs">Salary Calculation Basis</label>
                    <select
                      name="salaryBasis"
                      value={form.salaryBasis}
                      onChange={F}
                      className="w-full px-3 py-2 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]  cursor-pointer"
                    >
                      {Object.entries(BASIS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>

                  {/* Statutory options when PF or PT components are selected */}
                  {assignedComponents.some(c => c.selected && c.componentCode.toUpperCase().includes('PF')) && (
                    <div className="pt-2 border-t border-[var(--rule)] space-y-2">
                      <p className="font-semibold text-[var(--text-primary)] text-xs">PF Wage Capping</p>
                      <Switch
                        checked={form.capEmployeePf}
                        onChange={(checked) => setForm(f => ({ ...f, capEmployeePf: checked, capEmployerPf: checked }))}
                        label="Cap PF at ₹15,000 ceiling"
                        description="Limit to 12% of ₹15,000 (₹1,800/mo) instead of uncapped basic"
                      />
                    </div>
                  )}

                  {assignedComponents.some(c => c.selected && (c.componentCode.toUpperCase() === 'PT' || c.componentCode.toUpperCase().includes('PROFESSIONAL_TAX'))) && (
                    <div className="pt-2 border-t border-[var(--rule)] space-y-1.5">
                      <label className="font-semibold text-[var(--text-primary)] block text-xs">PT State Slabs</label>
                      <select
                        name="ptState"
                        value={form.ptState}
                        onChange={F}
                        className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]  cursor-pointer"
                      >
                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Column 2: Salary Components */}
                <div className="space-y-3">
                  <div className="border-b border-[var(--rule)] pb-2 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)] text-xs font-normal uppercase tracking-wider">Salary Components</p>
                      <p className="text-xs font-normal text-[var(--text-secondary)]">Check components that apply to this group</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--paper-subtle)] text-[var(--text-primary)] border border-[var(--rule)]">
                      {assignedComponents.filter(c => c.selected).length} of {assignedComponents.length} selected
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                    {/* Earnings Section */}
                    <div>
                      <p className="text-xs font-normal font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1.5">
                        Earnings
                      </p>
                      <div className="space-y-1">
                        {assignedComponents
                          .filter(c => c.componentType === 'Earning')
                          .map(c => (
                            <label
                              key={c.componentId}
                              className={`flex items-center justify-between p-2 rounded-[4px] border transition-all cursor-pointer ${
                                c.selected
                                  ? 'bg-[var(--surface-sunken)] border-[var(--accent)]/40 shadow-xs'
                                  : 'bg-[var(--paper)] border-[var(--rule)] opacity-60 hover:opacity-100'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={c.selected}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    setAssignedComponents(prev =>
                                      prev.map(item => item.componentId === c.componentId ? { ...item, selected: checked } : item)
                                    );
                                  }}
                                  className="rounded border-[var(--rule)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate block">{c.componentName}</span>
                                  <code className="text-xs font-normal  px-1 py-0.2 rounded bg-[var(--paper-subtle)] text-[var(--text-secondary)]">
                                    {c.componentCode}
                                  </code>
                                </div>
                              </div>
                              <div className="shrink-0 ml-2">{renderRuleBadge(c)}</div>
                            </label>
                          ))}
                      </div>
                    </div>

                    {/* Deductions & Statutory Section */}
                    <div>
                      <p className="text-xs font-normal font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-1.5">
                        Deductions & Statutory
                      </p>
                      <div className="space-y-1">
                        {assignedComponents
                          .filter(c => c.componentType === 'Deduction' || c.componentType === 'Informational')
                          .map(c => (
                            <label
                              key={c.componentId}
                              className={`flex items-center justify-between p-2 rounded-[4px] border transition-all cursor-pointer ${
                                c.selected
                                  ? 'bg-[var(--surface-sunken)] border-[var(--accent)]/40 shadow-xs'
                                  : 'bg-[var(--paper)] border-[var(--rule)] opacity-60 hover:opacity-100'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={c.selected}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    setAssignedComponents(prev =>
                                      prev.map(item => item.componentId === c.componentId ? { ...item, selected: checked } : item)
                                    );
                                  }}
                                  className="rounded border-[var(--rule)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate block">{c.componentName}</span>
                                  <code className="text-xs font-normal  px-1 py-0.2 rounded bg-[var(--paper-subtle)] text-[var(--text-secondary)]">
                                    {c.componentCode}
                                  </code>
                                </div>
                              </div>
                              <div className="shrink-0 ml-2">{renderRuleBadge(c)}</div>
                            </label>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 3: Employee Assignment (only when editing) */}
                <div>
                  {editId ? (
                    <EmployeeAssignPanel
                      payGroupId={editId}
                      onCountChange={(n) => {
                        setGroups(gs => gs.map(g => g.id === editId ? { ...g, employeeCount: n } : g));
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
                      <Users size={28} className="text-[var(--ink-subtle)]" />
                      <p className="text-xs text-[var(--text-secondary)]">Save the group first,<br />then assign employees.</p>
                    </div>
                  )}
                </div>

              </div>

              <div className="flex flex-shrink-0 justify-end gap-3 p-4 border-t border-[var(--rule)] bg-[var(--surface)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-outline text-xs py-1.5 px-4 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs py-1.5 px-6 cursor-pointer"
                >
                  {saving ? 'Saving...' : editId ? 'Update Group' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {payGroupArchive.dialog}
    </div>
  );
};

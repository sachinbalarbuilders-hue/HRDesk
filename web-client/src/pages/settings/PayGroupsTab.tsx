import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useArchiveActions, isRowArchived } from '../../hooks/useArchiveActions';
import { type ArchiveFilterValue } from '../../components/ui/ArchiveToggle';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { DataToolbar } from '../../components/ui/DataToolbar';
import {
  Users, Plus, Pencil, X, MapPin, ChevronDown, ChevronRight,
} from 'lucide-react';

interface PayGroup {
  id: number;
  name: string;
  description?: string;
  salaryBasis: string;
  lopRounding: string;
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  ptState?: string;
  templateId?: number;
  templateName?: string;
  isActive: boolean;
  employeeCount: number;
  archivedAt?: string;
}

interface Template {
  id: number;
  name: string;
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

const emptyForm = {
  name: '', description: '', salaryBasis: 'CalendarDays',
  pfApplicable: true, esiApplicable: true, ptApplicable: true,
  ptState: 'Telangana', templateId: '',
};

export const PayGroupsTab: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [groups, setGroups] = useState<PayGroup[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<typeof emptyForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [groupEmployees, setGroupEmployees] = useState<any[]>([]);
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const [grpRes, tplRes] = await Promise.all([
        apiClient.get('/pay-groups', { params: { archiveStatus: archiveFilter } }),
        apiClient.get('/salary-templates', { params: { archiveStatus: 'active' } }),
      ]);
      setGroups(grpRes.data || []);
      setTemplates(tplRes.data || []);
    } catch { showError('Failed to load pay groups'); }
    finally { setLoading(false); }
  }, [archiveFilter]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const openCreate = () => { setEditId(null); setForm({ ...emptyForm }); setModalOpen(true); };
  const openEdit = (g: PayGroup) => {
    setEditId(g.id);
    setForm({
      name: g.name, description: g.description || '',
      salaryBasis: g.salaryBasis,
      pfApplicable: g.pfApplicable, esiApplicable: g.esiApplicable,
      ptApplicable: g.ptApplicable, ptState: g.ptState || 'Telangana',
      templateId: g.templateId?.toString() || '',
    });
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
      const payload = {
        ...form,
        templateId: form.templateId ? parseInt(form.templateId) : null,
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

  const toggleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    try {
      const res = await apiClient.get(`/pay-groups/${id}/employees`);
      setGroupEmployees(res.data || []);
    } catch { setGroupEmployees([]); }
  };

  const F = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const FC = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.checked }));

  const filteredGroups = groups.filter(g => {
    const isAct = !isRowArchived(g);
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
        <div className="flex items-start gap-2">
          <button
            onClick={() => toggleExpand(g.id)}
            className="text-[var(--ink-muted)] hover:text-[var(--ink)] mt-0.5 cursor-pointer"
            title="Toggle employee list"
          >
            {expandedId === g.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div>
            <p className="font-semibold text-[var(--ink)] text-xs">{g.name}</p>
            {g.description && <p className="text-[10px] text-[var(--ink-muted)]">{g.description}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'salaryBasis',
      header: 'Salary Basis',
      render: (g: PayGroup) => (
        <span className="text-xs font-medium text-[var(--ink)]">
          {BASIS_LABELS[g.salaryBasis] ?? g.salaryBasis}
        </span>
      ),
    },
    {
      key: 'statutoryRules',
      header: 'Statutory Rules',
      render: (g: PayGroup) => (
        <div className="flex gap-1.5 flex-wrap items-center">
          {[['PF', g.pfApplicable], ['ESI', g.esiApplicable], ['PT', g.ptApplicable]].map(([lbl, on]) => (
            <span
              key={lbl as string}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] ${
                on
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-[var(--paper-subtle)] text-[var(--ink-muted)]'
              }`}
            >
              {lbl as string}
            </span>
          ))}
          {g.ptApplicable && g.ptState && (
            <span className="text-[10px] text-[var(--ink-muted)] flex items-center gap-0.5">
              <MapPin size={9} />{g.ptState}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'template',
      header: 'Salary Template',
      render: (g: PayGroup) => (
        <span className="text-xs text-[var(--ink-muted)]">
          {g.templateName ?? <span className="italic">None</span>}
        </span>
      ),
    },
    {
      key: 'employeeCount',
      header: 'Employees',
      align: 'center',
      render: (g: PayGroup) => (
        <span className="text-xs font-semibold text-[var(--ink)] font-data">{g.employeeCount}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (g: PayGroup) => (
        <RowActionMenu
          actions={[
            { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(g) },
            ...payGroupArchive.rowActions({ id: g.id, name: g.name, isArchived: isRowArchived(g) }),
          ] as RowAction[]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-[var(--ink)] font-ui">Pay Groups</h2>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Configure salary calculation basis, statutory deduction applicability, and link templates.
        </p>
      </div>

      {/* Unified DataToolbar */}
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

      {/* Reusable DataTable with standard Pagination */}
      <DataTable
        columns={columns}
        data={paginatedGroups}
        loading={loading}
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

      {/* Expanded Employees Drawer */}
      {expandedId && (
        <div className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] space-y-2">
          <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
            <span className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
              <Users size={13} className="text-[var(--gold-500)]" />
              Assigned Employees in Pay Group ({groupEmployees.length})
            </span>
            <button
              onClick={() => setExpandedId(null)}
              className="text-[var(--ink-muted)] hover:text-[var(--ink)] text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
          {groupEmployees.length === 0 ? (
            <p className="text-xs text-[var(--ink-muted)] py-2 italic">No employees assigned to this pay group yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto py-1">
              {groupEmployees.map((emp: any) => (
                <span
                  key={emp.employeeId}
                  className="text-xs bg-[var(--paper)] border border-[var(--rule)] px-2.5 py-1 rounded-[2px] text-[var(--ink)]"
                >
                  {emp.employeeName} {emp.designation ? `· ${emp.designation}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[var(--rule)]">
              <h3 className="font-bold text-sm text-[var(--ink)]">
                {editId ? 'Edit Pay Group' : 'New Pay Group'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">Group Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={F}
                  required
                  placeholder="e.g. Corporate Staff, Factory Workers"
                  className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] font-ui"
                />
              </div>

              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">Description</label>
                <input
                  name="description"
                  value={form.description}
                  onChange={F}
                  placeholder="Optional notes"
                  className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] font-ui"
                />
              </div>

              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">Salary Calculation Basis</label>
                <select
                  name="salaryBasis"
                  value={form.salaryBasis}
                  onChange={F}
                  className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] font-ui cursor-pointer"
                >
                  {Object.entries(BASIS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">Salary Structure Template</label>
                <select
                  name="templateId"
                  value={form.templateId}
                  onChange={F}
                  className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] font-ui cursor-pointer"
                >
                  <option value="">— None (manual components) —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="space-y-2 border-t border-[var(--rule)] pt-3">
                <p className="font-bold text-[var(--ink)] text-[11px] uppercase tracking-wider">Statutory Deductions</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="pfApplicable" checked={form.pfApplicable} onChange={FC} className="rounded" />
                  <span className="text-[var(--ink)] font-medium">EPF Applicable (12% employee + 12% employer)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="esiApplicable" checked={form.esiApplicable} onChange={FC} className="rounded" />
                  <span className="text-[var(--ink)] font-medium">ESI Applicable (0.75% emp + 3.25% employer)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="ptApplicable" checked={form.ptApplicable} onChange={FC} className="rounded" />
                  <span className="text-[var(--ink)] font-medium">Professional Tax (PT) Applicable</span>
                </label>
                {form.ptApplicable && (
                  <div className="pl-6 pt-1">
                    <label className="text-[var(--ink-muted)] block mb-1 text-[11px]">PT State Slabs</label>
                    <select
                      name="ptState"
                      value={form.ptState}
                      onChange={F}
                      className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] font-ui cursor-pointer"
                    >
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-outline text-xs py-1.5 px-3 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs py-1.5 px-4 cursor-pointer"
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

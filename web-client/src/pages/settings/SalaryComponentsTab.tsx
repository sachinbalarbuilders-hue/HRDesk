import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Plus, Pencil, X, Check, Minus } from 'lucide-react';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import { type ArchiveFilterValue } from '../../components/ui/ArchiveToggle';
import { useArchiveActions, isRowArchived } from '../../hooks/useArchiveActions';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { DataToolbar } from '../../components/ui/DataToolbar';
import { Switch } from '../../components/ui/Switch';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

interface SalaryComponent {
  id: number;
  componentName: string;
  componentCode: string;
  componentType: 'Earning' | 'Deduction' | 'Informational';
  category: string;
  isEpfApplicable: boolean;
  isEsiApplicable: boolean;
  isTaxable: boolean;
  isActive: boolean;
  displayOrder: number;
  archivedAt?: string;
}

const COMPONENT_TYPES = ['Earning', 'Deduction', 'Informational'];

const TYPE_COLORS: Record<string, string> = {
  Earning: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300',
  Deduction: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300',
  Informational: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300',
};

const Dot: React.FC<{ on: boolean }> = ({ on }) => (
  <span
    className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] ${
      on
        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
        : 'bg-[var(--paper-subtle)] text-[var(--ink-muted)]'
    }`}
  >
    {on ? <Check size={10} /> : <Minus size={10} />}
  </span>
);

const emptyForm = {
  componentName: '',
  componentCode: '',
  componentType: 'Earning' as SalaryComponent['componentType'],
  isEpfApplicable: false,
  isEsiApplicable: false,
  isTaxable: true,
  isActive: true,
  displayOrder: 50,
};

export const SalaryComponentsTab: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<typeof emptyForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  const fetchComponents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/salary-templates/components', {
        params: { archiveStatus: archiveFilter }
      });
      setComponents(res.data || []);
    } catch {
      showError('Failed to load components');
    } finally {
      setLoading(false);
    }
  }, [archiveFilter]);

  const archive = useArchiveActions({ endpoint: '/salary-templates/components', onDone: fetchComponents, label: 'Component' });

  useEffect(() => { fetchComponents(); }, [archiveFilter, fetchComponents]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (c: SalaryComponent) => {
    setEditId(c.id);
    setForm({
      componentName: c.componentName,
      componentCode: c.componentCode,
      componentType: c.componentType,
      isEpfApplicable: c.isEpfApplicable,
      isEsiApplicable: c.isEsiApplicable,
      isTaxable: c.isTaxable,
      isActive: c.isActive,
      displayOrder: c.displayOrder,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.componentName.trim() || !form.componentCode.trim()) return;
    try {
      setSaving(true);
      const payload = {
        ...form,
        componentCode: form.componentCode.trim().toUpperCase(),
        id: editId ?? undefined,
      };
      await apiClient.post('/salary-templates/components', payload);
      showSuccess(editId ? 'Component updated' : 'Component created');
      setModalOpen(false);
      fetchComponents();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to save component');
    } finally {
      setSaving(false);
    }
  };

  const F = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(f => {
      const updated = { ...f, [name]: value };
      if (name === 'componentName' && !editId) {
        updated.componentCode = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      }
      return updated;
    });
  };
  const FC = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.checked }));

  const filtered = components.filter(c => {
    const isAct = !isRowArchived(c);
    const matchesArchive = archiveFilter === 'all' || (archiveFilter === 'active' ? isAct : !isAct);
    const matchesType = typeFilter === 'all' || c.componentType === typeFilter;
    const s = search.trim().toLowerCase();
    const matchesSearch = !s || c.componentName.toLowerCase().includes(s) || c.componentCode.toLowerCase().includes(s);
    return matchesArchive && matchesType && matchesSearch;
  }).sort((a, b) => a.displayOrder - b.displayOrder);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns: ColumnDef<SalaryComponent>[] = [
    {
      key: 'displayOrder',
      header: '#',
      width: '45px',
      align: 'center',
      render: (c) => <span className="font-mono text-xs text-[var(--ink-muted)]">{c.displayOrder}</span>,
    },
    {
      key: 'componentName',
      header: 'Component',
      render: (c) => (
        <div>
          <span className="font-semibold text-[var(--ink)] text-xs block">{c.componentName}</span>
          <span className={`inline-block px-1.5 py-0.2 rounded-[2px] text-[9px] font-bold ${TYPE_COLORS[c.componentType]}`}>
            {c.componentType}
          </span>
        </div>
      ),
    },
    {
      key: 'componentCode',
      header: 'Code',
      render: (c) => (
        <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--paper-subtle)] text-[var(--teal-600)]">
          {c.componentCode}
        </code>
      ),
    },
    {
      key: 'isEpfApplicable',
      header: 'EPF',
      align: 'center',
      render: (c) => <Dot on={c.isEpfApplicable} />,
    },
    {
      key: 'isEsiApplicable',
      header: 'ESI',
      align: 'center',
      render: (c) => <Dot on={c.isEsiApplicable} />,
    },
    {
      key: 'isTaxable',
      header: 'Taxable',
      align: 'center',
      render: (c) => <Dot on={c.isTaxable} />,
    },
    {
      key: 'isActive',
      header: 'Status',
      align: 'center',
      render: (c) => (
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] ${
            c.isActive
              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
              : 'bg-[var(--paper-subtle)] text-[var(--ink-muted)]'
          }`}
        >
          {c.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <RowActionMenu
          actions={[
            { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(c) },
            ...archive.rowActions({ id: c.id, name: c.componentName, isArchived: isRowArchived(c) }),
          ] as RowAction[]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-[var(--ink)] font-ui">Salary Components</h2>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Define earnings, deductions, and informational items available in salary templates.
        </p>
      </div>

      {/* Unified DataToolbar */}
      <DataToolbar
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search component name or code..."
        archiveFilter={{
          value: archiveFilter,
          onChange: (v) => { setArchiveFilter(v); setPage(1); },
        }}
        filters={[
          {
            id: 'typeFilter',
            ariaLabel: 'Component Type Filter',
            value: typeFilter,
            onChange: (v) => { setTypeFilter(v); setPage(1); },
            options: [
              { value: 'all', label: 'All Types' },
              ...COMPONENT_TYPES.map(t => ({ value: t, label: `${t}s` })),
            ],
          },
        ]}
        primaryAction={{
          label: 'New Component',
          icon: <Plus size={14} />,
          onClick: openCreate,
        }}
      />

      {/* Reusable DataTable with Pagination and Bulk Actions */}
      <DataTable
        columns={columns}
        data={paginated}
        loading={loading}
        showSrNo={false}
        keyExtractor={(c) => c.id}
        selection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys),
          bulkActions: archive.bulkActions(archiveFilter === 'archived'),
        }}
        emptyMessage="No salary components found matching your filter criteria."
        pagination={{
          page,
          pageSize,
          totalCount: filtered.length,
          totalPages: Math.ceil(filtered.length / pageSize) || 1,
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
        }}
      />

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[var(--rule)]">
              <h3 className="font-bold text-sm text-[var(--ink)] font-ui">{editId ? 'Edit Component' : 'New Salary Component'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-4 text-xs">
              {/* Name + Code */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider block mb-1.5">Component Name *</label>
                  <input
                    name="componentName"
                    value={form.componentName}
                    onChange={F}
                    required
                    placeholder="e.g. Basic Salary, HRA"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--paper)] border border-[var(--rule)] text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-500)]/30 focus:border-[var(--gold-500)] transition-all shadow-sm font-ui"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider block mb-1.5">Code * (UPPERCASE)</label>
                  <input
                    name="componentCode"
                    value={form.componentCode}
                    onChange={F}
                    required
                    placeholder="e.g. BASIC, HRA, PF"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--paper)] border border-[var(--rule)] text-sm font-mono text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-500)]/30 focus:border-[var(--gold-500)] transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="text-[11px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider block mb-1.5">Component Type</label>
                <SearchableSelect
                  value={form.componentType}
                  options={COMPONENT_TYPES}
                  onChange={(v) => setForm(f => ({ ...f, componentType: v as any }))}
                  searchable={false}
                  className="h-10 w-full"
                />
              </div>

              {/* Display Order */}
              <div>
                <label className="text-[11px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider block mb-1.5">Display Order (lower numbers appear first on payslip)</label>
                <input
                  type="number"
                  name="displayOrder"
                  value={form.displayOrder}
                  onChange={F}
                  min={1}
                  max={999}
                  className="w-24 px-3 py-2 rounded-lg bg-[var(--paper)] border border-[var(--rule)] text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-500)]/30 focus:border-[var(--gold-500)] transition-all shadow-sm font-ui"
                />
              </div>

              {/* Custom Switches */}
              <div className="grid grid-cols-1 gap-4 border-t border-[var(--rule)] pt-5 pb-2">
                <Switch 
                  checked={form.isTaxable} 
                  onChange={(c) => setForm(f => ({ ...f, isTaxable: c }))} 
                  label="Taxable" 
                  description="Included in income tax calculation" 
                />
                <Switch 
                  checked={form.isEpfApplicable} 
                  onChange={(c) => setForm(f => ({ ...f, isEpfApplicable: c }))} 
                  label="EPF Qualifying" 
                  description="Included in PF wage for 12% calculation" 
                />
                <Switch 
                  checked={form.isEsiApplicable} 
                  onChange={(c) => setForm(f => ({ ...f, isEsiApplicable: c }))} 
                  label="ESI Qualifying" 
                  description="Included in gross wages for ESI threshold" 
                />
                <Switch 
                  checked={form.isActive} 
                  onChange={(c) => setForm(f => ({ ...f, isActive: c }))} 
                  label="Active" 
                  description="Available for selection in salary templates" 
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2 text-sm font-medium rounded-lg border border-[var(--rule)] hover:bg-[var(--paper-subtle)] text-[var(--ink)] transition-colors shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-[var(--gold-500)] hover:bg-[var(--gold-600)] text-white shadow-sm transition-colors flex items-center justify-center min-w-[140px]"
                >
                  {saving ? 'Saving...' : editId ? 'Update Component' : 'Create Component'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {archive.dialog}
    </div>
  );
};

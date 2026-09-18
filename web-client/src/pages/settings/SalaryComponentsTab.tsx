import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Plus, Pencil, X } from 'lucide-react';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import { type ArchiveFilterValue } from '../../components/ui/ArchiveToggle';
import { useArchiveActions } from '../../hooks/useArchiveActions';
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
  calculationType?: string;
  defaultValue?: number | null;
  baseComponentCode?: string | null;
}

const COMPONENT_TYPES = ['Earning', 'Deduction', 'Informational'];

const CALCULATION_TYPES = [
  { value: 'PercentOfCTC', label: '% of Monthly CTC' },
  { value: 'PercentOfComponent', label: '% of Base Component (e.g. Basic)' },
  { value: 'FixedAmount', label: '₹ Fixed Monthly Amount' },
  { value: 'Remainder', label: 'Remainder (fills CTC)' },
  { value: 'Statutory', label: 'Statutory (auto-computed)' },
];

const TYPE_COLORS: Record<string, string> = {
  Earning: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300',
  Deduction: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300',
  Informational: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300',
};

const emptyForm = {
  componentName: '',
  componentCode: '',
  componentType: 'Earning' as SalaryComponent['componentType'],
  calculationType: 'PercentOfCTC',
  defaultValue: '' as number | '',
  baseComponentCode: 'BASIC',
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const defaultPageSize = Number(localStorage.getItem('hrdesk_default_page_size')) || 15;
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  const fetchComponents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/salary-components', {
        params: { archiveStatus: archiveFilter }
      });
      setComponents(res.data || []);
    } catch {
      showError('Failed to load components');
    } finally {
      setLoading(false);
    }
  }, [archiveFilter]);

  const archive = useArchiveActions({ endpoint: '/salary-components', onDone: fetchComponents, label: 'Component' });

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
      calculationType: c.calculationType || 'PercentOfCTC',
      defaultValue: c.defaultValue != null ? c.defaultValue : '',
      baseComponentCode: c.baseComponentCode || 'BASIC',
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
      const code = form.componentCode.trim().toUpperCase();
      const isBasic = code === 'BASIC';
      const isEarning = form.componentType === 'Earning';
      const payload = {
        ...form,
        componentCode: code,
        isEpfApplicable: isBasic,
        isEsiApplicable: isEarning,
        isTaxable: isEarning,
        defaultValue: form.defaultValue !== '' ? parseFloat(form.defaultValue as any) : null,
        baseComponentCode: form.calculationType === 'PercentOfComponent' ? form.baseComponentCode : null,
        id: editId ?? undefined,
      };
      await apiClient.post('/salary-components', payload);
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
    const isArchived = Boolean(c.archivedAt);
    const matchesArchive = archiveFilter === 'all' || (archiveFilter === 'active' ? !isArchived : isArchived);
    const matchesType = typeFilter === 'all' || c.componentType === typeFilter;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? c.isActive : !c.isActive);
    const s = search.trim().toLowerCase();
    const matchesSearch = !s || c.componentName.toLowerCase().includes(s) || c.componentCode.toLowerCase().includes(s);
    return matchesArchive && matchesType && matchesStatus && matchesSearch;
  }).sort((a, b) => a.displayOrder - b.displayOrder);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns: ColumnDef<SalaryComponent>[] = [
    {
      key: 'displayOrder',
      header: '#',
      width: '45px',
      align: 'center',
      render: (c) => <span className=" text-xs text-[var(--text-secondary)]">{c.displayOrder}</span>,
    },
    {
      key: 'componentName',
      header: 'Component',
      render: (c) => (
        <div>
          <span className="font-semibold text-[var(--text-primary)] text-xs block">{c.componentName}</span>
          <span className={`inline-block px-1.5 py-0.2 rounded-[2px] text-xs font-normal font-semibold ${TYPE_COLORS[c.componentType]}`}>
            {c.componentType}
          </span>
        </div>
      ),
    },
    {
      key: 'componentCode',
      header: 'Code',
      render: (c) => (
        <code className="text-xs  px-1.5 py-0.5 rounded bg-[var(--paper-subtle)] text-[var(--teal-600)]">
          {c.componentCode}
        </code>
      ),
    },
    {
      key: 'calculationType',
      header: 'Calculation Rule',
      render: (c) => {
        if (c.calculationType === 'PercentOfCTC') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
              {c.defaultValue ?? 0}% of CTC
            </span>
          );
        }
        if (c.calculationType === 'PercentOfComponent') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300">
              {c.defaultValue ?? 0}% of {c.baseComponentCode || 'BASIC'}
            </span>
          );
        }
        if (c.calculationType === 'FixedAmount') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
              ₹{Number(c.defaultValue || 0).toLocaleString('en-IN')} / mo
            </span>
          );
        }
        if (c.calculationType === 'Remainder') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
              Remainder
            </span>
          );
        }
        if (c.calculationType === 'Statutory') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              Statutory
            </span>
          );
        }
        return <span className="text-xs text-[var(--text-secondary)]">—</span>;
      },
    },
    {
      key: 'isActive',
      header: 'Status',
      align: 'center',
      render: (c) => (
        <span
          className={`text-xs font-normal font-semibold px-1.5 py-0.5 rounded-[2px] ${
            c.isActive
              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
              : 'bg-[var(--paper-subtle)] text-[var(--text-secondary)]'
          }`}
        >
          {c.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: '100px',
      render: (c) => (
        <RowActionMenu
          actions={[
            { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(c) },
            ...archive.rowActions({ id: c.id, name: c.componentName, isArchived: Boolean(c.archivedAt) }),
          ] as RowAction[]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)] ">Salary Components</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
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
          {
            id: 'statusFilter',
            ariaLabel: 'Status Filter',
            value: statusFilter,
            onChange: (v) => { setStatusFilter(v); setPage(1); },
            options: [
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
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
              <h3 className="font-semibold text-sm text-[var(--text-primary)] ">{editId ? 'Edit Component' : 'New Salary Component'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-4 text-xs">
              {/* Name + Code */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">Component Name *</label>
                  <input
                    name="componentName"
                    value={form.componentName}
                    onChange={F}
                    required
                    placeholder="e.g. Basic Salary, HRA"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--paper)] border border-[var(--rule)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all shadow-sm "
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">Code * (UPPERCASE)</label>
                  <input
                    name="componentCode"
                    value={form.componentCode}
                    onChange={F}
                    required
                    placeholder="e.g. BASIC, HRA, PF"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--paper)] border border-[var(--rule)] text-sm  text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">Component Type</label>
                <SearchableSelect
                  value={form.componentType}
                  options={COMPONENT_TYPES}
                  onChange={(v) => setForm(f => ({ ...f, componentType: v as any }))}
                  searchable={false}
                  className="h-10 w-full"
                />
              </div>

              {/* Calculation & Default Value Section */}
              <div className="p-3.5 rounded-lg bg-[var(--paper-subtle)] border border-[var(--rule)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-normal font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    Calculation & Value Type
                  </span>
                  <span className="text-xs font-normal text-[var(--text-secondary)]">Default calculation rule</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Value Type *</label>
                    <select
                      name="calculationType"
                      value={form.calculationType}
                      onChange={F}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--paper)] border border-[var(--rule)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all  cursor-pointer"
                    >
                      {CALCULATION_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {form.calculationType === 'PercentOfComponent' && (
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">Base Component *</label>
                      <select
                        name="baseComponentCode"
                        value={form.baseComponentCode}
                        onChange={F}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--paper)] border border-[var(--rule)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all  cursor-pointer"
                      >
                        {components
                          .filter(c => c.componentType === 'Earning' && c.id !== editId)
                          .map(c => (
                            <option key={c.componentCode} value={c.componentCode}>
                              {c.componentName} ({c.componentCode})
                            </option>
                          ))}
                        {!components.some(c => c.componentCode === 'BASIC') && (
                          <option value="BASIC">Basic Salary (BASIC)</option>
                        )}
                      </select>
                    </div>
                  )}

                  {['PercentOfCTC', 'PercentOfComponent', 'FixedAmount'].includes(form.calculationType) && (
                    <div>
                      <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                        {form.calculationType === 'FixedAmount' ? 'Monthly Rupee Value (₹) *' : 'Percentage Value (%) *'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          name="defaultValue"
                          value={form.defaultValue}
                          onChange={F}
                          step={form.calculationType === 'FixedAmount' ? '1' : '0.01'}
                          min="0"
                          placeholder={form.calculationType === 'FixedAmount' ? 'e.g. 1600' : 'e.g. 40 or 50'}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--paper)] border border-[var(--rule)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all  pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-secondary)]">
                          {form.calculationType === 'FixedAmount' ? '₹' : '%'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {form.calculationType === 'Remainder' && (
                  <p className="text-xs font-normal text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200 dark:border-amber-900/50">
                    ðŸ’¡ <strong>Remainder:</strong> This component automatically absorbs whatever monthly CTC remains after all other earnings are deducted, keeping CTC exact.
                  </p>
                )}

                {form.calculationType === 'Statutory' && (
                  <p className="text-xs font-normal text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 p-2 rounded border border-slate-200 dark:border-slate-700">
                    âš–ï¸ <strong>Statutory:</strong> This component is auto-calculated at payroll time according to PF, ESI, PT, or TDS rules and wage limits.
                  </p>
                )}
              </div>

              {/* Display Order */}
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">Display Order (lower numbers appear first on payslip)</label>
                <input
                  type="number"
                  name="displayOrder"
                  value={form.displayOrder}
                  onChange={F}
                  min={1}
                  max={999}
                  className="w-24 px-3 py-2 rounded-lg bg-[var(--paper)] border border-[var(--rule)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all shadow-sm "
                />
              </div>

              {/* Active Switch */}
              <div className="border-t border-[var(--rule)] pt-4 pb-1">
                <Switch 
                  checked={form.isActive} 
                  onChange={(c) => setForm(f => ({ ...f, isActive: c }))} 
                  label="Active Component" 
                  description="Available for use in payroll calculations" 
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2 text-sm font-medium rounded-lg border border-[var(--rule)] hover:bg-[var(--paper-subtle)] text-[var(--text-primary)] transition-colors shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-sm transition-colors flex items-center justify-center min-w-[140px]"
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


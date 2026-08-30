import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useArchiveActions, isRowArchived } from '../../hooks/useArchiveActions';
import { type ArchiveFilterValue } from '../../components/ui/ArchiveToggle';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { DataToolbar } from '../../components/ui/DataToolbar';
import {
  Layers, Plus, Pencil, X,
  IndianRupee, Percent, Equal, Wand2, Zap, ChevronDown, ChevronRight,
} from 'lucide-react';

interface Template { id: number; name: string; description?: string; isDefault: boolean; isActive: boolean; componentCount: number; archivedAt?: string; }
interface Component { id: number; componentName: string; componentCode: string; componentType: string; category: string; isEpfApplicable: boolean; isEsiApplicable: boolean; isTaxable: boolean; isActive: boolean; displayOrder: number; }
interface TplComponent { id?: number; componentId: number; calculationType: string; value?: number | ''; baseComponentCode?: string; displayOrder: number; componentName?: string; componentCode?: string; componentType?: string; }
interface PreviewRow { componentCode: string; componentName: string; componentType: string; amount: number; calculationType: string; formula: string; }

const CALC_TYPES = [
  { value: 'FixedAmount', label: '₹ Fixed Amount', icon: <IndianRupee size={12} /> },
  { value: 'PercentOfCTC', label: '% of Monthly CTC', icon: <Percent size={12} /> },
  { value: 'PercentOfComponent', label: '% of Component', icon: <Percent size={12} /> },
  { value: 'Remainder', label: 'Remainder (fills CTC)', icon: <Equal size={12} /> },
  { value: 'Statutory', label: 'Statutory (auto)', icon: <Zap size={12} /> },
];

export const SalaryTemplatesTab: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedComponents, setExpandedComponents] = useState<TplComponent[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editTplId, setEditTplId] = useState<number | null>(null);
  const [tplForm, setTplForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [editComponentsId, setEditComponentsId] = useState<number | null>(null);
  const [editRows, setEditRows] = useState<TplComponent[]>([]);
  const [previewCTC, setPreviewCTC] = useState('');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [tplRes, cmpRes] = await Promise.all([
        apiClient.get('/salary-templates', { params: { archiveStatus: archiveFilter } }),
        apiClient.get('/salary-templates/components', { params: { archiveStatus: archiveFilter } }),
      ]);
      setTemplates(tplRes.data || []);
      setComponents(cmpRes.data || []);
    } catch { showError('Failed to load templates'); }
    finally { setLoading(false); }
  }, [archiveFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    try {
      const res = await apiClient.get(`/salary-templates/${id}`);
      setExpandedComponents(res.data.components || []);
    } catch { setExpandedComponents([]); }
  };

  const templateArchive = useArchiveActions({
    endpoint: '/salary-templates',
    label: 'Salary Template',
    onDone: fetchAll,
  });

  const openCreateTemplate = () => { setEditTplId(null); setTplForm({ name: '', description: '' }); setTemplateModalOpen(true); };
  const openEditTemplate = (t: Template) => { setEditTplId(t.id); setTplForm({ name: t.name, description: t.description || '' }); setTemplateModalOpen(true); };

  const saveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplForm.name.trim()) return;
    try {
      setSaving(true);
      if (editTplId) { await apiClient.put(`/salary-templates/${editTplId}`, { ...tplForm, isActive: true }); showSuccess('Template updated'); }
      else { await apiClient.post('/salary-templates', { ...tplForm }); showSuccess('Template created'); }
      setTemplateModalOpen(false);
      fetchAll();
    } catch { showError('Failed to save template'); }
    finally { setSaving(false); }
  };

  const openEditComponents = async (id: number) => {
    setEditComponentsId(id);
    setPreviewRows([]);
    setPreviewCTC('');
    try {
      const res = await apiClient.get(`/salary-templates/${id}`);
      setEditRows((res.data.components || []).map((c: any) => ({
        componentId: c.componentId, calculationType: c.calculationType,
        value: c.value ?? '', baseComponentCode: c.baseComponentCode || '',
        displayOrder: c.displayOrder,
        componentName: c.componentName, componentCode: c.componentCode, componentType: c.componentType,
      })));
    } catch { setEditRows([]); }
  };

  const addComponentRow = () => {
    const first = components.find(c => c.isActive);
    if (!first) return;
    setEditRows(r => [...r, {
      componentId: first.id, calculationType: 'FixedAmount', value: '',
      baseComponentCode: '', displayOrder: r.length * 10 + 10,
      componentName: first.componentName, componentCode: first.componentCode, componentType: first.componentType,
    }]);
  };

  const removeRow = (idx: number) => setEditRows(r => r.filter((_, i) => i !== idx));

  const updateRow = (idx: number, field: string, val: any) => {
    setEditRows(rows => rows.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: val };
      if (field === 'componentId') {
        const comp = components.find(c => c.id === parseInt(val));
        if (comp) { updated.componentName = comp.componentName; updated.componentCode = comp.componentCode; updated.componentType = comp.componentType; }
      }
      return updated;
    }));
  };

  const saveComponents = async () => {
    if (!editComponentsId) return;
    try {
      setSaving(true);
      const payload = editRows.map((r, i) => ({
        componentId: r.componentId,
        calculationType: r.calculationType,
        value: r.value !== '' ? parseFloat(r.value as any) : null,
        baseComponentCode: r.baseComponentCode || null,
        displayOrder: (i + 1) * 10,
      }));
      await apiClient.post(`/salary-templates/${editComponentsId}/components`, payload);
      showSuccess('Components saved');
      setEditComponentsId(null);
      fetchAll();
    } catch { showError('Failed to save components'); }
    finally { setSaving(false); }
  };

  const handlePreview = async () => {
    if (!editComponentsId || !previewCTC) return;
    try {
      setPreviewing(true);
      const res = await apiClient.post('/salary-templates/preview-ctc', {
        annualCTC: parseFloat(previewCTC),
        templateId: editComponentsId,
      });
      setPreviewRows(res.data.components || []);
    } catch { showError('Preview failed'); }
    finally { setPreviewing(false); }
  };

  const filteredTemplates = templates.filter(t => {
    const isAct = !isRowArchived(t);
    const matchesArchive = archiveFilter === 'all' || (archiveFilter === 'active' ? isAct : !isAct);
    const s = search.trim().toLowerCase();
    const matchesSearch = !s || t.name.toLowerCase().includes(s) || (t.description && t.description.toLowerCase().includes(s));
    return matchesArchive && matchesSearch;
  });

  const paginated = filteredTemplates.slice((page - 1) * pageSize, page * pageSize);

  const columns: ColumnDef<Template>[] = [
    {
      key: 'name',
      header: 'Template Name',
      render: (t: Template) => (
        <div className="flex items-start gap-2">
          <button
            onClick={() => toggleExpand(t.id)}
            className="text-[var(--ink-muted)] hover:text-[var(--ink)] mt-0.5 cursor-pointer"
            title="Preview components formula"
          >
            {expandedId === t.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-[var(--ink)]">{t.name}</span>
              {t.isDefault && (
                <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded-[2px] font-bold">
                  DEFAULT
                </span>
              )}
            </div>
            {t.description && <p className="text-[10px] text-[var(--ink-muted)]">{t.description}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'componentCount',
      header: 'Components',
      align: 'center',
      render: (t: Template) => (
        <span className="text-xs font-semibold text-[var(--ink)] font-data">
          {t.componentCount} items
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (t: Template) => (
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] ${
            t.isActive
              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
              : 'bg-[var(--paper-subtle)] text-[var(--ink-muted)]'
          }`}
        >
          {t.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (t: Template) => (
        <RowActionMenu
          actions={[
            { label: 'Edit Formulas', icon: <Layers size={14} />, onClick: () => openEditComponents(t.id) },
            { label: 'Edit Details', icon: <Pencil size={14} />, onClick: () => openEditTemplate(t) },
            ...templateArchive.rowActions({ id: t.id, name: t.name, isArchived: isRowArchived(t) }),
          ] as RowAction[]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-[var(--ink)] font-ui">Salary Structure Templates</h2>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Define CTC-based formulas (Basic=40% of CTC, HRA=50% of Basic, etc.) and assign to Pay Groups.
        </p>
      </div>

      {/* Unified DataToolbar */}
      <DataToolbar
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search salary templates..."
        archiveFilter={{
          value: archiveFilter,
          onChange: (v) => { setArchiveFilter(v); setPage(1); },
        }}
        primaryAction={{
          label: 'New Template',
          icon: <Plus size={14} />,
          onClick: openCreateTemplate,
        }}
      />

      {/* Reusable DataTable with Pagination */}
      <DataTable
        columns={columns}
        data={paginated}
        loading={loading}
        emptyMessage="No salary structure templates found. Click 'New Template' to create one."
        pagination={{
          page,
          pageSize,
          totalCount: filteredTemplates.length,
          totalPages: Math.ceil(filteredTemplates.length / pageSize) || 1,
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
        }}
      />

      {/* Expanded Template Formula Drawer */}
      {expandedId && (
        <div className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
            <span className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
              <Layers size={13} className="text-[var(--gold-500)]" />
              Template Breakdown Formulas
            </span>
            <button
              onClick={() => setExpandedId(null)}
              className="text-[var(--ink-muted)] hover:text-[var(--ink)] text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
          {expandedComponents.length === 0 ? (
            <p className="text-xs text-[var(--ink-muted)] py-2 italic">
              No components configured yet. Click "Edit Formulas" on the action menu to add components.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-[var(--ink-muted)] font-bold border-b border-[var(--rule)]">
                    <th className="pb-1.5 text-left">Component</th>
                    <th className="pb-1.5 text-left">Type</th>
                    <th className="pb-1.5 text-left">Formula Calculation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                  {expandedComponents.map((c: any) => (
                    <tr key={c.id}>
                      <td className="py-2 font-medium text-[var(--ink)]">{c.componentName}</td>
                      <td className="py-2 text-[var(--ink-muted)]">{c.componentType}</td>
                      <td className="py-2 font-mono text-[var(--teal-600)]">{
                        c.calculationType === 'FixedAmount' ? `₹${(c.value||0).toLocaleString()}/month` :
                        c.calculationType === 'PercentOfCTC' ? `${c.value}% of Monthly CTC` :
                        c.calculationType === 'PercentOfComponent' ? `${c.value}% of ${c.baseComponentCode}` :
                        c.calculationType === 'Remainder' ? 'Monthly CTC − other earnings' :
                        c.calculationType === 'Statutory' ? 'Auto (PF/ESI/PT)' : c.calculationType
                      }</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Template create/edit modal */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b border-[var(--rule)]">
              <h3 className="font-bold text-sm text-[var(--ink)]">{editTplId ? 'Edit Template' : 'New Template'}</h3>
              <button onClick={() => setTemplateModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={saveTemplate} className="p-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">Template Name *</label>
                <input
                  value={tplForm.name}
                  onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g. Standard CTC Template"
                  className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] font-ui"
                />
              </div>
              <div>
                <label className="font-semibold text-[var(--ink)] block mb-1">Description</label>
                <input
                  value={tplForm.description}
                  onChange={e => setTplForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. For corporate and engineering roles"
                  className="w-full px-3 py-1.5 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--gold-500)] font-ui"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(false)}
                  className="btn-outline text-xs py-1.5 px-3 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs py-1.5 px-4 cursor-pointer"
                >
                  {saving ? 'Saving...' : editTplId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Components Formula Modal */}
      {editComponentsId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--rule)]">
              <div>
                <h3 className="font-bold text-sm text-[var(--ink)]">Configure Salary Formulas</h3>
                <p className="text-xs text-[var(--ink-muted)]">Set calculation rules for each component in this template</p>
              </div>
              <button onClick={() => setEditComponentsId(null)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[var(--ink)]">Component Formula Rules ({editRows.length})</span>
                <button onClick={addComponentRow} className="btn-outline text-xs flex items-center gap-1 py-1 px-2.5 cursor-pointer">
                  <Plus size={12} /> Add Component
                </button>
              </div>

              {editRows.length === 0 ? (
                <div className="text-center py-8 text-[var(--ink-muted)] border border-dashed border-[var(--rule)] rounded-[4px]">
                  No components in this template yet. Click "Add Component" above.
                </div>
              ) : (
                <div className="space-y-2">
                  {editRows.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2.5 bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] flex-wrap">
                      <select
                        value={row.componentId}
                        onChange={e => updateRow(idx, 'componentId', e.target.value)}
                        className="px-2 py-1 rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] text-xs text-[var(--ink)] flex-1 min-w-36 font-semibold cursor-pointer"
                      >
                        {components.filter(c => c.isActive).map(c => (
                          <option key={c.id} value={c.id}>
                            {c.componentName} ({c.componentCode}) — {c.componentType}
                          </option>
                        ))}
                      </select>

                      <select
                        value={row.calculationType}
                        onChange={e => updateRow(idx, 'calculationType', e.target.value)}
                        className="px-2 py-1 rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] text-xs text-[var(--ink)] min-w-40 cursor-pointer"
                      >
                        {CALC_TYPES.map(ct => (
                          <option key={ct.value} value={ct.value}>{ct.label}</option>
                        ))}
                      </select>

                      {['FixedAmount', 'PercentOfCTC', 'PercentOfComponent'].includes(row.calculationType) && (
                        <input
                          type="number"
                          value={row.value ?? ''}
                          onChange={e => updateRow(idx, 'value', e.target.value)}
                          placeholder={row.calculationType === 'FixedAmount' ? '₹ Amount' : '% Value'}
                          className="w-24 px-2 py-1 rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] text-xs font-mono text-[var(--ink)]"
                          min={0}
                        />
                      )}

                      {row.calculationType === 'PercentOfComponent' && (
                        <input
                          type="text"
                          value={row.baseComponentCode || ''}
                          onChange={e => updateRow(idx, 'baseComponentCode', e.target.value.toUpperCase())}
                          placeholder="Base Code (e.g. BASIC)"
                          className="w-32 px-2 py-1 rounded-[4px] bg-[var(--surface)] border border-[var(--rule)] text-xs font-mono text-[var(--ink)] uppercase"
                        />
                      )}

                      <button
                        onClick={() => removeRow(idx)}
                        className="text-[var(--danger)] hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1 rounded-[2px] transition-colors ml-auto cursor-pointer"
                        title="Remove Component"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* CTC Preview Tool */}
              <div className="border-t border-[var(--rule)] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[var(--ink)] flex items-center gap-1.5">
                    <Wand2 size={13} className="text-[var(--gold-500)]" />
                    Simulate & Preview CTC Breakdown
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={previewCTC}
                      onChange={e => setPreviewCTC(e.target.value)}
                      placeholder="Annual CTC (e.g. 600000)"
                      className="w-48 px-2.5 py-1 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] text-xs font-mono text-[var(--ink)]"
                    />
                    <button
                      type="button"
                      onClick={handlePreview}
                      disabled={previewing || !previewCTC}
                      className="btn-outline text-xs py-1 px-2.5 cursor-pointer"
                    >
                      {previewing ? 'Simulating...' : 'Simulate'}
                    </button>
                  </div>
                </div>

                {previewRows.length > 0 && (
                  <div className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--paper)]">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--surface-sunken)] border-b border-[var(--rule)] text-[10px] uppercase font-bold text-[var(--ink-muted)]">
                        <tr>
                          <th className="px-3 py-1.5 text-left">Component</th>
                          <th className="px-3 py-1.5 text-left">Type</th>
                          <th className="px-3 py-1.5 text-left">Formula</th>
                          <th className="px-3 py-1.5 text-right">Monthly (₹)</th>
                          <th className="px-3 py-1.5 text-right">Annual (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--rule)] font-mono">
                        {previewRows.map((r, i) => (
                          <tr key={i} className="hover:bg-[var(--surface-sunken)]">
                            <td className="px-3 py-1.5 font-sans font-medium text-[var(--ink)]">{r.componentName}</td>
                            <td className="px-3 py-1.5 font-sans text-[var(--ink-muted)]">{r.componentType}</td>
                            <td className="px-3 py-1.5 text-[var(--teal-600)]">{r.formula}</td>
                            <td className="px-3 py-1.5 text-right font-bold text-[var(--ink)]">₹{r.amount.toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-right text-[var(--ink-muted)]">₹{(r.amount * 12).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-[var(--rule)]">
              <button
                type="button"
                onClick={() => setEditComponentsId(null)}
                className="btn-outline text-xs py-1.5 px-3 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveComponents}
                disabled={saving}
                className="btn-primary text-xs py-1.5 px-4 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Formulas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {templateArchive.dialog}
    </div>
  );
};

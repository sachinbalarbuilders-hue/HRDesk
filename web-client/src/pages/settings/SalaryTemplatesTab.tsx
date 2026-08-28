import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  LayoutTemplate, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight,
  IndianRupee, Percent, Equal, Wand2, Zap,
} from 'lucide-react';

interface Template { id: number; name: string; description?: string; isDefault: boolean; isActive: boolean; componentCount: number; }
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

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [tplRes, cmpRes] = await Promise.all([
        apiClient.get('/salary-templates'),
        apiClient.get('/salary-templates/components'),
      ]);
      setTemplates(tplRes.data || []);
      setComponents(cmpRes.data || []);
    } catch { showError('Failed to load templates'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  const toggleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    try {
      const res = await apiClient.get(`/salary-templates/${id}`);
      setExpandedComponents(res.data.components || []);
    } catch { setExpandedComponents([]); }
  };

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

  const deleteTemplate = async (id: number) => {
    if (!confirm('Delete or deactivate this template?')) return;
    try { await apiClient.delete(`/salary-templates/${id}`); showSuccess('Template removed'); fetchAll(); }
    catch { showError('Failed'); }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)] font-ui">Salary Structure Templates</h2>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">
            Define CTC-based formulas (Basic=40% of CTC, HRA=50% of Basic, etc.) and assign to Pay Groups.
          </p>
        </div>
        <button onClick={openCreateTemplate} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus size={14} /> New Template
        </button>
      </div>

      {/* Template list */}
      {loading ? (
        <div className="h-32 flex items-center justify-center text-[var(--ink-muted)] text-sm">Loading...</div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className={`border border-[var(--rule)] rounded-[6px] bg-[var(--paper)] ${!t.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleExpand(t.id)} className="text-[var(--ink-muted)]">
                    {expandedId === t.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--ink)]">{t.name}</span>
                      {t.isDefault && <span className="text-[10px] bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 px-1.5 py-0.5 rounded-[3px] font-bold">DEFAULT</span>}
                    </div>
                    {t.description && <p className="text-[11px] text-[var(--ink-muted)]">{t.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-[var(--ink-muted)]">{t.componentCount} components</span>
                  <button onClick={() => openEditComponents(t.id)} className="text-xs text-[var(--teal-600)] hover:underline font-medium">Edit Formula</button>
                  <button onClick={() => openEditTemplate(t)} className="p-1.5 rounded hover:bg-[var(--surface-sunken)] text-[var(--ink-muted)]"><Pencil size={13} /></button>
                  {!t.isDefault && <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--ink-muted)] hover:text-red-600"><Trash2 size={13} /></button>}
                </div>
              </div>
              {expandedId === t.id && (
                <div className="border-t border-[var(--rule)] px-4 py-3 bg-[var(--surface-sunken)]">
                  {expandedComponents.length === 0 ? (
                    <p className="text-xs text-[var(--ink-muted)]">No components defined. Click "Edit Formula" to add.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase text-[var(--ink-muted)] font-bold border-b border-[var(--rule)]">
                          <th className="pb-1.5 text-left">Component</th>
                          <th className="pb-1.5 text-left">Type</th>
                          <th className="pb-1.5 text-left">Formula</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--rule)]">
                        {expandedComponents.map((c: any) => (
                          <tr key={c.id}>
                            <td className="py-1.5 font-medium text-[var(--ink)]">{c.componentName}</td>
                            <td className="py-1.5 text-[var(--ink-muted)]">{c.componentType}</td>
                            <td className="py-1.5 font-mono text-[var(--teal-600)]">{
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
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Template create/edit modal */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--paper)] rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-[var(--rule)]">
              <h3 className="font-bold text-[var(--ink)] font-ui">{editTplId ? 'Edit Template' : 'New Template'}</h3>
              <button onClick={() => setTemplateModalOpen(false)} className="text-[var(--ink-muted)]"><X size={18} /></button>
            </div>
            <form onSubmit={saveTemplate} className="p-5 space-y-4">
              <div>
                <label className="register-label">Template Name *</label>
                <input value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Standard CTC Template" className="register-input w-full" />
              </div>
              <div>
                <label className="register-label">Description</label>
                <textarea value={tplForm.description} onChange={e => setTplForm(f => ({ ...f, description: e.target.value }))} rows={2} className="register-input w-full" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setTemplateModalOpen(false)} className="btn-outline text-xs">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">{saving ? 'Saving...' : editTplId ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit components modal */}
      {editComponentsId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--paper)] rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[var(--rule)] sticky top-0 bg-[var(--paper)] z-10">
              <h3 className="font-bold text-[var(--ink)] font-ui">Edit Salary Formula</h3>
              <button onClick={() => setEditComponentsId(null)} className="text-[var(--ink-muted)]"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Rows */}
              <div className="space-y-2">
                {editRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-[var(--surface-sunken)] p-2 rounded-[4px] border border-[var(--rule)]">
                    {/* Component */}
                    <div className="col-span-3">
                      <select value={row.componentId} onChange={e => updateRow(idx, 'componentId', parseInt(e.target.value))} className="register-input w-full text-xs">
                        {components.filter(c => c.isActive).map(c => (
                          <option key={c.id} value={c.id}>{c.componentName} ({c.componentType})</option>
                        ))}
                      </select>
                    </div>
                    {/* Calculation type */}
                    <div className="col-span-3">
                      <select value={row.calculationType} onChange={e => updateRow(idx, 'calculationType', e.target.value)} className="register-input w-full text-xs">
                        {CALC_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                      </select>
                    </div>
                    {/* Value */}
                    <div className="col-span-2">
                      {(row.calculationType === 'FixedAmount' || row.calculationType === 'PercentOfCTC' || row.calculationType === 'PercentOfComponent') ? (
                        <input type="number" min="0" step="0.01" value={row.value} onChange={e => updateRow(idx, 'value', e.target.value)} placeholder={row.calculationType === 'FixedAmount' ? '₹ amount' : '% value'} className="register-input w-full text-xs font-mono" />
                      ) : <span className="text-[11px] text-[var(--ink-muted)] italic px-2">auto</span>}
                    </div>
                    {/* Base component */}
                    <div className="col-span-3">
                      {row.calculationType === 'PercentOfComponent' ? (
                        <select value={row.baseComponentCode} onChange={e => updateRow(idx, 'baseComponentCode', e.target.value)} className="register-input w-full text-xs">
                          <option value="">— base —</option>
                          {components.filter(c => c.isActive && c.componentType === 'Earning').map(c => (
                            <option key={c.id} value={c.componentCode}>{c.componentCode} – {c.componentName}</option>
                          ))}
                        </select>
                      ) : <span />}
                    </div>
                    {/* Remove */}
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => removeRow(idx)} className="p-1 text-[var(--ink-muted)] hover:text-red-600"><X size={13} /></button>
                    </div>
                  </div>
                ))}
                <button onClick={addComponentRow} className="text-xs text-[var(--teal-600)] hover:underline flex items-center gap-1 mt-1">
                  <Plus size={13} /> Add Component
                </button>
              </div>

              {/* CTC Preview */}
              <div className="border border-[var(--rule)] rounded-[6px] p-4 bg-[var(--surface-sunken)] space-y-3">
                <p className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5"><Wand2 size={13} /> Preview CTC Breakdown</p>
                <div className="flex gap-2">
                  <input type="number" value={previewCTC} onChange={e => setPreviewCTC(e.target.value)} placeholder="Annual CTC (e.g. 600000)" className="register-input flex-1 text-xs font-mono" />
                  <button onClick={handlePreview} disabled={!previewCTC || previewing} className="btn-outline text-xs px-3">
                    {previewing ? '...' : 'Preview'}
                  </button>
                </div>
                {previewRows.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-[var(--ink-muted)] font-bold border-b border-[var(--rule)]">
                        <th className="pb-1 text-left">Component</th>
                        <th className="pb-1 text-left">Type</th>
                        <th className="pb-1 text-right">Monthly (₹)</th>
                        <th className="pb-1 text-left pl-3">Formula</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map(r => (
                        <tr key={r.componentCode} className="border-b border-[var(--rule)]">
                          <td className="py-1 font-medium text-[var(--ink)]">{r.componentName}</td>
                          <td className="py-1 text-[var(--ink-muted)]">{r.componentType}</td>
                          <td className="py-1 text-right font-mono font-semibold text-[var(--ink)]">
                            {r.calculationType === 'Statutory' ? '—' : `₹${r.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                          </td>
                          <td className="py-1 pl-3 text-[10px] text-[var(--ink-muted)]">{r.formula}</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td colSpan={2} className="pt-2 text-right text-[var(--ink)]">Monthly Total:</td>
                        <td className="pt-2 text-right font-mono text-[var(--teal-600)]">
                          ₹{previewRows.filter(r => r.componentType === 'Earning' && r.calculationType !== 'Statutory').reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--rule)]">
                <button onClick={() => setEditComponentsId(null)} className="btn-outline text-xs">Cancel</button>
                <button onClick={saveComponents} disabled={saving} className="btn-primary text-xs">
                  {saving ? 'Saving...' : 'Save Formula'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Plus, Pencil, Trash2, X, Layers } from 'lucide-react';

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
}

const COMPONENT_TYPES = ['Earning', 'Deduction', 'Informational'];
const CATEGORIES = ['Basic', 'Allowance', 'Statutory', 'Reimbursement', 'Bonus', 'Other'];

const TYPE_COLORS: Record<string, string> = {
  Earning: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Deduction: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Informational: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

const emptyForm = {
  componentName: '',
  componentCode: '',
  componentType: 'Earning' as SalaryComponent['componentType'],
  category: 'Allowance',
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

  const fetchComponents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/salary-templates/components');
      setComponents(res.data || []);
    } catch {
      showError('Failed to load components');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchComponents(); }, []);

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
      category: c.category,
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

  const handleToggleActive = async (c: SalaryComponent) => {
    try {
      await apiClient.post('/salary-templates/components', {
        id: c.id,
        componentName: c.componentName,
        componentCode: c.componentCode,
        componentType: c.componentType,
        category: c.category,
        isEpfApplicable: c.isEpfApplicable,
        isEsiApplicable: c.isEsiApplicable,
        isTaxable: c.isTaxable,
        isActive: !c.isActive,
        displayOrder: c.displayOrder,
      });
      showSuccess(c.isActive ? 'Component deactivated' : 'Component activated');
      fetchComponents();
    } catch {
      showError('Failed to update component');
    }
  };

  const F = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const FC = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.checked }));

  const filtered = typeFilter === 'all' ? components : components.filter(c => c.componentType === typeFilter);
  const grouped = COMPONENT_TYPES.map(type => ({
    type,
    items: filtered.filter(c => c.componentType === type),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)] font-ui">Salary Components</h2>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">
            Define earnings, deductions, and informational items available in salary templates.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus size={14} /> New Component
        </button>
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-2">
        {['all', ...COMPONENT_TYPES].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
              typeFilter === t
                ? 'bg-[var(--gold-500)] text-white'
                : 'bg-[var(--surface-sunken)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            {t === 'all' ? 'All' : t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center text-[var(--ink-muted)] text-sm">Loading...</div>
      ) : components.length === 0 ? (
        <div className="h-32 flex flex-col items-center justify-center text-[var(--ink-muted)] text-sm gap-2">
          <Layers size={32} className="opacity-30" />
          <span>No components yet. Create one to get started.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ type, items }) => (
            <div key={type}>
              <p className="text-[11px] font-bold uppercase text-[var(--ink-muted)] mb-2 tracking-wider">{type}s</p>
              <div className="rounded-[4px] border border-[var(--rule)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--rule)]">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui w-8">#</th>
                      <th className="px-4 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Component</th>
                      <th className="px-4 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Code</th>
                      <th className="px-4 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Category</th>
                      <th className="px-4 py-2.5 text-center text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">EPF</th>
                      <th className="px-4 py-2.5 text-center text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">ESI</th>
                      <th className="px-4 py-2.5 text-center text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Taxable</th>
                      <th className="px-4 py-2.5 text-center text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Status</th>
                      <th className="px-4 py-2.5 text-right text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rule)]">
                    {items.sort((a, b) => a.displayOrder - b.displayOrder).map(c => (
                      <tr key={c.id} className={`bg-[var(--paper)] hover:bg-[var(--surface-sunken)] transition-colors ${!c.isActive ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-2.5 text-[11px] text-[var(--ink-muted)] font-mono">{c.displayOrder}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-[var(--ink)] text-xs">{c.componentName}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <code className="text-[11px] font-mono bg-[var(--surface-sunken)] px-1.5 py-0.5 rounded text-[var(--teal-600)]">{c.componentCode}</code>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[var(--ink-muted)]">{c.category}</td>
                        <td className="px-4 py-2.5 text-center">
                          <Dot on={c.isEpfApplicable} />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Dot on={c.isEsiApplicable} />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Dot on={c.isTaxable} />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] ${c.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-[var(--surface-sunken)] text-[var(--ink-muted)]'}`}>
                            {c.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-[var(--surface-sunken)] text-[var(--ink-muted)]" title="Edit"><Pencil size={13} /></button>
                            <button onClick={() => handleToggleActive(c)} className={`p-1.5 rounded text-[var(--ink-muted)] text-[11px] font-medium hover:bg-[var(--surface-sunken)]`} title={c.isActive ? 'Deactivate' : 'Activate'}>
                              {c.isActive ? <Trash2 size={13} className="hover:text-red-500" /> : <Plus size={13} className="hover:text-emerald-500" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--paper)] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[var(--rule)]">
              <h3 className="font-bold text-[var(--ink)] font-ui">{editId ? 'Edit Component' : 'New Salary Component'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)]"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* Name + Code */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="register-label">Component Name *</label>
                  <input name="componentName" value={form.componentName} onChange={F} required placeholder="e.g. Travel Allowance" className="register-input w-full" />
                </div>
                <div>
                  <label className="register-label">Code * <span className="text-[10px] text-[var(--ink-muted)] font-normal">(used in formulas)</span></label>
                  <input name="componentCode" value={form.componentCode} onChange={F} required placeholder="e.g. TRAVEL" className="register-input w-full font-mono uppercase" />
                </div>
              </div>

              {/* Type + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="register-label">Type *</label>
                  <select name="componentType" value={form.componentType} onChange={F} className="register-input w-full">
                    {COMPONENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="register-label">Category</label>
                  <select name="category" value={form.category} onChange={F} className="register-input w-full">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Display Order */}
              <div>
                <label className="register-label">Display Order</label>
                <input type="number" name="displayOrder" value={form.displayOrder} onChange={F} min={1} className="register-input w-full" />
                <p className="text-[10px] text-[var(--ink-muted)] mt-0.5">Lower number = appears first in payslip (e.g. Basic = 1, HRA = 2)</p>
              </div>

              {/* Flags */}
              <div>
                <label className="register-label">Applicability</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { name: 'isEpfApplicable', label: 'EPF Applicable', checked: form.isEpfApplicable },
                    { name: 'isEsiApplicable', label: 'ESI Applicable', checked: form.isEsiApplicable },
                    { name: 'isTaxable', label: 'Taxable', checked: form.isTaxable },
                  ].map(({ name, label, checked }) => (
                    <label key={name} className="flex items-center gap-2 p-2 border border-[var(--rule)] rounded-[4px] cursor-pointer hover:border-[var(--teal-500)] bg-[var(--surface-sunken)]">
                      <input type="checkbox" name={name} checked={checked} onChange={FC} className="rounded" />
                      <span className="text-xs font-medium text-[var(--ink)]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Active toggle (edit only) */}
              {editId && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="isActive" checked={form.isActive} onChange={FC} className="rounded" />
                  <span className="text-xs font-medium text-[var(--ink)]">Active</span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-outline text-xs">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">
                  {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Small dot indicator
const Dot: React.FC<{ on: boolean }> = ({ on }) => (
  <span className={`inline-block w-2 h-2 rounded-full ${on ? 'bg-emerald-500' : 'bg-[var(--rule)]'}`} />
);

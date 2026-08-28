import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  Users, Plus, Pencil, Trash2, X, CheckCircle2, MapPin, ChevronDown, ChevronRight,
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

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const [grpRes, tplRes] = await Promise.all([
        apiClient.get('/pay-groups'),
        apiClient.get('/salary-templates'),
      ]);
      setGroups(grpRes.data || []);
      setTemplates(tplRes.data || []);
    } catch { showError('Failed to load pay groups'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGroups(); }, []);

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

  const handleDelete = async (id: number) => {
    if (!confirm('Deactivate or delete this pay group?')) return;
    try {
      await apiClient.delete(`/pay-groups/${id}`);
      showSuccess('Pay group removed');
      fetchGroups();
    } catch { showError('Failed to remove pay group'); }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)] font-ui">Pay Groups</h2>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">
            Control salary calculation basis (calendar days, fixed 26, etc.) and statutory applicability per employee group.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus size={14} /> New Pay Group
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="h-32 flex items-center justify-center text-[var(--ink-muted)] text-sm">Loading...</div>
      ) : groups.length === 0 ? (
        <div className="h-32 flex flex-col items-center justify-center text-[var(--ink-muted)] text-sm gap-2">
          <Users size={32} className="opacity-30" />
          <span>No pay groups yet. Create one to get started.</span>
        </div>
      ) : (
        <div className="rounded-[4px] border border-[var(--rule)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-sunken)] border-b border-[var(--rule)]">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Group</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Salary Basis</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Statutory</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Template</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">Employees</th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {groups.map(g => (
                <React.Fragment key={g.id}>
                  <tr className={`bg-[var(--paper)] hover:bg-[var(--surface-sunken)] transition-colors ${!g.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleExpand(g.id)} className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
                          {expandedId === g.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <div>
                          <p className="font-semibold text-[var(--ink)]">{g.name}</p>
                          {g.description && <p className="text-[11px] text-[var(--ink-muted)]">{g.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-[var(--ink)]">{BASIS_LABELS[g.salaryBasis] ?? g.salaryBasis}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {[['PF', g.pfApplicable], ['ESI', g.esiApplicable], ['PT', g.ptApplicable]].map(([lbl, on]) => (
                          <span key={lbl as string} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] ${on ? 'bg-[var(--success-light)] text-[var(--success)]' : 'bg-[var(--surface-secondary)] text-[var(--text-muted)]'}`}>
                            {lbl as string}
                          </span>
                        ))}
                        {g.ptApplicable && g.ptState && (
                          <span className="text-[10px] text-[var(--ink-muted)] flex items-center gap-0.5">
                            <MapPin size={9} />{g.ptState}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--ink-muted)]">
                      {g.templateName ?? <span className="italic">None</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-[var(--ink)]">{g.employeeCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(g)} className="p-1.5 rounded hover:bg-[var(--surface-sunken)] text-[var(--ink-muted)]"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(g.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--ink-muted)] hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === g.id && (
                    <tr className="bg-[var(--surface-sunken)]">
                      <td colSpan={6} className="px-8 py-3">
                        {groupEmployees.length === 0 ? (
                          <p className="text-xs text-[var(--ink-muted)]">No employees in this group yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {groupEmployees.map((emp: any) => (
                              <span key={emp.employeeId} className="text-xs bg-[var(--paper)] border border-[var(--rule)] px-2 py-1 rounded-[4px] text-[var(--ink)]">
                                {emp.employeeName} {emp.designation ? `· ${emp.designation}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--paper)] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[var(--rule)]">
              <h3 className="font-bold text-[var(--ink)] font-ui">{editId ? 'Edit Pay Group' : 'New Pay Group'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)]"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="register-label">Group Name *</label>
                <input name="name" value={form.name} onChange={F} required placeholder="e.g. Management Staff" className="register-input w-full" />
              </div>
              <div>
                <label className="register-label">Description</label>
                <textarea name="description" value={form.description} onChange={F} rows={2} placeholder="Brief description" className="register-input w-full" />
              </div>

              {/* Salary Basis */}
              <div>
                <label className="register-label">Salary Calculation Basis</label>
                <select name="salaryBasis" value={form.salaryBasis} onChange={F} className="register-input w-full">
                  {Object.entries(BASIS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Template */}
              <div>
                <label className="register-label">Default Salary Structure Template</label>
                <select name="templateId" value={form.templateId} onChange={F} className="register-input w-full">
                  <option value="">— None —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* Statutory */}
              <div className="space-y-2">
                <label className="register-label">Statutory Deductions</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: 'pfApplicable', label: 'Provident Fund (PF)', checked: form.pfApplicable },
                    { name: 'esiApplicable', label: 'ESI', checked: form.esiApplicable },
                    { name: 'ptApplicable', label: 'Professional Tax (PT)', checked: form.ptApplicable },
                  ].map(({ name, label, checked }) => (
                    <label key={name} className="flex items-center gap-2 p-2 border border-[var(--rule)] rounded-[4px] cursor-pointer hover:border-[var(--teal-500)] bg-[var(--surface-sunken)]">
                      <input type="checkbox" name={name} checked={checked} onChange={FC} className="rounded" />
                      <span className="text-xs font-medium text-[var(--ink)]">{label}</span>
                    </label>
                  ))}
                </div>
                {form.ptApplicable && (
                  <div>
                    <label className="register-label">PT State</label>
                    <select name="ptState" value={form.ptState} onChange={F} className="register-input w-full">
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>

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

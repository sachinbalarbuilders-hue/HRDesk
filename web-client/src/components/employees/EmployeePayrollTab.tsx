import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { IndianRupee, Plus, Pencil, X, ChevronDown, Users } from 'lucide-react';

interface CTCRecord {
  id: number;
  annualCTC: number;
  monthlyCTC: number;
  templateId: number;
  templateName?: string;
  salaryBasisOverride?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  remarks?: string;
}

interface Template { id: number; name: string; }
interface PayGroup { id: number; name: string; salaryBasis: string; }
interface PreviewRow { componentCode: string; componentName: string; componentType: string; amount: number; calculationType: string; formula: string; }

const BASIS_LABELS: Record<string, string> = {
  CalendarDays: 'Calendar Days', Fixed26: 'Fixed 26', Fixed30: 'Fixed 30',
  ActualWorkingDays: 'Actual Working Days', PerDay: 'Per Day',
};

interface Props {
  employeeId: number;
  canEdit: boolean;
}

const empty = { annualCTC: '', templateId: '', effectiveFrom: '', remarks: '' };

export const EmployeePayrollTab: React.FC<Props> = ({ employeeId, canEdit }) => {
  const { showSuccess, showError } = useToast();
  const [records, setRecords] = useState<CTCRecord[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [currentGroup, setCurrentGroup] = useState<PayGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [assignGroupId, setAssignGroupId] = useState('');
  const [assigningSaving, setAssigningSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ctcRes, tplRes, pgRes] = await Promise.all([
        apiClient.get(`/salary-templates/employee-ctc/${employeeId}`),
        apiClient.get('/salary-templates'),
        apiClient.get('/pay-groups'),
      ]);
      setRecords(ctcRes.data || []);
      setTemplates(tplRes.data || []);
      const groups: PayGroup[] = pgRes.data || [];
      setPayGroups(groups);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // Also fetch current pay group assignment from employee data
  const fetchPayGroup = async () => {
    try {
      const res = await apiClient.get(`/employees/${employeeId}`);
      const emp = res.data;
      if (emp?.payGroupId) {
        const pg = payGroups.find(p => p.id === emp.payGroupId);
        if (pg) setCurrentGroup(pg);
        else setCurrentGroup({ id: emp.payGroupId, name: emp.payGroupName || `Group #${emp.payGroupId}`, salaryBasis: '' });
      } else {
        setCurrentGroup(null);
      }
      if (emp?.payGroupId) setAssignGroupId(emp.payGroupId.toString());
    } catch { /* silent */ }
  };

  useEffect(() => { fetchData(); }, [employeeId]);
  useEffect(() => { if (payGroups.length > 0) fetchPayGroup(); }, [payGroups]);

  const openModal = () => {
    const active = records.find(r => !r.effectiveTo);
    setForm({
      annualCTC: active ? active.annualCTC.toString() : '',
      templateId: active ? active.templateId.toString() : '',
      effectiveFrom: new Date().toISOString().split('T')[0],
      remarks: '',
    });
    setPreviewRows([]);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.annualCTC || !form.templateId || !form.effectiveFrom) return;
    try {
      setSaving(true);
      await apiClient.post('/salary-templates/employee-ctc', {
        employeeId,
        annualCTC: parseFloat(form.annualCTC),
        templateId: parseInt(form.templateId),
        effectiveFrom: form.effectiveFrom,
        salaryBasisOverride: null,
        remarks: form.remarks || null,
      });
      showSuccess('CTC saved');
      setModalOpen(false);
      fetchData();
    } catch { showError('Failed to save CTC'); }
    finally { setSaving(false); }
  };

  const handlePreview = async () => {
    if (!form.annualCTC || !form.templateId) return;
    try {
      setPreviewing(true);
      const res = await apiClient.post('/salary-templates/preview-ctc', {
        annualCTC: parseFloat(form.annualCTC),
        templateId: parseInt(form.templateId),
      });
      setPreviewRows(res.data.components || []);
    } catch { showError('Preview failed'); }
    finally { setPreviewing(false); }
  };

  const handleAssignGroup = async () => {
    if (!assignGroupId) return;
    try {
      setAssigningSaving(true);
      await apiClient.post(`/pay-groups/${parseInt(assignGroupId)}/assign`, {
        employeeIds: [employeeId],
      });
      showSuccess('Pay group assigned');
      fetchData();
    } catch { showError('Failed to assign pay group'); }
    finally { setAssigningSaving(false); }
  };

  const activeRecord = records.find(r => !r.effectiveTo);

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="h-20 flex items-center justify-center text-[var(--ink-muted)] text-sm">Loading...</div>
      ) : (
        <>
          {/* Pay Group Assignment */}
          <div className="p-4 border border-[var(--rule)] rounded-[6px] bg-[var(--paper)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[var(--ink)] font-ui uppercase tracking-wide flex items-center gap-1.5">
                <Users size={13} /> Pay Group
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={assignGroupId}
                onChange={e => setAssignGroupId(e.target.value)}
                className="register-input flex-1 text-sm"
                disabled={!canEdit}
              >
                <option value="">— Not assigned —</option>
                {payGroups.filter(g => g.isActive !== false).map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({BASIS_LABELS[g.salaryBasis] ?? g.salaryBasis})</option>
                ))}
              </select>
              {canEdit && (
                <button onClick={handleAssignGroup} disabled={assigningSaving || !assignGroupId} className="btn-primary text-xs px-4">
                  {assigningSaving ? 'Saving...' : 'Assign'}
                </button>
              )}
            </div>
            {currentGroup && (
              <p className="text-[11px] text-[var(--ink-muted)] mt-1.5">
                Currently: <strong>{currentGroup.name}</strong>
                {currentGroup.salaryBasis && ` · ${BASIS_LABELS[currentGroup.salaryBasis] ?? currentGroup.salaryBasis}`}
              </p>
            )}
          </div>

          {/* Active CTC */}
          <div className="p-4 border border-[var(--rule)] rounded-[6px] bg-[var(--paper)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[var(--ink)] font-ui uppercase tracking-wide flex items-center gap-1.5">
                <IndianRupee size={13} /> Salary / CTC
              </h3>
              {canEdit && (
                <button onClick={openModal} className="btn-primary text-xs flex items-center gap-1">
                  <Plus size={12} /> {activeRecord ? 'Revise CTC' : 'Assign CTC'}
                </button>
              )}
            </div>

            {activeRecord ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Annual CTC', `₹${activeRecord.annualCTC.toLocaleString('en-IN')}`],
                  ['Monthly CTC', `₹${activeRecord.monthlyCTC.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`],
                  ['Template', activeRecord.templateName ?? '—'],
                  ['Effective From', activeRecord.effectiveFrom],
                ].map(([lbl, val]) => (
                  <div key={lbl} className="p-3 rounded-[4px] bg-[var(--surface-sunken)] border border-[var(--rule)]">
                    <span className="text-[10px] uppercase font-bold text-[var(--ink-muted)] font-ui">{lbl}</span>
                    <p className="font-semibold text-[var(--ink)] mt-0.5 text-sm">{val}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">No CTC assigned. Click "Assign CTC" to set up.</p>
            )}
          </div>

          {/* CTC History */}
          {records.length > 1 && (
            <div>
              <h3 className="text-xs font-bold text-[var(--ink)] font-ui uppercase tracking-wide mb-2">CTC History</h3>
              <div className="space-y-1.5">
                {records.slice(1).map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 border border-[var(--rule)] rounded-[4px] bg-[var(--paper)] opacity-70">
                    <div>
                      <span className="font-semibold text-sm text-[var(--ink)]">₹{r.annualCTC.toLocaleString('en-IN')} / year</span>
                      <span className="text-xs text-[var(--ink-muted)] ml-2">{r.templateName}</span>
                    </div>
                    <span className="text-xs text-[var(--ink-muted)]">{r.effectiveFrom} → {r.effectiveTo ?? 'superseded'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* CTC Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--paper)] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[var(--rule)] sticky top-0 bg-[var(--paper)]">
              <h3 className="font-bold text-[var(--ink)] font-ui">Assign / Revise CTC</h3>
              <button onClick={() => setModalOpen(false)} className="text-[var(--ink-muted)]"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="register-label">Annual CTC (₹) *</label>
                  <input type="number" min="0" value={form.annualCTC} onChange={e => setForm(f => ({ ...f, annualCTC: e.target.value }))} required placeholder="e.g. 600000" className="register-input w-full font-mono" />
                  {form.annualCTC && <p className="text-[10px] text-[var(--ink-muted)] mt-0.5">Monthly: ₹{(parseFloat(form.annualCTC) / 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>}
                </div>
                <div>
                  <label className="register-label">Effective From *</label>
                  <input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} required className="register-input w-full" />
                </div>
              </div>
              <div>
                <label className="register-label">Salary Structure Template *</label>
                <select value={form.templateId} onChange={e => setForm(f => ({ ...f, templateId: e.target.value }))} required className="register-input w-full">
                  <option value="">Select template...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="register-label">Remarks</label>
                <input
                  value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  placeholder="e.g. Annual increment 2026"
                  className="register-input w-full"
                />
              </div>

              {/* Preview button */}
              {form.annualCTC && form.templateId && (
                <div>
                  <button type="button" onClick={handlePreview} disabled={previewing} className="btn-outline text-xs">
                    {previewing ? 'Previewing...' : 'Preview Monthly Breakdown'}
                  </button>
                  {previewRows.length > 0 && (
                    <div className="mt-2 border border-[var(--rule)] rounded-[4px] overflow-hidden">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-[var(--rule)]">
                          {previewRows.filter(r => r.componentType !== 'Informational').map(r => (
                            <tr key={r.componentCode} className="bg-[var(--paper)]">
                              <td className="px-3 py-1.5 text-[var(--ink)]">{r.componentName}</td>
                              <td className="px-3 py-1.5 text-[11px] text-[var(--ink-muted)]">{r.componentType}</td>
                              <td className="px-3 py-1.5 font-mono text-right text-[var(--ink)] font-semibold">
                                {r.calculationType === 'Statutory' ? '—' : `₹${r.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-outline text-xs">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">{saving ? 'Saving...' : 'Save CTC'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

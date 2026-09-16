import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';

interface AssignCTCModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: number;
  employeeName?: string;
  currentAnnualCTC?: number;
  currentPayGroupId?: number;
  currentPayGroupName?: string;
  onSuccess: () => void;
}

interface PayGroup {
  id: number;
  name: string;
}

interface PreviewRow {
  componentCode: string;
  componentName: string;
  componentType: string;
  amount: number;
  calculationType: string;
  formula?: string;
}

export const AssignCTCModal: React.FC<AssignCTCModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  currentAnnualCTC,
  currentPayGroupId,
  currentPayGroupName,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();
  
  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [showChangeGroup, setShowChangeGroup] = useState(false);
  const [form, setForm] = useState({
    annualCTC: '',
    payGroupId: '',
    effectiveFrom: (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
    })(),
    remarks: '',
  });
  
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchPayGroups();
      setForm({
        annualCTC: currentAnnualCTC ? currentAnnualCTC.toString() : '',
        payGroupId: currentPayGroupId ? currentPayGroupId.toString() : '',
        effectiveFrom: (() => {
          const n = new Date();
          return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
        })(),
        remarks: '',
      });
      setShowChangeGroup(!currentPayGroupId);
      setPreviewRows([]);
    }
  }, [isOpen, currentAnnualCTC, currentPayGroupId]);

  const fetchPayGroups = async () => {
    try {
      const res = await apiClient.get('/pay-groups');
      setPayGroups((res.data || []).filter((t: any) => t.isActive));
    } catch {
      showError('Failed to load pay groups');
    }
  };

  // Live debounced calculation of monthly breakdown as soon as Annual CTC & Pay Group are set
  useEffect(() => {
    const annual = parseFloat(form.annualCTC);
    const pgId = parseInt(form.payGroupId);
    if (isNaN(annual) || annual <= 0 || isNaN(pgId) || pgId <= 0) {
      setPreviewRows([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setPreviewing(true);
        const res = await apiClient.post('/pay-groups/preview-ctc', {
          annualCTC: annual,
          payGroupId: pgId,
        });
        setPreviewRows(res.data.components || []);
      } catch {
        // silent on preview error
      } finally {
        setPreviewing(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [form.annualCTC, form.payGroupId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.annualCTC || !form.payGroupId || !form.effectiveFrom) return;
    try {
      setSaving(true);
      await apiClient.post('/pay-groups/employee-ctc', {
        employeeId,
        annualCTC: parseFloat(form.annualCTC),
        payGroupId: parseInt(form.payGroupId),
        effectiveFrom: form.effectiveFrom,
        salaryBasisOverride: null,
        remarks: form.remarks || null,
      });
      showSuccess('CTC Assigned', `Cost-To-Company saved successfully${employeeName ? ` for ${employeeName}` : ''}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      showError('Failed to save CTC', err.response?.data?.message || 'Server error occurred');
    } finally {
      setSaving(false);
    }
  };

  const resolvedGroupName =
    currentPayGroupName ||
    payGroups.find(g => g.id === parseInt(form.payGroupId))?.name ||
    'Assigned Group';

  const earnings = previewRows.filter(r => r.componentType === 'Earning');
  const deductions = previewRows.filter(r => r.componentType !== 'Earning' && r.componentType !== 'Informational');
  const totalEarnings = earnings.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign / Revise CTC"
      description={employeeName ? `For ${employeeName}` : 'Configure Cost-To-Company breakdown'}
      size="xl"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Pay Group Card / Selector */}
        {currentPayGroupId && !showChangeGroup ? (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-primary)]">
              Pay Group
            </label>
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-[var(--radius-md)]">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {resolvedGroupName}
                </span>
                <Badge variant="success" size="sm">
                  Assigned
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => setShowChangeGroup(true)}
                className="text-xs text-[var(--accent)] hover:underline font-medium cursor-pointer"
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-[var(--text-primary)]">
                Pay Group <span className="text-[var(--danger)]">*</span>
              </label>
              {currentPayGroupId && (
                <button
                  type="button"
                  onClick={() => {
                    setForm(f => ({ ...f, payGroupId: currentPayGroupId.toString() }));
                    setShowChangeGroup(false);
                  }}
                  className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
                >
                  Keep assigned group
                </button>
              )}
            </div>
            <select
              value={form.payGroupId}
              onChange={e => setForm(f => ({ ...f, payGroupId: e.target.value }))}
              required
              className="register-input"
            >
              <option value="">Select pay group...</option>
              {payGroups.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {!currentPayGroupId && (
              <p className="text-[11px] text-[var(--text-muted)]">
                Employee is not yet assigned to a pay group. Selecting here will assign them.
              </p>
            )}
          </div>
        )}

        {/* CTC and Effective From */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Annual CTC (₹)"
            required
            type="number"
            min="0"
            step="0.01"
            value={form.annualCTC}
            onChange={e => setForm(f => ({ ...f, annualCTC: e.target.value }))}
            placeholder="e.g. 600000"
            helperText={
              form.annualCTC && parseFloat(form.annualCTC) > 0
                ? `Monthly: ₹${(parseFloat(form.annualCTC) / 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                : undefined
            }
          />
          <Input
            label="Effective From"
            required
            type="date"
            value={form.effectiveFrom}
            onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
          />
        </div>

        {/* Remarks */}
        <Input
          label="Remarks"
          value={form.remarks}
          onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
          placeholder="e.g. Annual increment 2026"
        />

        {/* Live Monthly Breakdown */}
        {form.annualCTC && form.payGroupId && parseFloat(form.annualCTC) > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                Monthly Breakdown Preview
                {previewing && <Loader2 size={13} className="animate-spin text-[var(--accent)]" />}
              </span>
              <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                ₹{(parseFloat(form.annualCTC) / 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / month
              </span>
            </div>

            {previewRows.length > 0 ? (
              <div className="border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden bg-[var(--surface)] shadow-xs">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--table-header-border)] bg-[var(--table-header-bg)]">
                      <th className="py-2.5 px-3.5 text-left text-[11px] font-semibold text-[var(--table-header-text)] uppercase tracking-wider">
                        Component
                      </th>
                      <th className="py-2.5 px-3.5 text-left text-[11px] font-semibold text-[var(--table-header-text)] uppercase tracking-wider">
                        Calculation
                      </th>
                      <th className="py-2.5 px-3.5 text-right text-[11px] font-semibold text-[var(--table-header-text)] uppercase tracking-wider">
                        Monthly Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {earnings.map(r => (
                      <tr key={r.componentCode} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="py-2.5 px-3.5">
                          <span className="font-medium text-[var(--text-primary)]">{r.componentName}</span>
                          {r.formula && (
                            <span className="text-[11px] text-[var(--text-muted)] block font-mono mt-0.5">
                              {r.formula}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-[var(--text-secondary)] font-mono text-[11px]">
                          {r.calculationType}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-right font-semibold text-[var(--text-primary)]">
                          ₹{r.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                    {deductions.map(r => (
                      <tr key={r.componentCode} className="hover:bg-[var(--surface-hover)] bg-[var(--surface-secondary)]/40 transition-colors">
                        <td className="py-2.5 px-3.5 text-[var(--text-secondary)]">{r.componentName}</td>
                        <td className="py-2.5 px-3.5 text-[var(--text-muted)] font-mono text-[11px]">
                          {r.calculationType}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-right text-[var(--text-secondary)]">
                          {r.calculationType === 'Statutory' ? 'Auto at payroll' : `₹${r.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-secondary)] font-semibold text-[var(--text-primary)]">
                      <td colSpan={2} className="py-2.5 px-3.5">Gross Earnings Total</td>
                      <td className="py-2.5 px-3.5 font-mono text-right font-bold text-[var(--text-primary)]">
                        ₹{totalEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : previewing ? (
              <div className="py-6 text-center text-xs text-[var(--text-muted)] border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--surface-secondary)]">
                Calculating monthly breakdown...
              </div>
            ) : null}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !form.annualCTC || !form.payGroupId}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save CTC'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

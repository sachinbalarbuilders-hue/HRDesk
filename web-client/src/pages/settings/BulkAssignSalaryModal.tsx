import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, IndianRupee, Settings2, LayoutTemplate } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';

interface BulkAssignSalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEmployeeIds: number[];
  onSuccess: () => void;
}

export const BulkAssignSalaryModal: React.FC<BulkAssignSalaryModalProps> = ({
  isOpen,
  onClose,
  selectedEmployeeIds,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();
  
  const [payGroups, setPayGroups] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [payGroupId, setPayGroupId] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('');
  const [annualCTC, setAnnualCTC] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    if (isOpen) {
      fetchLookups();
      // Reset form
      setPayGroupId('');
      setTemplateId('');
      setAnnualCTC('');
    }
  }, [isOpen]);

  const fetchLookups = async () => {
    try {
      setLoading(true);
      const [pgRes, tplRes] = await Promise.all([
        apiClient.get('/pay-groups'),
        apiClient.get('/salary-templates'),
      ]);
      setPayGroups((pgRes.data || []).filter((g: any) => g.isActive));
      setTemplates((tplRes.data || []).filter((t: any) => t.isActive));
    } catch {
      showError('Failed to load dropdowns');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeIds.length) return;
    
    // We can assign Pay Group without CTC, or CTC without Pay Group. 
    // But if they provided a Template, they must provide CTC.
    if (templateId && (!annualCTC || parseFloat(annualCTC) <= 0)) {
      showError('Validation Error', 'Annual CTC is required when assigning a Salary Template.');
      return;
    }

    try {
      setSaving(true);
      
      // 1. Assign Pay Group
      if (payGroupId) {
        await apiClient.post(`/pay-groups/${payGroupId}/assign`, { 
          employeeIds: selectedEmployeeIds 
        });
      }

      // 2. Assign CTC (Sequentially since there's no bulk endpoint)
      if (templateId && annualCTC) {
        const ctcVal = parseFloat(annualCTC);
        const tplId = parseInt(templateId);
        
        await Promise.all(
          selectedEmployeeIds.map(empId =>
            apiClient.post('/salary-templates/employee-ctc', {
              employeeId: empId,
              templateId: tplId,
              annualCTC: ctcVal,
              effectiveFrom: effectiveFrom,
              remarks: 'Bulk assigned via configuration wizard'
            })
          )
        );
      }

      showSuccess('Assignment Successful', `Updated ${selectedEmployeeIds.length} employee(s).`);
      onSuccess();
      onClose();
    } catch (err: any) {
      showError('Assignment Failed', err.response?.data?.message || 'Server error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--paper)] w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col max-h-full border border-[var(--rule)]">
        
        <div className="flex items-center justify-between p-4 border-b border-[var(--rule)] bg-[var(--paper-subtle)]">
          <h2 className="text-sm font-bold text-[var(--ink)]">Bulk Assign Salary & Pay Group</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--rule)] rounded-md transition-colors text-[var(--ink-muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 bg-[var(--info-light)] text-[var(--info)] text-xs flex items-center gap-2 border-b border-[var(--info-light)]">
          <AlertCircle size={14} />
          You are updating <strong>{selectedEmployeeIds.length}</strong> selected employee(s).
        </div>

        <form onSubmit={handleSave} className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-8 text-center text-xs text-[var(--ink-muted)]">Loading configuration...</div>
          ) : (
            <div className="space-y-5">
              
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5 opacity-80">
                  <Settings2 size={12} /> Pay Group Assignment
                </h3>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1">Pay Group</label>
                  <select
                    className="w-full h-8 text-sm border border-[var(--rule)] rounded-md bg-[var(--paper)] text-[var(--ink)] px-2 focus:border-[var(--gold-500)] outline-none"
                    value={payGroupId}
                    onChange={(e) => setPayGroupId(e.target.value)}
                  >
                    <option value="">-- Do not change Pay Group --</option>
                    {payGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.salaryBasis})</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-[var(--rule)]" />

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5 opacity-80">
                  <IndianRupee size={12} /> Compensation Assignment
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1 flex items-center gap-1">
                      <LayoutTemplate size={12} /> Salary Template
                    </label>
                    <select
                      className="w-full h-8 text-sm border border-[var(--rule)] rounded-md bg-[var(--paper)] text-[var(--ink)] px-2 focus:border-[var(--gold-500)] outline-none"
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                    >
                      <option value="">-- Do not change Template --</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1">Annual CTC (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full h-8 text-sm border border-[var(--rule)] rounded-md bg-[var(--paper)] text-[var(--ink)] px-2 focus:border-[var(--gold-500)] outline-none"
                      placeholder="e.g. 500000"
                      value={annualCTC}
                      onChange={(e) => setAnnualCTC(e.target.value)}
                      disabled={!templateId}
                    />
                  </div>
                </div>

                {templateId && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1">Effective From Date</label>
                    <input
                      type="date"
                      required
                      className="w-full h-8 text-sm border border-[var(--rule)] rounded-md bg-[var(--paper)] text-[var(--ink)] px-2 focus:border-[var(--gold-500)] outline-none"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-[var(--rule)]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-medium rounded-md border border-[var(--rule)] text-[var(--ink)] hover:bg-[var(--paper-subtle)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (!payGroupId && !templateId)}
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-[var(--gold-500)] text-white hover:bg-[var(--gold-600)] flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
              Apply to {selectedEmployeeIds.length} Employee(s)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

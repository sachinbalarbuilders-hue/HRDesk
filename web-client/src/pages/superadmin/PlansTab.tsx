import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';

interface PlanItem {
  id: number;
  publicId: string;
  name: string;
  code: string;
  description: string;
  maxEmployees: number;
  maxBranches: number;
  hasBiometricsModule: boolean;
  hasPayrollModule: boolean;
  hasRecruitmentModule: boolean;
  hasLoanManagement: boolean;
  hasCustomDomain: boolean;
  pricePerMonth: number;
  isActive: boolean;
}

const emptyForm = {
  name: '',
  code: '',
  description: '',
  maxEmployees: 25,
  maxBranches: 1,
  hasBiometricsModule: true,
  hasPayrollModule: false,
  hasRecruitmentModule: false,
  hasLoanManagement: false,
  hasCustomDomain: false,
  pricePerMonth: 0,
};

export const PlansTab: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/superadmin/plans');
      setPlans(res.data || []);
    } catch {
      showError('Error', 'Failed to load plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (plan: PlanItem) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      code: plan.code,
      description: plan.description || '',
      maxEmployees: plan.maxEmployees,
      maxBranches: plan.maxBranches,
      hasBiometricsModule: plan.hasBiometricsModule,
      hasPayrollModule: plan.hasPayrollModule,
      hasRecruitmentModule: plan.hasRecruitmentModule,
      hasLoanManagement: plan.hasLoanManagement,
      hasCustomDomain: plan.hasCustomDomain,
      pricePerMonth: plan.pricePerMonth,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      showError('Validation', 'Name and Code are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingPlan) {
        await apiClient.put(`/superadmin/plans/${editingPlan.id}`, form);
        showSuccess('Updated', 'Plan updated successfully.');
      } else {
        await apiClient.post('/superadmin/plans', form);
        showSuccess('Created', 'Plan created successfully.');
      }
      setModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (plan: PlanItem) => {
    if (!window.confirm(`Deactivate "${plan.name}"? It won't appear for new subscriptions.`)) return;
    try {
      await apiClient.delete(`/superadmin/plans/${plan.id}`);
      showSuccess('Deactivated', `${plan.name} has been deactivated.`);
      fetchPlans();
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to deactivate plan.');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-[var(--accent)]" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Subscription Plans</h3>
          <p className="text-[11px] text-[var(--text-muted)]">Manage pricing tiers shown on landing page and registration.</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer">
          <Plus size={14} /> Add Plan
        </button>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-secondary)] border-b border-[var(--border)]">
              <tr className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                <th className="py-3 px-4">Plan Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">₹/Month</th>
                <th className="py-3 px-4">Employees</th>
                <th className="py-3 px-4">Branches</th>
                <th className="py-3 px-4">Features</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-[var(--surface-hover)]">
                  <td className="py-3 px-4">
                    <p className="font-medium text-[var(--text-primary)]">{plan.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5 line-clamp-1">{plan.description}</p>
                  </td>
                  <td className="py-3 px-4 font-mono text-[var(--text-secondary)]">{plan.code}</td>
                  <td className="py-3 px-4 font-data font-semibold text-[var(--text-primary)]">
                    {plan.pricePerMonth === 0 ? 'Free' : `₹${plan.pricePerMonth.toLocaleString()}`}
                  </td>
                  <td className="py-3 px-4 font-data">{plan.maxEmployees.toLocaleString()}</td>
                  <td className="py-3 px-4 font-data">{plan.maxBranches}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {plan.hasBiometricsModule && <Badge variant="default" size="sm">Bio</Badge>}
                      {plan.hasPayrollModule && <Badge variant="success" size="sm">Pay</Badge>}
                      {plan.hasRecruitmentModule && <Badge variant="info" size="sm">Recruit</Badge>}
                      {plan.hasLoanManagement && <Badge variant="warning" size="sm">Loans</Badge>}
                      {plan.hasCustomDomain && <Badge variant="neutral" size="sm">Domain</Badge>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={plan.isActive ? 'success' : 'danger'} dot>{plan.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(plan)} className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] cursor-pointer" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      {plan.isActive && (
                        <button onClick={() => handleDeactivate(plan)} className="p-1.5 rounded-[var(--radius-md)] text-[var(--danger)] hover:bg-[var(--danger-light)] cursor-pointer" title="Deactivate">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">No plans found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create New Plan'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Plan Name *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Growth Enterprise" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Code *</label>
              <input type="text" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. growth" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description for landing page" className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">₹ Price/Month</label>
              <input type="number" min={0} value={form.pricePerMonth} onChange={(e) => setForm({ ...form, pricePerMonth: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Max Employees</label>
              <input type="number" min={1} value={form.maxEmployees} onChange={(e) => setForm({ ...form, maxEmployees: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Max Branches</label>
              <input type="number" min={1} value={form.maxBranches} onChange={(e) => setForm({ ...form, maxBranches: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
            </div>
          </div>

          {/* Feature Toggles */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Included Modules</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'hasBiometricsModule', label: 'Biometric Attendance' },
                { key: 'hasPayrollModule', label: 'Payroll Engine' },
                { key: 'hasRecruitmentModule', label: 'Recruitment' },
                { key: 'hasLoanManagement', label: 'Loans & Advances' },
                { key: 'hasCustomDomain', label: 'Custom Domain' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary px-4 py-2 text-sm cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm cursor-pointer flex items-center gap-2 disabled:opacity-50">
              <CheckCircle2 size={14} /> {saving ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

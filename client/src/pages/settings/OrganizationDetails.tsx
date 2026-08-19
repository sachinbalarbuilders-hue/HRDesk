import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { ArchiveActionButton } from '../../components/ui/ArchiveActionButton';
import { RolesPermissionsTab } from '../../components/settings/RolesPermissionsTab';
import { Building2, ArrowLeft, Save, Plus, MapPin, Shield, Trash2, Edit2, X, Archive, RotateCcw } from 'lucide-react';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const;

function endMonthFromStart(start: number) {
  return start === 1 ? 12 : start - 1;
}

function startMonthFromEnd(end: number) {
  return end === 12 ? 1 : end + 1;
}

function monthLabel(month: number) {
  return MONTHS.find(m => m.value === month)?.label ?? '';
}

function lastDayOfMonth(month: number) {
  return new Date(2024, month, 0).getDate();
}

export const OrganizationDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const isNew = id === 'new';

  const [activeTab, setActiveTab] = useState<'details' | 'branches' | 'policy'>(isNew ? 'details' : 'branches');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchForPermissions, setSelectedBranchForPermissions] = useState<any | null>(null);

  const [orgForm, setOrgForm] = useState({
    name: '',
    code: '',
    address: '',
    isActive: true,
  });

  const [policyForm, setPolicyForm] = useState({
    yearStartMonth: 11,
    yearEndMonth: 10,
    advanceNoticeDays: 2,
    maxConsecutiveLeaves: 14,
    sandwichRuleEnabled: true,
    defaultProbationDays: 90,
  });

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        setLoading(true);
        const orgId = parseInt(id || '0', 10);
        const [overviewRes, policyRes] = await Promise.allSettled([
          apiClient.get('/masters/overview'),
          apiClient.get('/masters/company-policy', { params: { organizationId: orgId } }),
        ]);

        const orgs = (overviewRes.status === 'fulfilled' && overviewRes.value.data?.organizations) || [];
        const org = orgs.find((o: any) => o.id === orgId);

        if (org) {
          setOrgForm({
            name: org.name,
            code: org.code || '',
            address: org.address || '',
            isActive: org.isActive !== false,
          });
          if (policyRes.status === 'fulfilled' && policyRes.value.data) {
            const p = policyRes.value.data;
            const start = p.yearStartMonth ?? 11;
            setPolicyForm({
              yearStartMonth: start,
              yearEndMonth: p.yearEndMonth ?? endMonthFromStart(start),
              advanceNoticeDays: p.advanceNoticeDays ?? 2,
              maxConsecutiveLeaves: p.maxConsecutiveLeaves ?? 14,
              sandwichRuleEnabled: p.sandwichRuleEnabled ?? true,
              defaultProbationDays: p.defaultProbationDays ?? 90,
            });
          }

          const orgBranches = (overviewRes.status === 'fulfilled' && overviewRes.value.data?.branches || [])
            .filter((b: any) => b.organizationId === org.id)
            .map((b: any) => ({
              id: b.id,
              organizationId: b.organizationId,
              name: b.name,
              code: b.code || '',
              address: b.address || '',
              city: b.city || '',
              state: b.state || '',
              latitude: b.latitude,
              longitude: b.longitude,
              radiusMeters: b.radiusMeters || 100,
              isActive: b.isActive !== false,
            }));
          setBranches(orgBranches);
        } else {
          showError('Not Found', 'Organization not found.');
          navigate('/settings?tab=company');
        }
      } catch (err) {
        showError('Error', 'Failed to load organization.');
      } finally {
        setLoading(false);
      }
    };

    if (id && id !== 'new') {
      fetchOrg();
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgForm.name) {
      showError('Validation', 'Organization Name is required.');
      return;
    }

    try {
      setSaving(true);
      if (id === 'new') {
        await apiClient.post('/masters/organizations', orgForm);
        showSuccess('Created', 'Organization created successfully.');
        navigate('/settings?tab=company');
      } else {
        await apiClient.put(`/masters/organizations/${id}`, { ...orgForm, id: parseInt(id!, 10) });
        showSuccess('Updated', 'Organization updated successfully.');
      }
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to save organization.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || isNew) return;

    try {
      setSaving(true);
      await apiClient.put('/masters/company-policy', {
        organizationId: parseInt(id, 10),
        yearStartMonth: policyForm.yearStartMonth,
        yearEndMonth: policyForm.yearEndMonth,
        advanceNoticeDays: policyForm.advanceNoticeDays,
        maxConsecutiveLeaves: policyForm.maxConsecutiveLeaves,
        sandwichRuleEnabled: policyForm.sandwichRuleEnabled,
        defaultProbationDays: policyForm.defaultProbationDays,
      });
      showSuccess('Saved', 'Company policies saved.');
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to save company policies.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBranch = async (branchId: number) => {
    try {
      await apiClient.delete(`/masters/branches/${branchId}`);
      setBranches(branches.filter(b => b.id !== branchId));
      showSuccess('Branch Deleted', 'Branch removed.');
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Server error');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-[var(--ink-muted)] text-xs font-data">Loading organization details...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings?tab=company')}
            className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--ink-muted)] transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-display font-semibold text-[var(--ink)] flex items-center gap-2">
              <Building2 className="text-[var(--gold-500)]" size={24} />
              {isNew ? 'New Organization' : orgForm.name}
            </h1>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Manage organization details, branches, and company policies.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-[var(--rule)] px-4">
          <button
            className={`px-4 py-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
              activeTab === 'details' ? 'border-[var(--gold-500)] text-[var(--gold-500)]' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
            onClick={() => setActiveTab('details')}
          >
            Organization Details
          </button>
          {!isNew && (
            <button
              className={`px-4 py-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
                activeTab === 'branches' ? 'border-[var(--gold-500)] text-[var(--gold-500)]' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setActiveTab('branches')}
            >
              Branches
            </button>
          )}
          {!isNew && (
            <button
              className={`px-4 py-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
                activeTab === 'policy' ? 'border-[var(--gold-500)] text-[var(--gold-500)]' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setActiveTab('policy')}
            >
              Company Policy
            </button>
          )}
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
              <div>
                <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Organization Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  placeholder="e.g. Acme Corp"
                  className="input-field w-full text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Registered Address</label>
                <textarea
                  value={orgForm.address}
                  onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                  placeholder="Full registered address"
                  className="input-field w-full text-sm min-h-[80px]"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={orgForm.isActive}
                  onChange={(e) => setOrgForm({ ...orgForm, isActive: e.target.checked })}
                  className="rounded border-[var(--rule)]"
                />
                <span className="font-medium text-sm text-[var(--ink)]">Organization is Active</span>
              </label>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/settings?tab=company')}
                  className="btn-secondary py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary py-2 px-6 flex items-center gap-2"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Organization'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'branches' && !isNew && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-[var(--ink)]">Branches</h3>
                  <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                    Sites and offices under this organization. Open a branch to edit details and attendance policy.
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/settings/branches/add?organizationId=${id}`)}
                  className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} /><span>Add Branch</span>
                </button>
              </div>

              {branches.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-[var(--ink-muted)] border border-dashed border-[var(--rule)] rounded-md">
                  <MapPin size={20} className="text-indigo-300" />
                  <span>No branches under <strong>{orgForm.name}</strong> yet.</span>
                  <button
                    onClick={() => navigate(`/settings/branches/add?organizationId=${id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 cursor-pointer transition-colors"
                  >
                    <Plus size={11} />Add First Branch
                  </button>
                </div>
              ) : (
                <div className="border border-[var(--rule)] rounded-md divide-y divide-[var(--rule)]">
                  {branches.map((branch) => (
                    <div key={branch.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--paper)]/60 transition-colors">
                      <div className="w-8 h-8 rounded-[3px] bg-[var(--navy-900)] text-[var(--gold-500)] flex items-center justify-center shrink-0">
                        <MapPin size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[var(--ink)]">{branch.name}</span>
                          {branch.isActive !== false
                            ? <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Active</span>
                            : <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 text-amber-800">Archived</span>
                          }
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[var(--ink-muted)]">
                          {branch.city && <span>{branch.city}{branch.state ? ', ' + branch.state : ''}</span>}
                          {branch.address && <span className="truncate max-w-xs">{branch.address}</span>}
                          {branch.latitude && <span className="font-data flex items-center gap-0.5"><MapPin size={9} className="text-indigo-400" />{Number(branch.latitude).toFixed(4)}, {Number(branch.longitude).toFixed(4)} ({branch.radiusMeters}m)</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <RowActionMenu actions={[
                          { label: 'Permissions', icon: <Shield size={14} />, onClick: () => setSelectedBranchForPermissions({ id: branch.id, name: branch.name, code: branch.code, orgName: orgForm.name }) },
                          { label: 'Edit Branch', icon: <Edit2 size={14} />, onClick: () => navigate(`/settings/branches/${branch.id}`) },
                          branch.isActive === false
                            ? { label: 'Restore', icon: <RotateCcw size={14} />, onClick: async () => { try { await apiClient.put(`/masters/branches/${branch.id}`, { ...branch, isActive: true }); setBranches(branches.map(b => b.id === branch.id ? { ...b, isActive: true } : b)); showSuccess('Restored', `${branch.name} restored.`); } catch (err: any) { showError('Error', err.response?.data?.message || 'Failed'); } }, variant: 'success', dividerBefore: true }
                            : { label: 'Archive', icon: <Archive size={14} />, onClick: async () => { try { await apiClient.put(`/masters/branches/${branch.id}`, { ...branch, isActive: false }); setBranches(branches.map(b => b.id === branch.id ? { ...b, isActive: false } : b)); showSuccess('Archived', `${branch.name} archived.`); } catch (err: any) { showError('Error', err.response?.data?.message || 'Failed'); } }, dividerBefore: true },
                          { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDeleteBranch(branch.id), variant: 'danger' },
                        ] as RowAction[]} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'policy' && (
            <form onSubmit={handleSavePolicy} className="space-y-4 max-w-3xl text-sm">
              <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-md">
                <h4 className="font-semibold text-[var(--ink)] mb-2 text-base">Company Year</h4>
                <p className="text-[var(--ink-muted)] mb-4">
                  Set the company year cycle used across this organization for rest, payroll, and other company-wide rules.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Year Start Month</label>
                    <select
                      value={policyForm.yearStartMonth}
                      onChange={(e) => {
                        const start = Number(e.target.value);
                        setPolicyForm({ ...policyForm, yearStartMonth: start, yearEndMonth: endMonthFromStart(start) });
                      }}
                      className="input-field w-full text-sm"
                    >
                      {MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-[var(--ink)] mb-1.5 text-xs">Year End Month</label>
                    <select
                      value={policyForm.yearEndMonth}
                      onChange={(e) => {
                        const end = Number(e.target.value);
                        setPolicyForm({ ...policyForm, yearEndMonth: end, yearStartMonth: startMonthFromEnd(end) });
                      }}
                      className="input-field w-full text-sm"
                    >
                      {MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-[var(--ink-muted)] mt-3">
                  Company year runs from <span className="font-medium text-[var(--ink)]">1 {monthLabel(policyForm.yearStartMonth)}</span>
                  {' '}to{' '}
                  <span className="font-medium text-[var(--ink)]">{lastDayOfMonth(policyForm.yearEndMonth)} {monthLabel(policyForm.yearEndMonth)}</span>.
                </p>
              </div>

              <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-md">
                <h4 className="font-semibold text-[var(--ink)] mb-2 text-base">Leave Application Rules</h4>
                <p className="text-[var(--ink-muted)] mb-4">Configure global constraints for employee leave applications across this organization.</p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-medium text-[var(--ink)] block">Advance Notice Required</span>
                      <span className="text-xs text-[var(--ink-muted)] block">Minimum days in advance an employee must apply for leave.</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={policyForm.advanceNoticeDays}
                      onChange={(e) => setPolicyForm({ ...policyForm, advanceNoticeDays: Number(e.target.value) })}
                      className="input-field w-24 text-center font-data"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-medium text-[var(--ink)] block">Max Consecutive Leaves</span>
                      <span className="text-xs text-[var(--ink-muted)] block">Maximum number of days an employee can take continuously.</span>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={policyForm.maxConsecutiveLeaves}
                      onChange={(e) => setPolicyForm({ ...policyForm, maxConsecutiveLeaves: Number(e.target.value) })}
                      className="input-field w-24 text-center font-data"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-md">
                <h4 className="font-semibold text-[var(--ink)] mb-2 text-base">Sandwich Leave Rule</h4>
                <p className="text-[var(--ink-muted)] mb-4">
                  When enabled, if an employee takes leave on both sides of a weekoff (e.g., Friday &amp; Monday),
                  the weekoff days in between are automatically counted as leave instead of regular days off.
                </p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyForm.sandwichRuleEnabled}
                    onChange={(e) => setPolicyForm({ ...policyForm, sandwichRuleEnabled: e.target.checked })}
                    className="rounded border-[var(--rule)] w-4 h-4"
                  />
                  <span className="font-medium text-[var(--ink)]">Enforce Sandwich Leave Rule</span>
                </label>
              </div>

              <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-md">
                <h4 className="font-semibold text-[var(--ink)] mb-2 text-base">Probation & Confirmation</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-medium text-[var(--ink)] block">Default Probation Period (Days)</span>
                      <span className="text-xs text-[var(--ink-muted)] block">Standard probation length for new hires.</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={policyForm.defaultProbationDays}
                      onChange={(e) => setPolicyForm({ ...policyForm, defaultProbationDays: Number(e.target.value) })}
                      className="input-field w-24 text-center font-data"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={saving} className="btn-primary py-2 px-6 flex items-center gap-2">
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Policies'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {selectedBranchForPermissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--rule)] bg-[var(--paper)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[3px] bg-[var(--navy-900)] text-[var(--gold-500)] flex items-center justify-center font-bold text-xs shrink-0">
                  <Shield size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold text-base text-[var(--ink)]">
                      {selectedBranchForPermissions.name}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60">
                      Branch • {selectedBranchForPermissions.orgName || 'Organization'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-muted)] font-ui mt-0.5">
                    Branch-level Roles, Custom Profiles & Granular Data Scopes
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBranchForPermissions(null)}
                className="p-1.5 rounded text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer hover:bg-[var(--surface)] transition-colors"
                title="Close Modal"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-[var(--surface)]">
              <RolesPermissionsTab />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

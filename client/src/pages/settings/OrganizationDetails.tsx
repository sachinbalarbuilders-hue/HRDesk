import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { ArchiveActionButton } from '../../components/ui/ArchiveActionButton';
import { RolesPermissionsTab } from '../../components/settings/RolesPermissionsTab';
import { Building2, ArrowLeft, Save, Plus, MapPin, Shield, Trash2, Edit2, X } from 'lucide-react';

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

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/masters/overview');
        const orgs = res.data.organizations || [];
        const org = orgs.find((o: any) => o.id === parseInt(id || '0', 10));

        if (org) {
          setOrgForm({
            name: org.name,
            code: org.code || '',
            address: org.address || '',
            isActive: org.isActive !== false,
          });
          const orgBranches = (res.data.branches || [])
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
              <Building2 className="text-indigo-600" size={24} />
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
              activeTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
            onClick={() => setActiveTab('details')}
          >
            Organization Details
          </button>
          {!isNew && (
            <button
              className={`px-4 py-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
                activeTab === 'branches' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setActiveTab('branches')}
            >
              Branches
            </button>
          )}
          {!isNew && (
            <button
              className={`px-4 py-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
                activeTab === 'policy' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
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
                      <div className="w-8 h-8 rounded-[3px] bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0">
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
                        <button
                          onClick={() => setSelectedBranchForPermissions({ id: branch.id, name: branch.name, code: branch.code, orgName: orgForm.name })}
                          className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--ink-muted)] hover:text-indigo-600 cursor-pointer transition-colors"
                          title="Branch Roles & Permissions"
                        >
                          <Shield size={13} />
                        </button>
                        <button
                          onClick={() => navigate(`/settings/branches/${branch.id}`)}
                          className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--gold-500)] cursor-pointer transition-colors"
                          title="Branch Settings"
                        >
                          <Edit2 size={13} />
                        </button>
                        <ArchiveActionButton
                          isArchived={branch.isActive === false}
                          onArchive={async () => { try { await apiClient.put(`/masters/branches/${branch.id}`, { ...branch, isActive: false }); setBranches(branches.map(b => b.id === branch.id ? { ...b, isActive: false } : b)); showSuccess('Archived', `${branch.name} archived.`); } catch (err: any) { showError('Error', err.response?.data?.message || 'Failed'); } }}
                          onRestore={async () => { try { await apiClient.put(`/masters/branches/${branch.id}`, { ...branch, isActive: true }); setBranches(branches.map(b => b.id === branch.id ? { ...b, isActive: true } : b)); showSuccess('Restored', `${branch.name} restored.`); } catch (err: any) { showError('Error', err.response?.data?.message || 'Failed'); } }}
                          itemName={branch.name}
                        />
                        <button onClick={() => handleDeleteBranch(branch.id)} className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--ink-muted)] hover:text-rose-600 cursor-pointer transition-colors" title="Delete Branch"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'policy' && (
            <div className="space-y-4 max-w-3xl text-sm">
              <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-md">
                <h4 className="font-semibold text-[var(--ink)] mb-2 text-base">Leave Application Rules</h4>
                <p className="text-[var(--ink-muted)] mb-4">Configure global constraints for employee leave applications across this organization.</p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-[var(--ink)] block">Advance Notice Required</span>
                      <span className="text-xs text-[var(--ink-muted)] block">Minimum days in advance an employee must apply for leave.</span>
                    </div>
                    <input type="number" defaultValue={2} className="input-field w-24 text-center font-data" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-[var(--ink)] block">Max Consecutive Leaves</span>
                      <span className="text-xs text-[var(--ink-muted)] block">Maximum number of days an employee can take continuously.</span>
                    </div>
                    <input type="number" defaultValue={14} className="input-field w-24 text-center font-data" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[var(--paper)] border border-[var(--rule)] rounded-md">
                <h4 className="font-semibold text-[var(--ink)] mb-2 text-base">Probation & Confirmation</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-[var(--ink)] block">Default Probation Period (Days)</span>
                      <span className="text-xs text-[var(--ink-muted)] block">Standard probation length for new hires.</span>
                    </div>
                    <input type="number" defaultValue={90} className="input-field w-24 text-center font-data" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button className="btn-primary py-2 px-6 flex items-center gap-2">
                  <Save size={16} /> Save Policies
                </button>
              </div>
            </div>
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

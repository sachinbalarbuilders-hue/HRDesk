import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  ChevronDown,
  ChevronRight,
  Check,
  Lock,
  Shield,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

export const RolesPermissionsTab: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [roles, setRoles] = useState<any[]>([]);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roleDetail, setRoleDetail] = useState<any>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedSuccessKey, setSavedSuccessKey] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Add Custom Role Modal
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const fetchRolesAndDefinitions = async () => {
    try {
      const [rolesRes, defsRes] = await Promise.all([
        apiClient.get('/roles'),
        apiClient.get('/roles/definitions'),
      ]);
      setRoles(rolesRes.data || []);
      setDefinitions(defsRes.data || []);

      if (rolesRes.data?.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesRes.data[0].id);
      }
    } catch (err: any) {
      showError('Failed to load roles', err.response?.data?.message || 'Network error');
    }
  };

  const fetchRoleDetail = async (id: number) => {
    try {
      const res = await apiClient.get(`/roles/${id}`);
      setRoleDetail(res.data);
    } catch (err: any) {
      showError('Failed to load role details', err.response?.data?.message || 'Network error');
    }
  };

  useEffect(() => {
    fetchRolesAndDefinitions();
  }, []);

  useEffect(() => {
    if (selectedRoleId) {
      fetchRoleDetail(selectedRoleId);
    }
  }, [selectedRoleId]);

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) => ({ ...prev, [moduleName]: !prev[moduleName] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    definitions.forEach((d) => (all[d.module] = true));
    setExpandedModules(all);
  };

  const collapseAll = () => {
    setExpandedModules({});
  };

  const handleTogglePermission = async (permissionKey: string, currentGranted: boolean, defaultScope: string) => {
    if (!selectedRoleId || roleDetail?.role?.isSystemRole) return;

    const newGranted = !currentGranted;
    const currentScope = roleDetail?.scopes?.[permissionKey] || defaultScope;

    try {
      setSavingKey(permissionKey);
      await apiClient.put(`/roles/${selectedRoleId}/permission`, {
        permissionKey,
        isGranted: newGranted,
        scope: currentScope,
      });

      // Update local state
      setRoleDetail((prev: any) => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permissionKey]: newGranted,
        },
        scopes: {
          ...prev.scopes,
          [permissionKey]: currentScope,
        },
      }));

      setSavedSuccessKey(permissionKey);
      setTimeout(() => setSavedSuccessKey(null), 1500);
      showSuccess('Permission Updated', `${permissionKey} is now ${newGranted ? 'Granted' : 'Revoked'}.`);
    } catch (err: any) {
      showError('Save Failed', err.response?.data?.message || 'Could not update permission');
    } finally {
      setSavingKey(null);
    }
  };

  const handleScopeChange = async (permissionKey: string, newScope: string) => {
    if (!selectedRoleId || roleDetail?.role?.isSystemRole) return;

    try {
      setSavingKey(permissionKey);
      await apiClient.put(`/roles/${selectedRoleId}/permission`, {
        permissionKey,
        isGranted: true,
        scope: newScope,
      });

      setRoleDetail((prev: any) => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permissionKey]: true,
        },
        scopes: {
          ...prev.scopes,
          [permissionKey]: newScope,
        },
      }));

      setSavedSuccessKey(permissionKey);
      setTimeout(() => setSavedSuccessKey(null), 1500);
      showSuccess('Scope Updated', `${permissionKey} scoped to: ${newScope}`);
    } catch (err: any) {
      showError('Scope Change Failed', err.response?.data?.message || 'Could not update scope');
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    try {
      const res = await apiClient.post('/roles', {
        name: newRoleName.trim(),
        description: newRoleDesc.trim(),
      });
      showSuccess('Role Created', `Custom role "${newRoleName}" added successfully.`);
      setCreateRoleModalOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      fetchRolesAndDefinitions();
      if (res.data?.id) setSelectedRoleId(res.data.id);
    } catch (err: any) {
      showError('Create Role Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleDeleteRole = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete role "${name}"?`)) return;
    try {
      await apiClient.delete(`/roles/${id}`);
      showSuccess('Role Deleted', `Role "${name}" removed.`);
      fetchRolesAndDefinitions();
      setSelectedRoleId(null);
    } catch (err: any) {
      showError('Delete Failed', err.response?.data?.message || 'Could not delete role');
    }
  };

  return (
    <div className="space-y-6 font-ui">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Roles List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--rule)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] font-ui flex items-center gap-1.5">
              <Shield size={14} className="text-[var(--gold-500)]" />
              <span>Roles & Profiles</span>
            </span>
            <button
              onClick={() => setCreateRoleModalOpen(true)}
              className="btn-primary text-[11px] py-1 px-2 flex items-center gap-1 cursor-pointer"
              title="Create Custom Role"
            >
              <Plus size={12} />
              <span>Add Role</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {roles.map((role) => {
              const isSelected = selectedRoleId === role.id;

              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full p-3 rounded-[4px] text-left transition-all flex items-center justify-between cursor-pointer border relative ${
                    isSelected
                      ? 'bg-[var(--surface)] border-[var(--gold-500)] shadow-xs'
                      : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--rule)] hover:border-[var(--ink-muted)]'
                  }`}
                >
                  {/* Left-edge gold active indicator */}
                  {isSelected && (
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--gold-500)] rounded-l-[4px]" />
                  )}

                  <div className="pl-1">
                    <p className="text-xs font-semibold text-[var(--ink)]">
                      {role.name}
                    </p>
                    <p className="text-[10px] font-data text-[var(--ink-muted)] mt-0.5">
                      {role.isSystemRole ? 'System Built-in' : 'Custom Configured'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded-[2px] text-[10px] font-data font-semibold bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink-muted)]">
                      {role.userCount || 0} users
                    </span>
                    {!role.isSystemRole && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(role.id, role.name);
                        }}
                        className="p-1 text-[var(--ink-muted)] hover:text-rose-600 rounded"
                        title="Delete Role"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Permissions Matrix & Scopes */}
        <div className="lg:col-span-3 space-y-4">
          {/* Active Role Card Header */}
          <div className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
                  {roleDetail?.role?.name || 'Loading role...'}
                </h2>
                {roleDetail?.role?.isSystemRole && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[var(--gold-100)] text-[var(--gold-500)] text-[10px] font-data font-bold border border-[var(--gold-500)]/40">
                    <Lock size={10} />
                    System Protected
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                {roleDetail?.role?.description || 'All permission and data scope switches auto-save in real time.'}
              </p>
            </div>

            {/* Expand / Collapse Controls */}
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={expandAll}
                className="btn-outline py-1 px-2.5 text-[11px] cursor-pointer"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="btn-outline py-1 px-2.5 text-[11px] cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Module Permission Groups Accordions */}
          <div className="space-y-3">
            {definitions.map((defGroup) => {
              const isExpanded = expandedModules[defGroup.module] ?? true;

              return (
                <div
                  key={defGroup.module}
                  className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] overflow-hidden"
                >
                  <button
                    onClick={() => toggleModule(defGroup.module)}
                    className="w-full px-4 py-3 bg-[var(--paper)] flex items-center justify-between cursor-pointer border-b border-[var(--rule)]/60 text-left hover:bg-[var(--surface)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-[var(--gold-500)]" />
                      ) : (
                        <ChevronRight size={14} className="text-[var(--ink-muted)]" />
                      )}
                      <span className="font-semibold text-xs text-[var(--ink)]">
                        {defGroup.module} Module
                      </span>
                    </div>

                    <span className="text-[10px] font-data text-[var(--ink-muted)]">
                      {defGroup.permissions.length} granular actions
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-[var(--rule)]/50">
                      {defGroup.permissions.map((perm: any) => {
                        const isGranted = roleDetail?.permissions?.[perm.key] ?? false;
                        const currentScope = roleDetail?.scopes?.[perm.key] || perm.defaultScope;
                        const isSaving = savingKey === perm.key;
                        const isSuccess = savedSuccessKey === perm.key;
                        const isSystem = roleDetail?.role?.isSystemRole;

                        return (
                          <div
                            key={perm.key}
                            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--paper)]/40 transition-colors"
                          >
                            <div className="space-y-0.5 flex-1 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-[var(--ink)]">
                                  {perm.name}
                                </span>
                                <span className="text-[10px] font-mono text-[var(--ink-muted)] bg-[var(--paper)] px-1.5 py-0.2 rounded border border-[var(--rule)]">
                                  {perm.key}
                                </span>
                                {isSuccess && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 animate-in fade-in">
                                    <Check size={10} /> Saved
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[var(--ink-muted)]">
                                {perm.description}
                              </p>
                            </div>

                            {/* Scope Selector & Grant Checkbox */}
                            <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
                              {/* Scoping Selector (if scoped action) */}
                              {perm.hasScope && (
                                <select
                                  disabled={!isGranted || isSystem || isSaving}
                                  value={currentScope}
                                  onChange={(e) => handleScopeChange(perm.key, e.target.value)}
                                  className="text-xs font-data px-2 py-1 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink)] focus:outline-none disabled:opacity-40 cursor-pointer"
                                >
                                  <option value="All">All Records (Global)</option>
                                  <option value="Department">Department Only</option>
                                  <option value="Reporting">Direct Reports</option>
                                  <option value="Own">Self Only</option>
                                </select>
                              )}

                              {/* Toggle Grant Switch */}
                              <button
                                disabled={isSystem || isSaving}
                                onClick={() => handleTogglePermission(perm.key, isGranted, perm.defaultScope)}
                                className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                  isGranted ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                                }`}
                              >
                                <div
                                  className={`w-3 h-3 rounded-full bg-white transition-transform ${
                                    isGranted ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Custom Role Modal */}
      {createRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <Shield size={16} className="text-[var(--gold-500)]" />
                <span>Create Custom Role</span>
              </h3>
              <button onClick={() => setCreateRoleModalOpen(false)} className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Role Name *</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Site Supervisor"
                  className="register-input w-full"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--ink)] mb-1">Description</label>
                <textarea
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Describe the permissions & access scope for this role..."
                  rows={3}
                  className="register-input w-full"
                />
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button type="button" onClick={() => setCreateRoleModalOpen(false)} className="btn-secondary py-1.5 px-3 text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 text-xs">
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

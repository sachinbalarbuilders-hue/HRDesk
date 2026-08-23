import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { SearchableSelect } from '../ui/SearchableSelect';
import {
  ChevronDown,
  ChevronUp,
  Check,
  Lock,
  Shield,
  Plus,
  Trash2,
  X,
  Users,
  Calendar,
  Palmtree,
  CreditCard,
  Building,
  Clock,
  UserCheck,
  Settings,
  Eye,
  Layers,
} from 'lucide-react';

interface RolesPermissionsTabProps {
  branchPublicId?: string;
  branchName?: string;
}

export const RolesPermissionsTab: React.FC<RolesPermissionsTabProps> = ({
  branchPublicId,
  branchName,
}) => {
  const { showSuccess, showError } = useToast();
  const [roles, setRoles] = useState<any[]>([]);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [selectedRolePublicId, setSelectedRolePublicId] = useState<string | null>(null);
  const [roleDetail, setRoleDetail] = useState<any>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedSuccessKey, setSavedSuccessKey] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Add Custom Role Modal
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Field Restrictions Modal / State
  const [fieldModalModule, setFieldModalModule] = useState<string | null>(null);

  const fetchRolesAndDefinitions = async () => {
    try {
      const url = branchPublicId ? `/roles?branchId=${branchPublicId}` : '/roles';
      const [rolesRes, defsRes] = await Promise.all([
        apiClient.get(url),
        apiClient.get('/roles/definitions'),
      ]);
      setRoles(rolesRes.data || []);
      setDefinitions(defsRes.data || []);

      if (rolesRes.data?.length > 0) {
        if (!selectedRolePublicId || !rolesRes.data.some((r: any) => r.publicId === selectedRolePublicId)) {
          setSelectedRolePublicId(rolesRes.data[0].publicId);
        }
      }
    } catch (err: any) {
      showError('Failed to load roles', err.response?.data?.message || 'Network error');
    }
  };

  const fetchRoleDetail = async (publicId: string) => {
    try {
      const res = await apiClient.get(`/roles/${publicId}`);
      setRoleDetail(res.data);
    } catch (err: any) {
      showError('Failed to load role details', err.response?.data?.message || 'Network error');
    }
  };

  useEffect(() => {
    fetchRolesAndDefinitions();
  }, [branchPublicId]);

  useEffect(() => {
    if (selectedRolePublicId) {
      fetchRoleDetail(selectedRolePublicId);
    }
  }, [selectedRolePublicId]);

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleName]: prev[moduleName] === undefined ? false : !prev[moduleName],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    definitions.forEach((d) => (all[d.module] = true));
    setExpandedModules(all);
  };

  const collapseAll = () => {
    const all: Record<string, boolean> = {};
    definitions.forEach((d) => (all[d.module] = false));
    setExpandedModules(all);
  };

  const handleScopeChange = async (permKey: string, newScope: string, currentSubs?: string[]) => {
    if (!selectedRolePublicId || roleDetail?.isSystemRole) return;

    try {
      setSavingKey(permKey);
      await apiClient.put(`/roles/${selectedRolePublicId}/permission`, {
        permissionKey: permKey,
        isGranted: true,
        scope: newScope,
        subRestrictions: currentSubs || roleDetail?.subRestrictions?.[permKey] || [],
      });

      setRoleDetail((prev: any) => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permKey]: true,
        },
        scopes: {
          ...prev.scopes,
          [permKey]: newScope,
        },
      }));

      setSavedSuccessKey(permKey);
      setTimeout(() => setSavedSuccessKey(null), 1500);
      showSuccess('Saved', `Scope set to "${newScope}"`);
    } catch (err: any) {
      showError('Save Failed', err.response?.data?.message || 'Could not update scope');
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleSubRestriction = async (permKey: string, subName: string) => {
    if (!selectedRolePublicId || roleDetail?.isSystemRole) return;

    const currentSubs: string[] = roleDetail?.subRestrictions?.[permKey] || [];
    const newSubs = currentSubs.includes(subName)
      ? currentSubs.filter((s) => s !== subName)
      : [...currentSubs, subName];

    const currentScope = roleDetail?.scopes?.[permKey] || 'Own Branch';

    try {
      setSavingKey(permKey);
      await apiClient.put(`/roles/${selectedRolePublicId}/permission`, {
        permissionKey: permKey,
        isGranted: true,
        scope: currentScope,
        subRestrictions: newSubs,
      });

      setRoleDetail((prev: any) => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permKey]: true,
        },
        subRestrictions: {
          ...prev.subRestrictions,
          [permKey]: newSubs,
        },
      }));

      setSavedSuccessKey(permKey);
      setTimeout(() => setSavedSuccessKey(null), 1500);
      showSuccess('Saved', `Updated sub-restrictions for ${subName}`);
    } catch (err: any) {
      showError('Save Failed', err.response?.data?.message || 'Could not update restriction');
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleSimplePermission = async (permKey: string, currentGranted: boolean, defaultScope: string) => {
    if (!selectedRolePublicId || roleDetail?.isSystemRole) return;

    const newGranted = !currentGranted;
    const currentScope = roleDetail?.scopes?.[permKey] || defaultScope;

    try {
      setSavingKey(permKey);
      await apiClient.put(`/roles/${selectedRolePublicId}/permission`, {
        permissionKey: permKey,
        isGranted: newGranted,
        scope: currentScope,
        subRestrictions: roleDetail?.subRestrictions?.[permKey] || [],
      });

      setRoleDetail((prev: any) => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permKey]: newGranted,
        },
        scopes: {
          ...prev.scopes,
          [permKey]: currentScope,
        },
      }));

      setSavedSuccessKey(permKey);
      setTimeout(() => setSavedSuccessKey(null), 1500);
      showSuccess('Permission Updated', `${permKey} is now ${newGranted ? 'Granted' : 'Revoked'}.`);
    } catch (err: any) {
      showError('Save Failed', err.response?.data?.message || 'Could not update permission');
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
        branchId: branchPublicId || null,
      });
      showSuccess('Role Created', `Role "${newRoleName}" added successfully.`);
      setCreateRoleModalOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      await fetchRolesAndDefinitions();
      if (res.data?.publicId) setSelectedRolePublicId(res.data.publicId);
    } catch (err: any) {
      showError('Create Role Failed', err.response?.data?.message || 'Server error');
    }
  };

  const handleDeleteRole = async (publicId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete role "${name}"?`)) return;
    try {
      await apiClient.delete(`/roles/${publicId}`);
      showSuccess('Role Deleted', `Role "${name}" removed.`);
      await fetchRolesAndDefinitions();
    } catch (err: any) {
      showError('Delete Failed', err.response?.data?.message || 'Could not delete role');
    }
  };

  const getModuleIcon = (moduleName: string) => {
    switch (moduleName) {
      case 'Employees':
        return <Users size={16} className="text-indigo-600 dark:text-indigo-400" />;
      case 'Attendance':
        return <Calendar size={16} className="text-amber-600 dark:text-amber-400" />;
      case 'Leaves & Comp-Off':
        return <Palmtree size={16} className="text-emerald-600 dark:text-emerald-400" />;
      case 'Payroll & Loans':
        return <CreditCard size={16} className="text-blue-600 dark:text-blue-400" />;
      case 'Masters & Structure':
        return <Building size={16} className="text-purple-600 dark:text-purple-400" />;
      case 'Shifts & Schedule':
        return <Clock size={16} className="text-orange-600 dark:text-orange-400" />;
      case 'Recruitment':
        return <UserCheck size={16} className="text-teal-600 dark:text-teal-400" />;
      case 'System & Settings':
        return <Settings size={16} className="text-slate-600 dark:text-slate-400" />;
      default:
        return <Layers size={16} className="text-indigo-500" />;
    }
  };

  return (
    <div className="space-y-6 font-ui">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Roles Selector Sidebar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--rule)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] font-ui flex items-center gap-1.5">
              <Shield size={14} className="text-[var(--gold-500)]" />
              <span>Roles & Profiles</span>
            </span>
            <button
              onClick={() => setCreateRoleModalOpen(true)}
              className="btn-primary text-[11px] py-1 px-2.5 flex items-center gap-1 cursor-pointer"
              title="Create Custom Role"
            >
              <Plus size={12} />
              <span>Add Role</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {roles.map((role) => {
              const isSelected = selectedRolePublicId === role.publicId;

              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRolePublicId(role.publicId)}
                  className={`w-full p-3 rounded-[6px] text-left transition-all flex items-center justify-between cursor-pointer border relative ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500 shadow-xs'
                      : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--rule)] hover:border-[var(--ink-muted)]'
                  }`}
                >
                  {/* Left-edge active indicator */}
                  {isSelected && (
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 dark:bg-indigo-400 rounded-l-[6px]" />
                  )}

                  <div className="pl-1.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-[var(--ink)]">
                        {role.name}
                      </p>
                      {role.isBranchSpecific && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                          Branch
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-data text-[var(--ink-muted)] mt-0.5">
                      {role.isSystemRole
                        ? 'System Built-in'
                        : role.isBranchSpecific
                        ? `Branch: ${role.branchName}`
                        : 'Organization Global'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-data font-semibold bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink-muted)]">
                      {role.userCount || 0} users
                    </span>
                    {!role.isSystemRole && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(role.publicId, role.name);
                        }}
                        className="p-1 text-[var(--ink-muted)] hover:text-rose-600 rounded cursor-pointer"
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

        {/* Right Column: Module Permission Cards & Scopes (Matching Reference) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Active Role Info Header */}
          <div className="p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-semibold text-[var(--ink)]">
                  {roleDetail?.name || 'Loading role...'}
                </h2>
                {roleDetail?.isSystemRole ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--gold-100)] text-[var(--gold-500)] text-[10px] font-data font-bold border border-[var(--gold-500)]/40">
                    <Lock size={10} />
                    System Protected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-data font-bold border border-emerald-200 dark:border-emerald-900/60">
                    Custom Configurable
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                {roleDetail?.description ||
                  `Configure granular data scopes (View, Create, Edit, Delete) and restrictions for ${branchName || 'this branch'}.`}
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

          {/* Module Permission Cards */}
          <div className="space-y-4">
            {definitions.map((defGroup) => {
              const isExpanded = expandedModules[defGroup.module] ?? true;
              const isSystem = roleDetail?.isSystemRole;

              // Separate scoped permissions vs simple boolean toggle permissions
              const scopedPerms = defGroup.permissions.filter((p: any) => p.supportsScope && p.scopeOptions);
              const togglePerms = defGroup.permissions.filter((p: any) => !p.supportsScope || !p.scopeOptions);

              // Sub-sections from first permission in module that defines them (e.g. Employees.View)
              const moduleSubSections: string[] =
                defGroup.permissions.find((p: any) => p.subSections)?.subSections || [];

              return (
                <div
                  key={defGroup.module}
                  className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg overflow-hidden shadow-xs transition-shadow"
                >
                  {/* Module Header (e.g. ^ 👥 Employees) */}
                  <button
                    onClick={() => toggleModule(defGroup.module)}
                    className="w-full px-4 py-3 bg-[var(--paper)] flex items-center justify-between cursor-pointer border-b border-[var(--rule)]/60 text-left hover:bg-[var(--surface)] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ChevronDown size={16} className="text-[var(--ink-muted)]" />
                      )}
                      {getModuleIcon(defGroup.module)}
                      <span className="font-semibold text-sm text-[var(--ink)]">
                        {defGroup.module}
                      </span>
                    </div>

                    <span className="text-[10px] font-data text-[var(--ink-muted)]">
                      {defGroup.permissions.length} granular rules
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="p-5 space-y-4">
                      {/* Scoped Actions (View Scope, Create Scope, Edit Scope, Delete Scope) */}
                      {scopedPerms.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">
                          {scopedPerms.map((perm: any) => {
                            const currentScope =
                              roleDetail?.scopes?.[perm.key] || perm.defaultScope || 'Own Branch';
                            const isSaving = savingKey === perm.key;
                            const isSuccess = savedSuccessKey === perm.key;

                            return (
                              <div
                                key={perm.key}
                                className="flex items-center justify-between gap-3 py-1"
                              >
                                <div className="flex items-center gap-2 min-w-[120px]">
                                  <label className="text-xs font-medium text-[var(--ink)]">
                                    {perm.displayName} :
                                  </label>
                                  {isSuccess && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 animate-in fade-in">
                                      <Check size={10} />
                                    </span>
                                  )}
                                </div>

                                <SearchableSelect
                                  disabled={isSystem || isSaving}
                                  value={currentScope}
                                  options={perm.scopeOptions}
                                  onChange={(newScope) => handleScopeChange(perm.key, newScope)}
                                  className="w-full max-w-[220px]"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Restricted Sub-sections (Checkboxes) matching Reference */}
                      {moduleSubSections.length > 0 && (
                        <div className="pt-3 border-t border-[var(--rule)]/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-[var(--ink)]">
                              Restricted Sub-sections :
                            </label>
                            <button
                              type="button"
                              onClick={() => setFieldModalModule(defGroup.module)}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-black text-white dark:bg-white dark:text-black text-[10px] font-medium hover:opacity-85 transition-opacity cursor-pointer"
                            >
                              <Eye size={11} />
                              <span>view</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 pt-1">
                            {moduleSubSections.map((subName) => {
                              // Use primary permission key for sub-restrictions (e.g. Employees.View)
                              const primaryPermKey = defGroup.permissions[0]?.key || '';
                              const activeSubs: string[] =
                                roleDetail?.subRestrictions?.[primaryPermKey] || [];
                              const isChecked = activeSubs.includes(subName);

                              return (
                                <label
                                  key={subName}
                                  className={`flex items-center gap-1.5 text-xs select-none p-1 rounded transition-colors ${
                                    isSystem
                                      ? 'opacity-60 cursor-not-allowed text-[var(--ink-muted)]'
                                      : 'cursor-pointer hover:text-indigo-600 text-[var(--ink)]'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={isSystem}
                                    checked={isChecked}
                                    onChange={() =>
                                      handleToggleSubRestriction(primaryPermKey, subName)
                                    }
                                    className="rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5"
                                  />
                                  <span className="text-[11px] font-medium">{subName}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Simple Boolean Permissions (Toggles) */}
                      {togglePerms.length > 0 && (
                        <div className="pt-3 border-t border-[var(--rule)]/60 space-y-2">
                          <span className="text-[11px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">
                            Additional Module Capabilities
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {togglePerms.map((perm: any) => {
                              const isGranted = roleDetail?.permissions?.[perm.key] ?? false;
                              const isSaving = savingKey === perm.key;

                              return (
                                <div
                                  key={perm.key}
                                  className="flex items-center justify-between p-2.5 rounded border border-[var(--rule)] bg-[var(--paper)]/50"
                                >
                                  <div className="pr-3">
                                    <p className="text-xs font-semibold text-[var(--ink)]">
                                      {perm.displayName}
                                    </p>
                                    <p className="text-[10px] text-[var(--ink-muted)]">
                                      {perm.description}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={isSystem || isSaving}
                                    onClick={() =>
                                      handleToggleSimplePermission(
                                        perm.key,
                                        isGranted,
                                        perm.defaultScope || 'Own Branch'
                                      )
                                    }
                                    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                                      isGranted
                                        ? 'bg-emerald-600'
                                        : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                  >
                                    <div
                                      className={`w-3 h-3 rounded-full bg-white transition-transform ${
                                        isGranted ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Field Restriction Modal */}
      {fieldModalModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <Eye size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span>Field Restrictions — {fieldModalModule}</span>
              </h3>
              <button
                onClick={() => setFieldModalModule(null)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Check specific tabs and sub-sections to restrict access for users assigned to this role within{' '}
              <span className="font-semibold text-[var(--ink)]">{branchName || 'this branch'}</span>.
            </p>

            <div className="p-3 bg-[var(--paper)] rounded border border-[var(--rule)] text-xs text-[var(--ink)] space-y-2">
              <div className="font-semibold text-indigo-700 dark:text-indigo-300">
                Active Branch Configuration
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-[var(--ink-muted)]">
                <li>Checked sub-sections are restricted / masked for this role.</li>
                <li>All changes auto-save in real time without requiring a server restart.</li>
              </ul>
            </div>

            <div className="pt-3 border-t border-[var(--rule)] flex justify-end">
              <button
                type="button"
                onClick={() => setFieldModalModule(null)}
                className="btn-primary py-1.5 px-4 text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Role Modal */}
      {createRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
                <Shield size={16} className="text-[var(--gold-500)]" />
                <span>Create {branchName ? `Branch Role (${branchName})` : 'Custom Role'}</span>
              </h3>
              <button
                onClick={() => setCreateRoleModalOpen(false)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
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
                  placeholder="Describe the access scope and responsibilities for this branch role..."
                  rows={3}
                  className="register-input w-full"
                />
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateRoleModalOpen(false)}
                  className="btn-secondary py-1.5 px-3 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-1.5 px-4 text-xs cursor-pointer">
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

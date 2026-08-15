import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import {
  ChevronDown,
  ChevronRight,
  Check,
  Lock,
  Shield
} from 'lucide-react';

export const Roles: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [roles, setRoles] = useState<any[]>([]);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roleDetail, setRoleDetail] = useState<any>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedSuccessKey, setSavedSuccessKey] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const fetchRolesAndDefinitions = async () => {
    try {
      const [rolesRes, defsRes] = await Promise.all([
        apiClient.get('/roles'),
        apiClient.get('/roles/definitions'),
      ]);
      setRoles(rolesRes.data);
      setDefinitions(defsRes.data);

      if (rolesRes.data.length > 0 && !selectedRoleId) {
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

  return (
    <div className="space-y-6 font-ui">
      {/* 1. Header with Display Serif and Divider */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
              Roles & Permissions
            </h1>
            <p className="text-xs text-[var(--ink-muted)] font-ui mt-0.5">
              Access control matrix & row-level data scoping rules (All, Reporting, Department, Own)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-data text-[var(--ink-muted)]">
              {roles.length} Roles Configured
            </span>
          </div>
        </div>

        {/* Signature Divider */}
        <div className="register-rule pt-1" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Roles List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-[var(--rule)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] font-ui">
              System Roles
            </span>
            <Shield size={14} className="text-[var(--ink-muted)]" />
          </div>

          <div className="space-y-1.5">
            {roles.map((role) => {
              const isSelected = selectedRoleId === role.id;

              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full p-3 rounded-[4px] text-left transition-all flex items-center justify-between cursor-pointer border relative ${
                    isSelected
                      ? 'bg-[var(--surface)] border-[var(--gold-500)] shadow-sm'
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

                  <div className="px-1.5 py-0.5 rounded-[2px] text-[10px] font-data font-semibold bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink-muted)]">
                    {role.userCount} users
                  </div>
                </button>
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
                  {roleDetail?.name || 'Loading role...'}
                </h2>
                {roleDetail?.isSystemRole && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[var(--gold-100)] text-[var(--gold-500)] text-[10px] font-data font-bold border border-[var(--gold-500)]/40">
                    <Lock size={10} />
                    System Protected
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                {roleDetail?.description || 'All permission and data scope switches auto-save in real time.'}
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

          {/* Module Accordions */}
          <div className="space-y-3">
            {definitions.map((def) => {
              const isExpanded = expandedModules[def.module] ?? true;
              const modulePerms = def.permissions || [];
              const grantedCount = modulePerms.filter(
                (p: any) => roleDetail?.permissions?.[p.key]
              ).length;

              return (
                <div
                  key={def.module}
                  className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] overflow-hidden"
                >
                  {/* Module Header Bar */}
                  <div
                    onClick={() => toggleModule(def.module)}
                    className="flex items-center justify-between p-3 cursor-pointer bg-[var(--surface-header)] hover:bg-[var(--surface-hover)] select-none transition-colors border-b border-[var(--rule)]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="text-[var(--ink-muted)]">
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </div>
                      <span className="font-semibold text-xs text-[var(--ink)] uppercase tracking-wider font-ui">
                        {def.module} Module
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded-[2px] text-[10px] font-data font-bold bg-[var(--paper)] text-[var(--ink-muted)] border border-[var(--rule)]">
                      {grantedCount} / {modulePerms.length} Active
                    </span>
                  </div>

                  {/* Module Permissions List */}
                  {isExpanded && (
                    <div className="divide-y divide-[var(--rule)]">
                      {modulePerms.map((perm: any) => {
                        const isGranted = !!roleDetail?.permissions?.[perm.key];
                        const currentScope = roleDetail?.scopes?.[perm.key] || 'All';
                        const isSaving = savingKey === perm.key;
                        const isSuccess = savedSuccessKey === perm.key;

                        return (
                          <div
                            key={perm.key}
                            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--surface-hover)] transition-colors"
                          >
                            <div className="space-y-0.5 max-w-md">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-[var(--ink)]">
                                  {perm.displayName}
                                </span>
                                <span className="font-data text-[10px] text-[var(--ink-muted)]">
                                  ({perm.key})
                                </span>
                              </div>
                              <p className="text-[11px] text-[var(--ink-muted)] leading-snug">
                                {perm.description}
                              </p>
                            </div>

                            {/* Scope Selector & Toggle Switch */}
                            <div className="flex items-center gap-3">
                              {perm.supportsScope && isGranted && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase font-ui">
                                    Scope:
                                  </span>
                                  <select
                                    value={currentScope}
                                    disabled={roleDetail?.isSystemRole}
                                    onChange={(e) => handleScopeChange(perm.key, e.target.value)}
                                    className="register-input py-1 px-2 text-xs font-data cursor-pointer"
                                  >
                                    <option value="All">All (Entire Org)</option>
                                    <option value="Reporting">Reporting Hierarchy</option>
                                    <option value="Department">Department</option>
                                    <option value="Own">Own Records Only</option>
                                  </select>
                                </div>
                              )}

                              {isSuccess && (
                                <span className="text-[10px] font-bold text-[var(--ok-600)] flex items-center gap-1 font-data">
                                  <Check size={12} /> Saved
                                </span>
                              )}

                              {/* Toggle Switch */}
                              <button
                                onClick={() =>
                                  handleTogglePermission(perm.key, isGranted, 'All')
                                }
                                disabled={roleDetail?.isSystemRole || isSaving}
                                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                  isGranted ? 'bg-[var(--navy-900)] dark:bg-[var(--gold-500)]' : 'bg-[var(--rule)]'
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
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
    </div>
  );
};

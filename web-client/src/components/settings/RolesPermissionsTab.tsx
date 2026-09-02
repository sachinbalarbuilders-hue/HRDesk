import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useArchiveActions } from '../../hooks/useArchiveActions';
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
  CalendarCheck,
  Sparkles,
  Megaphone,
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
      window.dispatchEvent(new Event('hrdesk:permissions_changed'));
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
      window.dispatchEvent(new Event('hrdesk:permissions_changed'));
    } catch (err: any) {
      showError('Save Failed', err.response?.data?.message || 'Could not update restriction');
    } finally {
      setSavingKey(null);
    }
  };

  const handleTogglePermission = async (
    permKey: string,
    currentGranted: boolean,
    defaultScope: string
  ) => {
    if (!selectedRolePublicId || roleDetail?.isSystemRole) return;

    const newGranted = !currentGranted;
    const currentScope = roleDetail?.scopes?.[permKey] || defaultScope;
    const currentSubs = roleDetail?.subRestrictions?.[permKey] || [];

    try {
      setSavingKey(permKey);
      await apiClient.put(`/roles/${selectedRolePublicId}/permission`, {
        permissionKey: permKey,
        isGranted: newGranted,
        scope: currentScope,
        subRestrictions: currentSubs,
      });

      setRoleDetail((prev: any) => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permKey]: newGranted,
        },
      }));

      setSavedSuccessKey(permKey);
      setTimeout(() => setSavedSuccessKey(null), 1500);
      showSuccess('Saved', `${newGranted ? 'Enabled' : 'Disabled'} ${permKey}`);
      window.dispatchEvent(new Event('hrdesk:permissions_changed'));
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

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const roleArchive = useArchiveActions({
    endpoint: '/roles',
    label: 'Role',
    onDone: fetchRolesAndDefinitions,
  });

  const getModuleIcon = (moduleName: string) => {
    switch (moduleName) {
      case 'Employees':
        return <Users size={16} className="text-indigo-600 dark:text-indigo-400" />;
      case 'Attendance':
        return <Calendar size={16} className="text-amber-600 dark:text-amber-400" />;
      case 'Regularizations':
        return <UserCheck size={16} className="text-rose-600 dark:text-rose-400" />;
      case 'Shifts & Roster':
      case 'Shifts & Schedule':
        return <Clock size={16} className="text-orange-600 dark:text-orange-400" />;
      case 'Holidays':
        return <Sparkles size={16} className="text-amber-500 dark:text-amber-400" />;
      case 'Announcements':
        return <Megaphone size={16} className="text-pink-600 dark:text-pink-400" />;
      case 'Leaves':
      case 'Leaves & Comp-Off':
        return <Palmtree size={16} className="text-emerald-600 dark:text-emerald-400" />;
      case 'Comp-Off':
        return <CalendarCheck size={16} className="text-teal-600 dark:text-teal-400" />;
      case 'Payroll & Loans':
        return <CreditCard size={16} className="text-blue-600 dark:text-blue-400" />;
      case 'Masters & Structure':
        return <Building size={16} className="text-purple-600 dark:text-purple-400" />;
      case 'Recruitment':
        return <Users size={16} className="text-teal-600 dark:text-teal-400" />;
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
                          roleArchive.archive({ id: role.publicId, name: role.name, isArchived: false });
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
              const scopedPerms = defGroup.permissions.filter((p: any) => p.supportsScope);
              const togglePerms = defGroup.permissions.filter((p: any) => !p.supportsScope);
              const moduleSubSections = defGroup.permissions[0]?.subSections || [];
              const grantedCount = defGroup.permissions.filter(
                (p: any) => roleDetail?.permissions?.[p.key]
              ).length;

              return (
                <div
                  key={defGroup.module}
                  className="rounded-xl border border-[var(--rule)] bg-[var(--card)] shadow-xs transition-shadow hover:shadow-sm relative"
                >
                  {/* Module Header Accordion */}
                  <button
                    type="button"
                    onClick={() => toggleModule(defGroup.module)}
                    className={`w-full flex items-center justify-between p-4 bg-[var(--paper)]/50 hover:bg-[var(--paper)] transition-colors text-left cursor-pointer rounded-t-xl ${
                      isExpanded ? 'border-b border-[var(--rule)]/60' : 'rounded-b-xl'
                    }`}
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

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium font-data px-2 py-0.5 rounded-full bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink-muted)]">
                        {grantedCount} / {defGroup.permissions.length} active
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-5 space-y-4">
                      {/* Special Structured Layout for Masters & Structure */}
                      {defGroup.module === 'Masters & Structure' ? (
                        <div className="space-y-4">
                          {[
                            {
                              title: 'Organizations & Branches',
                              icon: Building,
                              keys: [
                                'Masters.Organizations.View',
                                'Masters.Organizations.Create',
                                'Masters.Organizations.Edit',
                                'Masters.Organizations.Delete',
                              ],
                            },
                            {
                              title: 'Departments',
                              icon: Layers,
                              keys: [
                                'Masters.Departments.View',
                                'Masters.Departments.Create',
                                'Masters.Departments.Edit',
                                'Masters.Departments.Delete',
                              ],
                            },
                            {
                              title: 'Designations',
                              icon: Users,
                              keys: [
                                'Masters.Designations.View',
                                'Masters.Designations.Create',
                                'Masters.Designations.Edit',
                                'Masters.Designations.Delete',
                              ],
                            },
                            {
                              title: 'Leave Types Master',
                              icon: Palmtree,
                              keys: [
                                'Leaves.Types.View',
                                'Leaves.Types.Create',
                                'Leaves.Types.Edit',
                                'Leaves.Types.Delete',
                              ],
                            },
                            {
                              title: 'Work Shifts Master',
                              icon: Clock,
                              keys: [
                                'Shifts.View',
                                'Shifts.Create',
                                'Shifts.Edit',
                                'Shifts.Delete',
                              ],
                            },
                          ].map((group) => {
                            const groupPerms = group.keys
                              .map((k) => defGroup.permissions.find((p: any) => p.key === k))
                              .filter(Boolean);
                            const GroupIcon = group.icon;
                            const groupGrantedCount = groupPerms.filter(
                              (p: any) => roleDetail?.permissions?.[p.key]
                            ).length;

                            return (
                              <div
                                key={group.title}
                                className="p-4 rounded-xl border border-[var(--rule)]/80 bg-[var(--paper)]/30 space-y-3 shadow-2xs"
                              >
                                <div className="flex items-center justify-between pb-2 border-b border-[var(--rule)]/60">
                                  <div className="flex items-center gap-2">
                                    <GroupIcon size={15} className="text-indigo-600 dark:text-indigo-400" />
                                    <h4 className="text-xs font-bold text-[var(--ink)] tracking-wide">
                                      {group.title}
                                    </h4>
                                  </div>
                                  <span className="text-[10px] font-medium font-data px-2 py-0.5 rounded-full bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink-muted)]">
                                    {groupGrantedCount} / {groupPerms.length} active
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {groupPerms.map((perm: any) => {
                                    const isGranted = roleDetail?.permissions?.[perm.key] ?? false;
                                    const currentScope =
                                      roleDetail?.scopes?.[perm.key] || perm.defaultScope || 'Soft Delete';
                                    const isSaving = savingKey === perm.key;
                                    const isSuccess = savedSuccessKey === perm.key;

                                    return (
                                      <div
                                        key={perm.key}
                                        className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-all ${
                                          isGranted
                                            ? 'bg-[var(--card)] border-[var(--rule)]/80 shadow-2xs'
                                            : 'bg-[var(--paper)]/15 border-transparent opacity-65'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-[130px]">
                                          <button
                                            type="button"
                                            disabled={isSystem || isSaving}
                                            onClick={() =>
                                              handleTogglePermission(
                                                perm.key,
                                                isGranted,
                                                perm.defaultScope || 'Soft Delete'
                                              )
                                            }
                                            className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                                              isGranted
                                                ? 'bg-emerald-600'
                                                : 'bg-slate-300 dark:bg-slate-700'
                                            }`}
                                            title={isGranted ? 'Click to Disable' : 'Click to Enable'}
                                          >
                                            <div
                                              className={`w-3 h-3 rounded-full bg-white transition-transform ${
                                                isGranted ? 'translate-x-3' : 'translate-x-0'
                                              }`}
                                            />
                                          </button>

                                          <label
                                            onClick={() => {
                                              if (!isSystem && !isSaving) {
                                                handleTogglePermission(
                                                  perm.key,
                                                  isGranted,
                                                  perm.defaultScope || 'Soft Delete'
                                                );
                                              }
                                            }}
                                            className={`text-xs font-medium cursor-pointer select-none ${
                                              isGranted
                                                ? 'text-[var(--ink)] font-semibold'
                                                : 'text-[var(--ink-muted)] line-through'
                                            }`}
                                          >
                                            {perm.displayName} {perm.supportsScope ? ':' : ''}
                                          </label>

                                          {isSuccess && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 animate-in fade-in">
                                              <Check size={10} />
                                            </span>
                                          )}
                                        </div>

                                        {perm.supportsScope ? (
                                          <SearchableSelect
                                            disabled={isSystem || isSaving || !isGranted}
                                            value={isGranted ? currentScope : 'Disabled'}
                                            options={perm.scopeOptions}
                                            onChange={(newScope) => handleScopeChange(perm.key, newScope)}
                                            className={`w-full max-w-[200px] ${
                                              !isGranted ? 'pointer-events-none opacity-40' : ''
                                            }`}
                                          />
                                        ) : (
                                          <span
                                            className={`text-[10px] font-data px-2 py-0.5 rounded border select-none ${
                                              isGranted
                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60'
                                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                            }`}
                                          >
                                            {isGranted ? 'Action Enabled' : 'Disabled'}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <>
                          {/* Scoped Actions (View Scope, Create Scope, Edit Scope, Delete Scope) with ON/OFF Toggles */}
                          {scopedPerms.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                              {scopedPerms.map((perm: any) => {
                                const isGranted = roleDetail?.permissions?.[perm.key] ?? false;
                                const currentScope =
                                  roleDetail?.scopes?.[perm.key] || perm.defaultScope || 'Own Branch';
                                const isSaving = savingKey === perm.key;
                                const isSuccess = savedSuccessKey === perm.key;

                                return (
                                  <div
                                    key={perm.key}
                                    className={`flex items-center justify-between gap-3 p-2 rounded-lg border transition-all ${
                                      isGranted
                                        ? 'bg-[var(--paper)]/40 border-[var(--rule)]/60'
                                        : 'bg-[var(--paper)]/15 border-transparent opacity-65'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-[140px]">
                                      {/* ON/OFF TOGGLE SWITCH */}
                                      <button
                                        type="button"
                                        disabled={isSystem || isSaving}
                                        onClick={() =>
                                          handleTogglePermission(
                                            perm.key,
                                            isGranted,
                                            perm.defaultScope || 'Own Branch'
                                          )
                                        }
                                        className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                                          isGranted
                                            ? 'bg-emerald-600'
                                            : 'bg-slate-300 dark:bg-slate-700'
                                        }`}
                                        title={isGranted ? 'Click to Disable permission' : 'Click to Enable permission'}
                                      >
                                        <div
                                          className={`w-3 h-3 rounded-full bg-white transition-transform ${
                                            isGranted ? 'translate-x-3' : 'translate-x-0'
                                          }`}
                                        />
                                      </button>

                                      <label
                                        onClick={() => {
                                          if (!isSystem && !isSaving) {
                                            handleTogglePermission(
                                              perm.key,
                                              isGranted,
                                              perm.defaultScope || 'Own Branch'
                                            );
                                          }
                                        }}
                                        className={`text-xs font-medium cursor-pointer select-none ${
                                          isGranted
                                            ? 'text-[var(--ink)] font-semibold'
                                            : 'text-[var(--ink-muted)] line-through'
                                        }`}
                                      >
                                        {perm.displayName} :
                                      </label>

                                      {isSuccess && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 animate-in fade-in">
                                          <Check size={10} />
                                        </span>
                                      )}
                                    </div>

                                    <SearchableSelect
                                      disabled={isSystem || isSaving || !isGranted}
                                      value={isGranted ? currentScope : 'Disabled'}
                                      options={perm.scopeOptions}
                                      onChange={(newScope) => handleScopeChange(perm.key, newScope)}
                                      className={`w-full max-w-[210px] ${
                                        !isGranted ? 'pointer-events-none opacity-40' : ''
                                      }`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Restricted Sub-sections (Checkboxes) */}
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
                                {moduleSubSections.map((subName: string) => {
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
                                      className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--rule)] bg-[var(--paper)]/50"
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
                                          handleTogglePermission(
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
                        </>
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

      {/* Permanent-delete confirmation (only reachable from the Archive view) */}
      {roleArchive.dialog}
    </div>
  );
};

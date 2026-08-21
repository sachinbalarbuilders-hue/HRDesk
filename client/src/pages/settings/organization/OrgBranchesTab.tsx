import React from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { RowActionMenu, type RowAction } from '../../../components/ui/RowActionMenu';
import { Plus, MapPin, Shield, Trash2, Edit2, Archive, RotateCcw } from 'lucide-react';
import { useOrgOutletContext } from './OrganizationShell';

export const OrgBranchesTab: React.FC = () => {
  const { id, orgForm, branches, setBranches } = useOrgOutletContext();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const handleDeleteBranch = async (branch: { id: number; publicId: string }) => {
    try {
      await apiClient.delete(`/masters/branches/${branch.publicId}`);
      setBranches(branches.filter((b) => b.id !== branch.id));
      showSuccess('Branch Deleted', 'Branch removed.');
    } catch (err: any) {
      showError('Failed', err.response?.data?.message || 'Server error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-[var(--ink)]">Branches</h3>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">
            Sites and offices under this organization. Open a branch to edit details and attendance policy.
          </p>
        </div>
        <button
          onClick={() => navigate(`/settings/organizations/${id}/branches/add`)}
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
            onClick={() => navigate(`/settings/organizations/${id}/branches/add`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 cursor-pointer transition-colors"
          >
            <Plus size={11} />Add First Branch
          </button>
        </div>
      ) : (
        <div className="border border-[var(--rule)] rounded-md divide-y divide-[var(--rule)]">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--paper)]/60 transition-colors cursor-pointer"
              onClick={() => navigate(`/settings/organizations/${id}/branches/${branch.publicId}`)}
            >
              <div className="w-8 h-8 rounded-[3px] bg-[var(--navy-900)] text-[var(--gold-500)] flex items-center justify-center shrink-0">
                <MapPin size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[var(--ink)]">{branch.name}</span>
                  {branch.isActive !== false
                    ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--paper)] border border-[var(--rule)] text-[var(--ok-600)]"><span className="status-dot-ok" /> Active</span>
                    : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--paper)] border border-[var(--rule)] text-[var(--warn-600)]"><span className="status-dot-warn" /> Archived</span>
                  }
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[var(--ink-muted)]">
                  {branch.city && <span>{branch.city}{branch.state ? ', ' + branch.state : ''}</span>}
                  {branch.address && <span className="truncate max-w-xs">{branch.address}</span>}
                  {branch.latitude && <span className="font-data flex items-center gap-0.5"><MapPin size={9} className="text-indigo-400" />{Number(branch.latitude).toFixed(4)}, {Number(branch.longitude).toFixed(4)} ({branch.radiusMeters}m)</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <RowActionMenu actions={[
                  { label: 'Permissions', icon: <Shield size={14} />, onClick: () => navigate(`/settings/organizations/${id}/branches/${branch.publicId}/permissions`) },
                  { label: 'Edit Branch', icon: <Edit2 size={14} />, onClick: () => navigate(`/settings/organizations/${id}/branches/${branch.publicId}`) },
                  branch.isActive === false
                    ? { label: 'Restore', icon: <RotateCcw size={14} />, onClick: async () => { try { await apiClient.put(`/masters/branches/${branch.publicId}`, { ...branch, isActive: true }); setBranches(branches.map((b) => b.id === branch.id ? { ...b, isActive: true } : b)); showSuccess('Restored', `${branch.name} restored.`); } catch (err: any) { showError('Error', err.response?.data?.message || 'Failed'); } }, variant: 'success', dividerBefore: true }
                    : { label: 'Archive', icon: <Archive size={14} />, onClick: async () => { try { await apiClient.put(`/masters/branches/${branch.publicId}`, { ...branch, isActive: false }); setBranches(branches.map((b) => b.id === branch.id ? { ...b, isActive: false } : b)); showSuccess('Archived', `${branch.name} archived.`); } catch (err: any) { showError('Error', err.response?.data?.message || 'Failed'); } }, dividerBefore: true },
                  { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDeleteBranch(branch), variant: 'danger' },
                ] as RowAction[]} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

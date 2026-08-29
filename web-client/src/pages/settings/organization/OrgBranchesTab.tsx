import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RowActionMenu, type RowAction } from '../../../components/ui/RowActionMenu';
import { useArchiveActions, isRowArchived } from '../../../hooks/useArchiveActions';
import { ArchiveToggle, type ArchiveFilterValue } from '../../../components/ui/ArchiveToggle';
import { Plus, MapPin, Shield, Edit2 } from 'lucide-react';
import { useOrgOutletContext } from './OrganizationShell';

export const OrgBranchesTab: React.FC = () => {
  const { id, orgForm, branches, setBranches, refetch } = useOrgOutletContext();
  const navigate = useNavigate();
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');

  // One shared "Delete" behaviour: archive from the active list, permanent from the archive view.
  const branchArchive = useArchiveActions({
    endpoint: '/masters/branches',
    label: 'Branch',
    onDone: refetch,
  });

  const visibleBranches = branches.filter((b) => {
    const archived = isRowArchived(b);
    if (archiveFilter === 'active') return !archived;
    if (archiveFilter === 'archived') return archived;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-[var(--ink)]">Branches</h3>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">
            Sites and offices under this organization. Open a branch to edit details and attendance policy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ArchiveToggle value={archiveFilter} onChange={setArchiveFilter} />
          <button
            onClick={() => navigate(`/settings/organizations/${id}/branches/add`)}
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={13} /><span>Add Branch</span>
          </button>
        </div>
      </div>

      {visibleBranches.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-[var(--ink-muted)] border border-dashed border-[var(--rule)] rounded-md">
          <MapPin size={20} className="text-indigo-300" />
          <span>{archiveFilter === 'archived' ? 'No archived branches.' : <>No branches under <strong>{orgForm.name}</strong> yet.</>}</span>
          {archiveFilter === 'active' && (
            <button
              onClick={() => navigate(`/settings/organizations/${id}/branches/add`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 cursor-pointer transition-colors"
            >
              <Plus size={11} />Add First Branch
            </button>
          )}
        </div>
      ) : (
        <div className="border border-[var(--rule)] rounded-md divide-y divide-[var(--rule)]">
          {visibleBranches.map((branch) => (
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
                  {!isRowArchived(branch)
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
                  ...branchArchive.rowActions({
                    id: branch.publicId,
                    name: branch.name,
                    isArchived: isRowArchived(branch),
                  }),
                ] as RowAction[]} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Permanent-delete confirmation (only reachable from the Archive view) */}
      {branchArchive.dialog}
    </div>
  );
};


import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useOrganization } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import {
  Building2,
  Plus,
  Trash2,
  MapPin,
  Edit2,
  Archive,
  RotateCcw,
  Eye,
} from 'lucide-react';

export const OrganizationsTab: React.FC = () => {
  const { currentBranch } = useOrganization();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/masters/overview', {
        params: { branchId: currentBranch?.id || undefined }
      });

      if (res?.data) {
        if (res.data.organizations) {
          const orgList = res.data.organizations.map((o: any) => ({
            id: o.id,
            publicId: o.publicId,
            name: o.name,
            code: o.code || (o.name.length > 3 ? o.name.split(' ').map((w: string) => w[0]).join('').toUpperCase() : o.name.toUpperCase()),
            address: o.address || '',
            whatsAppGroupId: o.whatsAppGroupId || '',
            latitude: o.latitude || 21.1702,
            longitude: o.longitude || 72.8311,
            radiusMeters: o.radiusMeters || 100,
            isActive: o.isActive !== false,
            status: o.isActive !== false ? 'Active' : 'Inactive',
          }));
          setOrganizations(orgList);
        }
        if (res.data.branches) {
          setBranches(res.data.branches.map((b: any) => ({
            id: b.id,
            publicId: b.publicId,
            organizationId: b.organizationId,
            name: b.name,
            code: b.code || (b.name.length > 3 ? b.name.split(' ').map((w: string) => w[0]).join('').toUpperCase() : b.name.toUpperCase()),
            address: b.address || '',
            city: b.city || '',
            state: b.state || '',
            pincode: b.pincode || '',
            whatsAppGroupId: b.whatsAppGroupId || '',
            latitude: b.latitude || 21.1702,
            longitude: b.longitude || 72.8311,
            radiusMeters: b.radiusMeters || 100,
            isActive: b.isActive !== false,
            status: b.isActive !== false ? 'Active' : 'Inactive',
          })));
        }
      }
    } catch (e) {
      console.error('Failed to load organizations', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentBranch?.id]);

  useEffect(() => {
    const handleReload = () => { fetchData(); };
    window.addEventListener('hrdesk:tenant_changed', handleReload);
    window.addEventListener('hrdesk:branch_changed', handleReload);
    return () => {
      window.removeEventListener('hrdesk:tenant_changed', handleReload);
      window.removeEventListener('hrdesk:branch_changed', handleReload);
    };
  }, []);

  const handleOpenCreateOrg = () => {
    navigate('/settings/organizations/new');
  };

  const handleOpenEditOrg = (org: any) => {
    navigate(`/settings/organizations/${org.publicId}`);
  };

  const handleDeleteOrg = (id: number) => {
    if (organizations.length <= 1) {
      showError('Cannot Delete', 'At least one primary Organization is required.');
      return;
    }
    setOrganizations(organizations.filter(o => o.id !== id));
    showSuccess('Organization Deleted', 'Organization profile removed.');
  };

  const s = search.trim().toLowerCase();
  const filteredOrgs = organizations.filter(o => {
    const matchesSearch = !s || (o.name?.toLowerCase().includes(s)) || (o.code?.toLowerCase().includes(s));
    return matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold text-sm text-[var(--ink)] flex items-center gap-2">
              <Building2 size={15} className="text-[var(--gold-500)]" />
              <span>Organizations</span>
            </h3>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5">
              Open an organization to manage its branches and branch settings.
            </p>
          </div>
          <button onClick={handleOpenCreateOrg} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer">
            <Plus size={13} /><span>Add Organization</span>
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organizations…"
          className="register-input w-full max-w-xs text-xs"
        />

        {loading ? (
          <div className="text-xs text-[var(--ink-muted)] py-6 text-center">Loading…</div>
        ) : filteredOrgs.length === 0 ? (
          <div className="text-xs text-[var(--ink-muted)] py-6 text-center border border-dashed border-[var(--rule)] rounded-[4px]">
            No Organizations found. Add one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrgs.map((org) => {
              const orgBranches = branches.filter(b => b.organizationId === org.id);
              return (
                <div key={org.id} className="border border-[var(--rule)] rounded-[4px] overflow-hidden bg-[var(--surface)]">
                  <div
                    className="flex items-center gap-3 px-4 py-3 bg-[var(--paper)] cursor-pointer hover:bg-[var(--surface)] transition-colors"
                    onClick={() => handleOpenEditOrg(org)}
                  >
                    <div className="w-8 h-8 rounded-[3px] bg-[var(--navy-900)] text-[var(--gold-500)] flex items-center justify-center shrink-0">
                      <Building2 size={14} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-[var(--ink)]">{org.name}</span>
                        {org.isActive !== false
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--paper)] border border-[var(--rule)] text-[var(--ok-600)]"><span className="status-dot-ok" /> Active</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--paper)] border border-[var(--rule)] text-[var(--warn-600)]"><span className="status-dot-warn" /> Archived</span>
                        }
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[var(--ink-muted)]">
                        {org.address && <span className="flex items-center gap-1"><MapPin size={10} />{org.address}</span>}
                        <span>{orgBranches.length} {orgBranches.length === 1 ? 'branch' : 'branches'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <RowActionMenu actions={[
                        { label: 'View', icon: <Eye size={14} />, onClick: () => navigate(`/settings/organizations/${org.publicId}`) },
                        { label: 'Edit', icon: <Edit2 size={14} />, onClick: () => handleOpenEditOrg(org) },
                        org.isActive === false
                          ? { label: 'Restore', icon: <RotateCcw size={14} />, onClick: async () => { try { await apiClient.put(`/masters/organizations/${org.publicId}`, { ...org, isActive: true }); setOrganizations(organizations.map(o => o.id === org.id ? { ...o, isActive: true } : o)); showSuccess('Restored', `${org.name} restored.`); } catch (err: any) { showError('Error', err.response?.data?.message || 'Failed'); } }, variant: 'success', dividerBefore: true }
                          : { label: 'Archive', icon: <Archive size={14} />, onClick: async () => { try { await apiClient.put(`/masters/organizations/${org.publicId}`, { ...org, isActive: false }); setOrganizations(organizations.map(o => o.id === org.id ? { ...o, isActive: false } : o)); showSuccess('Archived', `${org.name} archived.`); } catch (err: any) { showError('Error', err.response?.data?.message || 'Failed'); } }, dividerBefore: true },
                        { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDeleteOrg(org.id), variant: 'danger' },
                      ] as RowAction[]} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { RolesPermissionsTab } from '../../components/settings/RolesPermissionsTab';
import { Shield, ArrowLeft } from 'lucide-react';

export const BranchPermissions: React.FC = () => {
  // Both segments are opaque PublicIds (GUIDs): orgId identifies the parent
  // organization, branchId identifies the branch these permissions belong to.
  const { orgId: orgPublicId, branchId: branchPublicId } = useParams<{ orgId: string; branchId: string }>();
  const navigate = useNavigate();
  const { showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState('');
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    const fetchNames = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/masters/overview');
        const orgs = res.data?.organizations || [];
        const branches = res.data?.branches || [];

        const org = orgs.find((o: any) => String(o.publicId) === orgPublicId);
        const branch = branches.find((b: any) => String(b.publicId) === branchPublicId);

        if (!branch) {
          showError('Not Found', 'Branch not found.');
          navigate(orgPublicId ? `/settings/organizations/${orgPublicId}/branches` : '/settings/organizations');
          return;
        }

        setOrgName(org?.name || '');
        setBranchName(branch.name);
      } catch (err) {
        showError('Error', 'Failed to load branch.');
      } finally {
        setLoading(false);
      }
    };

    fetchNames();
  }, [orgPublicId, branchPublicId]);

  if (loading) {
    return <div className="p-8 text-center text-[var(--ink-muted)] text-xs font-data">Loading branch permissions...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(orgPublicId ? `/settings/organizations/${orgPublicId}/branches` : '/settings/organizations')}
          className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--ink-muted)] transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-semibold text-[var(--ink)] flex items-center gap-2">
              <Shield className="text-[var(--gold-500)]" size={22} />
              {branchName}
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60">
              Branch • {orgName || 'Organization'}
            </span>
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            Branch-level Roles, Custom Profiles & Granular Data Scopes
          </p>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-lg shadow-sm p-6">
        <RolesPermissionsTab />
      </div>
    </div>
  );
};

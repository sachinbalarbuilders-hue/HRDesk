import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext, Outlet } from 'react-router-dom';
import { apiClient } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { Building2, ArrowLeft } from 'lucide-react';

export interface OrgForm {
  name: string;
  code: string;
  address: string;
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
  isActive: boolean;
}

export interface PolicyForm {
  yearStartMonth: number;
  yearEndMonth: number;
  advanceNoticeDays: number;
  maxConsecutiveLeaves: number;
  sandwichRuleEnabled: boolean;
  defaultProbationDays: number;
}

export interface Branch {
  id: number;
  publicId: string;
  organizationId: number;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  radiusMeters: number;
  isActive: boolean;
  archivedAt?: string | null;
}

export interface OrgOutletContext {
  /** Opaque PublicId (GUID) from the URL — use this for API calls that address this org by URL param. */
  id: string | undefined;
  /** Internal integer Id — only needed for endpoints not yet migrated to PublicId (e.g. company-policy). */
  orgId: number | null;
  isNew: boolean;
  loading: boolean;
  orgForm: OrgForm;
  setOrgForm: React.Dispatch<React.SetStateAction<OrgForm>>;
  branches: Branch[];
  setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
  refetch: () => void;
  policyForm: PolicyForm;
  setPolicyForm: React.Dispatch<React.SetStateAction<PolicyForm>>;
}

function endMonthFromStart(start: number) {
  return start === 1 ? 12 : start - 1;
}

const TABS = [
  { id: 'details', label: 'Organization Details', path: (id: string) => `/settings/organizations/${id}` },
  { id: 'branches', label: 'Branches', path: (id: string) => `/settings/organizations/${id}/branches` },
  { id: 'policy', label: 'Company Policy', path: (id: string) => `/settings/organizations/${id}/policy` },
];

export const OrganizationShell: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showError } = useToast();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [orgForm, setOrgForm] = useState<OrgForm>({ name: '', code: '', address: '', isActive: true });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [policyForm, setPolicyForm] = useState<PolicyForm>({
    yearStartMonth: 11,
    yearEndMonth: 10,
    advanceNoticeDays: 2,
    maxConsecutiveLeaves: 14,
    sandwichRuleEnabled: true,
    defaultProbationDays: 90,
  });

  const fetchOrg = useCallback(async () => {
    if (!id || isNew) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const overviewRes = await apiClient.get('/masters/overview').then(
        (res) => ({ status: 'fulfilled' as const, value: res }),
        (err) => ({ status: 'rejected' as const, reason: err })
      );

      const orgs = (overviewRes.status === 'fulfilled' && overviewRes.value.data?.organizations) || [];
      // The URL param is the opaque PublicId (GUID), not the internal integer Id.
      const org = orgs.find((o: any) => String(o.publicId) === id);

      const policyRes = org
        ? await apiClient.get('/masters/company-policy', { params: { organizationId: org.id } }).then(
            (res) => ({ status: 'fulfilled' as const, value: res }),
            (err) => ({ status: 'rejected' as const, reason: err })
          )
        : { status: 'rejected' as const, reason: null };

      if (org) {
        setOrgId(org.id);
        setOrgForm({
          name: org.name,
          code: org.code || '',
          address: org.address || '',
          logoUrl: org.logoUrl || '',
          primaryColor: org.primaryColor || '#D97706',
          customDomain: org.customDomain || '',
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

        const orgBranches = ((overviewRes.status === 'fulfilled' && overviewRes.value.data?.branches) || [])
          .filter((b: any) => b.organizationId === org.id)
          .map((b: any) => ({
            id: b.id,
            publicId: b.publicId,
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
            archivedAt: b.archivedAt ?? null,
          }));
        setBranches(orgBranches);
      } else {
        showError('Not Found', 'Organization not found.');
        navigate('/settings/organizations');
      }
    } catch (err) {
      showError('Error', 'Failed to load organization.');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const outletContext: OrgOutletContext = {
    id, orgId, isNew, loading, orgForm, setOrgForm, branches, setBranches, refetch: fetchOrg, policyForm, setPolicyForm,
  };

  if (loading) {
    return <div className="p-8 text-center text-[var(--ink-muted)] text-xs font-data">Loading organization details...</div>;
  }

  const activeTab = TABS.find((t) => location.pathname === t.path(id || '')) || TABS[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings/organizations')}
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
          {TABS.map((tab) => {
            if (tab.id !== 'details' && isNew) return null;
            const path = tab.path(id || '');
            const isActive = activeTab.id === tab.id;
            return (
              <button
                key={tab.id}
                className={`px-4 py-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
                  isActive ? 'border-[var(--gold-500)] text-[var(--gold-500)]' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
                onClick={() => navigate(path)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          <Outlet context={outletContext} />
        </div>
      </div>
    </div>
  );
};

export function useOrgOutletContext() {
  return useOutletContext<OrgOutletContext>();
}

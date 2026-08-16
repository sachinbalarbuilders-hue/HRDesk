import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  whatsAppGroupId?: string;
  isActive?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  code?: string;
  address?: string;
  whatsAppGroupId?: string;
  isActive?: boolean;
  branches?: Branch[];
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  currentBranch: Branch | null;
  branches: Branch[];
  allBranches: Branch[];
  isLoading: boolean;
  switchOrganization: (orgId: string) => void;
  switchBranch: (branchId: string | null) => void;
  refreshOrganizations: () => Promise<void>;
}

const DEFAULT_ORGS: Organization[] = [
  { id: '1', name: 'Setu Developers', code: 'SETU', address: 'Surat, Gujarat' },
  { id: '2', name: 'Shilpam', code: 'SHILPAM', address: 'Surat, Gujarat' },
];

const DEFAULT_BRANCHES: Branch[] = [
  { id: '1', organizationId: '1', name: 'Ville flora', code: 'VF-01', city: 'Surat', state: 'Gujarat', radiusMeters: 150, isActive: true },
  { id: '2', organizationId: '1', name: 'Ville Flora 2', code: 'VF-02', city: 'Surat', state: 'Gujarat', radiusMeters: 200, isActive: true },
  { id: '3', organizationId: '2', name: 'Vista Regency', code: 'VR-01', city: 'Surat', state: 'Gujarat', radiusMeters: 150, isActive: true },
];

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<Organization[]>(() => {
    const cached = localStorage.getItem('hrdesk_db_orgs');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return DEFAULT_ORGS;
  });

  const [allBranches, setAllBranches] = useState<Branch[]>(() => {
    const cached = localStorage.getItem('hrdesk_db_branches');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If cached data contains stale mock names like "Vesu", discard it
          if (!parsed.some((b: any) => b.name?.includes('Vesu'))) {
            return parsed;
          }
        }
      } catch {}
    }
    return DEFAULT_BRANCHES;
  });

  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(() => {
    const savedObj = localStorage.getItem('hrdesk_active_org_obj');
    if (savedObj) {
      try {
        return JSON.parse(savedObj);
      } catch {}
    }
    const savedId = localStorage.getItem('hrdesk_active_organization') || '1';
    const cachedOrgs = localStorage.getItem('hrdesk_db_orgs');
    if (cachedOrgs) {
      try {
        const list: Organization[] = JSON.parse(cachedOrgs);
        const match = list.find(o => String(o.id) === String(savedId));
        if (match) return match;
      } catch {}
    }
    return DEFAULT_ORGS.find(o => String(o.id) === String(savedId)) || DEFAULT_ORGS[0];
  });

  const [currentBranch, setCurrentBranch] = useState<Branch | null>(() => {
    const savedBranchId = localStorage.getItem('hrdesk_active_branch');
    if (!savedBranchId || savedBranchId === 'all') return null;
    const cachedBranches = localStorage.getItem('hrdesk_db_branches');
    if (cachedBranches) {
      try {
        const list: Branch[] = JSON.parse(cachedBranches);
        if (!list.some((b: any) => b.name?.includes('Vesu'))) {
          const match = list.find(b => String(b.id) === String(savedBranchId));
          if (match) return match;
        }
      } catch {}
    }
    return DEFAULT_BRANCHES.find(b => String(b.id) === String(savedBranchId)) || null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Filter branches for the current active organization
  const activeOrgId = currentOrganization?.id ? String(currentOrganization.id) : '1';
  const orgBranches = allBranches.filter(b => String(b.organizationId) === activeOrgId);

  const fetchOrganizationsAndBranches = async () => {
    try {
      setIsLoading(true);
      const [orgsRes, branchesRes] = await Promise.allSettled([
        apiClient.get('/masters/organizations'),
        apiClient.get('/masters/branches'),
      ]);

      let orgList: Organization[] = DEFAULT_ORGS;
      if (orgsRes.status === 'fulfilled' && Array.isArray(orgsRes.value.data) && orgsRes.value.data.length > 0) {
        orgList = orgsRes.value.data.map((o: any) => ({
          id: String(o.id),
          name: o.name,
          code: o.code,
          address: o.address,
          whatsAppGroupId: o.whatsAppGroupId,
          isActive: o.isActive ?? true,
        }));
        setOrganizations(orgList);
        localStorage.setItem('hrdesk_db_orgs', JSON.stringify(orgList));
      }

      let branchList: Branch[] = DEFAULT_BRANCHES;
      if (branchesRes.status === 'fulfilled' && Array.isArray(branchesRes.value.data) && branchesRes.value.data.length > 0) {
        branchList = branchesRes.value.data.map((b: any) => ({
          id: String(b.id),
          organizationId: String(b.organizationId),
          name: b.name,
          code: b.code,
          address: b.address,
          city: b.city,
          state: b.state,
          pincode: b.pincode,
          latitude: b.latitude,
          longitude: b.longitude,
          radiusMeters: b.radiusMeters,
          whatsAppGroupId: b.whatsAppGroupId,
          isActive: b.isActive ?? true,
        }));
        setAllBranches(branchList);
        localStorage.setItem('hrdesk_db_branches', JSON.stringify(branchList));
      }

      const savedOrgId = localStorage.getItem('hrdesk_active_organization') || (orgList[0]?.id ? String(orgList[0].id) : '1');
      const matchedOrg = orgList.find(o => String(o.id) === String(savedOrgId)) || orgList[0] || DEFAULT_ORGS[0];
      setCurrentOrganization(matchedOrg);
      localStorage.setItem('hrdesk_active_organization', String(matchedOrg.id));
      localStorage.setItem('hrdesk_active_org_obj', JSON.stringify(matchedOrg));

      const savedBranchId = localStorage.getItem('hrdesk_active_branch');
      if (savedBranchId && savedBranchId !== 'all') {
        const matchedBranch = branchList.find(b => String(b.id) === String(savedBranchId) && String(b.organizationId) === String(matchedOrg.id));
        setCurrentBranch(matchedBranch || null);
        if (matchedBranch) {
          localStorage.setItem('hrdesk_active_branch', String(matchedBranch.id));
        } else {
          localStorage.removeItem('hrdesk_active_branch');
        }
      } else {
        setCurrentBranch(null);
      }
    } catch (err) {
      console.warn('Could not fetch organizations/branches from backend:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizationsAndBranches();
  }, []);

  useEffect(() => {
    if (currentBranch && allBranches.length > 0) {
      const freshBranch = allBranches.find(b => String(b.id) === String(currentBranch.id));
      if (freshBranch && freshBranch.name !== currentBranch.name) {
        setCurrentBranch(freshBranch);
      }
    }
  }, [allBranches, currentBranch]);

  const switchOrganization = (orgId: string) => {
    const match = organizations.find(c => String(c.id) === String(orgId));
    if (match) {
      setCurrentOrganization(match);
      localStorage.setItem('hrdesk_active_organization', String(match.id));
      localStorage.setItem('hrdesk_active_org_obj', JSON.stringify(match));
      // Reset branch when switching organization
      setCurrentBranch(null);
      localStorage.setItem('hrdesk_active_branch', 'all');
      // Dispatch custom event so pages can re-fetch data without full page reload
      window.dispatchEvent(new CustomEvent('hrdesk:tenant_changed', { detail: { organizationId: match.id } }));
    }
  };

  const switchBranch = (branchId: string | null) => {
    if (!branchId || branchId === 'all') {
      setCurrentBranch(null);
      localStorage.setItem('hrdesk_active_branch', 'all');
      window.dispatchEvent(new CustomEvent('hrdesk:branch_changed', { detail: { branchId: null } }));
    } else {
      const match = allBranches.find(b => String(b.id) === String(branchId));
      if (match) {
        setCurrentBranch(match);
        localStorage.setItem('hrdesk_active_branch', String(match.id));
        window.dispatchEvent(new CustomEvent('hrdesk:branch_changed', { detail: { branchId: match.id } }));
      }
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        currentBranch,
        branches: orgBranches,
        allBranches,
        isLoading,
        switchOrganization,
        switchBranch,
        refreshOrganizations: fetchOrganizationsAndBranches,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = (): OrganizationContextType => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

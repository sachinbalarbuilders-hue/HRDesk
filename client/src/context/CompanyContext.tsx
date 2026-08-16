import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export interface Organization {
  id: string;
  name: string;
  code?: string;
  address?: string;
  whatsAppGroupId?: string;
  isActive?: boolean;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  switchOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
}

const DEFAULT_ORGS: Organization[] = [
  { id: '1', name: 'Setu Developers', code: 'SETU' },
  { id: '2', name: 'Shilpam Infracon', code: 'SHILPAM' },
  { id: '3', name: 'Synery Corporation', code: 'SYNERY' },
  { id: '4', name: 'Vatar Industrial Park', code: 'VATAR' },
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
        const match = list.find(o => String(o.id) === savedId);
        if (match) return match;
      } catch {}
    }
    return DEFAULT_ORGS.find(o => o.id === savedId) || DEFAULT_ORGS[0];
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get('/masters/organizations');
      const orgList: Organization[] = res.data || [];
      if (orgList.length > 0) {
        setOrganizations(orgList);
        localStorage.setItem('hrdesk_db_orgs', JSON.stringify(orgList));

        const savedId = localStorage.getItem('hrdesk_active_organization') || '1';
        const matched = orgList.find(o => String(o.id) === String(savedId)) || orgList[0];
        setCurrentOrganization(matched);
        localStorage.setItem('hrdesk_active_organization', String(matched.id));
        localStorage.setItem('hrdesk_active_org_obj', JSON.stringify(matched));
      }
    } catch (err) {
      console.warn('Could not fetch organizations from backend:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const switchOrganization = (orgId: string) => {
    const match = organizations.find(c => String(c.id) === String(orgId));
    if (match) {
      setCurrentOrganization(match);
      localStorage.setItem('hrdesk_active_organization', String(match.id));
      localStorage.setItem('hrdesk_active_org_obj', JSON.stringify(match));
      window.location.reload();
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        isLoading,
        switchOrganization,
        refreshOrganizations: fetchOrganizations,
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

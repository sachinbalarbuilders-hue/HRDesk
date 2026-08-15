import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Organization {
  id: string;
  name: string;
  code: string;
  address?: string;
  whatsAppGroupId?: string;
}

interface OrganizationContextType {
  currentOrganization: Organization;
  organizations: Organization[];
  switchOrganization: (orgId: string) => void;
}

const DEFAULT_ORGANIZATIONS: Organization[] = [
  {
    id: '1',
    name: 'HRDesk Builders & Developers',
    code: 'HBD',
    address: 'Plot 42, Cyber Gateway, Hyderabad',
  },
  {
    id: '2',
    name: 'HRDesk Infra & Projects',
    code: 'HIP',
    address: 'Outer Ring Road, Bengaluru',
  },
  {
    id: '3',
    name: 'HRDesk Facility Services',
    code: 'HFS',
    address: 'Andheri East, Mumbai',
  },
];

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations] = useState<Organization[]>(DEFAULT_ORGANIZATIONS);
  const [currentOrganization, setCurrentOrganization] = useState<Organization>(() => {
    const saved = localStorage.getItem('hrdesk_active_organization');
    if (saved) {
      const match = DEFAULT_ORGANIZATIONS.find(c => c.id === saved);
      if (match) return match;
    }
    return DEFAULT_ORGANIZATIONS[0];
  });

  useEffect(() => {
    localStorage.setItem('hrdesk_active_organization', currentOrganization.id);
  }, [currentOrganization]);

  const switchOrganization = (orgId: string) => {
    const match = organizations.find(c => c.id === orgId);
    if (match) {
      setCurrentOrganization(match);
    }
  };

  return (
    <OrganizationContext.Provider value={{ currentOrganization, organizations, switchOrganization }}>
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

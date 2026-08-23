import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export interface UserProfile {
  id: number;
  username: string;
  fullName: string;
  role: string;
  roleId?: number;
  roleName?: string;
  employeeId?: number;
  employeeName?: string;
  avatarUrl?: string;
  organizationId: number;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  permissions: string[];
  permissionScopes: Record<string, string>;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permissionKey: string) => boolean;
  getPermissionScope: (permissionKey: string) => string | undefined;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('hrdesk_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('hrdesk_token'));
  const [permissions, setPermissions] = useState<string[]>(() => {
    const saved = localStorage.getItem('hrdesk_permissions');
    return saved ? JSON.parse(saved) : [];
  });
  const [permissionScopes, setPermissionScopes] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('hrdesk_permission_scopes');
    return saved ? JSON.parse(saved) : {};
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifySession = async () => {
      if (token) {
        try {
          const res = await apiClient.get('/auth/me');
          setUser(res.data.user);
          setPermissions(res.data.permissions || []);
          setPermissionScopes(res.data.permissionScopes || {});
          if (res.data.organizations && res.data.organizations.length > 0) {
            localStorage.setItem('hrdesk_db_orgs', JSON.stringify(res.data.organizations));
          }
          localStorage.setItem('hrdesk_user', JSON.stringify(res.data.user));
          localStorage.setItem('hrdesk_permissions', JSON.stringify(res.data.permissions || []));
          localStorage.setItem('hrdesk_permission_scopes', JSON.stringify(res.data.permissionScopes || {}));
        } catch {
          logout();
        }
      }
      setIsLoading(false);
    };

    verifySession();
  }, [token]);

  const login = async (username: string, password: string) => {
    const res = await apiClient.post('/auth/login', { username, password });
    const { token: newToken, user: newUser, permissions: newPerms, permissionScopes: newScopes, organizations: newOrgs } = res.data;

    setToken(newToken);
    setUser(newUser);
    setPermissions(newPerms || []);
    setPermissionScopes(newScopes || {});

    localStorage.setItem('hrdesk_token', newToken);
    localStorage.setItem('hrdesk_user', JSON.stringify(newUser));
    localStorage.setItem('hrdesk_permissions', JSON.stringify(newPerms || []));
    localStorage.setItem('hrdesk_permission_scopes', JSON.stringify(newScopes || {}));
    if (newOrgs && newOrgs.length > 0) {
      localStorage.setItem('hrdesk_db_orgs', JSON.stringify(newOrgs));
      localStorage.setItem('hrdesk_active_organization', String(newUser.organizationId || newOrgs[0].id));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setPermissions([]);
    setPermissionScopes({});
    localStorage.removeItem('hrdesk_token');
    localStorage.removeItem('hrdesk_user');
    localStorage.removeItem('hrdesk_permissions');
    localStorage.removeItem('hrdesk_permission_scopes');
    localStorage.removeItem('hrdesk_db_orgs');
    localStorage.removeItem('hrdesk_active_org_obj');
  };

  const hasPermission = (permissionKey: string): boolean => {
    if (!user) return false;
    if (user.role === 'SuperAdmin') return true;
    return permissions.includes(permissionKey);
  };

  const getPermissionScope = (permissionKey: string): string | undefined => {
    if (!user) return undefined;
    if (user.role === 'SuperAdmin') return 'All';
    return permissionScopes[permissionKey];
  };

  const isAdmin = user?.role === 'SuperAdmin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        permissions,
        permissionScopes,
        isLoading,
        login,
        logout,
        hasPermission,
        getPermissionScope,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

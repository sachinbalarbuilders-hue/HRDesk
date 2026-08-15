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
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permissionKey: string) => boolean;
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
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifySession = async () => {
      if (token) {
        try {
          const res = await apiClient.get('/auth/me');
          setUser(res.data.user);
          setPermissions(res.data.permissions || []);
          localStorage.setItem('hrdesk_user', JSON.stringify(res.data.user));
          localStorage.setItem('hrdesk_permissions', JSON.stringify(res.data.permissions || []));
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
    const { token: newToken, user: newUser, permissions: newPerms } = res.data;

    setToken(newToken);
    setUser(newUser);
    setPermissions(newPerms || []);

    localStorage.setItem('hrdesk_token', newToken);
    localStorage.setItem('hrdesk_user', JSON.stringify(newUser));
    localStorage.setItem('hrdesk_permissions', JSON.stringify(newPerms || []));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setPermissions([]);
    localStorage.removeItem('hrdesk_token');
    localStorage.removeItem('hrdesk_user');
    localStorage.removeItem('hrdesk_permissions');
  };

  const hasPermission = (permissionKey: string): boolean => {
    if (!user) return false;
    if (user.role === 'SuperAdmin' || user.role === 'Admin') return true;
    return permissions.includes(permissionKey);
  };

  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        permissions,
        isLoading,
        login,
        logout,
        hasPermission,
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

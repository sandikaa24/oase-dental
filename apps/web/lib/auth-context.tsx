'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from './api-client';
import type { Permission, UserRole } from '@oase/shared';

export interface BranchSummary {
  id: string;
  code: string;
  name: string;
}

export interface UserSession {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
  activeBranchId: string | null;
  branchContext?: string | null;
  branches: BranchSummary[];
  permissions: Permission[];
}

interface AuthContextValue {
  user: UserSession | null;
  isLoading: boolean;
  login: (email: string, password: string, branchId?: string) => Promise<UserSession>;
  logout: () => Promise<void>;
  selectBranch: (branchId: string, remember?: boolean) => Promise<void>;
  switchBranch: (branchId: string) => Promise<void>;
  refreshSession: () => Promise<UserSession | null>;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: UserSession | null;
}) {
  const [user, setUser] = useState<UserSession | null>(initialUser);
  const [isLoading, setIsLoading] = useState<boolean>(!initialUser);
  const router = useRouter();

  const refreshSession = useCallback(async (): Promise<UserSession | null> => {
    try {
      const res = await fetchApi<{ user: UserSession }>('/api/v1/auth/me');
      if (res.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      }
      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialUser) {
      refreshSession();
    }
  }, [initialUser, refreshSession]);

  const login = async (
    identifier: string,
    password: string,
    branchId?: string
  ): Promise<UserSession> => {
    const res = await fetchApi<{ user: UserSession }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, email: identifier, password, branchId }),
    });

    if (!res.data?.user) {
      throw new Error('Format response login tidak valid');
    }

    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async (): Promise<void> => {
    try {
      await fetchApi('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Abaikan error saat logout agar state lokal tetap di-clear
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  const selectBranch = async (branchId: string, remember = false): Promise<void> => {
    const res = await fetchApi<{ user: UserSession; branchContext: string }>(
      '/api/v1/auth/select-branch',
      {
        method: 'POST',
        body: JSON.stringify({ branchId, remember }),
      }
    );

    if (res.data?.user) {
      setUser(res.data.user);
      router.refresh();
    }
  };

  const switchBranch = async (branchId: string): Promise<void> => {
    return selectBranch(branchId);
  };

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      return user.permissions.includes(permission);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        selectBranch,
        switchBranch,
        refreshSession,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

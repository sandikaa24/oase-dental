'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { RoleBadge } from '@/components/ui/badge';
import {
  Menu,
  Building2,
  ChevronDown,
  LogOut,
  User,
  Check,
  Building,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { isMultiBranchUser } from '@oase/shared';
import { fetchApi } from '@/lib/api-client';
import { Globe } from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

interface OwnerBranch {
  id: string;
  code: string;
  name: string;
  active?: boolean;
}

export function Header({ onToggleMobileMenu }: HeaderProps) {
  const { user, logout, switchBranch } = useAuth();
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [ownerBranches, setOwnerBranches] = useState<OwnerBranch[]>([]);

  const branchMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        branchMenuRef.current &&
        !branchMenuRef.current.contains(event.target as Node)
      ) {
        setIsBranchMenuOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isOwner = user?.role === 'OWNER';
  const isMultiBranch = user ? isMultiBranchUser(user) : false;

  // Load cabang aktif untuk OWNER
  useEffect(() => {
    if (isOwner) {
      fetchApi<OwnerBranch[]>('/api/v1/branches?active=true&limit=100')
        .then((res) => {
          if (res.success && res.data) {
            setOwnerBranches(res.data.filter((b) => b.active !== false));
          }
        })
        .catch(() => {});
    }
  }, [isOwner]);

  const userBranches = isOwner ? ownerBranches : user?.branches || [];
  const currentBranchContext = user?.branchContext ?? user?.activeBranchId;

  const activeBranch = isOwner
    ? ownerBranches.find((b) => b.id === user?.activeBranchId)
    : userBranches.find((b) => b.id === (user?.activeBranchId || userBranches[0]?.id));

  const handleBranchSelect = async (branchId: string) => {
    if (branchId === currentBranchContext) {
      setIsBranchMenuOpen(false);
      return;
    }
    try {
      setIsSwitching(true);
      await switchBranch(branchId);
    } catch {
      // Switch branch failed
    } finally {
      setIsSwitching(false);
      setIsBranchMenuOpen(false);
    }
  };

  const getBranchLabel = () => {
    if (isOwner) {
      if (currentBranchContext === 'ALL' || (!user?.activeBranchId && !user?.branchContext)) {
        return 'Semua Cabang (Pusat)';
      }
      return activeBranch ? `${activeBranch.name} (${activeBranch.code})` : 'Pilih Cabang';
    }
    return activeBranch ? `${activeBranch.name} (${activeBranch.code})` : 'Cabang Utama';
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-border bg-surface px-4 sm:px-6 shadow-xs">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 text-slate-600 hover:text-foreground rounded-md hover:bg-slate-100"
          aria-label="Buka Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Active Branch Indicator & Switcher (§8) */}
        <div className="relative" ref={branchMenuRef}>
          {isMultiBranch ? (
            <button
              type="button"
              onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
              disabled={isSwitching}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
                'bg-branch-indicator-bg text-branch-indicator-text border-branch-indicator-border hover:bg-teal-100/70'
              )}
            >
              {isOwner && (currentBranchContext === 'ALL' || !activeBranch) ? (
                <Globe className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Building2 className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {getBranchLabel()}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-primary" />
            </button>
          ) : (
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border',
                'bg-branch-indicator-bg text-branch-indicator-text border-branch-indicator-border'
              )}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[140px] sm:max-w-[220px]">
                {getBranchLabel()}
              </span>
            </div>
          )}

          {/* Branch Switcher Dropdown */}
          {isBranchMenuOpen && isMultiBranch && (
            <div className="absolute left-0 mt-2 w-64 rounded-md border border-border bg-surface py-1 shadow-md z-50 animate-in fade-in-50">
              <div className="px-3 py-2 text-xs font-semibold text-muted border-b border-border">
                Pilih Cabang Aktif
              </div>

              {/* Pilihan Semua Cabang untuk OWNER */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => handleBranchSelect('ALL')}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-xs text-left transition-colors',
                    currentBranchContext === 'ALL'
                      ? 'bg-primary-soft text-primary font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate font-medium">Semua Cabang (Pusat)</span>
                  </div>
                  {currentBranchContext === 'ALL' && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              )}

              {/* Pilihan Cabang Fisik */}
              {userBranches.map((branch) => {
                const isSelected = branch.id === currentBranchContext;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => handleBranchSelect(branch.id)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-xs text-left transition-colors',
                      isSelected
                        ? 'bg-primary-soft text-primary font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{branch.name} ({branch.code})</span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>


      {/* User Dropdown */}
      <div className="relative" ref={userMenuRef}>
        <button
          type="button"
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-slate-50 border border-transparent hover:border-border transition-colors text-left"
          aria-expanded={isUserMenuOpen}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-border">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-foreground leading-tight truncate max-w-[120px]">
              {user?.name || user?.email?.split('@')[0] || 'Pengguna'}
            </div>
            <div className="mt-0.5">
              {user?.role && <RoleBadge role={user.role} size="sm" />}
            </div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted hidden sm:block" />
        </button>

        {isUserMenuOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-md border border-border bg-surface py-1 shadow-md z-50 animate-in fade-in-50">
            <div className="px-3.5 py-2.5 border-b border-border">
              <p className="text-xs font-semibold text-foreground truncate">
                {user?.name || 'Pengguna'}
              </p>
              <p className="text-[11px] text-muted truncate">{user?.email}</p>
              <div className="mt-2">
                {user?.role && <RoleBadge role={user.role} size="sm" />}
              </div>
            </div>

            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-xs text-danger-text hover:bg-danger-bg transition-colors"
              >
                <LogOut className="h-3.5 w-3.5 text-danger-icon" />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

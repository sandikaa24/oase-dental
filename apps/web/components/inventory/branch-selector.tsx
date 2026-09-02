'use client';

import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { Building2, Store } from 'lucide-react';

export interface Branch {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

interface BranchSelectorProps {
  selectedBranchId: string;
  onSelectBranch: (branchId: string) => void;
  className?: string;
}

export function BranchSelector({
  selectedBranchId,
  onSelectBranch,
  className = '',
}: BranchSelectorProps) {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  // Query daftar cabang khusus untuk OWNER
  const { data: branchesResponse, isLoading } = useQuery({
    queryKey: ['branches', 'list'],
    queryFn: async () => {
      return fetchApi<Branch[]>('/api/v1/branches?limit=100');
    },
    enabled: isOwner,
  });

  const branches = branchesResponse?.data ?? [];
  const activeBranches = branches.filter((b) => b.active);

  // Auto-select cabang pertama bila belum ada cabang terpilih
  useEffect(() => {
    if (isOwner && !selectedBranchId && activeBranches.length > 0 && activeBranches[0]) {
      onSelectBranch(activeBranches[0].id);
    }
  }, [isOwner, selectedBranchId, activeBranches, onSelectBranch]);

  // Tampilan untuk non-OWNER (MANAGER): Label statis cabang aktif
  if (!isOwner) {
    const currentBranchName =
      user?.branches?.find((b) => b.id === user?.activeBranchId)?.name ||
      user?.branches?.[0]?.name ||
      'Cabang Aktif';

    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 font-medium ${className}`}>
        <Store className="h-3.5 w-3.5 text-slate-500 shrink-0" />
        <span className="truncate">{currentBranchName}</span>
      </div>
    );
  }

  // Tampilan untuk OWNER: Dropdown selector cabang
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 shrink-0">
        <Building2 className="h-3.5 w-3.5 text-primary" />
        <span>Cabang:</span>
      </div>
      <select
        value={selectedBranchId}
        onChange={(e) => onSelectBranch(e.target.value)}
        disabled={isLoading || activeBranches.length === 0}
        className="h-8 px-2.5 py-1 text-xs rounded-lg border border-border bg-white text-foreground font-medium shadow-xs focus:ring-1 focus:ring-primary focus:outline-none transition-all disabled:opacity-50"
      >
        {isLoading && <option value="">Memuat cabang...</option>}
        {!isLoading && activeBranches.length === 0 && (
          <option value="">Tidak ada cabang aktif</option>
        )}
        {activeBranches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name} ({branch.code})
          </option>
        ))}
      </select>
    </div>
  );
}

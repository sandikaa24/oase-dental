'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ExpenseList } from '@/components/expenses/expense-list';
import { ExpenseModal } from '@/components/expenses/expense-modal';
import { CreditCard, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ExpensesPage() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const isOwner = user?.role === 'OWNER';
  const canCreate = user?.role === 'OWNER' || user?.role === 'MANAGER';

  // Fetch cabang aktif jika OWNER untuk filter list dan modal
  const { data: branchRes } = useQuery<ApiResponse<Array<{ id: string; name: string; code: string }>>>({
    queryKey: ['branches', 'active'],
    queryFn: () => fetchApi<Array<{ id: string; name: string; code: string }>>('/api/v1/branches?active=true'),
    enabled: isOwner,
  });

  const branches = isOwner
    ? (branchRes?.data || [])
    : (user?.branches?.map((b) => ({ id: b.id, code: b.code, name: b.name })) || []);

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Pengeluaran Operasional</h1>
          </div>
          <p className="text-xs text-muted">
            Pencatatan biaya dan pengeluaran harian klinik beserta bukti nota/kuitansi.
          </p>
        </div>

        {canCreate && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="self-start sm:self-auto gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pengeluaran</span>
          </Button>
        )}
      </div>

      {/* Konten Daftar Pengeluaran */}
      <ExpenseList
        isOwner={isOwner}
        activeBranchId={user?.activeBranchId || null}
        branches={branches}
        onOpenCreateModal={() => setIsModalOpen(true)}
      />

      {/* Modal Tambah Pengeluaran */}
      {canCreate && (
        <ExpenseModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          isOwner={isOwner}
          activeBranchId={user?.activeBranchId || null}
          branches={branches}
        />
      )}
    </div>
  );
}

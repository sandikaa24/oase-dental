'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorBanner } from '@/components/ui/placeholder';
import { formatRupiah } from '@/lib/formatters';
import {
  Package,
  Boxes,
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import type { InventoryReportItem } from './reports-types';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

export function InventoryTab() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [page, setPage] = useState(1);

  // Fetch branches untuk dropdown OWNER
  const { data: branchesResponse } = useQuery<ApiResponse<BranchOption[]>>({
    queryKey: ['branches', 'select-list'],
    queryFn: () => fetchApi<BranchOption[]>('/api/v1/branches?limit=100'),
    enabled: isOwner,
  });

  const branches = branchesResponse?.data ?? [];

  const queryParams = new URLSearchParams();
  if (isOwner && selectedBranchId) queryParams.set('branchId', selectedBranchId);
  queryParams.set('page', String(page));
  queryParams.set('limit', '20');

  const {
    data: inventoryResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<InventoryReportItem[]>>({
    queryKey: ['reports', 'inventory', selectedBranchId, page],
    queryFn: () => fetchApi<InventoryReportItem[]>(`/api/v1/reports/inventory?${queryParams.toString()}`),
  });

  const items = inventoryResponse?.data ?? [];
  const meta = inventoryResponse?.meta;

  // Hitung akumulasi valuasi dan jumlah item low stock di halaman
  const totalValuation = items.reduce((acc, curr) => {
    return acc + Number(curr.totalValuation || 0);
  }, 0);

  const lowStockCount = items.filter((i) => i.isLowStock).length;

  return (
    <div className="space-y-6">
      {/* Branch Filter (OWNER Only) */}
      {isOwner && (
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="max-w-xs space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                Filter Cabang Klinik
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Semua Cabang (Konsolidasi)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Banner */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Laporan Persediaan"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem'}
          onRetry={() => refetch()}
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Total Valuasi Persediaan (WAC)</span>
              <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                <Boxes className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-36 mt-1" />
            ) : (
              <CardTitle className="text-lg font-bold text-primary">
                {formatRupiah(totalValuation.toFixed(2))}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">
              Berdasarkan Weighted Average Cost berjalan
            </span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Bahan Stok Kritis (Low Stock)</span>
              <div className="p-1.5 rounded-md bg-danger-bg text-danger-icon">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-20 mt-1" />
            ) : (
              <CardTitle className="text-lg font-bold text-danger-text">
                {lowStockCount} Item
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">
              Kuantitas &le; batas minimum stok
            </span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Total Variasi Bahan</span>
              <div className="p-1.5 rounded-md bg-info-bg text-info-icon">
                <Package className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <CardTitle className="text-lg font-bold text-info-text">
                {meta ? meta.total : items.length} Bahan
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">
              Tercatat pada data persediaan
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Daftar Valuasi &amp; Posisi Stok Fisik</h3>
            <p className="text-xs text-muted">Metode kalkulasi harga pokok Weighted Average Cost (WAC) dari riwayat stock-in</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Tidak Ada Data Persediaan"
              description="Belum ada data stok bahan medis pada cabang ini."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nama Bahan Medis</th>
                  <th className="py-3 px-4 text-center">Stok Fisik</th>
                  <th className="py-3 px-4 text-center">Batas Min.</th>
                  <th className="py-3 px-4 text-center">Status Stok</th>
                  <th className="py-3 px-4 text-right">Harga Pokok WAC</th>
                  <th className="py-3 px-4 text-right">Total Valuasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">
                      {item.itemName}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-foreground">
                      {item.currentQuantity}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500">
                      {item.minStock}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-danger-bg text-danger-text border border-red-200">
                          <AlertTriangle className="h-3 w-3 text-danger-icon" />
                          ⚠ Kritis
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success-bg text-success-text border border-green-200">
                          <CheckCircle2 className="h-3 w-3 text-success-icon" />
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700">
                      {formatRupiah(item.wac)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-primary">
                      {formatRupiah(item.totalValuation)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {meta?.totalPages && meta.totalPages > 1 && (
          <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted">
            <span>
              Menampilkan halaman {meta.page || 1} dari {meta.totalPages} ({meta.total || 0} bahan)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-md border border-border bg-surface hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={page >= (meta.totalPages || 1)}
                onClick={() => setPage((p) => Math.min(meta.totalPages || 1, p + 1))}
                className="p-1.5 rounded-md border border-border bg-surface hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

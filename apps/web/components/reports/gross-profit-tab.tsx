'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/placeholder';
import { formatRupiah, formatDate } from '@/lib/formatters';
import {
  Calendar,
  Building2,
  Minus,
  Percent,
  Calculator,
} from 'lucide-react';
import type { GrossProfitData } from './reports-types';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

export function GrossProfitTab() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Fetch branches untuk dropdown OWNER
  const { data: branchesResponse } = useQuery<ApiResponse<BranchOption[]>>({
    queryKey: ['branches', 'select-list'],
    queryFn: () => fetchApi<BranchOption[]>('/api/v1/branches?limit=100'),
    enabled: isOwner,
  });

  const branches = branchesResponse?.data ?? [];

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set('dateFrom', dateFrom);
  if (dateTo) queryParams.set('dateTo', dateTo);
  if (isOwner && selectedBranchId) queryParams.set('branchId', selectedBranchId);

  const {
    data: profitResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<GrossProfitData>>({
    queryKey: ['reports', 'gross-profit', dateFrom, dateTo, selectedBranchId],
    queryFn: () => fetchApi<GrossProfitData>(`/api/v1/reports/gross-profit?${queryParams.toString()}`),
  });

  const profit = profitResponse?.data;
  const isProfitPositive = Number(profit?.grossProfit || 0) >= 0;

  // Hitung Margin Laba Kotor jika ada penjualan
  const revenueNum = Number(profit?.totalRevenue || 0);
  const profitNum = Number(profit?.grossProfit || 0);
  const profitMargin = revenueNum > 0 ? ((profitNum / revenueNum) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Tanggal Awal
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Tanggal Akhir
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {isOwner && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  Cabang Klinik
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Laporan Laba Kotor"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem'}
          onRetry={() => refetch()}
        />
      )}

      {/* Hero Profit Card */}
      <Card className="border-border overflow-hidden">
        <div className="bg-gradient-to-r from-primary-soft/40 to-slate-50 p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Hasil Laba Kotor Bersih Periode
              </span>
              <Badge variant={isProfitPositive ? 'success' : 'danger'} size="sm">
                {isProfitPositive ? 'SURPLUS' : 'DEFISIT'}
              </Badge>
            </div>
            {isLoading ? (
              <Skeleton className="h-10 w-64 mt-2" />
            ) : (
              <div className="text-3xl font-black tracking-tight text-foreground mt-1">
                {formatRupiah(profit?.grossProfit ?? '0')}
              </div>
            )}
            <p className="text-xs text-muted mt-1">
              Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}
            </p>
          </div>

          <div className="flex sm:flex-col items-end gap-1">
            <span className="text-xs text-muted flex items-center gap-1">
              <Percent className="h-3.5 w-3.5" /> Margin Laba Kotor
            </span>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-2xl font-bold text-primary">
                {profitMargin}%
              </span>
            )}
          </div>
        </div>

        <CardContent className="p-6">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Calculator className="h-4 w-4 text-primary" />
            Rincian Persamaan Laba Kotor (Metode WAC)
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-7 items-center gap-3">
            {/* 1. Omzet */}
            <div className="md:col-span-2 p-4 rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">1. Total Penjualan (Omzet)</span>
                <Badge variant="primary" size="sm">(+)</Badge>
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-32 mt-1" />
              ) : (
                <div className="text-lg font-bold text-primary mt-1">
                  {formatRupiah(profit?.totalRevenue ?? '0')}
                </div>
              )}
              <span className="text-[11px] text-muted">Seluruh transaksi lunas (PAID)</span>
            </div>

            {/* Minus Sign */}
            <div className="flex justify-center text-slate-400">
              <Minus className="h-5 w-5" />
            </div>

            {/* 2. HPP Stock In */}
            <div className="md:col-span-2 p-4 rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">2. HPP (Biaya Stock-In WAC)</span>
                <Badge variant="warning" size="sm">(-)</Badge>
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-32 mt-1" />
              ) : (
                <div className="text-lg font-bold text-warning-text mt-1">
                  {formatRupiah(profit?.totalCOGS ?? '0')}
                </div>
              )}
              <span className="text-[11px] text-muted">Biaya pengadaan stok dalam periode</span>
            </div>

            {/* Minus Sign */}
            <div className="flex justify-center text-slate-400">
              <Minus className="h-5 w-5" />
            </div>

            {/* 3. Pengeluaran */}
            <div className="md:col-span-2 p-4 rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">3. Pengeluaran Operasional</span>
                <Badge variant="danger" size="sm">(-)</Badge>
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-32 mt-1" />
              ) : (
                <div className="text-lg font-bold text-danger-text mt-1">
                  {formatRupiah(profit?.totalExpense ?? '0')}
                </div>
              )}
              <span className="text-[11px] text-muted">Beban biaya &amp; utilitas klinik</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

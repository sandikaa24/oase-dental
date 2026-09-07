'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/placeholder';
import { formatRupiah, formatDate, formatDateTime } from '@/lib/formatters';
import {
  Calendar,
  Building2,
  TrendingUp,
  Boxes,
  CreditCard,
  Percent,
  Calculator,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  Receipt,
  Layers,
} from 'lucide-react';
import type { ProfitLossData } from './reports-types';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

type DrilldownSubTab = 'cogs' | 'expenses' | 'revenue' | 'branches';

export function GrossProfitTab() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  // Inisialisasi tanggal default: 30 hari terakhir
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [drilldownPage, setDrilldownPage] = useState(1);
  const [activeSubTab, setActiveSubTab] = useState<DrilldownSubTab>('cogs');

  // Preset filter cepat
  const applyPreset = (days: number) => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setDateFrom(start);
    setDateTo(end);
    setDrilldownPage(1);
  };

  const applyThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date().toISOString().split('T')[0];
    setDateFrom(start);
    setDateTo(end);
    setDrilldownPage(1);
  };

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
  queryParams.set('page', String(drilldownPage));
  queryParams.set('limit', '15');

  const {
    data: reportResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<ProfitLossData>>({
    queryKey: ['reports', 'profit-loss', dateFrom, dateTo, selectedBranchId, drilldownPage],
    queryFn: () => fetchApi<ProfitLossData>(`/api/v1/reports/profit-loss?${queryParams.toString()}`),
  });

  const report = reportResponse?.data;
  const summary = report?.summary;
  const isNetProfitPositive = summary?.status === 'SURPLUS';
  const drilldownMeta = report?.stockMovementDrilldown?.meta;
  const drilldownItems = report?.stockMovementDrilldown?.data ?? [];
  const branchComparisons = report?.branchComparisons ?? [];

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <span className="text-xs font-semibold text-slate-600">Rentang Periode Cepat:</span>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => applyPreset(0)}
                className="text-[11px] h-7 px-2.5"
              >
                Hari Ini
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => applyPreset(7)}
                className="text-[11px] h-7 px-2.5"
              >
                7 Hari
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => applyPreset(30)}
                className="text-[11px] h-7 px-2.5"
              >
                30 Hari
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={applyThisMonth}
                className="text-[11px] h-7 px-2.5"
              >
                Bulan Ini
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Tanggal Awal
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDrilldownPage(1);
                }}
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
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setDrilldownPage(1);
                }}
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
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    setDrilldownPage(1);
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Laporan Laba Rugi"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem'}
          onRetry={() => refetch()}
        />
      )}

      {/* Hero Profit Card (Laba Bersih & Margin) */}
      <Card className="border-border overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-primary-soft/50 via-surface to-slate-50 p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Laba Bersih Operasional (Net Profit)
              </span>
              <Badge variant={isNetProfitPositive ? 'success' : 'danger'} size="sm">
                {summary?.status ?? 'SURPLUS'}
              </Badge>
            </div>
            {isLoading ? (
              <Skeleton className="h-10 w-64 mt-2" />
            ) : (
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black tracking-tight text-foreground">
                  {formatRupiah(summary?.netProfit ?? '0')}
                </span>
                {isNetProfitPositive ? (
                  <ArrowUpRight className="h-6 w-6 text-success-icon" />
                ) : (
                  <ArrowDownRight className="h-6 w-6 text-danger-icon" />
                )}
              </div>
            )}
            <p className="text-xs text-muted mt-1">
              Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)} • Basis Kas (diakui saat dibayar)
            </p>
          </div>

          <div className="flex sm:flex-col items-end gap-1">
            <span className="text-xs text-muted flex items-center gap-1">
              <Percent className="h-3.5 w-3.5 text-primary" /> Margin Laba Bersih
            </span>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-2xl font-black text-primary">
                {summary?.netProfitMargin ?? '0.0'}%
              </span>
            )}
            <span className="text-[11px] text-muted">dari total penerimaan kas</span>
          </div>
        </div>

        {/* 4 Pilar KPI Laba Rugi */}
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Pendapatan */}
            <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted flex items-center gap-1.5 font-semibold">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  1. Total Pendapatan
                </span>
                <Badge variant="primary" size="sm">(+)</Badge>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-32" />
                ) : (
                  <div className="text-xl font-bold text-primary">
                    {formatRupiah(summary?.totalRevenue ?? '0')}
                  </div>
                )}
                <div className="text-[11px] text-muted mt-1">
                  {summary?.transactionCount ?? 0} transaksi lunas (AOV: {formatRupiah(summary?.aov ?? '0')})
                </div>
              </div>
            </div>

            {/* 2. HPP Persediaan */}
            <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted flex items-center gap-1.5 font-semibold">
                  <Boxes className="h-3.5 w-3.5 text-warning-text" />
                  2. HPP Persediaan
                </span>
                <Badge variant="warning" size="sm">(-)</Badge>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-32" />
                ) : (
                  <div className="text-xl font-bold text-warning-text">
                    {formatRupiah(summary?.totalCOGS ?? '0')}
                  </div>
                )}
                <div className="text-[11px] text-muted mt-1 flex items-center gap-1">
                  Pemakaian stok &amp; susut opname
                  {summary && summary.uncostedMovementCount > 0 && (
                    <span className="text-danger-text inline-flex items-center gap-0.5 font-semibold" title="Ada item tanpa HPP">
                      <AlertTriangle className="h-3 w-3" /> {summary.uncostedMovementCount}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Laba Kotor */}
            <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted flex items-center gap-1.5 font-semibold">
                  <Calculator className="h-3.5 w-3.5 text-slate-600" />
                  3. Laba Kotor
                </span>
                <Badge variant="neutral" size="sm">Margin {summary?.grossProfitMargin ?? '0'}%</Badge>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-32" />
                ) : (
                  <div className="text-xl font-bold text-foreground">
                    {formatRupiah(summary?.grossProfit ?? '0')}
                  </div>
                )}
                <div className="text-[11px] text-muted mt-1">
                  Pendapatan − HPP Persediaan
                </div>
              </div>
            </div>

            {/* 4. Beban Operasional */}
            <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted flex items-center gap-1.5 font-semibold">
                  <CreditCard className="h-3.5 w-3.5 text-danger-text" />
                  4. Beban Operasional
                </span>
                <Badge variant="danger" size="sm">(-)</Badge>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-32" />
                ) : (
                  <div className="text-xl font-bold text-danger-text">
                    {formatRupiah(summary?.totalExpense ?? '0')}
                  </div>
                )}
                <div className="text-[11px] text-muted mt-1">
                  Gaji, sewa, utilitas, &amp; operasional
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drill-down Sub-Tabs */}
      <Card className="border-border shadow-sm">
        <div className="border-b border-border px-6 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Rincian &amp; Analisis Laba Rugi
            </h3>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-px">
            <button
              type="button"
              onClick={() => setActiveSubTab('cogs')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeSubTab === 'cogs'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-foreground'
              }`}
            >
              <Boxes className="h-3.5 w-3.5" />
              Rincian HPP Persediaan
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('expenses')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeSubTab === 'expenses'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-foreground'
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              Rincian Beban Operasional
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('revenue')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeSubTab === 'revenue'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-foreground'
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />
              Rincian Penerimaan Kas
            </button>
            {isOwner && !selectedBranchId && branchComparisons.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveSubTab('branches')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                  activeSubTab === 'branches'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-foreground'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                Komparasi Antar Cabang
              </button>
            )}
          </div>
        </div>

        <CardContent className="p-6">
          {/* SUB-TAB 1: HPP Persediaan */}
          {activeSubTab === 'cogs' && (
            <div className="space-y-6">
              {/* Kategori HPP Breakdown Cards */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Distribusi Beban per Kategori Produk
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(report?.cogsBreakdown?.byCategory ?? {}).length === 0 ? (
                    <div className="col-span-full text-xs text-muted p-4 border border-border rounded-lg text-center bg-slate-50">
                      Tidak ada pergerakan pemakaian persediaan pada periode ini.
                    </div>
                  ) : (
                    Object.entries(report?.cogsBreakdown?.byCategory ?? {}).map(([cat, amount]) => (
                      <div key={cat} className="p-3 rounded-lg border border-border bg-surface">
                        <span className="text-xs text-muted font-medium">{cat}</span>
                        <div className="text-sm font-bold text-foreground mt-1">
                          {formatRupiah(amount)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Tabel Mutasi Stok Pemakaian */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Log Pemakaian Stok &amp; Susut Opname (Snapshot HPP)
                  </h4>
                  <span className="text-xs text-muted">
                    Total: {drilldownMeta?.total ?? 0} pergerakan
                  </span>
                </div>

                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-border">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Waktu Mutasi</th>
                        <th className="px-3 py-2.5 font-semibold">Produk &amp; Kategori</th>
                        <th className="px-3 py-2.5 font-semibold">Tipe</th>
                        <th className="px-3 py-2.5 font-semibold text-right">Delta Qty</th>
                        <th className="px-3 py-2.5 font-semibold text-right">HPP Satuan</th>
                        <th className="px-3 py-2.5 font-semibold text-right">Beban Biaya (Rp)</th>
                        <th className="px-3 py-2.5 font-semibold">Cabang</th>
                        <th className="px-3 py-2.5 font-semibold">Petugas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            <td colSpan={8} className="p-3">
                              <Skeleton className="h-5 w-full" />
                            </td>
                          </tr>
                        ))
                      ) : drilldownItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-muted">
                            Belum ada catatan mutasi pemakaian stok (OUT atau ADJUSTMENT) dalam periode ini.
                          </td>
                        </tr>
                      ) : (
                        drilldownItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2.5 text-muted whitespace-nowrap">
                              {formatDateTime(item.createdAt)}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-foreground">{item.productName}</div>
                              <div className="text-[11px] text-muted">
                                {item.sku ? `${item.sku} • ` : ''}{item.category}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge
                                variant={item.type === 'OUT' ? 'warning' : 'neutral'}
                                size="sm"
                              >
                                {item.type}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium">
                              {item.qtyDelta} {item.unit}
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted">
                              {formatRupiah(item.costPrice)}
                              {item.costPriceSnapshot ? (
                                <span className="block text-[10px] text-success-text">snapshot</span>
                              ) : (
                                <span className="block text-[10px] text-warning-text">master</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-foreground">
                              {formatRupiah(item.costImpact)}
                            </td>
                            <td className="px-3 py-2.5 text-muted whitespace-nowrap">
                              {item.branchCode}
                            </td>
                            <td className="px-3 py-2.5 text-muted whitespace-nowrap">
                              {item.creatorName}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {drilldownMeta && drilldownMeta.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-muted">
                      Halaman {drilldownMeta.page} dari {drilldownMeta.totalPages}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={drilldownMeta.page <= 1}
                        onClick={() => setDrilldownPage((p) => Math.max(1, p - 1))}
                        className="h-7 px-2"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={drilldownMeta.page >= drilldownMeta.totalPages}
                        onClick={() => setDrilldownPage((p) => p + 1)}
                        className="h-7 px-2"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: Beban Operasional */}
          {activeSubTab === 'expenses' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Breakdown Beban Operasional per Kategori Pengeluaran
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(report?.expenseBreakdown?.byCategory ?? {}).length === 0 ? (
                  <div className="col-span-full text-xs text-muted p-4 border border-border rounded-lg text-center bg-slate-50">
                    Tidak ada pengeluaran operasional yang dicatat pada rentang tanggal ini.
                  </div>
                ) : (
                  Object.entries(report?.expenseBreakdown?.byCategory ?? {}).map(([cat, amount]) => {
                    const amtNum = Number(amount);
                    const totalExp = Number(summary?.totalExpense || 1);
                    const pct = totalExp > 0 ? ((amtNum / totalExp) * 100).toFixed(1) : '0.0';

                    return (
                      <div key={cat} className="p-4 rounded-xl border border-border bg-surface">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">{cat}</span>
                          <Badge variant="neutral" size="sm">{pct}%</Badge>
                        </div>
                        <div className="text-lg font-black text-danger-text mt-2">
                          {formatRupiah(amount)}
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
                          <div
                            className="bg-danger-icon h-full rounded-full"
                            style={{ width: `${Math.min(100, Number(pct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: Penerimaan Kas */}
          {activeSubTab === 'revenue' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Penerimaan Pembayaran Kas Berdasarkan Metode
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Object.entries(report?.revenueBreakdown?.byPaymentMethod ?? {}).map(([method, amount]) => {
                  const amtNum = Number(amount);
                  const totalRev = Number(summary?.totalRevenue || 1);
                  const pct = totalRev > 0 ? ((amtNum / totalRev) * 100).toFixed(1) : '0.0';

                  return (
                    <div key={method} className="p-4 rounded-xl border border-border bg-surface">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">{method}</span>
                        <Badge variant="primary" size="sm">{pct}%</Badge>
                      </div>
                      <div className="text-lg font-black text-foreground mt-2">
                        {formatRupiah(amount)}
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${Math.min(100, Number(pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUB-TAB 4: Komparasi Cabang (OWNER Konsolidasi) */}
          {activeSubTab === 'branches' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Perbandingan Kinerja Laba Rugi Antar Cabang
              </h4>

              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-border">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Cabang</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Pendapatan</th>
                      <th className="px-3 py-2.5 font-semibold text-right">HPP Persediaan</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Laba Kotor</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Beban Opex</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Laba Bersih</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Margin</th>
                      <th className="px-3 py-2.5 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {branchComparisons.map((b) => (
                      <tr key={b.branchId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-foreground">{b.branchName}</div>
                          <div className="text-[11px] text-muted">{b.branchCode}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-primary">
                          {formatRupiah(b.revenue)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-warning-text">
                          {formatRupiah(b.cogs)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                          {formatRupiah(b.grossProfit)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-danger-text">
                          {formatRupiah(b.expense)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-black text-foreground">
                          {formatRupiah(b.netProfit)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-primary">
                          {b.netProfitMargin}%
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant={b.status === 'SURPLUS' ? 'success' : 'danger'} size="sm">
                            {b.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorBanner } from '@/components/ui/placeholder';
import { formatRupiah, formatDate } from '@/lib/formatters';
import {
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
} from 'lucide-react';
import type { ExpensesReportData } from './reports-types';

export function ExpensesTab() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [category, setCategory] = useState<string>('');
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set('dateFrom', dateFrom);
  if (dateTo) queryParams.set('dateTo', dateTo);
  if (category) queryParams.set('category', category);
  queryParams.set('page', String(page));
  queryParams.set('limit', '20');

  const {
    data: expensesResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<ExpensesReportData>>({
    queryKey: ['reports', 'expenses', dateFrom, dateTo, category, page],
    queryFn: () => fetchApi<ExpensesReportData>(`/api/v1/reports/expenses?${queryParams.toString()}`),
  });

  const reportData = expensesResponse?.data;
  const items = reportData?.data ?? [];
  const totalExpense = reportData?.summary?._sum?.amount ?? '0';
  const meta = expensesResponse?.meta;

  const categoryBadge = (cat: string) => {
    switch (cat) {
      case 'OPERASIONAL':
        return <Badge variant="info">OPERASIONAL</Badge>;
      case 'MEDIS':
        return <Badge variant="primary">MEDIS</Badge>;
      case 'UTILITAS':
        return <Badge variant="warning">UTILITAS</Badge>;
      case 'GAJI_BONUS':
        return <Badge variant="success">GAJI &amp; BONUS</Badge>;
      default:
        return <Badge variant="neutral">LAINNYA</Badge>;
    }
  };

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
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
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
                  setPage(1);
                }}
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                Kategori Pengeluaran
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Semua Kategori</option>
                <option value="OPERASIONAL">Operasional</option>
                <option value="MEDIS">Bahan / Obat Medis</option>
                <option value="UTILITAS">Utilitas (Air, Listrik, Internet)</option>
                <option value="GAJI_BONUS">Gaji &amp; Bonus</option>
                <option value="LAINNYA">Lain-lain</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Laporan Pengeluaran"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem'}
          onRetry={() => refetch()}
        />
      )}

      {/* Summary Highlight */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Total Pengeluaran Periode</span>
              <div className="p-1.5 rounded-md bg-danger-bg text-danger-icon">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : (
              <CardTitle className="text-lg font-bold text-danger-text">
                {formatRupiah(totalExpense)}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">
              {meta ? `${meta.total} transaksi pengeluaran` : 'Total periode terfilter'}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Expenses Table */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Daftar Rekapitulasi Pengeluaran</h3>
            <p className="text-xs text-muted">Pencatatan pengeluaran operasional klinik dan utilitas</p>
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
              title="Tidak Ada Data Pengeluaran"
              description="Tidak ditemukan catatan pengeluaran pada rentang tanggal atau kategori yang dipilih."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Cabang</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Catatan / Deskripsi</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                      {formatDate(exp.expenseDate)}
                    </td>
                    <td className="py-3 px-4 text-foreground font-medium">
                      {exp.branch?.name || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {categoryBadge(exp.category)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                      {exp.note || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-danger-text">
                      {formatRupiah(exp.amount)}
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
              Menampilkan halaman {meta.page || 1} dari {meta.totalPages} ({meta.total || 0} transaksi)
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

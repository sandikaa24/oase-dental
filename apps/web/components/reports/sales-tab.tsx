'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorBanner } from '@/components/ui/placeholder';
import { formatRupiah, formatDateTime } from '@/lib/formatters';
import {
  CreditCard,
  Banknote,
  QrCode,
  ArrowLeftRight,
  TrendingUp,
  Receipt,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { SalesReportData } from './reports-types';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

export function SalesTab() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  // Default date range: 30 hari terakhir
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [page, setPage] = useState(1);

  // Fetch branches untuk dropdown OWNER
  const { data: branchesResponse } = useQuery<ApiResponse<BranchOption[]>>({
    queryKey: ['branches', 'select-list'],
    queryFn: () => fetchApi<BranchOption[]>('/api/v1/branches?limit=100'),
    enabled: isOwner,
  });

  const branches = branchesResponse?.data ?? [];

  // Query sales data
  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set('dateFrom', dateFrom);
  if (dateTo) queryParams.set('dateTo', dateTo);
  if (isOwner && selectedBranchId) queryParams.set('branchId', selectedBranchId);
  if (paymentMethod) queryParams.set('method', paymentMethod);
  queryParams.set('page', String(page));
  queryParams.set('limit', '20');

  const {
    data: salesResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<SalesReportData>>({
    queryKey: ['reports', 'sales', dateFrom, dateTo, selectedBranchId, paymentMethod, page],
    queryFn: () => fetchApi<SalesReportData>(`/api/v1/reports/sales?${queryParams.toString()}`),
  });

  const reportData = salesResponse?.data;
  const summary = reportData?.summary;
  const transactions = reportData?.transactions ?? [];
  const meta = salesResponse?.meta;

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date From */}
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

            {/* Date To */}
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

            {/* Filter Cabang (HANYA OWNER) */}
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
            )}

            {/* Filter Metode Bayar */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Semua Metode</option>
                <option value="CASH">Tunai (Cash)</option>
                <option value="DEBIT">Kartu Debit</option>
                <option value="QRIS">QRIS</option>
                <option value="TRANSFER">Transfer Bank</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Laporan Penjualan"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem'}
          onRetry={() => refetch()}
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Omzet */}
        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Total Omzet</span>
              <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-28 mt-1" />
            ) : (
              <CardTitle className="text-base font-bold text-primary">
                {formatRupiah(summary?.totalRevenue ?? '0')}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">
              {summary?.transactionCount ?? 0} transaksi lunas
            </span>
          </CardContent>
        </Card>

        {/* Cash */}
        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Tunai (Cash)</span>
              <div className="p-1.5 rounded-md bg-success-bg text-success-icon">
                <Banknote className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-28 mt-1" />
            ) : (
              <CardTitle className="text-base font-bold text-success-text">
                {formatRupiah(summary?.cashRevenue ?? '0')}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">Uang tunai kasir</span>
          </CardContent>
        </Card>

        {/* Debit */}
        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Debit Card</span>
              <div className="p-1.5 rounded-md bg-info-bg text-info-icon">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-28 mt-1" />
            ) : (
              <CardTitle className="text-base font-bold text-info-text">
                {formatRupiah(summary?.debitRevenue ?? '0')}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">Mesin EDC EDC</span>
          </CardContent>
        </Card>

        {/* QRIS */}
        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">QRIS</span>
              <div className="p-1.5 rounded-md bg-warning-bg text-warning-icon">
                <QrCode className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-28 mt-1" />
            ) : (
              <CardTitle className="text-base font-bold text-warning-text">
                {formatRupiah(summary?.qrisRevenue ?? '0')}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">Pembayaran instan</span>
          </CardContent>
        </Card>

        {/* Transfer */}
        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Transfer</span>
              <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                <ArrowLeftRight className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-28 mt-1" />
            ) : (
              <CardTitle className="text-base font-bold text-foreground">
                {formatRupiah(summary?.transferRevenue ?? '0')}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">Rekening klinik</span>
          </CardContent>
        </Card>

        {/* Total Transaksi */}
        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Total Volume</span>
              <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <CardTitle className="text-base font-bold text-foreground">
                {summary?.transactionCount ?? 0}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">Kwitansi terbit</span>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Rincian Transaksi Penjualan</h3>
            <p className="text-xs text-muted">Daftar transaksi status PAID dalam rentang waktu yang dipilih</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Tidak Ada Transaksi Penjualan"
              description="Tidak ditemukan transaksi lunas (PAID) pada rentang tanggal atau cabang yang dipilih."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">No. Transaksi</th>
                  <th className="py-3 px-4">Tanggal &amp; Waktu</th>
                  <th className="py-3 px-4">Cabang</th>
                  <th className="py-3 px-4">Pasien</th>
                  <th className="py-3 px-4">Kasir</th>
                  <th className="py-3 px-4">Metode Bayar</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      {trx.transactionNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {formatDateTime(trx.transactionDate)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {trx.branch?.name || '-'}
                    </td>
                    <td className="py-3 px-4 text-foreground font-medium">
                      {trx.patientName || 'Pasien Umum'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {trx.cashier?.name || trx.cashier?.email || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="neutral" size="sm">
                        {trx.paymentMethod}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-primary">
                      {formatRupiah(trx.total)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="success" size="sm">
                        PAID
                      </Badge>
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

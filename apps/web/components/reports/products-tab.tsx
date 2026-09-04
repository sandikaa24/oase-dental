'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorBanner } from '@/components/ui/placeholder';
import { formatRupiah } from '@/lib/formatters';
import {
  Package,
  Calendar,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { ProductReportItem } from './reports-types';

export function ProductsTab() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set('dateFrom', dateFrom);
  if (dateTo) queryParams.set('dateTo', dateTo);

  const {
    data: productsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<ProductReportItem[]>>({
    queryKey: ['reports', 'products', dateFrom, dateTo],
    queryFn: () => fetchApi<ProductReportItem[]>(`/api/v1/reports/products?${queryParams.toString()}`),
  });

  const products = productsResponse?.data ?? [];

  // Hitung total unit dan total revenue
  const totalQuantity = products.reduce((acc, curr) => acc + curr.quantity, 0);
  const topProduct = products[0];

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Laporan Produk"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem'}
          onRetry={() => refetch()}
        />
      )}

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Produk / Layanan Terlaris</span>
              <div className="p-1.5 rounded-md bg-warning-bg text-warning-icon">
                <Trophy className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-32 mt-1" />
            ) : (
              <CardTitle className="text-base font-bold text-foreground truncate">
                {topProduct ? topProduct.name : '-'}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">
              {topProduct ? `${topProduct.quantity} item terjual` : 'Belum ada data'}
            </span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Total Volume Penjualan Item</span>
              <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                <Package className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <CardTitle className="text-base font-bold text-primary">
                {totalQuantity} Unit
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">
              Dari {products.length} variasi layanan &amp; bahan
            </span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Total Variasi Terjual</span>
              <div className="p-1.5 rounded-md bg-info-bg text-info-icon">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <CardTitle className="text-base font-bold text-info-text">
                {products.length} Item
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-[11px] text-muted">Tercatat dalam transaksi</span>
          </CardContent>
        </Card>
      </div>

      {/* Table of Products */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Peringkat Layanan &amp; Obat Terlaris</h3>
            <p className="text-xs text-muted">Diurutkan berdasarkan kuantitas transaksi terbanyak (Sort by Qty Descending)</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : products.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Tidak Ada Data Produk Terjual"
              description="Belum ada transaksi tindakan atau bahan medis pada rentang tanggal yang dipilih."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-16 text-center">Rank</th>
                  <th className="py-3 px-4">Nama Layanan / Bahan</th>
                  <th className="py-3 px-4 text-right">Kuantitas Terjual</th>
                  <th className="py-3 px-4 text-right">Kontribusi Omzet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p, idx) => (
                  <tr key={p.itemId || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-500">
                      {idx === 0 ? (
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-800 text-xs">
                          🥇
                        </span>
                      ) : idx === 1 ? (
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-200 text-slate-700 text-xs">
                          🥈
                        </span>
                      ) : idx === 2 ? (
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-orange-100 text-orange-800 text-xs">
                          🥉
                        </span>
                      ) : (
                        `#${idx + 1}`
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {p.name}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-foreground">
                      {p.quantity} unit
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-primary">
                      {formatRupiah(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

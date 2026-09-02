'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRupiah, formatDate } from '@/lib/formatters';
import { CalendarDays, TrendingUp, Banknote, Receipt } from 'lucide-react';
import type { ClosingPreview } from './closing-types';

interface ClosingPreviewPanelProps {
  preview: ClosingPreview;
  isLoading?: boolean;
}

/**
 * Panel preview kas: menampilkan informasi periode berjalan dan
 * expectedCash yang dihitung server sebelum kasir submit.
 * §24: formatRupiah dari string Decimal, tanpa parseFloat.
 */
export function ClosingPreviewPanel({ preview, isLoading }: ClosingPreviewPanelProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-36 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Deteksi apakah period start masih epoch (belum pernah ada closing)
  const isFirstClosing = preview.periodStart.startsWith('1970');
  const periodStartDisplay = isFirstClosing
    ? 'Awal Operasional'
    : formatDate(preview.periodStart, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Awal Periode */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Awal Periode</CardDescription>
            <div className="p-1.5 rounded-md bg-info-bg text-info-icon">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <CardTitle className="text-base font-semibold text-foreground truncate">
            {periodStartDisplay}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted">
            {isFirstClosing ? 'Tidak ada closing sebelumnya' : 'Sejak closing terakhir'}
          </p>
        </CardContent>
      </Card>

      {/* Jumlah Transaksi */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Transaksi Periode Ini</CardDescription>
            <div className="p-1.5 rounded-md bg-primary-soft text-primary">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            {preview.transactionCount}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted">Semua metode pembayaran</p>
        </CardContent>
      </Card>

      {/* Total Omset */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Total Omset Periode</CardDescription>
            <div className="p-1.5 rounded-md bg-success-bg text-success-icon">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <CardTitle className="text-xl font-bold text-success-text">
            {formatRupiah(preview.totalRevenue)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted">Tunai + Non-Tunai</p>
        </CardContent>
      </Card>

      {/* Ekspektasi Kas Tunai (server) */}
      <Card className="border-warning-bg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Ekspektasi Kas Tunai</CardDescription>
            <div className="p-1.5 rounded-md bg-warning-bg text-warning-icon">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <CardTitle className="text-xl font-bold text-warning-text">
            {formatRupiah(preview.expectedCash)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted">Dihitung server — hanya CASH</p>
        </CardContent>
      </Card>
    </div>
  );
}

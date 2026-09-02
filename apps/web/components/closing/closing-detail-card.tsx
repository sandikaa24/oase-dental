'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClosingStatusBadge, VarianceBadge } from './closing-status-badge';
import { formatRupiah, formatDateTime, formatDate } from '@/lib/formatters';
import { Receipt, RotateCcw, Calendar, User } from 'lucide-react';
import type { CashClosing } from './closing-types';

interface ClosingDetailCardProps {
  closing: CashClosing;
  isLoading?: boolean;
  canReopen?: boolean; // hanya true untuk OWNER
  onReopen?: () => void;
}

/**
 * Kartu detail closing (read-only).
 * Digunakan untuk:
 * 1. Tampilan setelah kasir berhasil submit (status CLOSED).
 * 2. Halaman detail /admin/cash-closing/:id.
 * §24: formatRupiah dari string Decimal; formatDateTime Asia/Jakarta.
 * §20: Status + variance selalu disertai teks label.
 */
export function ClosingDetailCard({
  closing,
  isLoading,
  canReopen = false,
  onReopen,
}: ClosingDetailCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const closedByName =
    closing.closedByUser?.employee?.name ??
    closing.closedByUser?.email ??
    closing.closedBy;

  const reopenedByName = closing.reopenedByUser
    ? (closing.reopenedByUser.employee?.name ?? closing.reopenedByUser.email)
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                Rekap Closing {formatDate(closing.closingDate)}
              </CardTitle>
              <p className="text-xs text-muted mt-0.5">
                {closing.branch.name} ({closing.branch.code})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ClosingStatusBadge status={closing.status} />
            {canReopen && closing.status === 'CLOSED' && onReopen && (
              <Button
                id="reopen-closing-btn"
                variant="secondary"
                size="sm"
                onClick={onReopen}
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Buka Kembali
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Info periode */}
        <div className="rounded-lg bg-background border border-border p-3 space-y-2 text-sm">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted mb-2">
            <Calendar className="h-3.5 w-3.5" />
            Informasi Periode
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Awal Periode</span>
            <span className="font-medium text-foreground text-right">
              {closing.periodStart.startsWith('1970')
                ? 'Awal Operasional'
                : formatDateTime(closing.periodStart)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Waktu Closing</span>
            <span className="font-medium text-foreground">{formatDateTime(closing.closingDate)}</span>
          </div>
        </div>

        {/* Rekap kas */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="text-muted">Ekspektasi Server</span>
            <span className="font-semibold text-foreground">{formatRupiah(closing.expectedCash)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="text-muted">Kas Fisik Dihitung</span>
            <span className="font-semibold text-foreground">{formatRupiah(closing.actualCash)}</span>
          </div>
          <div className="flex justify-between items-center py-1.5">
            <span className="text-muted font-medium">Selisih</span>
            <VarianceBadge variance={closing.variance} />
          </div>
        </div>

        {/* Catatan */}
        {closing.note && (
          <div className="rounded-md bg-background border border-border p-3">
            <p className="text-xs font-medium text-muted mb-1">Catatan</p>
            <p className="text-sm text-foreground">{closing.note}</p>
          </div>
        )}

        {/* Info petugas */}
        <div className="flex items-center gap-2 text-xs text-muted pt-1">
          <User className="h-3.5 w-3.5" />
          <span>Ditutup oleh: <span className="font-medium text-foreground">{closedByName}</span></span>
        </div>

        {/* Info reopen (jika ada) */}
        {closing.status === 'OPEN' && closing.reopenedAt && (
          <div className="rounded-md bg-warning-bg border border-amber-200 p-3 text-xs space-y-1">
            <p className="font-medium text-warning-text">Kas Dibuka Kembali</p>
            <p className="text-warning-text">
              Oleh: <strong>{reopenedByName}</strong> pada {formatDateTime(closing.reopenedAt)}
            </p>
            {closing.reopenedReason && (
              <p className="text-warning-text">Alasan: {closing.reopenedReason}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

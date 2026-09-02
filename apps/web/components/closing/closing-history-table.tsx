'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/placeholder';
import { ClosingStatusBadge, VarianceBadge } from './closing-status-badge';
import { formatRupiah, formatDate } from '@/lib/formatters';
import { Receipt, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { CashClosing } from './closing-types';

interface ClosingHistoryTableProps {
  closings: CashClosing[];
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * Tabel riwayat closing dengan pagination.
 * §23: Loading skeleton, empty state, error (ditangani di parent).
 * §24: formatRupiah string Decimal, formatDate Asia/Jakarta.
 */
export function ClosingHistoryTable({
  closings,
  isLoading,
  currentPage,
  totalPages,
  total,
  onPageChange,
}: ClosingHistoryTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (closings.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="h-6 w-6" />}
        title="Belum Ada Riwayat Closing"
        description="Data closing kas akan muncul di sini setelah pertama kali melakukan tutup kas."
      />
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                    Tanggal Closing
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                    Cabang
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">
                    Ekspektasi
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">
                    Kas Fisik
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted uppercase tracking-wide">
                    Selisih
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted uppercase tracking-wide">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {closings.map((closing) => (
                  <tr key={closing.id} className="hover:bg-background transition-colors">
                    <td className="px-4 py-3 text-foreground">
                      {formatDate(closing.closingDate)}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      <span className="font-medium">{closing.branch.code}</span>
                      <span className="text-muted ml-1 text-xs">— {closing.branch.name}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatRupiah(closing.expectedCash)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatRupiah(closing.actualCash)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <VarianceBadge variance={closing.variance} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ClosingStatusBadge status={closing.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/admin/cash-closing/${closing.id}`}>
                        <Button variant="secondary" size="sm" className="gap-1">
                          Detail
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden divide-y divide-border">
            {closings.map((closing) => (
              <Link
                key={closing.id}
                href={`/admin/cash-closing/${closing.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-background transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {formatDate(closing.closingDate)}
                  </p>
                  <p className="text-xs text-muted">
                    {closing.branch.code} · Ekspektasi {formatRupiah(closing.expectedCash)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <ClosingStatusBadge status={closing.status} size="sm" />
                    <VarianceBadge variance={closing.variance} />
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Total {total} data · Halaman {currentPage} dari {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              id="closing-prev-page-btn"
              variant="secondary"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="gap-1"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
              Sebelumnya
            </Button>
            <Button
              id="closing-next-page-btn"
              variant="secondary"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="gap-1"
              aria-label="Halaman berikutnya"
            >
              Berikutnya
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

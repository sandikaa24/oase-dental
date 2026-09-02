'use client';

import React from 'react';
import Link from 'next/link';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { StockOpnameSummary } from './inventory-types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/placeholder';
import { ClipboardList, ChevronRight, CheckCircle, Clock, ChevronLeft } from 'lucide-react';

interface OpnameTableProps {
  opnames: StockOpnameSummary[];
  isLoading: boolean;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  onPageChange: (page: number) => void;
}

export function OpnameTable({
  opnames,
  isLoading,
  meta,
  onPageChange,
}: OpnameTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    );
  }

  if (opnames.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-8 w-8 text-muted" />}
        title="Belum Ada Riwayat Stock Opname"
        description="Belum ada sesi stock opname yang dibuat atau tercatat pada cabang ini."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-border text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Tanggal Opname</th>
                <th className="py-3 px-4">Cabang</th>
                <th className="py-3 px-4 text-center">Jumlah Item</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Waktu Finalisasi</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {opnames.map((o) => {
                const isDraft = o.status === 'DRAFT';
                return (
                  <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                      {formatDate(o.opnameDate)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {o.branchName}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium whitespace-nowrap">
                      {o.itemCount} item
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {isDraft ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-300">
                          <Clock className="h-3 w-3 text-amber-600" />
                          <span>DRAFT</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-50 text-teal-800 border border-teal-300">
                          <CheckCircle className="h-3 w-3 text-teal-600" />
                          <span>SUBMITTED</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {o.submittedAt ? formatDateTime(o.submittedAt) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link href={`/admin/inventory/opname/${o.id}`}>
                        <Button
                          variant={isDraft ? 'primary' : 'secondary'}
                          size="sm"
                          className="h-7 text-xs flex items-center gap-1 ml-auto"
                        >
                          <span>{isDraft ? 'Edit & Submit' : 'Lihat Detail'}</span>
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {meta && typeof meta.totalPages === 'number' && meta.totalPages > 1 && (
          <div className="p-4 border-t border-border bg-slate-50 flex items-center justify-between text-xs">
            <span className="text-muted">
              Menampilkan {opnames.length} dari {meta.total ?? opnames.length} opname
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPageChange((meta.page ?? 1) - 1)}
                disabled={(meta.page ?? 1) <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Sebelumnya
              </Button>
              <span className="px-2 font-medium">
                {meta.page ?? 1} / {meta.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPageChange((meta.page ?? 1) + 1)}
                disabled={(meta.page ?? 1) >= meta.totalPages || isLoading}
              >
                Berikutnya
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

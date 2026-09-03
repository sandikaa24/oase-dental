'use client';

import React from 'react';
import { StockItem } from './inventory-types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/placeholder';
import { History, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

interface StockTableProps {
  items: StockItem[];
  isLoading: boolean;
  onOpenMovementDrawer: (item: StockItem) => void;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  onPageChange: (page: number) => void;
}

export function StockTable({
  items,
  isLoading,
  onOpenMovementDrawer,
  meta,
  onPageChange,
}: StockTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Tidak Ada Data Stok"
        description="Tidak ditemukan bahan medis yang sesuai dengan filter pencarian atau cabang aktif."
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
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Nama Bahan Medis</th>
                <th className="py-3 px-4 text-right">Stok Fisik</th>
                <th className="py-3 px-4">Satuan</th>
                <th className="py-3 px-4 text-right">Min. Stok</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const isLow = item.isLowStock;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {item.sku}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sm whitespace-nowrap">
                      <span className={isLow ? 'text-warning-text' : 'text-foreground'}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500 whitespace-nowrap">
                      {item.minStock}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-warning-bg text-warning-text border border-amber-300">
                          <AlertTriangle className="h-3 w-3 text-warning-icon" />
                          <span>Stok Rendah</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-success-bg text-success-text border border-green-200">
                          <CheckCircle2 className="h-3 w-3 text-success-icon" />
                          <span>Aman</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenMovementDrawer(item)}
                        className="h-7 text-xs flex items-center gap-1 mx-auto"
                      >
                        <History className="h-3.5 w-3.5 text-primary" />
                        <span>Kartu Stok</span>
                      </Button>
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
              Menampilkan {items.length} dari {meta.total ?? items.length} item
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

'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StockItem, StockMovementItem, StockMovementType } from './stock-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/placeholder';
import { formatDateTime } from '@/lib/formatters';
import { X, History, ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MovementHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StockItem | null;
  branchId: string;
}

export function MovementHistoryDrawer({
  open,
  onOpenChange,
  item,
  branchId,
}: MovementHistoryDrawerProps) {
  const [selectedType, setSelectedType] = useState<string>('ALL');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    if (open) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  const { data, isLoading } = useQuery({
    queryKey: ['stock-movements', item?.productId, branchId, selectedType],
    queryFn: async () => {
      if (!item) return null;
      let url = `/api/v1/stock/movements?productId=${item.productId}&limit=50`;
      if (branchId) url += `&branchId=${branchId}`;
      if (selectedType !== 'ALL') url += `&type=${selectedType}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal memuat riwayat mutasi');
      const json = await res.json();
      return json.data as StockMovementItem[];
    },
    enabled: open && !!item,
  });

  if (!open || !item) return null;

  const movements = data || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in-0 duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-xl bg-surface border-l border-border shadow-md flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header Drawer */}
          <div className="p-4 sm:p-6 border-b border-border flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Riwayat Mutasi Stok</h2>
              </div>
              <div className="mt-1 font-semibold text-sm text-foreground">{item.name}</div>
              <div className="text-xs text-muted">
                {item.category} &bull; SKU: {item.sku || '-'} &bull; Stok saat ini:{' '}
                <strong className="text-foreground">{item.quantity} {item.unit}</strong>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-slate-100 transition-colors"
              aria-label="Tutup Riwayat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Filter Tipe Mutasi */}
          <div className="px-4 sm:px-6 py-3 border-b border-border bg-slate-50 flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs text-muted mr-1 font-medium">Filter:</span>
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'IN', label: 'Masuk (IN)' },
              { id: 'OUT', label: 'Keluar (OUT)' },
              { id: 'ADJUSTMENT', label: 'Penyesuaian' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedType(t.id)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap',
                  selectedType === t.id
                    ? 'bg-primary text-white font-semibold'
                    : 'bg-surface text-slate-600 hover:bg-slate-200 border border-border'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Isi Konten Riwayat */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3 border border-border rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </div>
            ) : movements.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  title="Belum Ada Riwayat Mutasi"
                  description="Belum ada transaksi mutasi stok yang tercatat untuk produk ini pada filter yang dipilih."
                />
              </div>
            ) : (
              <div className="space-y-3">
                {movements.map((mov) => {
                  const isPositive = mov.type === 'IN';
                  const isNegative = mov.type === 'OUT';
                  const isAdj = mov.type === 'ADJUSTMENT';

                  return (
                    <div
                      key={mov.id}
                      className="p-3.5 border border-border rounded-lg bg-surface hover:bg-slate-50/70 transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-muted font-medium">
                          {formatDateTime(mov.createdAt)}
                        </div>
                        <div>
                          {isPositive && (
                            <Badge variant="success" size="sm" className="gap-1">
                              <ArrowDownLeft className="h-3 w-3" />
                              Masuk (IN)
                            </Badge>
                          )}
                          {isNegative && (
                            <Badge variant="danger" size="sm" className="gap-1">
                              <ArrowUpRight className="h-3 w-3" />
                              Keluar (OUT)
                            </Badge>
                          )}
                          {isAdj && (
                            <Badge variant="warning" size="sm" className="gap-1">
                              <Scale className="h-3 w-3" />
                              Penyesuaian
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <div className="text-sm font-semibold text-foreground">
                          {isPositive && `+${mov.qty}`}
                          {isNegative && `-${mov.qty}`}
                          {isAdj && `Set ke ${mov.qtyAfter}`} {item.unit}
                        </div>
                        <div className="text-xs text-muted">
                          Stok: <span className="font-medium text-foreground">{mov.qtyBefore}</span> &rarr;{' '}
                          <span className="font-bold text-foreground">{mov.qtyAfter}</span> {item.unit}
                        </div>
                      </div>

                      {mov.note && (
                        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-md border border-slate-100">
                          &ldquo;{mov.note}&rdquo;
                        </div>
                      )}

                      <div className="text-[11px] text-muted flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>Oleh: {mov.user?.username || mov.user?.email || 'Sistem'}</span>
                        <span>{mov.branch?.name || 'Cabang'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Drawer */}
          <div className="p-4 border-t border-border bg-slate-50 flex justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

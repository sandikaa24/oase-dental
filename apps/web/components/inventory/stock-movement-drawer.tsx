'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { formatDateTime } from '@/lib/formatters';
import { StockItem, MovementDetailResponse } from './inventory-types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/placeholder';
import {
  History,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface StockMovementDrawerProps {
  item: StockItem | null;
  branchId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockMovementDrawer({
  item,
  branchId,
  open,
  onOpenChange,
}: StockMovementDrawerProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // TanStack Query untuk fetch kartu stok
  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      'stock-movements',
      branchId,
      item?.itemId,
      dateFrom,
      dateTo,
      page,
    ],
    queryFn: async () => {
      if (!item) return null;
      let url = `/api/v1/inventory/stock/MATERIAL/${item.itemId}/movements?page=${page}&limit=20`;
      if (branchId) url += `&branchId=${branchId}`;
      if (dateFrom) url += `&dateFrom=${dateFrom}`;
      if (dateTo) url += `&dateTo=${dateTo}`;

      return fetchApi<MovementDetailResponse>(url);
    },
    enabled: open && !!item && !!branchId,
  });

  if (!open || !item) return null;

  const movements = data?.data?.movements ?? [];
  const meta = data?.meta;
  const currentQuantity = data?.data?.item?.currentQuantity ?? item.quantity;

  const getReferenceLabel = (type: string) => {
    switch (type) {
      case 'STOCK_IN':
        return 'Penerimaan Barang (Stock In)';
      case 'TRANSACTION':
        return 'Penjualan POS';
      case 'OPNAME':
        return 'Penyesuaian Opname';
      case 'MANUAL_ADJUSTMENT':
        return 'Pemakaian / Koreksi Manual';
      case 'DAMAGE':
        return 'Barang Rusak';
      case 'EXPIRED':
        return 'Kadaluwarsa';
      default:
        return type;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-surface h-full shadow-xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
        {/* Header Drawer */}
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  BAHAN KLINIS
                </span>
                <span className="text-xs text-muted font-mono">{item.sku}</span>
              </div>
              <h2 className="text-lg font-bold text-foreground mt-0.5">{item.name}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-slate-200/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Item Stock Summary Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-muted">Satuan: </span>
              <span className="font-semibold text-foreground">{item.unit}</span>
            </div>
            <div>
              <span className="text-muted">Batas Min: </span>
              <span className="font-semibold text-foreground">{item.minStock} {item.unit}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted">Stok Saat Ini:</span>
            <span className="text-base font-bold font-mono text-primary">
              {currentQuantity} {item.unit}
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-2 bg-white text-xs">
          <div className="flex items-center gap-1.5 text-muted font-medium">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter Tanggal:</span>
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1 rounded border border-border text-xs focus:ring-1 focus:ring-primary focus:outline-none"
          />
          <span className="text-muted">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1 rounded border border-border text-xs focus:ring-1 focus:ring-primary focus:outline-none"
          />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
              className="text-xs text-primary hover:underline ml-2"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Timeline Movement Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : isError ? (
            <div className="p-4 rounded-lg bg-danger-bg text-danger-text text-xs border border-red-200">
              {error instanceof Error ? error.message : 'Gagal memuat kartu stok item'}
            </div>
          ) : movements.length === 0 ? (
            <EmptyState
              icon={<History className="h-8 w-8 text-muted" />}
              title="Belum Ada Pergerakan Stok"
              description="Belum ada riwayat penerimaan, pengeluaran, atau opname untuk bahan ini pada cabang aktif."
            />
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-border text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Waktu (WIB)</th>
                    <th className="py-2.5 px-3">Tipe &amp; Keterangan</th>
                    <th className="py-2.5 px-3 text-right">Perubahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movements.map((m) => {
                    const isPositive = m.quantityDelta > 0;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {formatDateTime(m.createdAt)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-foreground">
                            {getReferenceLabel(m.referenceType)}
                          </div>
                          {m.notes && (
                            <div className="text-[11px] text-muted truncate max-w-xs mt-0.5">
                              {m.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs ${
                              isPositive
                                ? 'bg-success-bg text-success-text'
                                : 'bg-danger-bg text-danger-text'
                            }`}
                          >
                            {isPositive ? (
                              <ArrowUpRight className="h-3 w-3 inline" />
                            ) : (
                              <ArrowDownLeft className="h-3 w-3 inline" />
                            )}
                            {isPositive ? `+${m.quantityDelta}` : m.quantityDelta} {item.unit}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {meta && typeof meta.totalPages === 'number' && meta.totalPages > 1 && (
          <div className="p-4 border-t border-border bg-slate-50 flex items-center justify-between text-xs">
            <span className="text-muted">
              Halaman {meta.page ?? page} dari {meta.totalPages} ({meta.total ?? 0} pergerakan)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1 || isLoading}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= meta.totalPages || isLoading}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

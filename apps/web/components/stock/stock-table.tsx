'use client';

import React from 'react';
import { StockItem } from './stock-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/placeholder';
import { formatRupiah, formatDate } from '@/lib/formatters';
import {
  ArrowDownUp,
  History,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Pencil,
} from 'lucide-react';

interface StockTableProps {
  items: StockItem[];
  isLoading: boolean;
  canMutate: boolean;
  onMutateClick: (item: StockItem) => void;
  onHistoryClick: (item: StockItem) => void;
  onEditClick?: (item: StockItem) => void;
}

export function StockTable({
  items,
  isLoading,
  canMutate,
  onMutateClick,
  onHistoryClick,
  onEditClick,
}: StockTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 shadow-xs">
        <EmptyState
          title="Tidak Ada Data Stok"
          description="Tidak ditemukan produk atau stok yang sesuai dengan filter pencarian saat ini."
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-foreground">
          <thead className="bg-slate-50 border-b border-border text-xs uppercase font-semibold text-muted tracking-wider">
            <tr>
              <th scope="col" className="px-4 py-3 sm:px-6">Produk & SKU</th>
              <th scope="col" className="px-4 py-3">Kategori</th>
              <th scope="col" className="px-4 py-3 text-right">Stok Cabang</th>
              <th scope="col" className="px-4 py-3 text-right">Min. Stok</th>
              <th scope="col" className="px-4 py-3">Status & Expired</th>
              <th scope="col" className="px-4 py-3 text-right">Harga Pokok</th>
              <th scope="col" className="px-4 py-3 sm:px-6 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-normal">
            {items.map((item) => {
              // Status indikator
              const isExpired = item.expiredWarning === 'EXPIRED';
              const isExpSoon = item.expiredWarning === 'EXPIRING_SOON';
              const isLow = item.isLowStock;
              const isNormal = !isExpired && !isExpSoon && !isLow;

              return (
                <tr
                  key={item.productId}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  {/* Nama Produk & SKU */}
                  <td className="px-4 py-3.5 sm:px-6">
                    <div className="font-semibold text-foreground">{item.name}</div>
                    <div className="text-xs text-muted font-mono mt-0.5">
                      {item.sku || 'Tanpa SKU'}
                    </div>
                  </td>

                  {/* Kategori & Satuan */}
                  <td className="px-4 py-3.5">
                    <div className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-xs text-slate-700 font-medium">
                      {item.category}
                    </div>
                    <div className="text-xs text-muted mt-0.5">Satuan: {item.unit}</div>
                  </td>

                  {/* Stok Saat Ini */}
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-bold text-base text-foreground">
                      {item.quantity.toLocaleString('id-ID')}
                    </span>
                    <span className="text-xs text-muted ml-1">{item.unit}</span>
                  </td>

                  {/* Min Stok */}
                  <td className="px-4 py-3.5 text-right text-muted text-xs">
                    {item.minStock.toLocaleString('id-ID')} {item.unit}
                  </td>

                  {/* Indikator Status & Expired */}
                  <td className="px-4 py-3.5 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isExpired && (
                        <Badge variant="danger" size="sm" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Kadaluarsa
                        </Badge>
                      )}
                      {isExpSoon && (
                        <Badge variant="warning" size="sm" className="gap-1">
                          <Clock className="h-3 w-3" />
                          Exp &lt; 30 Hari
                        </Badge>
                      )}
                      {isLow && (
                        <Badge variant="warning" size="sm" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Stok Rendah
                        </Badge>
                      )}
                      {isNormal && (
                        <Badge variant="success" size="sm" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Normal
                        </Badge>
                      )}
                    </div>
                    {item.expiredDate && (
                      <div className="text-[11px] text-muted">
                        Exp: {formatDate(item.expiredDate)}
                      </div>
                    )}
                  </td>

                  {/* Harga Pokok */}
                  <td className="px-4 py-3.5 text-right text-xs font-mono text-slate-700">
                    {item.costPrice !== null && item.costPrice !== undefined
                      ? formatRupiah(item.costPrice)
                      : '-'}
                  </td>

                  {/* Tombol Aksi */}
                  <td className="px-4 py-3.5 sm:px-6 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      {canMutate && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onMutateClick(item)}
                          className="text-xs h-8 px-2.5"
                          title="Catat Mutasi Stok"
                        >
                          <ArrowDownUp className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">Mutasi</span>
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onHistoryClick(item)}
                        className="text-xs h-8 px-2.5"
                        title="Lihat Riwayat Mutasi"
                      >
                        <History className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Riwayat</span>
                      </Button>
                      {canMutate && onEditClick && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onEditClick(item)}
                          className="text-xs h-8 px-2 text-muted hover:text-foreground"
                          title="Edit Produk"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

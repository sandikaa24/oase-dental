'use client';

import React, { useState } from 'react';
import { type PosCatalogItem, type PosCartItem } from './pos-types';
import { formatRupiah } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/placeholder';
import {
  Search,
  Plus,
  Stethoscope,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PosCatalogProps {
  items: PosCatalogItem[];
  isLoading: boolean;
  onAddToCart: (item: PosCatalogItem) => void;
  cartItems: PosCartItem[];
}

export function PosCatalog({
  items,
  isLoading,
  onAddToCart,
  cartItems,
}: PosCatalogProps) {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Filter items in client for fast responsiveness
  const filteredItems = items.filter((item) => {
    // Category filter
    if (selectedCategoryId && item.category?.id !== selectedCategoryId) return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchCategory = item.category?.name.toLowerCase().includes(q);
      if (!matchName && !matchCategory) return false;
    }

    return true;
  });

  // Extract unique categories from services
  const categories = Array.from(
    new Map(
      items
        .filter((i) => i.category)
        .map((i) => [i.category!.id, i.category!])
    ).values()
  );

  return (
    <div className="space-y-4">
      {/* Search and Category Filter Header */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama layanan atau tindakan medis..."
            className={cn(
              'w-full pl-9 pr-4 py-2 text-xs rounded-md border border-border bg-surface text-foreground',
              'placeholder:text-muted focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent transition-all'
            )}
          />
        </div>

        {/* Category Pills */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              className={cn(
                'px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border text-xs',
                selectedCategoryId === null
                  ? 'bg-primary text-white border-primary font-medium'
                  : 'bg-surface text-slate-600 border-border hover:bg-slate-50'
              )}
            >
              Semua Kategori
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id === selectedCategoryId ? null : cat.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border text-xs',
                  selectedCategoryId === cat.id
                    ? 'bg-primary text-white border-primary font-medium'
                    : 'bg-surface text-slate-600 border-border hover:bg-slate-50'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Item Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-8 w-8" />}
          title="Layanan tidak ditemukan"
          description={
            search
              ? `Tidak ada layanan yang cocok dengan "${search}"`
              : 'Belum ada katalog layanan medis aktif'
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {filteredItems.map((item) => {
            const inCart = cartItems.find((ci) => ci.itemId === item.id);

            return (
              <Card
                key={item.id}
                className={cn(
                  'p-3.5 flex flex-col justify-between transition-all duration-150 border-border hover:border-primary/40 hover:shadow-sm bg-surface',
                  inCart && 'ring-1 ring-primary/30 border-primary/40 bg-primary-soft/10'
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-soft text-primary">
                      <Stethoscope className="h-2.5 w-2.5" />
                      <span>{item.category?.name || 'Tindakan Gigi'}</span>
                    </span>

                    {inCart && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary-soft px-1.5 py-0.5 rounded">
                        <Check className="h-3 w-3" />
                        <span>{inCart.quantity}x</span>
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-xs text-foreground line-clamp-2 leading-snug">
                    {item.name}
                  </h3>
                </div>

                <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {formatRupiah(item.price)}
                  </span>

                  <Button
                    type="button"
                    size="sm"
                    variant={inCart ? 'secondary' : 'primary'}
                    onClick={() => onAddToCart(item)}
                    className="h-7 text-xs px-2.5 gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{inCart ? 'Tambah Lagi' : 'Pilih'}</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

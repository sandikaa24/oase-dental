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
  Package,
  Layers,
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
  const [selectedType, setSelectedType] = useState<'ALL' | 'SERVICE' | 'PRODUCT'>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Filter items in client for fast responsiveness
  const filteredItems = items.filter((item) => {
    // Type filter
    if (selectedType === 'SERVICE' && item.type !== 'SERVICE') return false;
    if (selectedType === 'PRODUCT' && item.type !== 'PRODUCT') return false;

    // Category filter (khusus layanan)
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
      {/* Search and Filters Header */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama layanan, tindakan, atau produk..."
            className={cn(
              'w-full pl-9 pr-4 py-2 text-xs rounded-md border border-border bg-surface text-foreground',
              'placeholder:text-muted focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent transition-all'
            )}
          />
        </div>

        {/* Type Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => {
              setSelectedType('ALL');
              setSelectedCategoryId(null);
            }}
            className={cn(
              'flex items-center justify-center gap-1.5 flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all',
              selectedType === 'ALL'
                ? 'bg-surface text-primary shadow-xs font-semibold'
                : 'text-slate-600 hover:text-foreground'
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Semua</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('SERVICE')}
            className={cn(
              'flex items-center justify-center gap-1.5 flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all',
              selectedType === 'SERVICE'
                ? 'bg-surface text-primary shadow-xs font-semibold'
                : 'text-slate-600 hover:text-foreground'
            )}
          >
            <Stethoscope className="h-3.5 w-3.5 text-primary" />
            <span>Layanan Gigi</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedType('PRODUCT');
              setSelectedCategoryId(null);
            }}
            className={cn(
              'flex items-center justify-center gap-1.5 flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all',
              selectedType === 'PRODUCT'
                ? 'bg-surface text-primary shadow-xs font-semibold'
                : 'text-slate-600 hover:text-foreground'
            )}
          >
            <Package className="h-3.5 w-3.5 text-info-icon" />
            <span>Produk Jual</span>
          </button>
        </div>

        {/* Category Pills (Hanya bila mode Layanan/Semua dan ada kategori) */}
        {selectedType !== 'PRODUCT' && categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              className={cn(
                'px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border',
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
                  'px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border',
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
          icon={<Layers className="h-8 w-8" />}
          title="Item tidak ditemukan"
          description={
            search
              ? `Tidak ada item yang cocok dengan "${search}"`
              : 'Belum ada katalog item tersedia'
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {filteredItems.map((item) => {
            const inCart = cartItems.find((ci) => ci.itemId === item.id);
            const isOutOfStock = item.type === 'PRODUCT' && (item.stock === null || item.stock <= 0);

            return (
              <Card
                key={item.id}
                className={cn(
                  'flex flex-col justify-between p-3.5 border transition-all duration-150',
                  inCart ? 'border-primary/50 bg-teal-50/20 shadow-xs' : 'hover:border-slate-300'
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
                        item.type === 'SERVICE'
                          ? 'bg-primary-soft text-primary'
                          : 'bg-info-bg text-info-icon'
                      )}
                    >
                      {item.type === 'SERVICE' ? 'Layanan' : 'Produk'}
                    </span>

                    {/* Stock badge untuk produk */}
                    {item.type === 'PRODUCT' && (
                      <span
                        className={cn(
                          'text-[11px] font-medium',
                          isOutOfStock ? 'text-danger-text font-semibold' : 'text-slate-600'
                        )}
                      >
                        {isOutOfStock ? 'Stok Habis' : `Stok: ${item.stock} ${item.unit || ''}`}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xs font-semibold text-foreground mt-1.5 line-clamp-2" title={item.name}>
                    {item.name}
                  </h3>

                  {item.category && (
                    <p className="text-[11px] text-muted mt-0.5">{item.category.name}</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-100">
                  <div className="font-semibold text-xs text-primary">
                    {formatRupiah(item.price)}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={inCart ? 'soft' : 'primary'}
                    disabled={isOutOfStock}
                    onClick={() => onAddToCart(item)}
                    className={cn(
                      'h-7 px-2.5 text-xs gap-1',
                      isOutOfStock && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {inCart ? (
                      <>
                        <Check className="h-3 w-3" />
                        <span>({inCart.quantity})</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3" />
                        <span>Tambah</span>
                      </>
                    )}
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

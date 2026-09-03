'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { Permission } from '@oase/shared';
import { StockItem } from '@/components/inventory/inventory-types';
import { StockTable } from '@/components/inventory/stock-table';
import { StockMovementDrawer } from '@/components/inventory/stock-movement-drawer';
import { StockInModal } from '@/components/inventory/stock-in-modal';
import { StockOutModal } from '@/components/inventory/stock-out-modal';
import { BranchSelector } from '@/components/inventory/branch-selector';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorBanner, EmptyState } from '@/components/ui/placeholder';
import {
  Package,
  PackagePlus,
  PackageMinus,
  ClipboardList,
  Search,
  AlertTriangle,
  ShieldX,
  Building2,
} from 'lucide-react';

export default function InventoryPage() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Guard Permission: Hanya OWNER & MANAGER yang memiliki akses
  const canAccess =
    user?.role === 'OWNER' ||
    user?.role === 'MANAGER' ||
    hasPermission(Permission.STOCK_REPORT) ||
    hasPermission(Permission.STOCK_IN);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(user?.activeBranchId || '');

  useEffect(() => {
    if (user?.role !== 'OWNER' && user?.activeBranchId) {
      setSelectedBranchId(user.activeBranchId);
    }
  }, [user]);

  const effectiveBranchId = user?.role === 'OWNER' ? selectedBranchId : (user?.activeBranchId || selectedBranchId);

  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [selectedItemForDrawer, setSelectedItemForDrawer] = useState<StockItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stockInModalOpen, setStockInModalOpen] = useState(false);
  const [stockOutModalOpen, setStockOutModalOpen] = useState(false);

  // TanStack Query untuk fetch data stok bahan
  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      'inventory-stock',
      effectiveBranchId,
      search,
      lowStockOnly,
      page,
    ],
    queryFn: async () => {
      let url = `/api/v1/inventory/stock?page=${page}&limit=20`;
      if (effectiveBranchId) url += `&branchId=${effectiveBranchId}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (lowStockOnly) url += `&lowStock=true`;

      return fetchApi<StockItem[]>(url);
    },
    enabled: canAccess && !!user && !!effectiveBranchId,
  });

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border-border text-center shadow-sm">
          <CardContent className="p-8 space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-bg text-danger-icon mx-auto">
              <ShieldX className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Akses Ditolak</h2>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Hanya <strong>OWNER</strong> dan <strong>MANAGER</strong> yang memiliki wewenang untuk mengelola inventaris dan kartu stok.
            </p>
            <div className="pt-2">
              <Link href="/admin">
                <Button variant="secondary" size="md">
                  Kembali ke Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stockList = data?.data ?? [];
  const meta = data?.meta;

  const handleOpenMovementDrawer = (item: StockItem) => {
    setSelectedItemForDrawer(item);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Inventaris &amp; Stok Bahan
              </h1>
              <p className="text-xs text-muted">
                Pantau saldo fisik, kartu stok pergerakan barang, penerimaan, dan pengeluaran bahan
              </p>
            </div>
          </div>
        </div>

        {/* Action Header Buttons & Branch Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <BranchSelector
            selectedBranchId={effectiveBranchId || ''}
            onSelectBranch={(id) => {
              setSelectedBranchId(id);
              setPage(1);
            }}
          />

          <Link href="/admin/inventory/opname">
            <Button variant="secondary" size="md" className="flex items-center gap-1.5 text-xs">
              <ClipboardList className="h-4 w-4 text-slate-600" />
              <span>Stock Opname</span>
            </Button>
          </Link>

          {/* Tombol Stock Out di samping Stock In */}
          <Button
            variant="secondary"
            size="md"
            onClick={() => setStockOutModalOpen(true)}
            disabled={!effectiveBranchId}
            className="flex items-center gap-1.5 text-xs text-danger-text border-danger-border hover:bg-danger-bg"
          >
            <PackageMinus className="h-4 w-4 text-danger-icon" />
            <span>Stock Out</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => setStockInModalOpen(true)}
            disabled={!effectiveBranchId}
            className="flex items-center gap-1.5 text-xs"
          >
            <PackagePlus className="h-4 w-4" />
            <span>Penerimaan Barang</span>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="text"
                placeholder="Cari nama bahan medis atau SKU..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                disabled={!effectiveBranchId}
                className="w-full h-9 pl-9 pr-4 rounded-md border border-border bg-white text-xs text-foreground placeholder:text-muted focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Toggle Low Stock */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLowStockOnly(!lowStockOnly);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                  lowStockOnly
                    ? 'bg-warning-bg text-warning-text border border-amber-300 font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Stok Rendah Saja</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Data Stok"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat katalog stok'}
        />
      )}

      {/* Empty State bila cabang belum dipilih */}
      {!effectiveBranchId ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Pilih Cabang"
          description="Silakan pilih cabang terlebih dahulu untuk melihat katalog inventaris dan mutasi stok."
        />
      ) : (
        /* Table Data */
        <StockTable
          items={stockList}
          isLoading={isLoading}
          onOpenMovementDrawer={handleOpenMovementDrawer}
          meta={meta}
          onPageChange={(newPage) => setPage(newPage)}
        />
      )}

      {/* Drawer Kartu Stok */}
      <StockMovementDrawer
        item={selectedItemForDrawer}
        branchId={effectiveBranchId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      {/* Modal Stock In */}
      <StockInModal
        open={stockInModalOpen}
        branchId={effectiveBranchId}
        onOpenChange={setStockInModalOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ['inventory-stock', effectiveBranchId],
          });
          queryClient.invalidateQueries({
            queryKey: ['stock-movements'],
          });
        }}
        availableItems={stockList}
      />

      {/* Modal Stock Out (Fitur Baru) */}
      <StockOutModal
        open={stockOutModalOpen}
        branchId={effectiveBranchId}
        onOpenChange={setStockOutModalOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ['inventory-stock', effectiveBranchId],
          });
          queryClient.invalidateQueries({
            queryKey: ['stock-movements'],
          });
        }}
        availableItems={stockList}
      />
    </div>
  );
}

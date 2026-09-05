'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { StockItem, StockListResponse } from '@/components/stock/stock-types';
import { StockTable } from '@/components/stock/stock-table';
import { ProductModal } from '@/components/stock/product-modal';
import { MutationModal } from '@/components/stock/mutation-modal';
import { MovementHistoryDrawer } from '@/components/stock/movement-history-drawer';
import { BranchSelector } from '@/components/inventory/branch-selector';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
} from 'lucide-react';

export default function StockManagementPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isOwner = user?.role === 'OWNER';
  const canMutate = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    user?.activeBranchId || ''
  );

  const effectiveBranchId = isOwner
    ? selectedBranchId
    : user?.activeBranchId || selectedBranchId;

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [expiredFilter, setExpiredFilter] = useState<'all' | 'expSoon' | 'expired'>('all');
  const [page, setPage] = useState(1);

  // Modal & Drawer states
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<StockItem | null>(null);

  const [mutationModalOpen, setMutationModalOpen] = useState(false);
  const [itemForMutation, setItemForMutation] = useState<StockItem | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [itemForDrawer, setItemForDrawer] = useState<StockItem | null>(null);

  // Query data stok cabang
  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      'stock-list',
      effectiveBranchId,
      search,
      categoryFilter,
      lowStockOnly,
      expiredFilter,
      page,
    ],
    queryFn: async () => {
      let url = `/api/v1/stock?page=${page}&limit=50`;
      if (effectiveBranchId) url += `&branchId=${effectiveBranchId}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (categoryFilter.trim()) url += `&category=${encodeURIComponent(categoryFilter.trim())}`;
      if (lowStockOnly) url += `&lowStock=true`;
      if (expiredFilter !== 'all') url += `&expiredStatus=${expiredFilter}`;

      return fetchApi<StockListResponse>(url);
    },
    enabled: !!user,
  });

  const stockData = data?.data?.items || [];
  const currentBranchId = data?.data?.branchId || effectiveBranchId;

  // Ringkasan metrik statistik
  const summaryMetrics = useMemo(() => {
    let totalItems = stockData.length;
    let lowStockCount = 0;
    let expiredCount = 0;
    let expiringSoonCount = 0;

    stockData.forEach((item) => {
      if (item.isLowStock) lowStockCount++;
      if (item.expiredWarning === 'EXPIRED') expiredCount++;
      if (item.expiredWarning === 'EXPIRING_SOON') expiringSoonCount++;
    });

    return { totalItems, lowStockCount, expiredCount, expiringSoonCount };
  }, [stockData]);

  const handleOpenMutate = (item: StockItem) => {
    setItemForMutation(item);
    setMutationModalOpen(true);
  };

  const handleOpenHistory = (item: StockItem) => {
    setItemForDrawer(item);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (item: StockItem) => {
    setProductToEdit(item);
    setProductModalOpen(true);
  };

  const handleOpenCreate = () => {
    setProductToEdit(null);
    setProductModalOpen(true);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-list'] });
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-50 border border-teal-200 text-primary">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Manajemen Stok
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Katalog master produk dan pemantauan stok per cabang dengan mutasi manual.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <BranchSelector
            selectedBranchId={effectiveBranchId}
            onSelectBranch={setSelectedBranchId}
          />
          {canMutate && (
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenCreate}
              className="gap-1.5 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Produk</span>
            </Button>
          )}
        </div>
      </div>

      {/* Ringkasan Status / KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Item */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted">Total Produk</div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {summaryMetrics.totalItems}
              </div>
              <div className="text-[11px] text-muted mt-0.5">Produk aktif terdaftar</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600">
              <Boxes className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Stok Rendah */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-amber-700">Stok Rendah</div>
              <div className="text-2xl font-bold text-amber-700 mt-1">
                {summaryMetrics.lowStockCount}
              </div>
              <div className="text-[11px] text-amber-600 mt-0.5">&le; batas minimum stok</div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Expired Segera */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-amber-700">Exp. &lt; 30 Hari</div>
              <div className="text-2xl font-bold text-amber-700 mt-1">
                {summaryMetrics.expiringSoonCount}
              </div>
              <div className="text-[11px] text-amber-600 mt-0.5">Perlu perhatian segera</div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Sudah Lewat Expired */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-danger-text">Lewat Expired</div>
              <div className="text-2xl font-bold text-danger-text mt-1">
                {summaryMetrics.expiredCount}
              </div>
              <div className="text-[11px] text-danger-text mt-0.5">Wajib segera dikeluarkan</div>
            </div>
            <div className="p-2.5 rounded-lg bg-danger-bg text-danger-icon border border-red-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Toolbar */}
      <div className="p-4 rounded-xl border border-border bg-surface shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama produk atau SKU..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          {/* Filter Dropdowns & Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Expired */}
            <select
              value={expiredFilter}
              onChange={(e) => {
                setExpiredFilter(e.target.value as 'all' | 'expSoon' | 'expired');
                setPage(1);
              }}
              className="px-3 py-2 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              aria-label="Filter status kadaluarsa"
            >
              <option value="all">Semua Status Expired</option>
              <option value="expSoon">Kuning: Menjelang Expired (&lt; 30 Hari)</option>
              <option value="expired">Merah: Lewat Expired</option>
            </select>

            {/* Toggle Stok Rendah */}
            <button
              type="button"
              onClick={() => {
                setLowStockOnly((prev) => !prev);
                setPage(1);
              }}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                lowStockOnly
                  ? 'bg-amber-50 border-amber-300 text-amber-800 font-semibold'
                  : 'bg-surface border-border text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className={`h-3.5 w-3.5 ${lowStockOnly ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>Hanya Stok Rendah</span>
            </button>

            {/* Reset Filters */}
            {(search || categoryFilter || lowStockOnly || expiredFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('');
                  setLowStockOnly(false);
                  setExpiredFilter('all');
                  setPage(1);
                }}
                className="px-2.5 py-2 text-xs text-muted hover:text-foreground font-medium underline"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabel Stok Produk */}
      <StockTable
        items={stockData}
        isLoading={isLoading}
        canMutate={canMutate}
        onMutateClick={handleOpenMutate}
        onHistoryClick={handleOpenHistory}
        onEditClick={handleOpenEdit}
      />

      {/* Modal Tambah / Edit Produk */}
      <ProductModal
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        productToEdit={productToEdit}
        onSuccess={handleRefresh}
      />

      {/* Modal Catat Mutasi Manual */}
      <MutationModal
        open={mutationModalOpen}
        onOpenChange={setMutationModalOpen}
        item={itemForMutation}
        branchId={currentBranchId}
        onSuccess={handleRefresh}
      />

      {/* Drawer Riwayat Mutasi */}
      <MovementHistoryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        item={itemForDrawer}
        branchId={currentBranchId}
      />
    </div>
  );
}

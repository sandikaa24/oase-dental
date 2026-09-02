'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { formatThousand } from '@/lib/format/currency';
import { Product } from './master-types';
import { ProductModal } from './product-modal';
import { DeleteMasterModal } from './delete-master-modal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorBanner } from '@/components/ui/placeholder';
import {
  ShoppingBag,
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Power,
  Layers,
} from 'lucide-react';

export function ProductsTab() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [search, setSearch] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['products', page, activeFilter],
    queryFn: async () => {
      let url = `/api/v1/products?page=${page}&limit=20`;
      if (activeFilter !== undefined) url += `&active=${activeFilter}`;
      return fetchApi<Product[]>(url);
    },
  });

  const products = data?.data ?? [];
  const meta = data?.meta;

  const filteredProducts = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setSelectedProduct(p);
    setModalOpen(true);
  };

  const handleOpenDelete = (p: Product) => {
    setProductToDelete(p);
    setDeleteModalOpen(true);
  };

  const handleToggleActive = async (p: Product) => {
    try {
      await fetchApi(`/api/v1/products/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !p.active }),
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setFeedbackMessage({
        type: 'success',
        text: `Produk "${p.name}" berhasil ${!p.active ? 'diaktifkan' : 'dinonaktifkan'}.`,
      });
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengubah status aktif produk',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetchApi<{ id: string; deleted: boolean; mode: 'soft' | 'hard' }>(
        `/api/v1/products/${productToDelete.id}`,
        { method: 'DELETE' }
      );
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteModalOpen(false);
      const modeText = res.data?.mode === 'soft' ? 'Dihapus (diarsipkan)' : 'Dihapus permanen';
      setFeedbackMessage({
        type: 'success',
        text: `Produk "${productToDelete.name}" berhasil ${modeText.toLowerCase()}.`,
      });
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menghapus produk',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-xs font-semibold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Cari nama produk atau SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-md border border-border bg-white text-xs text-foreground placeholder:text-muted focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* Filter & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveFilter(undefined);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                activeFilter === undefined
                  ? 'bg-white text-primary shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-foreground'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFilter(true);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                activeFilter === true
                  ? 'bg-white text-primary shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-foreground'
              }`}
            >
              Aktif
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFilter(false);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                activeFilter === false
                  ? 'bg-white text-primary shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-foreground'
              }`}
            >
              Nonaktif
            </button>
          </div>

          {isOwner && (
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenCreate}
              className="gap-1.5 text-xs shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Produk</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Produk"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat memuat katalog produk'}
        />
      )}

      {/* Table Data */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-border text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Nama Produk</th>
                  <th className="py-3 px-4 text-right">Harga Jual</th>
                  <th className="py-3 px-4 text-center">Satuan</th>
                  <th className="py-3 px-4 text-center">Min. Stok Global</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {isOwner && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-36" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-14 mx-auto" /></td>
                      {isOwner && <td className="py-3 px-4"><Skeleton className="h-4 w-16 ml-auto" /></td>}
                    </tr>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={isOwner ? 7 : 6} className="p-8 text-center">
                      <EmptyState
                        icon={<ShoppingBag className="h-6 w-6 text-muted" />}
                        title="Tidak Ada Produk Jual"
                        description={search ? 'Tidak ditemukan produk yang sesuai dengan pencarian.' : 'Belum ada data produk penjualan.'}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    const priceNum = typeof prod.sellPrice === 'string' ? Math.round(Number(prod.sellPrice)) : Math.round(prod.sellPrice);
                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                          {prod.sku}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{prod.name}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                          Rp {formatThousand(priceNum)}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600 font-medium">
                          {prod.unit}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700 text-[11px]">
                            <Layers className="h-3 w-3 text-muted" />
                            <span>{prod.minStock}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {prod.active ? (
                            <Badge variant="success">Aktif</Badge>
                          ) : (
                            <Badge variant="default" className="bg-slate-200 text-slate-700">Nonaktif</Badge>
                          )}
                        </td>
                        {isOwner && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Toggle Active Button */}
                              <button
                                type="button"
                                title={prod.active ? 'Nonaktifkan produk' : 'Aktifkan produk'}
                                onClick={() => handleToggleActive(prod)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  prod.active
                                    ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                title="Edit data produk"
                                onClick={() => handleOpenEdit(prod)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-primary hover:bg-primary-soft transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                title="Hapus produk"
                                onClick={() => handleOpenDelete(prod)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-danger-text hover:bg-danger-bg transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages && meta.totalPages > 1 ? (
            <div className="p-3 border-t border-border flex items-center justify-between text-xs bg-slate-50/50">
              <span className="text-muted">
                Halaman {meta.page} dari {meta.totalPages} (Total {meta.total} item)
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= (meta.totalPages || 1)}
                  onClick={() => setPage(page + 1)}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Modal Create / Edit Product */}
      <ProductModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={(msg) => {
          queryClient.invalidateQueries({ queryKey: ['products'] });
          if (msg) setFeedbackMessage({ type: 'success', text: msg });
        }}
        product={selectedProduct}
      />

      {/* Modal Delete Confirmation */}
      <DeleteMasterModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        title="Hapus Produk Penjualan"
        itemLabel={productToDelete?.name || ''}
        isSubmitting={isDeleting}
      />
    </div>
  );
}

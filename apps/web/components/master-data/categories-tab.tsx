'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { Category } from './master-types';
import { CategoryModal } from './category-modal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorBanner } from '@/components/ui/placeholder';
import {
  Tags,
  Plus,
  Search,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Power,
} from 'lucide-react';

export function CategoriesTab() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [search, setSearch] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['categories', page, activeFilter],
    queryFn: async () => {
      let url = `/api/v1/categories?page=${page}&limit=20`;
      if (activeFilter !== undefined) url += `&active=${activeFilter}`;
      return fetchApi<Category[]>(url);
    },
  });

  const categories = data?.data ?? [];
  const meta = data?.meta;

  const filteredCategories = categories.filter((c) => {
    if (!search.trim()) return true;
    return c.name.toLowerCase().includes(search.toLowerCase());
  });

  const handleOpenCreate = () => {
    setSelectedCategory(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setSelectedCategory(cat);
    setModalOpen(true);
  };

  const handleToggleActive = async (cat: Category) => {
    try {
      await fetchApi(`/api/v1/categories/${cat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !cat.active }),
      });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setFeedbackMessage({
        type: 'success',
        text: `Kategori "${cat.name}" berhasil ${!cat.active ? 'diaktifkan' : 'dinonaktifkan'}.`,
      });
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengubah status aktif kategori',
      });
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
            placeholder="Cari nama kategori..."
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
              <span>Tambah Kategori</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Kategori"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat memuat data kategori'}
        />
      )}

      {/* Table Data */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-border text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Nama Kategori</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {isOwner && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-48" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-14 mx-auto" /></td>
                      {isOwner && <td className="py-3 px-4"><Skeleton className="h-4 w-16 ml-auto" /></td>}
                    </tr>
                  ))
                ) : filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={isOwner ? 3 : 2} className="p-8 text-center">
                      <EmptyState
                        icon={<Tags className="h-6 w-6 text-muted" />}
                        title="Tidak Ada Kategori"
                        description={search ? 'Tidak ditemukan kategori yang sesuai dengan pencarian.' : 'Belum ada data kategori tindakan.'}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {cat.name}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cat.active ? (
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
                              title={cat.active ? 'Nonaktifkan kategori' : 'Aktifkan kategori'}
                              onClick={() => handleToggleActive(cat)}
                              className={`p-1.5 rounded-md transition-colors ${
                                cat.active
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>

                            {/* Edit Button */}
                            <button
                              type="button"
                              title="Edit nama kategori"
                              onClick={() => handleOpenEdit(cat)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-primary hover:bg-primary-soft transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
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

      {/* Modal Create / Edit Category */}
      <CategoryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={(msg) => {
          queryClient.invalidateQueries({ queryKey: ['categories'] });
          if (msg) setFeedbackMessage({ type: 'success', text: msg });
        }}
        category={selectedCategory}
      />
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { formatThousand } from '@/lib/format/currency';
import { Service, Category } from './master-types';
import { ServiceModal } from './service-modal';
import { DeleteMasterModal } from './delete-master-modal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorBanner } from '@/components/ui/placeholder';
import {
  Stethoscope,
  Plus,
  Search,
  Edit2,
  Trash2,
  Globe,
  Clock,
  ChevronLeft,
  ChevronRight,
  Power,
} from 'lucide-react';

interface ServicesTabProps {
  categories: Category[];
}

export function ServicesTab({ categories }: ServicesTabProps) {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [search, setSearch] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['services', page, activeFilter],
    queryFn: async () => {
      let url = `/api/v1/services?page=${page}&limit=20`;
      if (activeFilter !== undefined) url += `&active=${activeFilter}`;
      return fetchApi<Service[]>(url);
    },
  });

  const services = data?.data ?? [];
  const meta = data?.meta;

  const filteredServices = services.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.nameEn && s.nameEn.toLowerCase().includes(q)) ||
      (s.category?.name && s.category.name.toLowerCase().includes(q))
    );
  });

  const handleOpenCreate = () => {
    setSelectedService(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (svc: Service) => {
    setSelectedService(svc);
    setModalOpen(true);
  };

  const handleOpenDelete = (svc: Service) => {
    setServiceToDelete(svc);
    setDeleteModalOpen(true);
  };

  const handleToggleActive = async (svc: Service) => {
    try {
      await fetchApi(`/api/v1/services/${svc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !svc.active }),
      });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setFeedbackMessage({
        type: 'success',
        text: `Layanan "${svc.name}" berhasil ${!svc.active ? 'diaktifkan' : 'dinonaktifkan'}.`,
      });
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengubah status aktif layanan',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!serviceToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetchApi<{ id: string; deleted: boolean; mode: 'soft' | 'hard' }>(
        `/api/v1/services/${serviceToDelete.id}`,
        { method: 'DELETE' }
      );
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setDeleteModalOpen(false);
      const modeText = res.data?.mode === 'soft' ? 'Dihapus (diarsipkan)' : 'Dihapus permanen';
      setFeedbackMessage({
        type: 'success',
        text: `Layanan "${serviceToDelete.name}" berhasil ${modeText.toLowerCase()}.`,
      });
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menghapus layanan',
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
            placeholder="Cari nama layanan atau kategori..."
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
              <span>Tambah Layanan</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Layanan"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat memuat data layanan'}
        />
      )}

      {/* Table Data */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-border text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Nama Layanan</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Durasi</th>
                  <th className="py-3 px-4 text-right">Tarif Pasien</th>
                  <th className="py-3 px-4 text-center">Portal Publik</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {isOwner && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-36" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-14 mx-auto" /></td>
                      {isOwner && <td className="py-3 px-4"><Skeleton className="h-4 w-16 ml-auto" /></td>}
                    </tr>
                  ))
                ) : filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan={isOwner ? 7 : 6} className="p-8 text-center">
                      <EmptyState
                        icon={<Stethoscope className="h-6 w-6 text-muted" />}
                        title="Tidak Ada Layanan Medis"
                        description={search ? 'Tidak ditemukan layanan yang sesuai dengan kata kunci pencarian.' : 'Belum ada data tindakan medis.'}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((svc) => {
                    const priceNum = typeof svc.price === 'string' ? Math.round(Number(svc.price)) : Math.round(svc.price);
                    return (
                      <tr key={svc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{svc.name}</div>
                          {svc.nameEn && (
                            <div className="text-[11px] text-muted italic font-sans">{svc.nameEn}</div>
                          )}
                          {svc.description && (
                            <p className="text-[10px] text-muted line-clamp-1 mt-0.5">{svc.description}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {svc.category?.name || <span className="text-muted italic">-</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {svc.durationMinutes ? (
                            <span className="flex items-center gap-1 font-mono text-[11px]">
                              <Clock className="h-3 w-3 text-muted" />
                              <span>{svc.durationMinutes} mnt</span>
                            </span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                          Rp {formatThousand(priceNum)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {svc.showOnPortal ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
                              <Globe className="h-2.5 w-2.5" />
                              <span>Tampil</span>
                            </span>
                          ) : (
                            <span className="text-muted text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {svc.active ? (
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
                                title={svc.active ? 'Nonaktifkan layanan' : 'Aktifkan layanan'}
                                onClick={() => handleToggleActive(svc)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  svc.active
                                    ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                title="Edit data layanan"
                                onClick={() => handleOpenEdit(svc)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-primary hover:bg-primary-soft transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                title="Hapus layanan"
                                onClick={() => handleOpenDelete(svc)}
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

      {/* Modal Create / Edit Service */}
      <ServiceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={(msg) => {
          queryClient.invalidateQueries({ queryKey: ['services'] });
          if (msg) setFeedbackMessage({ type: 'success', text: msg });
        }}
        service={selectedService}
        categories={categories}
      />

      {/* Modal Delete Confirmation */}
      <DeleteMasterModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        title="Hapus Layanan Tindakan"
        itemLabel={serviceToDelete?.name || ''}
        isSubmitting={isDeleting}
      />
    </div>
  );
}

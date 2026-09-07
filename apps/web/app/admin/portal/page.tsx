'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { PortalContentItem, PortalContentType } from '@/components/portal/portal-types';
import { PortalContentModal } from '@/components/portal/portal-content-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
  UserCheck,
  HelpCircle,
  Sparkles,
  Camera,
  Cpu,
  MessageSquare,
} from 'lucide-react';

const TABS: Array<{ id: string; label: string; type?: PortalContentType; icon: React.ReactNode }> = [
  { id: 'ALL', label: 'Semua Konten', icon: <Globe className="h-4 w-4" /> },
  { id: 'DOCTOR', label: 'Dokter Gigi', type: 'DOCTOR', icon: <UserCheck className="h-4 w-4" /> },
  { id: 'ARTICLE', label: 'Artikel & Edukasi', type: 'ARTICLE', icon: <FileText className="h-4 w-4" /> },
  { id: 'PATIENT_GUIDE', label: 'Panduan Pasien', type: 'PATIENT_GUIDE', icon: <Sparkles className="h-4 w-4" /> },
  { id: 'FAQ', label: 'FAQ', type: 'FAQ', icon: <HelpCircle className="h-4 w-4" /> },
  { id: 'BEFORE_AFTER', label: 'Before / After', type: 'BEFORE_AFTER', icon: <Camera className="h-4 w-4" /> },
  { id: 'FACILITY', label: 'Fasilitas & Teknologi', type: 'FACILITY', icon: <Cpu className="h-4 w-4" /> },
  { id: 'TESTIMONI', label: 'Testimoni', type: 'TESTIMONI', icon: <MessageSquare className="h-4 w-4" /> },
];

export default function PortalManagementPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [demoFilter, setDemoFilter] = useState<'all' | 'true' | 'false'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PortalContentItem | null>(null);

  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PortalContentItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Ambil data layanan master untuk relasi FAQ
  const { data: servicesData } = useQuery({
    queryKey: ['services-for-portal'],
    queryFn: async () => {
      const res = await fetchApi<{ items?: Array<{ id: string; name: string }>; data?: Array<{ id: string; name: string }> }>('/api/v1/services?limit=100');
      const list = res.data || (Array.isArray(res) ? res : []);
      return list as Array<{ id: string; name: string }>;
    },
  });

  // Query konten portal
  const currentType = TABS.find((t) => t.id === activeTab)?.type;

  const { data, isLoading } = useQuery({
    queryKey: ['portal-contents', activeTab, search, publishedFilter, demoFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentType) params.set('type', currentType);
      if (publishedFilter !== 'all') params.set('published', publishedFilter);
      if (demoFilter !== 'all') params.set('isDemoContent', demoFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '50');

      const res = await fetchApi<{
        data: PortalContentItem[];
        meta: { total: number; page: number; totalPages: number };
      }>(`/api/v1/portal-content?${params.toString()}`);

      const items = Array.isArray(res.data) ? res.data : [];
      return { items, meta: res.meta };
    },
  });

  // Mutasi Toggle Publish
  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, published, type, patientConsent }: { id: string; published: boolean; type: string; patientConsent: boolean }) => {
      if (type === 'BEFORE_AFTER' && published && !patientConsent) {
        throw new Error('Tidak dapat mempublikasikan: Belum ada izin pasien (patientConsent)');
      }
      return fetchApi(`/api/v1/portal-content/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ published }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-contents'] });
      setFeedback({ type: 'success', message: 'Status publikasi berhasil diperbarui' });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui status publikasi';
      setFeedback({ type: 'error', message: msg });
    },
  });

  // Mutasi Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return fetchApi(`/api/v1/portal-content/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-contents'] });
      setFeedback({ type: 'success', message: 'Konten portal berhasil dihapus' });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus konten portal';
      setFeedback({ type: 'error', message: msg });
    },
  });

  // Mutasi Bulk Delete Demo
  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      return fetchApi<{ count: number }>('/api/v1/portal-content/bulk-delete-demo', {
        method: 'POST',
        body: JSON.stringify({
          type: currentType,
        }),
      });
    },
    onSuccess: (res: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['portal-contents'] });
      setConfirmBulkDelete(false);
      const resObj = res as { count?: number; data?: { count?: number } };
      const count = resObj?.data?.count ?? resObj?.count ?? 0;
      setFeedback({
        type: 'success',
        message: `Berhasil menghapus ${count} konten demo`,
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus konten demo';
      setFeedback({ type: 'error', message: msg });
    },
  });

  const items = data?.items || [];
  const demoCount = items.filter((i) => i.isDemoContent).length;

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Manajemen Konten Portal Publik
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                CMS terpusat untuk mengelola profil dokter, artikel edukasi, FAQ, galeri, dan fasilitas klinik.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {demoCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmBulkDelete(true)}
              className="text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Hapus Semua Demo ({demoCount})
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => {
              setSelectedItem(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah Konten
          </Button>
        </div>
      </div>

      {/* Banner Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-lg p-3 text-xs ${
            feedback.type === 'success'
              ? 'border border-primary/30 bg-primary/10 text-primary'
              : 'border border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner Deteksi Konten Demo */}
      {demoCount > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span>
              <strong>Perhatian:</strong> Terdapat <strong>{demoCount} konten contoh (demo)</strong> aktif.
              Gunakan tombol <em>Hapus Semua Demo</em> sebelum klinik live rilis ke pasien.
            </span>
          </div>
        </div>
      )}

      {/* Tabs Kategori Konten */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border pb-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul atau slug..."
            className="pl-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={publishedFilter}
            onChange={(e) => setPublishedFilter(e.target.value as 'all' | 'true' | 'false')}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Semua Status</option>
            <option value="true">Published</option>
            <option value="false">Draft</option>
          </select>

          <select
            value={demoFilter}
            onChange={(e) => setDemoFilter(e.target.value as 'all' | 'true' | 'false')}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Semua Tipe Data</option>
            <option value="true">Hanya Demo</option>
            <option value="false">Data Asli</option>
          </select>
        </div>
      </div>

      {/* Tabel Konten Portal */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-slate-50 text-muted font-medium">
              <tr>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Judul & Slug</th>
                <th className="px-4 py-3">Info Spesifik</th>
                <th className="px-4 py-3 text-center">Urutan</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Memuat konten portal...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <p className="text-sm font-medium text-foreground">Belum ada konten portal</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Klik &quot;Tambah Konten&quot; untuk membuat artikel, dokter, FAQ, atau panduan baru.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const meta = item.metadata || {};
                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-muted text-muted-foreground">
                          {item.type}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-foreground">{item.title}</span>
                          {item.isDemoContent && (
                            <Badge variant="warning" size="sm">
                              Demo
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">/{item.slug}</p>
                      </td>

                      <td className="px-4 py-3 align-top text-muted-foreground">
                        {item.type === 'DOCTOR' && (
                          <div>
                            <span className="font-medium text-foreground">
                              {String(meta.title || 'drg.')} {String(meta.name || '')}
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              STR: {meta.str ? String(meta.str) : <span className="italic">Tanpa STR (Demo)</span>}
                            </p>
                          </div>
                        )}

                        {item.type === 'BEFORE_AFTER' && (
                          <div>
                            {item.patientConsent ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                                <CheckCircle2 className="h-3 w-3" /> Izin Pasien Sah
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                                <XCircle className="h-3 w-3" /> Belum Ada Izin
                              </span>
                            )}
                          </div>
                        )}

                        {item.type === 'FAQ' && (
                          <p className="text-[11px]">
                            {meta.serviceName ? `Layanan: ${meta.serviceName}` : 'FAQ Umum Klinik'}
                          </p>
                        )}

                        {item.type !== 'DOCTOR' && item.type !== 'BEFORE_AFTER' && item.type !== 'FAQ' && (
                          <p className="text-[11px] truncate max-w-xs">{item.body || '-'}</p>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top text-center font-mono">
                        {item.sortOrder}
                      </td>

                      <td className="px-4 py-3 align-top text-center">
                        <button
                          type="button"
                          onClick={() =>
                            togglePublishMutation.mutate({
                              id: item.id,
                              published: !item.published,
                              type: item.type,
                              patientConsent: item.patientConsent,
                            })
                          }
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                            item.published
                              ? 'bg-primary/10 text-primary hover:bg-primary/20'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {item.published ? (
                            <>
                              <Eye className="h-3 w-3" /> Live
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" /> Draft
                            </>
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setSelectedItem(item);
                              setIsModalOpen(true);
                            }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 text-danger-solid hover:bg-danger-bg transition-colors"
                            onClick={() => setItemToDelete(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editor Portal Content */}
      <PortalContentModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSuccess={(msg) => {
          queryClient.invalidateQueries({ queryKey: ['portal-contents'] });
          if (msg) setFeedback({ type: 'success', message: msg });
        }}
        item={selectedItem}
        defaultType={currentType || 'ARTICLE'}
        services={servicesData || []}
      />

      {/* Dialog Konfirmasi Hapus Konten Tunggal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-danger-solid">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-bg text-danger-icon">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Hapus Konten Portal?
              </h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Apakah Anda yakin ingin menghapus konten <strong>&quot;{itemToDelete.title}&quot;</strong>?
              Tindakan ini tidak dapat dikembalikan.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItemToDelete(null)}
                disabled={deleteMutation.isPending}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  deleteMutation.mutate(itemToDelete.id);
                  setItemToDelete(null);
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Hapus Semua Demo */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-danger-solid">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-bg text-danger-icon">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Hapus Semua Konten Demo?
              </h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Tindakan ini akan menghapus <strong>semua konten bertanda demo</strong>
              {currentType ? ` untuk kategori ${currentType}` : ''} secara permanen dari database.
              Data yang terhapus tidak dapat dikembalikan.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmBulkDelete(false)}
                disabled={bulkDeleteMutation.isPending}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => bulkDeleteMutation.mutate()}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus Semua Demo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

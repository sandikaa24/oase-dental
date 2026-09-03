'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { Branch } from './branch-types';
import { BranchModal } from './branch-modal';
import { WorkingHoursModal } from './working-hours-modal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorBanner } from '@/components/ui/placeholder';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Clock,
  Power,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
} from 'lucide-react';

export function BranchTable() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [search, setSearch] = useState('');

  // Modals state
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const [workingHoursModalOpen, setWorkingHoursModalOpen] = useState(false);
  const [branchForWorkingHours, setBranchForWorkingHours] = useState<Branch | null>(null);

  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['branches', page, activeFilter],
    queryFn: async () => {
      let url = `/api/v1/branches?page=${page}&limit=20`;
      if (activeFilter !== undefined) url += `&active=${activeFilter}`;
      return fetchApi<Branch[]>(url);
    },
    enabled: isOwner,
  });

  const branches = data?.data ?? [];
  const meta = data?.meta;

  const filteredBranches = branches.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q) || b.address.toLowerCase().includes(q);
  });

  const handleOpenCreate = () => {
    setSelectedBranch(null);
    setBranchModalOpen(true);
  };

  const handleOpenEdit = (b: Branch) => {
    setSelectedBranch(b);
    setBranchModalOpen(true);
  };

  const handleOpenWorkingHours = (b: Branch) => {
    setBranchForWorkingHours(b);
    setWorkingHoursModalOpen(true);
  };

  const handleToggleStatus = async (b: Branch) => {
    try {
      await fetchApi(`/api/v1/branches/${b.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !b.active }),
      });
      // Invalidate query branches (otomatis merefresh BranchSelector di seluruh modul)
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setFeedbackMessage({
        type: 'success',
        text: `Cabang "${b.name}" (${b.code}) berhasil ${!b.active ? 'diaktifkan' : 'dinonaktifkan'}.`,
      });
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengubah status cabang',
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
            placeholder="Cari nama, kode, atau alamat cabang..."
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

          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreate}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Cabang</span>
          </Button>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Cabang"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat memuat data cabang'}
        />
      )}

      {/* Table Data */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-border text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Cabang &amp; Alamat</th>
                  <th className="py-3 px-4">Kontak Telepon</th>
                  <th className="py-3 px-4">Jam Operasional</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-12" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-44" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-28" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-14 mx-auto" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredBranches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <EmptyState
                        icon={<Building2 className="h-6 w-6 text-muted" />}
                        title="Tidak Ada Cabang"
                        description={search ? 'Tidak ditemukan cabang yang sesuai dengan kata kunci pencarian.' : 'Belum ada data cabang klinik.'}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredBranches.map((branch) => (
                    <tr key={branch.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {branch.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{branch.name}</div>
                        <div className="flex items-center gap-1 text-[11px] text-muted mt-0.5">
                          <MapPin className="h-3 w-3 text-muted shrink-0" />
                          <span className="line-clamp-1">{branch.address}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {branch.phone ? (
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Phone className="h-3 w-3 text-muted" />
                            <span>{branch.phone}</span>
                          </span>
                        ) : (
                          <span className="text-muted italic">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {branch.workingHours ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-foreground">
                              <Clock className="h-3 w-3 text-primary" />
                              <span>{branch.workingHours.openTime} – {branch.workingHours.closeTime}</span>
                            </span>
                            <div className="text-[10px] text-muted">
                              Late after: <span className="font-mono font-medium">{branch.workingHours.lateAfter}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-amber-700 text-[11px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Belum diatur
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {branch.active ? (
                          <Badge variant="success">Aktif</Badge>
                        ) : (
                          <Badge variant="default" className="bg-slate-200 text-slate-700">Nonaktif</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Setting Jam Kerja */}
                          <button
                            type="button"
                            title="Atur jam operasional & shift"
                            onClick={() => handleOpenWorkingHours(branch)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-primary hover:bg-primary-soft transition-colors"
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit Profil */}
                          <button
                            type="button"
                            title="Edit profil cabang"
                            onClick={() => handleOpenEdit(branch)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-primary hover:bg-primary-soft transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Toggle Active Status */}
                          <button
                            type="button"
                            title={branch.active ? 'Nonaktifkan cabang' : 'Aktifkan cabang'}
                            onClick={() => handleToggleStatus(branch)}
                            className={`p-1.5 rounded-md transition-colors ${
                              branch.active
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
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
                Halaman {meta.page} dari {meta.totalPages} (Total {meta.total} cabang)
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

      {/* Modal Create & Edit Branch */}
      <BranchModal
        open={branchModalOpen}
        onOpenChange={setBranchModalOpen}
        onSuccess={(msg) => {
          queryClient.invalidateQueries({ queryKey: ['branches'] });
          if (msg) setFeedbackMessage({ type: 'success', text: msg });
        }}
        branch={selectedBranch}
      />

      {/* Modal Setting Working Hours */}
      <WorkingHoursModal
        open={workingHoursModalOpen}
        onOpenChange={setWorkingHoursModalOpen}
        onSuccess={(msg) => {
          queryClient.invalidateQueries({ queryKey: ['branches'] });
          if (msg) setFeedbackMessage({ type: 'success', text: msg });
        }}
        branch={branchForWorkingHours}
      />
    </div>
  );
}

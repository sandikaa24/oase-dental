'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { StockOpnameSummary, ItemType, OpnameStatus } from '@/components/inventory/inventory-types';
import { OpnameTable } from '@/components/inventory/opname-table';
import { BranchSelector } from '@/components/inventory/branch-selector';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorBanner, EmptyState } from '@/components/ui/placeholder';
import {
  ClipboardList,
  Plus,
  ArrowLeft,
  X,
  ShieldX,
  Filter,
  Building2,
} from 'lucide-react';

export default function StockOpnameListPage() {
  const router = useRouter();
  const { user } = useAuth();

  const canAccess = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const [selectedBranchId, setSelectedBranchId] = useState<string>(user?.activeBranchId || '');

  useEffect(() => {
    if (user?.role !== 'OWNER' && user?.activeBranchId) {
      setSelectedBranchId(user.activeBranchId);
    }
  }, [user]);

  const effectiveBranchId = user?.role === 'OWNER' ? selectedBranchId : (user?.activeBranchId || selectedBranchId);

  const [statusFilter, setStatusFilter] = useState<OpnameStatus | ''>('');
  const [page, setPage] = useState(1);

  // Modal Create DRAFT state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [opnameDate, setOpnameDate] = useState(() => new Date().toISOString().split('T')[0]);
  const itemType: ItemType = 'MATERIAL';
  const [note, setNote] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stock-opnames', effectiveBranchId, statusFilter, page],
    queryFn: async () => {
      let url = `/api/v1/stock-opnames?page=${page}&limit=20`;
      if (effectiveBranchId) url += `&branchId=${effectiveBranchId}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      return fetchApi<StockOpnameSummary[]>(url);
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
              Hanya <strong>OWNER</strong> dan <strong>MANAGER</strong> yang memiliki wewenang untuk mengelola sesi stock opname.
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

  const opnames = data?.data ?? [];
  const meta = data?.meta;

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const res = await fetchApi<{ id: string }>('/api/v1/stock-opnames', {
        method: 'POST',
        body: JSON.stringify({
          branchId: effectiveBranchId || undefined,
          opnameDate,
          itemType,
          note: note.trim() || undefined,
        }),
      });

      if (res.data?.id) {
        router.push(`/admin/inventory/opname/${res.data.id}`);
      } else {
        refetch();
        setCreateModalOpen(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setCreateError(err.message);
      } else {
        setCreateError('Gagal membuat sesi stock opname.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/inventory"
              className="text-xs text-muted hover:text-primary flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Kembali ke Inventaris</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Stock Opname
              </h1>
              <p className="text-xs text-muted">
                Riwayat dan sesi perhitungan fisik berkala per cabang
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

          <Button
            variant="primary"
            size="md"
            onClick={() => setCreateModalOpen(true)}
            disabled={!effectiveBranchId}
            className="flex items-center gap-1.5 text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Sesi Opname Baru</span>
          </Button>
        </div>
      </div>

      {/* Filter Status Toolbar */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span>Filter Status:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                statusFilter === ''
                  ? 'bg-primary text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Status
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('DRAFT');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                statusFilter === 'DRAFT'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              DRAFT (Perlu Review)
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('SUBMITTED');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                statusFilter === 'SUBMITTED'
                  ? 'bg-teal-100 text-teal-900 border border-teal-300 font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              SUBMITTED (Terkunci)
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Riwayat Opname"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat memuat riwayat opname'}
        />
      )}

      {/* Empty State bila cabang belum dipilih */}
      {!effectiveBranchId ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Pilih Cabang"
          description="Silakan pilih cabang terlebih dahulu untuk melihat riwayat dan sesi stock opname."
        />
      ) : (
        /* Opname Table */
        <OpnameTable
          opnames={opnames}
          isLoading={isLoading}
          meta={meta}
          onPageChange={(newPage) => setPage(newPage)}
        />
      )}

      {/* Modal Create DRAFT Stock Opname */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary-soft text-primary">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Buat Sesi Stock Opname
                  </h3>
                  <p className="text-[11px] text-muted">
                    Sistem akan mengambil snapshot stok aktif saat ini
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-md text-muted hover:text-foreground hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="space-y-4">
              {createError && (
                <ErrorBanner title="Pembuatan Draf Gagal" message={createError} />
              )}

              {/* Tanggal Opname */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Tanggal Opname</label>
                <input
                  type="date"
                  required
                  value={opnameDate}
                  onChange={(e) => setOpnameDate(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-white px-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Jenis Item */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Kategori Item</label>
                <div className="py-2 px-3 rounded-lg border border-primary bg-primary-soft text-primary text-xs font-semibold text-center">
                  Bahan Klinis (MATERIAL)
                </div>
              </div>

              {/* Catatan Sesi */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Catatan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Opname Akhir Bulan Cabang Pusat"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-white px-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={isCreating}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isCreating}
                >
                  Buat Draf &amp; Hitung Fisik
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

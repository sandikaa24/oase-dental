'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { formatRupiah, formatDate } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CreditCard,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { EXPENSE_CATEGORIES, type ExpenseCategoryType } from '@/lib/validations/expense.schema';

export interface ExpenseRecord {
  id: string;
  branchId: string;
  branch?: {
    id: string;
    code: string;
    name: string;
  } | null;
  category: ExpenseCategoryType;
  amount: string;
  expenseDate: string;
  note: string;
  proofUrl: string | null;
  createdBy: string;
  createdByUser?: {
    id: string;
    email: string;
    employee: {
      name: string;
    } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface ExpenseListProps {
  isOwner: boolean;
  activeBranchId: string | null;
  branches?: Array<{ id: string; code: string; name: string }>;
  onOpenCreateModal: () => void;
}

export function ExpenseList({
  isOwner,
  branches = [],
  onOpenCreateModal,
}: ExpenseListProps) {
  const [page, setPage] = useState<number>(1);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

  const limit = 15;

  const { data: response, isLoading, isError, error, refetch } = useQuery<
    ApiResponse<ExpenseRecord[]>
  >({
    queryKey: [
      'expenses',
      {
        page,
        limit,
        category: categoryFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        branchId: isOwner ? (branchFilter || undefined) : undefined,
      },
    ],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set('page', String(page));
      sp.set('limit', String(limit));
      if (categoryFilter) sp.set('category', categoryFilter);
      if (dateFrom) sp.set('dateFrom', dateFrom);
      if (dateTo) sp.set('dateTo', dateTo);
      if (isOwner && branchFilter) sp.set('branchId', branchFilter);

      return fetchApi<ExpenseRecord[]>(`/api/v1/expenses?${sp.toString()}`);
    },
  });

  const resetFilters = () => {
    setCategoryFilter('');
    setDateFrom('');
    setDateTo('');
    setBranchFilter('');
    setPage(1);
  };

  const getCategoryBadgeVariant = (cat: ExpenseCategoryType) => {
    switch (cat) {
      case 'OPERASIONAL':
        return 'primary';
      case 'GAJI':
        return 'info';
      case 'SEWA':
        return 'warning';
      case 'UTILITAS':
        return 'neutral';
      case 'SUPPLIER':
        return 'success';
      case 'LAINNYA':
      default:
        return 'default';
    }
  };

  const records = response?.data || [];
  const meta = response?.meta || { page: 1, limit, total: 0, totalPages: 1 };

  return (
    <div className="space-y-4">
      {/* Bar Filter */}
      <div className="bg-surface rounded-xl border border-border p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Filter className="w-4 h-4 text-primary" />
            <span>Filter Pengeluaran</span>
          </div>
          {(categoryFilter || dateFrom || dateTo || branchFilter) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-primary hover:underline font-medium"
            >
              Reset Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Filter Cabang (Hanya OWNER) */}
          {isOwner && (
            <div>
              <label htmlFor="filter-branch" className="block text-xs font-medium text-muted mb-1">
                Cabang
              </label>
              <select
                id="filter-branch"
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setPage(1);
                }}
                className="flex h-9 w-full rounded-md border border-slate-300 bg-surface px-3 py-1.5 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-primary-soft"
              >
                <option value="">Semua Cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filter Kategori */}
          <div>
            <label htmlFor="filter-cat" className="block text-xs font-medium text-muted mb-1">
              Kategori
            </label>
            <select
              id="filter-cat"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="flex h-9 w-full rounded-md border border-slate-300 bg-surface px-3 py-1.5 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-primary-soft"
            >
              <option value="">Semua Kategori</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Dari Tanggal */}
          <div>
            <label htmlFor="filter-date-from" className="block text-xs font-medium text-muted mb-1">
              Dari Tanggal
            </label>
            <Input
              id="filter-date-from"
              type="date"
              className="h-9 text-xs"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Filter Sampai Tanggal */}
          <div>
            <label htmlFor="filter-date-to" className="block text-xs font-medium text-muted mb-1">
              Sampai Tanggal
            </label>
            <Input
              id="filter-date-to"
              type="date"
              className="h-9 text-xs"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Tabel Data & States */}
      <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
        {/* State: Error */}
        {isError && (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-danger-icon mx-auto" />
            <h3 className="text-sm font-semibold text-danger-text">Gagal Memuat Data Pengeluaran</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {error instanceof Error ? error.message : 'Terjadi kesalahan sistem'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Coba Lagi
            </Button>
          </div>
        )}

        {/* State: Loading */}
        {isLoading && (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        )}

        {/* State: Empty */}
        {!isLoading && !isError && records.length === 0 && (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Belum Ada Pengeluaran</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {categoryFilter || dateFrom || dateTo || branchFilter
                ? 'Tidak ada data pengeluaran yang sesuai dengan filter pencarian.'
                : 'Belum ada pengeluaran yang dicatat di klinik ini.'}
            </p>
            <Button variant="primary" size="sm" onClick={onOpenCreateModal}>
              + Catat Pengeluaran Baru
            </Button>
          </div>
        )}

        {/* State: Data Ready */}
        {!isLoading && !isError && records.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-slate-50/75 text-muted font-medium">
                    <th className="py-3 px-4">Tanggal</th>
                    {isOwner && <th className="py-3 px-4">Cabang</th>}
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Nominal</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4">Bukti Nota</th>
                    <th className="py-3 px-4">Dicatat Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                        {formatDate(item.expenseDate)}
                      </td>

                      {isOwner && (
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-700">
                            {item.branch?.code || '-'}
                          </span>
                        </td>
                      )}

                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant={getCategoryBadgeVariant(item.category)} size="sm">
                          {item.category}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-semibold text-foreground">
                        {formatRupiah(item.amount)}
                      </td>

                      <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={item.note}>
                        {item.note}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.proofUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedProofUrl(item.proofUrl)}
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-xs"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Lihat Bukti</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-muted text-[11px]">
                        {item.createdByUser?.employee?.name || item.createdByUser?.email || item.createdBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50/50 text-xs">
              <span className="text-muted">
                Menampilkan {records.length} dari {meta.total || 0} pengeluaran
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Sebelumnya
                </Button>
                <span className="text-muted font-medium">
                  {meta.page || page} / {meta.totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= (meta.totalPages || 1)}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 px-2.5"
                >
                  Berikutnya
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Preview Bukti Gambar */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative bg-surface rounded-xl max-w-xl w-full p-4 shadow-md border border-border space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-foreground">Bukti Pengeluaran</h3>
              <div className="flex items-center gap-2">
                <a
                  href={selectedProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-muted hover:text-foreground text-xs flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedProofUrl(null)}
                  className="p-1 text-muted hover:text-foreground rounded-sm"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-lg bg-slate-100 flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedProofUrl}
                alt="Bukti Pengeluaran"
                className="max-h-[65vh] w-auto object-contain rounded-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { formatDate } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, AlertCircle, RefreshCw } from 'lucide-react';

export interface LeaveRecord {
  id: string;
  employeeId: string;
  type: 'CUTI' | 'IZIN' | 'SAKIT';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    name: string;
    position: string;
    branches?: Array<{
      branch: {
        id: string;
        code: string;
        name: string;
      };
    }>;
  };
}

interface MyLeavesTabProps {
  onOpenApplyModal: () => void;
  hasEmployeeProfile: boolean;
}

export function MyLeavesTab({
  onOpenApplyModal,
  hasEmployeeProfile,
}: MyLeavesTabProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [actionError, setActionError] = useState<string | null>(null);

  // TanStack Query untuk pengajuan cuti saya
  const { data: response, isLoading, isError, refetch } = useQuery<
    ApiResponse<LeaveRecord[]>
  >({
    queryKey: ['leave-requests', 'me', { status: statusFilter || undefined, page }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set('scope', 'me');
      sp.set('page', String(page));
      sp.set('limit', '10');
      if (statusFilter) sp.set('status', statusFilter);
      return fetchApi<LeaveRecord[]>(`/api/v1/leave-requests?${sp.toString()}`);
    },
    enabled: hasEmployeeProfile,
  });

  // Mutasi Pembatalan (Cancel)
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      return fetchApi(`/api/v1/leave-requests/${id}/cancel`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['leave-requests', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests', 'team'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Gagal membatalkan pengajuan');
    },
  });

  if (!hasEmployeeProfile) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-800 mb-1">
          Akun Tidak Terhubung ke Data Karyawan
        </h3>
        <p className="text-xs text-muted max-w-md mx-auto">
          Akun ini tidak memiliki ID karyawan aktif, sehingga tidak memiliki
          rekam pengajuan cuti pribadi.
        </p>
      </div>
    );
  }

  const records = response?.data || [];
  const meta = response?.meta;

  const renderBadge = (status: LeaveRecord['status']) => {
    switch (status) {
      case 'APPROVED':
        return (
          <Badge variant="success" size="sm">
            Disetujui
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="danger" size="sm">
            Ditolak
          </Badge>
        );
      case 'PENDING':
      default:
        return (
          <Badge variant="warning" size="sm">
            Menunggu
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter & Tombol Ajukan */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-lg border border-slate-200 px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:border-teal-500"
          >
            <option value="">Semua Status</option>
            <option value="PENDING">Menunggu</option>
            <option value="APPROVED">Disetujui</option>
            <option value="REJECTED">Ditolak</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="text-xs text-slate-600 gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={onOpenApplyModal}
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs gap-1 shadow-sm"
          >
            + Ajukan Cuti/Izin
          </Button>
        </div>
      </div>

      {/* Tabel Riwayat */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold text-[11px]">
              <tr>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Rentang Tanggal</th>
                <th className="px-4 py-3">Alasan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Catatan Putusan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Memuat riwayat pengajuan cuti...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-red-500">
                    Gagal memuat data pengajuan cuti.
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Belum ada riwayat pengajuan cuti/izin.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {r.type}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(r.startDate)} s.d. {formatDate(r.endDate)}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-slate-700" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {renderBadge(r.status)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={r.decisionNote || '-'}>
                      {r.decisionNote || '-'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {r.status === 'PENDING' ? (
                        <button
                          onClick={() => {
                            if (confirm('Yakin ingin membatalkan pengajuan ini?')) {
                              cancelMutation.mutate(r.id);
                            }
                          }}
                          disabled={cancelMutation.isPending}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-medium text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Batalkan
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic">
                          Terkunci
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginasi */}
        {Boolean(meta?.totalPages && meta.totalPages > 1) && (
          <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-slate-50/50 text-xs">
            <span className="text-muted">
              Total {meta?.total ?? 0} pengajuan (Halaman {page} dari {meta?.totalPages})
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={Boolean(meta?.totalPages && page >= meta.totalPages)}
                onClick={() => setPage((p) => p + 1)}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

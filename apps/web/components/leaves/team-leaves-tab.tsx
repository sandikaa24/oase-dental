'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { formatDate } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import type { LeaveRecord } from './my-leaves-tab';

interface TeamLeavesTabProps {
  isOwner: boolean;
  activeBranchId: string | null;
  currentEmployeeName?: string | null;
}

export function TeamLeavesTab({
  isOwner,
  activeBranchId,
  currentEmployeeName,
}: TeamLeavesTabProps) {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [actionError, setActionError] = useState<string | null>(null);

  // State Dialog Keputusan (Approve/Reject)
  const [decideTarget, setDecideTarget] = useState<LeaveRecord | null>(null);
  const [decisionType, setDecisionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [decisionNote, setDecisionNote] = useState<string>('');

  // Ambil data cabang untuk filter OWNER
  const { data: branchRes } = useQuery<ApiResponse<Array<{ id: string; name: string; code: string }>>>({
    queryKey: ['branches', 'active'],
    queryFn: () => fetchApi<Array<{ id: string; name: string; code: string }>>('/branches?active=true'),
    enabled: isOwner,
  });

  const branches = branchRes?.data || [];

  // Query permohonan cuti tim
  const queryKey = [
    'leave-requests',
    'team',
    {
      status: statusFilter || undefined,
      branchId: isOwner ? (branchFilter || undefined) : (activeBranchId || undefined),
      page,
    },
  ];

  const { data: response, isLoading, isError, refetch } = useQuery<ApiResponse<LeaveRecord[]>>({
    queryKey,
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set('page', String(page));
      sp.set('limit', '10');
      if (statusFilter) sp.set('status', statusFilter);
      if (isOwner && branchFilter) sp.set('branchId', branchFilter);
      return fetchApi<LeaveRecord[]>(`/leave-requests?${sp.toString()}`);
    },
  });

  // Mutasi Keputusan
  const decideMutation = useMutation({
    mutationFn: async ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: 'APPROVED' | 'REJECTED';
      note?: string;
    }) => {
      return fetchApi(`/leave-requests/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          note: note || undefined,
        }),
      });
    },
    onSuccess: () => {
      setActionError(null);
      setDecideTarget(null);
      setDecisionNote('');
      queryClient.invalidateQueries({ queryKey: ['leave-requests', 'team'] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests', 'me'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Gagal memproses keputusan');
    },
  });

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

  const openDecideModal = (record: LeaveRecord, type: 'APPROVED' | 'REJECTED') => {
    setActionError(null);
    setDecideTarget(record);
    setDecisionType(type);
    setDecisionNote('');
  };

  const handleConfirmDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decideTarget) return;

    decideMutation.mutate({
      id: decideTarget.id,
      decision: decisionType,
      note: decisionNote,
    });
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

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Status */}
          <div className="flex items-center gap-1.5">
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
              <option value="PENDING">Menunggu Persetujuan</option>
              <option value="APPROVED">Disetujui</option>
              <option value="REJECTED">Ditolak</option>
            </select>
          </div>

          {/* Filter Cabang (OWNER-only) */}
          {isOwner && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Cabang:</label>
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs rounded-lg border border-slate-200 px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:border-teal-500"
              >
                <option value="">Semua Cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="text-xs text-slate-600 gap-1 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Tabel Pengajuan Tim */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold text-[11px]">
              <tr>
                <th className="px-4 py-3">Karyawan</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Rentang Tanggal</th>
                <th className="px-4 py-3">Alasan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Catatan Putusan</th>
                <th className="px-4 py-3 text-right">Keputusan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Memuat data pengajuan tim...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-red-500">
                    Gagal memuat data pengajuan tim.
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Tidak ada pengajuan cuti tim yang sesuai filter.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isSelfLeave = Boolean(currentEmployeeName && r.employee?.name === currentEmployeeName);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          {r.employee?.name || 'Karyawan'}
                        </div>
                        <div className="text-[11px] text-muted">
                          {r.employee?.position || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
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
                          isSelfLeave ? (
                            <span className="text-[11px] text-amber-600 italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title="Self-decision dilarang (403)">
                              Milik Sendiri
                            </span>
                          ) : (
                            <div className="inline-flex gap-1.5">
                              <button
                                onClick={() => openDecideModal(r, 'APPROVED')}
                                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium text-xs px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                              >
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                Setujui
                              </button>
                              <button
                                onClick={() => openDecideModal(r, 'REJECTED')}
                                className="inline-flex items-center gap-1 text-red-700 hover:text-red-800 font-medium text-xs px-2.5 py-1 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5 text-red-600" />
                                Tolak
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-400 text-xs italic">
                            Selesai
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginasi */}
        {Boolean(meta?.totalPages && meta.totalPages > 1) && (
          <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-slate-50/50 text-xs">
            <span className="text-muted">
              Total {meta?.total ?? 0} data (Halaman {page} dari {meta?.totalPages})
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

      {/* Dialog Konfirmasi Keputusan */}
      <Dialog open={!!decideTarget} onOpenChange={(open) => !open && setDecideTarget(null)}>
        <div className="p-6 max-w-md w-full bg-white rounded-xl shadow-xl">
          <DialogHeader className="mb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold text-slate-800">
                {decisionType === 'APPROVED' ? 'Setujui Pengajuan Cuti' : 'Tolak Pengajuan Cuti'}
              </DialogTitle>
              <DialogClose onClose={() => setDecideTarget(null)} />
            </div>
          </DialogHeader>

          {decideTarget && (
            <form onSubmit={handleConfirmDecision} className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 text-slate-600 border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-800">Karyawan:</span>{' '}
                  {decideTarget.employee?.name}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Tipe:</span>{' '}
                  {decideTarget.type}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Tanggal:</span>{' '}
                  {formatDate(decideTarget.startDate)} s.d. {formatDate(decideTarget.endDate)}
                </div>
                <div className="pt-1 text-slate-700 italic border-t border-slate-200">
                  &ldquo;{decideTarget.reason}&rdquo;
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Keputusan (Opsional)
                </label>
                <textarea
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Berikan catatan persetujuan atau alasan penolakan..."
                  rows={2}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDecideTarget(null)}
                  disabled={decideMutation.isPending}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={decideMutation.isPending}
                  className={
                    decisionType === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }
                >
                  {decisionType === 'APPROVED' ? 'Ya, Setujui' : 'Ya, Tolak'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Dialog>
    </div>
  );
}

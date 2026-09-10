'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftRight, Check, X, Clock, Calendar, AlertCircle } from 'lucide-react';

interface EmployeeItem {
  id: string;
  name: string;
  position: string;
}

interface ShiftSwapItem {
  id: string;
  requesterId: string;
  targetEmployeeId: string;
  branchId: string;
  requesterDate: string;
  requesterShift: 'MORNING' | 'EVENING';
  targetDate: string;
  targetShift: 'MORNING' | 'EVENING';
  reason?: string | null;
  status: 'PENDING_PEER' | 'PEER_APPROVED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requester?: { id: string; name: string };
  targetEmployee?: { id: string; name: string };
  branch?: { id: string; name: string };
}

interface ShiftSwapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShiftSwapModal({ open, onOpenChange }: ShiftSwapModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [activeSubTab, setActiveSubTab] = useState<'create' | 'list'>('create');
  const [requesterDate, setRequesterDate] = useState<string>(todayStr);
  const [requesterShift, setRequesterShift] = useState<'MORNING' | 'EVENING'>('MORNING');
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>(todayStr);
  const [targetShift, setTargetShift] = useState<'MORNING' | 'EVENING'>('EVENING');
  const [reason, setReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch daftar rekan kerja
  const { data: employeesRes } = useQuery<ApiResponse<EmployeeItem[]>>({
    queryKey: ['employees', 'active'],
    queryFn: () => fetchApi<EmployeeItem[]>('/api/v1/employees?limit=100'),
    enabled: open,
  });

  // Fetch daftar permohonan swap
  const { data: swapsRes, isLoading: isLoadingSwaps } = useQuery<ApiResponse<ShiftSwapItem[]>>({
    queryKey: ['shifts', 'swaps'],
    queryFn: () => fetchApi<ShiftSwapItem[]>('/api/v1/shifts/swaps'),
    enabled: open,
  });

  // Mutasi buat swap request
  const createSwapMutation = useMutation({
    mutationFn: () =>
      fetchApi('/api/v1/shifts/swaps', {
        method: 'POST',
        body: JSON.stringify({
          targetEmployeeId,
          requesterDate,
          requesterShift,
          targetDate,
          targetShift,
          reason: reason.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      setErrorMessage(null);
      setSuccessMessage('Permohonan tukar shift berhasil dikirim ke rekan kerja!');
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['shifts', 'swaps'] });
      setActiveSubTab('list');
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || 'Gagal mengajukan tukar shift');
    },
  });

  // Mutasi respon rekan kerja (approve/reject)
  const peerRespondMutation = useMutation({
    mutationFn: ({ swapId, action }: { swapId: string; action: 'APPROVE' | 'REJECT' }) =>
      fetchApi(`/api/v1/shifts/swaps/${swapId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', 'swaps'] });
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || 'Gagal merespons permohonan');
    },
  });

  // Mutasi owner approval (decide)
  const ownerDecideMutation = useMutation({
    mutationFn: ({ swapId, action }: { swapId: string; action: 'APPROVE' | 'REJECT' }) =>
      fetchApi(`/api/v1/shifts/swaps/${swapId}/decide`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', 'swaps'] });
      queryClient.invalidateQueries({ queryKey: ['shifts', 'assignments'] });
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || 'Gagal mengambil keputusan');
    },
  });

  if (!open) return null;

  const swaps = swapsRes?.data || [];
  const otherEmployees = employeesRes?.data?.filter((e) => e.id !== user?.employeeId) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Tukar Shift Staf</h3>
              <p className="text-[11px] text-muted">
                Pengajuan pertukaran jadwal shift antar rekan kerja klinik.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md text-muted hover:text-foreground hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('create');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSubTab === 'create'
                ? 'bg-primary text-white'
                : 'text-slate-600 hover:text-foreground hover:bg-slate-100'
            }`}
          >
            Ajukan Pertukaran Baru
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('list');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'list'
                ? 'bg-primary text-white'
                : 'text-slate-600 hover:text-foreground hover:bg-slate-100'
            }`}
          >
            <span>Daftar Permohonan</span>
            {swaps.filter((s) => s.status === 'PENDING_PEER' || s.status === 'PEER_APPROVED').length >
              0 && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Notifikasi feedback */}
        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-danger-bg text-danger-text text-xs flex items-center gap-2 border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-900 text-xs flex items-center gap-2 border border-emerald-200">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Tab 1: Form Ajukan Tukar Shift */}
        {activeSubTab === 'create' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Kolom Shift Saya */}
              <div className="p-3 rounded-lg border border-border bg-slate-50 space-y-2">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>Jadwal Shift Anda yang Ingin Ditukar</span>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600">Tanggal Shift Anda:</label>
                  <input
                    type="date"
                    value={requesterDate}
                    onChange={(e) => setRequesterDate(e.target.value)}
                    className="w-full text-xs p-1.5 rounded border border-border bg-white mt-0.5"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600">Shift Anda:</label>
                  <select
                    value={requesterShift}
                    onChange={(e) => setRequesterShift(e.target.value as 'MORNING' | 'EVENING')}
                    className="w-full text-xs p-1.5 rounded border border-border bg-white mt-0.5"
                  >
                    <option value="MORNING">Shift Pagi (09:00 - 13:00)</option>
                    <option value="EVENING">Shift Sore (16:00 - 21:00)</option>
                  </select>
                </div>
              </div>

              {/* Kolom Shift Rekan */}
              <div className="p-3 rounded-lg border border-border bg-slate-50 space-y-2">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Target Rekan &amp; Shift Pengganti</span>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600">Pilih Rekan Kerja:</label>
                  <select
                    value={targetEmployeeId}
                    onChange={(e) => setTargetEmployeeId(e.target.value)}
                    className="w-full text-xs p-1.5 rounded border border-border bg-white mt-0.5"
                  >
                    <option value="">-- Pilih Rekan Kerja --</option>
                    {otherEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.position})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600">Tanggal Shift Rekan:</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full text-xs p-1.5 rounded border border-border bg-white mt-0.5"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600">Shift Rekan:</label>
                  <select
                    value={targetShift}
                    onChange={(e) => setTargetShift(e.target.value as 'MORNING' | 'EVENING')}
                    className="w-full text-xs p-1.5 rounded border border-border bg-white mt-0.5"
                  >
                    <option value="MORNING">Shift Pagi (09:00 - 13:00)</option>
                    <option value="EVENING">Shift Sore (16:00 - 21:00)</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">Alasan Pertukaran (Opsional):</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Misal: Keperluan keluarga mendadak..."
                className="w-full text-xs p-2 rounded border border-border bg-white mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => createSwapMutation.mutate()}
                disabled={!targetEmployeeId || createSwapMutation.isPending}
                isLoading={createSwapMutation.isPending}
              >
                Kirim Pengajuan
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: Daftar Status Swap */}
        {activeSubTab === 'list' && (
          <div className="space-y-3">
            {isLoadingSwaps ? (
              <div className="text-xs text-muted text-center py-6 animate-pulse">
                Memuat riwayat permohonan tukar shift...
              </div>
            ) : swaps.length === 0 ? (
              <div className="text-xs text-muted text-center py-8">
                Belum ada permohonan pertukaran shift aktif.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {swaps.map((item) => {
                  const isTarget = item.targetEmployeeId === user?.employeeId;

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-border bg-white space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <span>{item.requester?.name || 'Staf'}</span>
                          <span className="text-muted font-normal font-mono">
                            ({item.requesterDate} - {item.requesterShift})
                          </span>
                          <ArrowLeftRight className="w-3 h-3 text-primary" />
                          <span>{item.targetEmployee?.name || 'Rekan'}</span>
                          <span className="text-muted font-normal font-mono">
                            ({item.targetDate} - {item.targetShift})
                          </span>
                        </div>

                        <div>
                          {item.status === 'PENDING_PEER' && (
                            <Badge variant="warning" size="sm">Menunggu Rekan</Badge>
                          )}
                          {item.status === 'PEER_APPROVED' && (
                            <Badge variant="info" size="sm">Menunggu Owner</Badge>
                          )}
                          {item.status === 'APPROVED' && (
                            <Badge variant="success" size="sm">Disetujui (Aktif)</Badge>
                          )}
                          {item.status === 'REJECTED' && (
                            <Badge variant="danger" size="sm">Ditolak</Badge>
                          )}
                          {item.status === 'CANCELLED' && (
                            <Badge variant="neutral" size="sm">Dibatalkan</Badge>
                          )}
                        </div>
                      </div>

                      {item.reason && (
                        <div className="text-[11px] text-muted italic bg-slate-50 p-1.5 rounded">
                          Alasan: &ldquo;{item.reason}&rdquo;
                        </div>
                      )}

                      {/* Tombol Aksi Persetujuan Rekan */}
                      {isTarget && item.status === 'PENDING_PEER' && (
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                          <span className="text-[11px] text-muted">Konfirmasi Anda:</span>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs text-red-600 hover:bg-red-50"
                            onClick={() =>
                              peerRespondMutation.mutate({ swapId: item.id, action: 'REJECT' })
                            }
                            disabled={peerRespondMutation.isPending}
                          >
                            Tolak
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              peerRespondMutation.mutate({ swapId: item.id, action: 'APPROVE' })
                            }
                            disabled={peerRespondMutation.isPending}
                          >
                            Setujui
                          </Button>
                        </div>
                      )}

                      {/* Tombol Aksi Persetujuan Owner */}
                      {isOwner && item.status === 'PEER_APPROVED' && (
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 bg-amber-50/50 p-1.5 rounded">
                          <span className="text-[11px] font-semibold text-amber-900">
                            Persetujuan Owner:
                          </span>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs text-red-600 hover:bg-red-50"
                            onClick={() =>
                              ownerDecideMutation.mutate({ swapId: item.id, action: 'REJECT' })
                            }
                            disabled={ownerDecideMutation.isPending}
                          >
                            Tolak
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              ownerDecideMutation.mutate({ swapId: item.id, action: 'APPROVE' })
                            }
                            disabled={ownerDecideMutation.isPending}
                          >
                            Setujui &amp; Swap Jadwal
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => onOpenChange(false)}
              >
                Tutup
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

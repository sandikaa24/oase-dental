'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { Branch } from './branch-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Plus, Trash2, X, User } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

interface ShiftAssignmentItem {
  id: string;
  employeeId: string;
  branchId: string;
  date: string;
  shift: 'MORNING' | 'EVENING';
  source: 'MANUAL' | 'SWAP';
  employee?: {
    id: string;
    name: string;
    position: string;
  };
}

interface EmployeeItem {
  id: string;
  name: string;
  position: string;
  active: boolean;
}

interface ShiftCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch | null;
}

export function ShiftCalendarModal({
  open,
  onOpenChange,
  branch,
}: ShiftCalendarModalProps) {
  const queryClient = useQueryClient();

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<'MORNING' | 'EVENING'>('MORNING');
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch daftar karyawan aktif
  const { data: employeesRes } = useQuery<ApiResponse<EmployeeItem[]>>({
    queryKey: ['employees', 'active'],
    queryFn: () => fetchApi<EmployeeItem[]>('/api/v1/employees?limit=100'),
    enabled: open,
  });

  // Fetch assignments untuk cabang & tanggal terpilih
  const { data: assignmentsRes, isLoading: isLoadingAssignments } = useQuery<
    ApiResponse<ShiftAssignmentItem[]>
  >({
    queryKey: ['shifts', 'assignments', branch?.id, selectedDate],
    queryFn: () =>
      fetchApi<ShiftAssignmentItem[]>(
        `/api/v1/shifts/assignments?branchId=${branch?.id}&date=${selectedDate}`
      ),
    enabled: open && !!branch?.id,
  });

  // Mutasi tambah assignment
  const createMutation = useMutation({
    mutationFn: () =>
      fetchApi('/api/v1/shifts/assignments', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          branchId: branch?.id,
          date: selectedDate,
          shift: selectedShift,
        }),
      }),
    onSuccess: () => {
      setActionError(null);
      setSelectedEmployeeId('');
      queryClient.invalidateQueries({ queryKey: ['shifts', 'assignments'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Gagal menambahkan penugasan shift');
    },
  });

  // Mutasi hapus assignment
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/v1/shifts/assignments/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['shifts', 'assignments'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Gagal menghapus penugasan');
    },
  });

  if (!open || !branch) return null;

  const assignments = assignmentsRes?.data || [];
  const morningShifts = assignments.filter((a) => a.shift === 'MORNING');
  const eveningShifts = assignments.filter((a) => a.shift === 'EVENING');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Jadwal Shift Staf — {branch.name}
              </h3>
              <p className="text-[11px] text-muted">
                Penugasan shift kerja harian staf (Pagi 09:00-13:00 / Sore 16:00-21:00)
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

        {/* Filter Tanggal */}
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-700">Pilih Tanggal:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-mono p-1.5 rounded border border-border bg-white text-foreground"
            />
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            {formatDate(new Date(selectedDate), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'Asia/Jakarta',
            })}
          </div>
        </div>

        {/* Form Tambah Penugasan */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
          <div className="text-xs font-bold text-primary flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Tugaskan Staf ke Shift Ini</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full text-xs p-2 rounded border border-border bg-white text-foreground"
              >
                <option value="">-- Pilih Karyawan --</option>
                {employeesRes?.data?.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.position})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value as 'MORNING' | 'EVENING')}
                className="w-full text-xs p-2 rounded border border-border bg-white text-foreground"
              >
                <option value="MORNING">Shift Pagi (09:00 - 13:00)</option>
                <option value="EVENING">Shift Sore (16:00 - 21:00)</option>
              </select>
            </div>

            <div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={!selectedEmployeeId || createMutation.isPending}
                isLoading={createMutation.isPending}
                className="w-full text-xs h-8"
              >
                Simpan
              </Button>
            </div>
          </div>

          {actionError && (
            <div className="text-[11px] text-danger-text bg-danger-bg p-2 rounded border border-red-200">
              {actionError}
            </div>
          )}
        </div>

        {/* Kolom Tampilan Shift Pagi & Sore */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Shift Pagi */}
          <div className="border border-border rounded-lg p-3 space-y-2 bg-white">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <Clock className="w-3.5 h-3.5" />
                <span>Shift Pagi (09:00 – 13:00)</span>
              </div>
              <Badge variant="neutral" size="sm">{morningShifts.length} staf</Badge>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {isLoadingAssignments ? (
                <div className="text-xs text-muted py-2 text-center animate-pulse">Memuat jadwal...</div>
              ) : morningShifts.length === 0 ? (
                <div className="text-xs text-muted italic py-3 text-center">
                  Tidak ada penugasan khusus (staf mengikuti shift standar).
                </div>
              ) : (
                morningShifts.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <div>
                        <div className="font-semibold text-foreground">{s.employee?.name}</div>
                        <div className="text-[10px] text-muted">{s.employee?.position}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={s.source === 'SWAP' ? 'info' : 'neutral'} size="sm">
                        {s.source}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(s.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                        title="Hapus penugasan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Shift Sore */}
          <div className="border border-border rounded-lg p-3 space-y-2 bg-white">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                <Clock className="w-3.5 h-3.5" />
                <span>Shift Sore (16:00 – 21:00)</span>
              </div>
              <Badge variant="neutral" size="sm">{eveningShifts.length} staf</Badge>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {isLoadingAssignments ? (
                <div className="text-xs text-muted py-2 text-center animate-pulse">Memuat jadwal...</div>
              ) : eveningShifts.length === 0 ? (
                <div className="text-xs text-muted italic py-3 text-center">
                  Tidak ada penugasan khusus (staf mengikuti shift standar).
                </div>
              ) : (
                eveningShifts.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <div>
                        <div className="font-semibold text-foreground">{s.employee?.name}</div>
                        <div className="text-[10px] text-muted">{s.employee?.position}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={s.source === 'SWAP' ? 'info' : 'neutral'} size="sm">
                        {s.source}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(s.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                        title="Hapus penugasan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
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
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogClose, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, PlusCircle } from 'lucide-react';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeaveRequestModal({ isOpen, onClose }: LeaveRequestModalProps) {
  const queryClient = useQueryClient();

  // Hari ini waktu WIB
  const todayWib = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [type, setType] = useState<'CUTI' | 'IZIN' | 'SAKIT'>('CUTI');
  const [startDate, setStartDate] = useState<string>(todayWib);
  const [endDate, setEndDate] = useState<string>(todayWib);
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      return fetchApi('/leave-requests', {
        method: 'POST',
        body: JSON.stringify({
          type,
          startDate,
          endDate,
          reason,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests', 'team'] });
      handleClose();
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || 'Gagal mengajukan cuti/izin');
    },
  });

  const handleClose = () => {
    setType('CUTI');
    setStartDate(todayWib);
    setEndDate(todayWib);
    setReason('');
    setErrorMsg(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (reason.trim().length < 10) {
      setErrorMsg('Alasan cuti/izin minimal 10 karakter');
      return;
    }

    if (endDate < startDate) {
      setErrorMsg('Tanggal selesai tidak boleh sebelum tanggal mulai');
      return;
    }

    createMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <div className="p-6 max-w-lg w-full bg-white rounded-xl shadow-xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-teal-50 text-primary flex items-center justify-center">
                <PlusCircle className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-800">
                  Ajukan Cuti / Izin / Sakit
                </DialogTitle>
                <p className="text-xs text-muted">
                  Isi formulir pengajuan dengan lengkap
                </p>
              </div>
            </div>
            <DialogClose onClose={handleClose} />
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipe Cuti/Izin */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipe Pengajuan <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['CUTI', 'IZIN', 'SAKIT'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                    type === t
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Rentang Tanggal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Mulai <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
              <span className="text-[10px] text-muted">
                Backdate maksimal 1 hari (kemarin)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Selesai <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="text-xs"
              />
            </div>
          </div>

          {/* Alasan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alasan Pengajuan <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan keperluan cuti atau izin (minimal 10 karakter)..."
              rows={3}
              required
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
            <div className="flex justify-between items-center text-[10px] text-muted mt-1">
              <span>Minimal 10 karakter</span>
              <span>{reason.length}/500</span>
            </div>
          </div>

          {/* Aksi */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={createMutation.isPending}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={createMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              Kirim Pengajuan
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

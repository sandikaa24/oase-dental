'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogClose, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileEdit } from 'lucide-react';
import type { AttendanceRecord } from './attendance-widget';

interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
}

export function AttendanceCorrectionModal({
  isOpen,
  onClose,
  record,
}: AttendanceCorrectionModalProps) {
  const queryClient = useQueryClient();

  // Helper konversi Date ke format input 'YYYY-MM-DDTHH:mm' (Asia/Jakarta)
  const toLocalInputValue = (isoString?: string | null) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';

    // Ambil format YYYY-MM-DDTHH:mm di Asia/Jakarta
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  };

  const [checkInVal, setCheckInVal] = useState<string>('');
  const [checkOutVal, setCheckOutVal] = useState<string>('');
  const [noteVal, setNoteVal] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setCheckInVal(toLocalInputValue(record.checkIn));
      setCheckOutVal(toLocalInputValue(record.checkOut));
      setNoteVal(record.correctionNote || '');
      setErrorMsg(null);
    }
  }, [record]);

  const mutation = useMutation({
    mutationFn: (payload: { checkIn?: string | null; checkOut?: string | null; note: string }) =>
      fetchApi<AttendanceRecord>(`/api/v1/attendance/${record?.id}/correct`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'me'] });
      onClose();
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || 'Gagal menyimpan koreksi absensi');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // BINDING PENAJAMAN 2: PERSIS skema backend attendanceCorrectSchema
    const trimmedNote = noteVal.trim();
    if (!trimmedNote) {
      setErrorMsg('Catatan koreksi wajib diisi');
      return;
    }

    // Konversi string datetime input ke ISO String
    let isoCheckIn: string | null = null;
    let isoCheckOut: string | null = null;

    if (checkInVal) {
      const dIn = new Date(checkInVal);
      if (isNaN(dIn.getTime())) {
        setErrorMsg('Format jam masuk tidak valid');
        return;
      }
      isoCheckIn = dIn.toISOString();
    }

    if (checkOutVal) {
      const dOut = new Date(checkOutVal);
      if (isNaN(dOut.getTime())) {
        setErrorMsg('Format jam keluar tidak valid');
        return;
      }
      isoCheckOut = dOut.toISOString();
    }

    // Validasi refine: checkOut >= checkIn
    if (isoCheckIn && isoCheckOut) {
      if (new Date(isoCheckOut) < new Date(isoCheckIn)) {
        setErrorMsg('Waktu check-out tidak boleh mendahului check-in');
        return;
      }
    }

    mutation.mutate({
      checkIn: isoCheckIn,
      checkOut: isoCheckOut,
      note: trimmedNote,
    });
  };

  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogClose onClose={onClose} />
      <DialogHeader>
        <DialogTitle>Koreksi Presensi Karyawan</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        {/* Info Singkat Karyawan & Tanggal */}
        <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-sm">
              {record.employee?.name || 'Karyawan'}
            </span>
            <Badge variant="neutral">{record.employee?.position || '-'}</Badge>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Cabang: {record.branch?.name || record.branch?.code || '-'}</span>
            <span>•</span>
            <span>
              Tanggal:{' '}
              {formatDate(record.workDate, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'Asia/Jakarta',
              })}
            </span>
          </div>
        </div>

        {/* Form Jam Masuk & Keluar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Waktu Check-In
            </label>
            <Input
              type="datetime-local"
              value={checkInVal}
              onChange={(e) => setCheckInVal(e.target.value)}
              className="text-xs h-9"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Status Hadir/Terlambat akan dihitung ulang otomatis dari jam masuk cabang.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Waktu Check-Out
            </label>
            <Input
              type="datetime-local"
              value={checkOutVal}
              onChange={(e) => setCheckOutVal(e.target.value)}
              className="text-xs h-9"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Kosongkan jika karyawan belum menyelesaikan shift.
            </p>
          </div>
        </div>

        {/* Alasan Koreksi (Wajib per API-CONTRACT & PRD) */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Alasan / Catatan Koreksi <span className="text-danger-text">*</span>
          </label>
          <textarea
            rows={3}
            value={noteVal}
            onChange={(e) => setNoteVal(e.target.value)}
            placeholder="Contoh: Lupa check-in karena langsung menangani pasien darurat, dikonfirmasi BM."
            className="w-full text-xs p-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Wajib diisi. Catatan ini akan dicatat permanen dalam Audit Log sistem (ATTENDANCE_CORRECTED).
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-danger-bg text-danger-text border border-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-danger-icon" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
            className="h-9 text-xs"
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending}
            className="h-9 text-xs gap-1.5"
          >
            <FileEdit className="w-3.5 h-3.5" />
            {mutation.isPending ? 'Menyimpan...' : 'Simpan Koreksi'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

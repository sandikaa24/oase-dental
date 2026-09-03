'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
import { Branch } from './branch-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Clock, X, Check } from 'lucide-react';

interface WorkingHoursModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
  branch: Branch | null;
}

export function WorkingHoursModal({
  open,
  onOpenChange,
  onSuccess,
  branch,
}: WorkingHoursModalProps) {
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('21:00');
  const [lateAfter, setLateAfter] = useState('08:15');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && branch) {
      setError(null);
      if (branch.workingHours) {
        setOpenTime(branch.workingHours.openTime);
        setCloseTime(branch.workingHours.closeTime);
        setLateAfter(branch.workingHours.lateAfter);
      } else {
        setOpenTime('08:00');
        setCloseTime('21:00');
        setLateAfter('08:15');
      }
    }
  }, [open, branch]);

  if (!open || !branch) return null;

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!timeRegex.test(openTime)) {
      setError('Format Jam Buka harus HH:MM (contoh: 08:00).');
      return;
    }
    if (!timeRegex.test(closeTime)) {
      setError('Format Jam Tutup harus HH:MM (contoh: 21:00).');
      return;
    }
    if (!timeRegex.test(lateAfter)) {
      setError('Format Batas Terlambat harus HH:MM (contoh: 08:15).');
      return;
    }

    if (closeTime <= openTime) {
      setError('Waktu tutup harus lebih besar dari waktu buka.');
      return;
    }

    setIsSubmitting(true);
    try {
      await fetchApi(`/api/v1/branches/${branch.id}/working-hours`, {
        method: 'PATCH',
        body: JSON.stringify({
          openTime,
          closeTime,
          lateAfter,
        }),
      });
      onSuccess(`Jam operasional untuk cabang "${branch.name}" berhasil disimpan`);
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat menyimpan jam operasional.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Jam Operasional &amp; Shift
              </h3>
              <p className="text-[11px] text-muted">Cabang: {branch.name} ({branch.code})</p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBanner title="Gagal Menyimpan" message={error} />}

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-1">
            <p className="font-semibold text-slate-800">Catatan Absensi Karyawan:</p>
            <p>
              Staf yang melakukan presensi masuk setelah waktu <strong>Batas Terlambat</strong> akan otomatis tercatat berstatus <span className="font-semibold text-amber-700">LATE (Terlambat)</span> pada modul absensi.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Jam Buka Klinik *</label>
              <Input
                type="time"
                required
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="text-xs font-mono font-semibold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Jam Tutup Klinik *</label>
              <Input
                type="time"
                required
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="text-xs font-mono font-semibold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Batas Toleransi Terlambat *</label>
            <Input
              type="time"
              required
              value={lateAfter}
              onChange={(e) => setLateAfter(e.target.value)}
              className="text-xs font-mono font-semibold"
            />
            <p className="text-[11px] text-muted">Contoh: 08:15 (Toleransi 15 menit dari jam buka 08:00)</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              className="gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Simpan Jam Kerja</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

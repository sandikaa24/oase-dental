'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
import { Branch } from './branch-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Clock, X, Check, Sun, Moon, CalendarDays, ShieldCheck } from 'lucide-react';

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
  // Shift Pagi (default: 09:00 - 13:00, lateAfter 09:15)
  const [morningOpen, setMorningOpen] = useState('09:00');
  const [morningClose, setMorningClose] = useState('13:00');
  const [morningLateAfter, setMorningLateAfter] = useState('09:15');

  // Shift Sore (default: 16:00 - 21:00, lateAfter 16:15)
  const [eveningOpen, setEveningOpen] = useState('16:00');
  const [eveningClose, setEveningClose] = useState('21:00');
  const [eveningLateAfter, setEveningLateAfter] = useState('16:15');

  // Aturan Hari
  const [saturdayEveningClosed, setSaturdayEveningClosed] = useState(true);
  const [sundayClosed, setSundayClosed] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && branch) {
      setError(null);
      if (branch.workingHours) {
        const wh = branch.workingHours;
        setMorningOpen(wh.morningOpen || wh.openTime || '09:00');
        setMorningClose(wh.morningClose || '13:00');
        setMorningLateAfter(wh.morningLateAfter || wh.lateAfter || '09:15');

        setEveningOpen(wh.eveningOpen || '16:00');
        setEveningClose(wh.eveningClose || wh.closeTime || '21:00');
        setEveningLateAfter(wh.eveningLateAfter || '16:15');

        setSaturdayEveningClosed(wh.saturdayEveningClosed ?? true);
        setSundayClosed(wh.sundayClosed ?? true);
      } else {
        setMorningOpen('09:00');
        setMorningClose('13:00');
        setMorningLateAfter('09:15');
        setEveningOpen('16:00');
        setEveningClose('21:00');
        setEveningLateAfter('16:15');
        setSaturdayEveningClosed(true);
        setSundayClosed(true);
      }
    }
  }, [open, branch]);

  if (!open || !branch) return null;

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Format regex validation
    if (!timeRegex.test(morningOpen) || !timeRegex.test(morningClose) || !timeRegex.test(morningLateAfter)) {
      setError('Format waktu Shift Pagi harus HH:MM (contoh 09:00).');
      return;
    }
    if (!timeRegex.test(eveningOpen) || !timeRegex.test(eveningClose) || !timeRegex.test(eveningLateAfter)) {
      setError('Format waktu Shift Sore harus HH:MM (contoh 16:00).');
      return;
    }

    // Logical validations
    if (morningClose <= morningOpen) {
      setError('Waktu selesai shift pagi harus lebih besar dari jam buka pagi.');
      return;
    }
    if (morningLateAfter < morningOpen || morningLateAfter > morningClose) {
      setError('Batas terlambat shift pagi harus berada dalam window shift pagi.');
      return;
    }
    if (eveningOpen < morningClose) {
      setError('Shift sore harus dimulai setelah shift pagi selesai.');
      return;
    }
    if (eveningClose <= eveningOpen) {
      setError('Waktu selesai shift sore harus lebih besar dari jam buka sore.');
      return;
    }
    if (eveningLateAfter < eveningOpen || eveningLateAfter > eveningClose) {
      setError('Batas terlambat shift sore harus berada dalam window shift sore.');
      return;
    }

    setIsSubmitting(true);
    try {
      await fetchApi(`/api/v1/branches/${branch.id}/working-hours`, {
        method: 'PATCH',
        body: JSON.stringify({
          morningOpen,
          morningClose,
          morningLateAfter,
          eveningOpen,
          eveningClose,
          eveningLateAfter,
          saturdayEveningClosed,
          sundayClosed,
          // Auto-sync turunan untuk kompatibilitas
          openTime: morningOpen,
          closeTime: eveningClose,
          lateAfter: morningLateAfter,
        }),
      });
      onSuccess(`Pengaturan shift & jam operasional cabang "${branch.name}" berhasil disimpan`);
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
      <div className="w-full max-w-lg bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Pengaturan Multi-Shift Cabang
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

          <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-blue-950">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span>Sumber Kebenaran Shift Cabang</span>
            </div>
            <p>
              Jam shift yang Anda simpan di sini menjadi acuan resmi kehadiran (LATE/PRESENT),
              cutoff auto-checkout (+30 menit), dan jadwal harian seluruh staf pada cabang ini.
            </p>
          </div>

          {/* Shift Pagi */}
          <div className="p-3.5 rounded-lg border border-border bg-slate-50/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <Sun className="h-4 w-4 text-amber-500" />
              <span>Shift Pagi (Senin – Sabtu)</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Mulai (Buka)</label>
                <Input
                  type="time"
                  required
                  value={morningOpen}
                  onChange={(e) => setMorningOpen(e.target.value)}
                  className="text-xs font-mono font-semibold h-8"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Selesai (Tutup)</label>
                <Input
                  type="time"
                  required
                  value={morningClose}
                  onChange={(e) => setMorningClose(e.target.value)}
                  className="text-xs font-mono font-semibold h-8"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Batas Terlambat</label>
                <Input
                  type="time"
                  required
                  value={morningLateAfter}
                  onChange={(e) => setMorningLateAfter(e.target.value)}
                  className="text-xs font-mono font-semibold h-8"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted italic">
              * Absen masuk shift pagi setelah {morningLateAfter} WIB otomatis berstatus LATE.
            </p>
          </div>

          {/* Shift Sore */}
          <div className="p-3.5 rounded-lg border border-border bg-indigo-50/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
              <Moon className="h-4 w-4 text-indigo-500" />
              <span>Shift Sore (Senin – Jumat)</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Mulai (Buka)</label>
                <Input
                  type="time"
                  required
                  value={eveningOpen}
                  onChange={(e) => setEveningOpen(e.target.value)}
                  className="text-xs font-mono font-semibold h-8"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Selesai (Tutup)</label>
                <Input
                  type="time"
                  required
                  value={eveningClose}
                  onChange={(e) => setEveningClose(e.target.value)}
                  className="text-xs font-mono font-semibold h-8"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Batas Terlambat</label>
                <Input
                  type="time"
                  required
                  value={eveningLateAfter}
                  onChange={(e) => setEveningLateAfter(e.target.value)}
                  className="text-xs font-mono font-semibold h-8"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted italic">
              * Absen masuk shift sore setelah {eveningLateAfter} WIB otomatis berstatus LATE.
            </p>
          </div>

          {/* Aturan Hari & Libur */}
          <div className="p-3.5 rounded-lg border border-border bg-white space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <CalendarDays className="h-4 w-4 text-slate-600" />
              <span>Aturan Hari Khusus</span>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saturdayEveningClosed}
                onChange={(e) => setSaturdayEveningClosed(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span>Sabtu hanya shift pagi (Shift sore tutup)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sundayClosed}
                onChange={(e) => setSundayClosed(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span>Minggu tutup total (Klinik libur)</span>
            </label>
          </div>

          {/* Card Turunan Publik */}
          <div className="px-3 py-2 rounded-md bg-slate-100 text-[11px] text-slate-600 flex items-center justify-between font-mono">
            <span>Rentang Operasional Turunan:</span>
            <span className="font-semibold text-foreground">{morningOpen} – {eveningClose} WIB</span>
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
              <span>Simpan Pengaturan Shift</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

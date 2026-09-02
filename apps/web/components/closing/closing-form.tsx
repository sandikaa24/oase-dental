'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ErrorBanner } from '@/components/ui/placeholder';
import { VarianceBadge } from './closing-status-badge';
import { formatRupiah } from '@/lib/formatters';
import { formatThousand, sanitizeDigits, decimalToCents, centsToDecimal } from '@/lib/format/currency';
import { Calculator, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface ClosingFormProps {
  expectedCash: string; // string Decimal dari server
  onSubmit: (actualCash: string, note: string | null) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Form tutup kas:
 * - Input actualCash (kas fisik dihitung) dengan prefix "Rp" statis & format ribuan live
 * - Selisih estimasi real-time (DISPLAY ONLY — kebenaran dari server saat submit)
 * - Textarea catatan opsional
 * - Dialog konfirmasi sebelum submit (aksi irreversible)
 * §24: Dilarang parseFloat untuk Decimal; gunakan string arithmetic untuk estimasi tampilan.
 * §23: Error inline, bukan alert().
 */
export function ClosingForm({
  expectedCash,
  onSubmit,
  isSubmitting,
  submitError,
}: ClosingFormProps) {
  const [actualCashInput, setActualCashInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [inputError, setInputError] = useState('');

  // Hitung selisih estimasi dari string input (DISPLAY-ONLY — hanya untuk informasi kasir)
  const estimatedVariance = computeVarianceDisplay(actualCashInput, expectedCash);

  function handleActualCashChange(e: React.ChangeEvent<HTMLInputElement>) {
    setActualCashInput(sanitizeDigits(e.target.value));
    if (inputError) setInputError('');
  }

  function handleOpenConfirm() {
    // Validasi input sebelum buka dialog
    const trimmed = actualCashInput.trim();
    if (!trimmed) {
      setInputError('Kas fisik wajib diisi');
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      setInputError('Masukkan angka positif (contoh: 1500000)');
      return;
    }
    setInputError('');
    setConfirmOpen(true);
  }

  async function handleConfirmSubmit() {
    setConfirmOpen(false);
    await onSubmit(actualCashInput.trim(), noteInput.trim() || null);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-warning-bg text-warning-icon">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Hitung Kas Fisik</CardTitle>
              <CardDescription>Input jumlah kas yang ada di laci</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error banner §23 — inline, bukan alert() */}
          {submitError && (
            <ErrorBanner
              title="Gagal Tutup Kas"
              message={submitError}
            />
          )}

          {/* Input kas fisik */}
          <div>
            <Input
              id="actual-cash-input"
              label="Kas Fisik"
              prefix="Rp"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={formatThousand(actualCashInput)}
              onChange={handleActualCashChange}
              error={inputError}
            />
          </div>

          {/* Catatan opsional */}
          <div className="space-y-1">
            <label htmlFor="closing-note" className="text-sm font-medium text-foreground">
              Catatan <span className="text-muted font-normal">(opsional)</span>
            </label>
            <textarea
              id="closing-note"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Catatan tambahan jika ada selisih atau keterangan lain..."
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
            />
            <p className="text-xs text-muted text-right">{noteInput.length}/500</p>
          </div>

          {/* Tampilan selisih estimasi — DISPLAY ONLY */}
          {actualCashInput && !inputError && (
            <div className="rounded-lg border border-border bg-background p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                Estimasi Selisih (tampilan — kebenaran dari server)
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 text-xs text-muted">
                  <p>Ekspektasi server: <span className="font-medium text-foreground">{formatRupiah(expectedCash)}</span></p>
                  <p>Kas fisik Anda: <span className="font-medium text-foreground">{formatRupiah(actualCashInput)}</span></p>
                </div>
                {estimatedVariance && <VarianceBadge variance={estimatedVariance} />}
              </div>
            </div>
          )}

          {/* Tombol submit */}
          <Button
            id="submit-closing-btn"
            variant="primary"
            className="w-full gap-2"
            onClick={handleOpenConfirm}
            disabled={isSubmitting || !actualCashInput}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Tutup Kas Sekarang
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Dialog konfirmasi — aksi irreversible */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogHeader>
          <DialogClose onClose={() => setConfirmOpen(false)} />
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-warning-bg text-warning-icon">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Konfirmasi Tutup Kas</DialogTitle>
          </div>
          <DialogDescription>
            Tindakan ini <strong className="text-danger-text">tidak dapat dibatalkan</strong>.
            Setelah kas ditutup, hanya OWNER yang bisa membuka kembali dengan alasan.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Ekspektasi server:</span>
            <span className="font-semibold text-foreground">{formatRupiah(expectedCash)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Kas fisik Anda:</span>
            <span className="font-semibold text-foreground">{formatRupiah(actualCashInput)}</span>
          </div>
          {estimatedVariance && (
            <div className="flex justify-between items-center">
              <span className="text-muted">Estimasi selisih:</span>
              <VarianceBadge variance={estimatedVariance} />
            </div>
          )}
          <p className="text-xs text-muted pt-2 border-t border-border">
            Selisih final akan dihitung oleh server saat submit.
          </p>
        </div>

        <DialogFooter>
          <Button
            id="cancel-confirm-closing-btn"
            variant="secondary"
            onClick={() => setConfirmOpen(false)}
          >
            Batal
          </Button>
          <Button
            id="confirm-closing-btn"
            variant="primary"
            onClick={handleConfirmSubmit}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Ya, Tutup Kas
              </>
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

/**
 * Hitung estimasi variance dari string input dan string expectedCash.
 * DILARANG parseFloat — gunakan string arithmetic via Intl-safe integer math.
 * Mengembalikan string Decimal atau null jika input tidak valid.
 */
function computeVarianceDisplay(actualStr: string, expectedStr: string): string | null {
  const trimmed = actualStr.trim();
  if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;

  const actualCents = decimalToCents(trimmed);
  const expectedCents = decimalToCents(expectedStr);
  const varianceCents = actualCents - expectedCents;

  return centsToDecimal(varianceCents);
}

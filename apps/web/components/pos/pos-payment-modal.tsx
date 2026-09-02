'use client';

import React, { useState, useEffect } from 'react';
import { type PosPayment } from './pos-types';
import { formatRupiah } from '@/lib/formatters';
import { formatThousand, sanitizeDigits, decimalToCents, centsToDecimal } from '@/lib/format/currency';
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
import {
  Banknote,
  CreditCard,
  QrCode,
  AlertCircle,
  CheckCircle2,
  Split,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PosPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: string;
  onProcessPayment: (payments: PosPayment[]) => Promise<void>;
  isProcessing: boolean;
  error: string | null;
}

export function PosPaymentModal({
  open,
  onOpenChange,
  totalAmount,
  onProcessPayment,
  isProcessing,
  error,
}: PosPaymentModalProps) {
  const totalCents = decimalToCents(totalAmount);

  const [paymentMode, setPaymentMode] = useState<'SINGLE' | 'SPLIT'>('SINGLE');
  const [singleMethod, setSingleMethod] = useState<'CASH' | 'DEBIT' | 'QRIS_TRANSFER'>('CASH');
  const [cashGiven, setCashGiven] = useState<string>('');

  // Split payment list (mulai kosong secara default)
  const [splitPayments, setSplitPayments] = useState<Array<{ method: 'CASH' | 'DEBIT' | 'QRIS_TRANSFER'; amount: string }>>([
    { method: 'CASH', amount: '' },
  ]);

  // Reset values when modal opens
  useEffect(() => {
    if (open) {
      setCashGiven('');
      setSplitPayments([{ method: 'CASH', amount: '' }]);
    }
  }, [open]);

  // Calculations (cents integer arithmetic)
  const cashGivenCents = decimalToCents(cashGiven);
  const isCashEmptyOrZero = !cashGiven.trim() || cashGivenCents === 0;
  const isCashUnderpaid = singleMethod === 'CASH' && (isCashEmptyOrZero || cashGivenCents < totalCents);
  const changeCents = singleMethod === 'CASH' && cashGivenCents >= totalCents ? cashGivenCents - totalCents : 0;

  const totalSplitPaidCents = splitPayments.reduce((acc, p) => acc + decimalToCents(p.amount), 0);
  const isSplitUnderpaid = totalSplitPaidCents < totalCents;
  const splitRemainingCents = Math.max(0, totalCents - totalSplitPaidCents);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (paymentMode === 'SINGLE') {
      if (singleMethod === 'CASH' && isCashUnderpaid) return;

      const payments: PosPayment[] = [
        {
          method: singleMethod,
          // Server checks sum(payments) >= total. For CASH, we pass the actual cash given
          amount: singleMethod === 'CASH' ? (cashGiven.trim() || '0') : totalAmount,
        },
      ];
      await onProcessPayment(payments);
    } else {
      if (isSplitUnderpaid) return;
      const validPayments = splitPayments
        .filter((p) => decimalToCents(p.amount) > 0)
        .map((p) => ({
          method: p.method,
          amount: p.amount.trim() || '0',
        }));
      await onProcessPayment(validPayments);
    }
  };

  // Quick cash amounts
  const totalWhole = Math.ceil(totalCents / 100);
  const quickCashAmounts = [
    { label: 'Uang Pas', value: String(totalWhole) },
    { label: 'Rp 50.000', value: '50000' },
    { label: 'Rp 100.000', value: '100000' },
    { label: 'Rp 200.000', value: '200000' },
    { label: 'Rp 500.000', value: '500000' },
  ].filter((qc) => decimalToCents(qc.value) >= totalCents || qc.label === 'Uang Pas');

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogClose onClose={() => onOpenChange(false)} />

      <DialogHeader>
        <DialogTitle>Pembayaran Transaksi</DialogTitle>
        <DialogDescription>
          Pilih metode pembayaran dan masukkan nominal yang diterima
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 pt-3">
        {/* Total Bill Callout */}
        <div className="p-3.5 rounded-lg bg-teal-50/70 border border-teal-200/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-teal-800">Total Tagihan</span>
            <div className="text-xl font-black text-primary">
              {formatRupiah(totalAmount)}
            </div>
          </div>

          <div className="flex items-center gap-1 p-0.5 rounded-md bg-white border border-teal-200 text-xs">
            <button
              type="button"
              onClick={() => setPaymentMode('SINGLE')}
              className={cn(
                'px-2 py-1 rounded transition-colors text-[11px] font-medium',
                paymentMode === 'SINGLE'
                  ? 'bg-primary text-white font-semibold'
                  : 'text-slate-600 hover:text-foreground'
              )}
            >
              Tunggal
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode('SPLIT')}
              className={cn(
                'px-2 py-1 rounded transition-colors text-[11px] font-medium flex items-center gap-1',
                paymentMode === 'SPLIT'
                  ? 'bg-primary text-white font-semibold'
                  : 'text-slate-600 hover:text-foreground'
              )}
            >
              <Split className="h-3 w-3" />
              <span>Split</span>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-2.5 rounded-md bg-danger-bg border border-danger-border text-danger-text text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Single Payment Mode */}
        {paymentMode === 'SINGLE' ? (
          <div className="space-y-3.5">
            {/* Method Tabs */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSingleMethod('CASH')}
                className={cn(
                  'flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all gap-1.5',
                  singleMethod === 'CASH'
                    ? 'border-primary bg-primary-soft text-primary font-bold shadow-xs'
                    : 'border-border bg-surface text-slate-600 hover:bg-slate-50'
                )}
              >
                <Banknote className="h-4 w-4" />
                <span>Tunai (Cash)</span>
              </button>

              <button
                type="button"
                onClick={() => setSingleMethod('QRIS_TRANSFER')}
                className={cn(
                  'flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all gap-1.5',
                  singleMethod === 'QRIS_TRANSFER'
                    ? 'border-primary bg-primary-soft text-primary font-bold shadow-xs'
                    : 'border-border bg-surface text-slate-600 hover:bg-slate-50'
                )}
              >
                <QrCode className="h-4 w-4" />
                <span>QRIS / Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setSingleMethod('DEBIT')}
                className={cn(
                  'flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all gap-1.5',
                  singleMethod === 'DEBIT'
                    ? 'border-primary bg-primary-soft text-primary font-bold shadow-xs'
                    : 'border-border bg-surface text-slate-600 hover:bg-slate-50'
                )}
              >
                <CreditCard className="h-4 w-4" />
                <span>Kartu Debit</span>
              </button>
            </div>

            {/* Cash Given & Quick Amount Buttons */}
            {singleMethod === 'CASH' && (
              <div className="space-y-2.5 p-3 rounded-lg bg-slate-50 border border-border">
                <div className="space-y-1">
                  <Input
                    id="cash-given-input"
                    label="Uang Tunai Diterima"
                    prefix="Rp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={formatThousand(cashGiven)}
                    onChange={(e) => setCashGiven(sanitizeDigits(e.target.value))}
                    className="text-sm font-bold h-9"
                  />
                </div>

                {/* Quick Cash Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {quickCashAmounts.map((qc) => (
                    <button
                      key={qc.label}
                      type="button"
                      onClick={() => setCashGiven(qc.value)}
                      className="px-2 py-1 text-[11px] font-medium rounded border border-slate-200 bg-white hover:bg-slate-100 transition-colors text-slate-700"
                    >
                      {qc.label}
                    </button>
                  ))}
                </div>

                {/* Change (Kembalian) Preview */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                  <span className="font-medium text-slate-600">Uang Kembalian:</span>
                  <span className="font-bold text-sm text-success-text">
                    {formatRupiah(centsToDecimal(changeCents))}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Split Payment Mode */
          <div className="space-y-3 p-3 rounded-lg bg-slate-50 border border-border">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Rincian Split Payment</span>
              <button
                type="button"
                onClick={() =>
                  setSplitPayments([...splitPayments, { method: 'QRIS_TRANSFER', amount: '' }])
                }
                className="text-primary hover:underline flex items-center gap-1 text-[11px]"
              >
                <Plus className="h-3 w-3" />
                <span>Tambah Metode</span>
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {splitPayments.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={p.method}
                    onChange={(e) => {
                      const updated = [...splitPayments];
                      updated[idx]!.method = e.target.value as 'CASH' | 'QRIS_TRANSFER' | 'DEBIT';
                      setSplitPayments(updated);
                    }}
                    className="h-8 px-2 py-1 text-xs rounded border border-border bg-surface text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  >
                    <option value="CASH">Tunai (CASH)</option>
                    <option value="QRIS_TRANSFER">QRIS / Transfer</option>
                    <option value="DEBIT">Debit</option>
                  </select>

                  <Input
                    prefix="Rp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={formatThousand(p.amount)}
                    onChange={(e) => {
                      const updated = [...splitPayments];
                      updated[idx]!.amount = sanitizeDigits(e.target.value);
                      setSplitPayments(updated);
                    }}
                    containerClassName="flex-1"
                    className="h-8 text-xs font-semibold pl-8 py-1"
                  />

                  {splitPayments.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSplitPayments(splitPayments.filter((_, i) => i !== idx))
                      }
                      className="p-1 text-slate-400 hover:text-danger-text"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-200 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Total Dibayar:</span>
                <span className="font-semibold">{formatRupiah(centsToDecimal(totalSplitPaidCents))}</span>
              </div>
              {splitRemainingCents > 0 && (
                <div className="flex justify-between text-danger-text font-semibold">
                  <span>Kekurangan:</span>
                  <span>{formatRupiah(centsToDecimal(splitRemainingCents))}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Batal
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={
              isProcessing ||
              (paymentMode === 'SINGLE' && singleMethod === 'CASH' && isCashUnderpaid) ||
              (paymentMode === 'SPLIT' && isSplitUnderpaid)
            }
            className="gap-2 font-semibold"
          >
            {isProcessing ? (
              <span>Memproses...</span>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Konfirmasi Pembayaran</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

'use client';

import React from 'react';
import { type PosTransaction } from './pos-types';
import { formatRupiah, formatDateTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Printer, CheckCircle, Plus } from 'lucide-react';

interface PosReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: PosTransaction | null;
  cashierName?: string | null;
  onNewTransaction: () => void;
}

export function PosReceiptModal({
  open,
  onOpenChange,
  transaction,
  cashierName,
  onNewTransaction,
}: PosReceiptModalProps) {
  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleNewTransactionClick = () => {
    onOpenChange(false);
    onNewTransaction();
  };

  // Calculate total paid across payments
  const totalPaid = transaction.payments?.reduce(
    (acc, p) => acc + (parseFloat(p.amount) || 0),
    0
  ) || parseFloat(transaction.total) || 0;

  const grandTotal = parseFloat(transaction.total) || 0;
  const changeAmount = Math.max(0, totalPaid - grandTotal);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogClose onClose={() => onOpenChange(false)} />

      <DialogHeader>
        <div className="flex items-center gap-2 text-success-text">
          <CheckCircle className="h-5 w-5 text-success-icon" />
          <DialogTitle>Transaksi Berhasil</DialogTitle>
        </div>
        <DialogDescription>
          Pembayaran telah diterima dan dicatat dalam sistem kasir
        </DialogDescription>
      </DialogHeader>

      {/* Printable Receipt Paper Container */}
      <div className="mt-4 p-5 rounded-lg border border-slate-200 bg-white font-mono text-xs text-slate-800 space-y-4 print:p-0 print:border-none">
        {/* Clinic Branding */}
        <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
          <h2 className="font-sans font-bold text-sm tracking-tight text-slate-900">
            OASE DENTAL CLINIC
          </h2>
          <p className="text-[11px] text-slate-600">
            {transaction.branch?.name || 'Klinik Gigi OASE'}
          </p>
        </div>

        {/* Transaction Meta */}
        <div className="space-y-1 text-[11px] text-slate-600 pb-3 border-b border-dashed border-slate-300">
          <div className="flex justify-between">
            <span>No. Transaksi:</span>
            <span className="font-bold text-slate-900">{transaction.transactionNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Waktu:</span>
            <span>{formatDateTime(transaction.paidAt || transaction.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Kasir:</span>
            <span>{cashierName || 'Kasir'}</span>
          </div>
          {transaction.patientName && (
            <div className="flex justify-between">
              <span>Pasien:</span>
              <span className="font-semibold text-slate-900">{transaction.patientName}</span>
            </div>
          )}
          {transaction.patientPhone && (
            <div className="flex justify-between">
              <span>No. HP:</span>
              <span>{transaction.patientPhone}</span>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <div className="space-y-2 pb-3 border-b border-dashed border-slate-300">
          {transaction.items?.map((item) => (
            <div key={item.id} className="space-y-0.5">
              <div className="font-medium text-slate-900">{item.name}</div>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>
                  {item.quantity} x {formatRupiah(item.price)}
                </span>
                <span className="font-semibold text-slate-900">
                  {formatRupiah(item.lineTotal)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Financial Summary */}
        <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatRupiah(transaction.subtotal)}</span>
          </div>

          {(parseFloat(transaction.discountAmount) || 0) > 0 && (
            <div className="flex justify-between text-danger-text">
              <span>Diskon {transaction.discountReason ? `(${transaction.discountReason})` : ''}</span>
              <span>-{formatRupiah(transaction.discountAmount)}</span>
            </div>
          )}

          <div className="flex justify-between text-xs font-bold text-slate-900 pt-1">
            <span>TOTAL</span>
            <span>{formatRupiah(transaction.total)}</span>
          </div>
        </div>

        {/* Payments Breakdown */}
        <div className="space-y-1 text-[11px]">
          {transaction.payments?.map((p, i) => (
            <div key={i} className="flex justify-between text-slate-600">
              <span>
                Bayar ({p.method === 'QRIS_TRANSFER' ? 'QRIS / Transfer' : p.method})
              </span>
              <span>{formatRupiah(p.amount)}</span>
            </div>
          ))}

          {changeAmount > 0 && (
            <div className="flex justify-between font-semibold text-slate-900 pt-1">
              <span>Kembalian</span>
              <span>{formatRupiah(String(changeAmount))}</span>
            </div>
          )}
        </div>

        {/* Receipt Footer */}
        <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-500">
          <p>Terima kasih atas kunjungan Anda</p>
          <p>Semoga lekas sembuh dan sehat selalu</p>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handlePrint}
          className="gap-1.5"
        >
          <Printer className="h-4 w-4" />
          <span>Cetak Struk</span>
        </Button>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleNewTransactionClick}
          className="gap-1.5 font-semibold"
        >
          <Plus className="h-4 w-4" />
          <span>Transaksi Baru</span>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

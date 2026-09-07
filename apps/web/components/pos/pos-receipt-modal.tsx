'use client';

import React, { useState } from 'react';
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
import { Printer, CheckCircle, Plus, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PosReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: PosTransaction | null;
  cashierName?: string | null;
  onNewTransaction: () => void;
  isReprint?: boolean;
}

export function PosReceiptModal({
  open,
  onOpenChange,
  transaction,
  cashierName,
  onNewTransaction,
  isReprint = false,
}: PosReceiptModalProps) {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleNewTransactionClick = () => {
    onOpenChange(false);
    onNewTransaction();
  };

  // Hitung total bayar lintas seluruh payment method
  const totalPaid =
    transaction.payments?.reduce(
      (acc, p) => acc + (parseFloat(p.amount) || 0),
      0
    ) ||
    parseFloat(transaction.paidTotal || transaction.total) ||
    0;

  const grandTotal = parseFloat(transaction.total) || 0;
  const changeAmount =
    parseFloat(transaction.change || '0') || Math.max(0, totalPaid - grandTotal);

  const effectiveCashier =
    transaction.cashierName || cashierName || 'Kasir OASE';

  const reprintTimestamp = new Date().toISOString();

  const handleCopyText = () => {
    const lines = [
      '================================',
      '       OASE DENTAL CLINIC',
      `      ${transaction.branch?.name || 'Klinik Gigi OASE'}`,
      transaction.branch?.address ? ` ${transaction.branch.address}` : '',
      transaction.branch?.phone ? ` Telp: ${transaction.branch.phone}` : '',
      '================================',
      isReprint ? ' *** SALINAN / CETAK ULANG ***' : '',
      isReprint ? ` Dicetak: ${formatDateTime(reprintTimestamp)}` : '',
      isReprint ? '--------------------------------' : '',
      `No. Trx : ${transaction.transactionNumber}`,
      `Waktu   : ${formatDateTime(transaction.paidAt || transaction.createdAt)}`,
      `Kasir   : ${effectiveCashier}`,
      transaction.patientName ? `Pasien  : ${transaction.patientName}` : '',
      transaction.patientPhone ? `No. HP  : ${transaction.patientPhone}` : '',
      '--------------------------------',
      'TINDAKAN / LAYANAN',
      '--------------------------------',
      ...(transaction.items?.map(
        (i) => `${i.name}\n  ${i.quantity} x ${formatRupiah(i.price)} = ${formatRupiah(i.lineTotal)}`
      ) || []),
      '--------------------------------',
      `Subtotal        : ${formatRupiah(transaction.subtotal)}`,
      `TOTAL TAGIHAN   : ${formatRupiah(transaction.total)}`,
      '--------------------------------',
      'PEMBAYARAN:',
      ...(transaction.payments?.map(
        (p) =>
          `  ${p.method === 'QRIS_TRANSFER' ? 'QRIS / Transfer' : p.method === 'DEBIT' ? 'Debit Card' : 'Tunai'} : ${formatRupiah(p.amount)}`
      ) || []),
      changeAmount > 0 ? `Kembalian       : ${formatRupiah(String(changeAmount))}` : '',
      '================================',
      ' Terima kasih atas kunjungan Anda',
      'Semoga lekas sembuh & sehat selalu',
      '================================',
    ]
      .filter((line) => line !== '')
      .join('\n');

    navigator.clipboard.writeText(lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-lg">
      <DialogClose onClose={() => onOpenChange(false)} />

      <DialogHeader>
        <div className="flex items-center justify-between gap-2 pr-6">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success-icon" />
            <DialogTitle>
              {isReprint ? 'Salinan Struk Transaksi' : 'Transaksi Berhasil'}
            </DialogTitle>
          </div>

          {/* Switcher Lebar Kertas Struk */}
          <div className="flex items-center p-0.5 rounded-md bg-slate-100 border border-border text-[11px]">
            <button
              type="button"
              onClick={() => setPaperWidth('58mm')}
              className={cn(
                'px-2 py-0.5 rounded font-medium transition-colors',
                paperWidth === '58mm'
                  ? 'bg-surface text-primary font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-foreground'
              )}
            >
              58mm
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth('80mm')}
              className={cn(
                'px-2 py-0.5 rounded font-medium transition-colors',
                paperWidth === '80mm'
                  ? 'bg-surface text-primary font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-foreground'
              )}
            >
              80mm
            </button>
          </div>
        </div>
        <DialogDescription>
          {isReprint
            ? 'Mencetak salinan struk transaksi yang telah tercatat'
            : 'Pembayaran telah diterima dan dicatat dalam sistem kasir'}
        </DialogDescription>
      </DialogHeader>

      {/* Preview Container — WYSIWYG Kertas Thermal */}
      <div className="mt-2 max-h-[60vh] overflow-y-auto py-2 px-1 bg-slate-50/70 rounded-md border border-slate-200">
        <div
          id="receipt-print-area"
          className={cn(
            'mx-auto bg-white p-4 font-mono text-xs text-slate-800 shadow-sm border border-slate-200 space-y-3 transition-all',
            paperWidth === '58mm' ? 'w-[290px]' : 'w-[370px]'
          )}
          style={{
            maxWidth: paperWidth === '58mm' ? '58mm' : '80mm',
          }}
        >
          {/* Header Watermark untuk Salinan / Cetak Ulang */}
          {isReprint && (
            <div className="text-center py-1 px-1 border-y border-dashed border-slate-400 bg-slate-50/80 mb-2">
              <div className="font-bold text-[10px] tracking-wider text-slate-900">
                *** SALINAN / CETAK ULANG ***
              </div>
              <div className="text-[9px] text-slate-500">
                Dicetak: {formatDateTime(reprintTimestamp)}
              </div>
            </div>
          )}

          {/* Clinic Branding */}
          <div className="text-center space-y-0.5 pb-2.5 border-b border-dashed border-slate-300">
            <h2 className="font-sans font-bold text-sm tracking-tight text-slate-900">
              OASE DENTAL CLINIC
            </h2>
            <p className="text-[11px] font-medium text-slate-700">
              {transaction.branch?.name || 'Klinik Gigi OASE'}
            </p>
            {transaction.branch?.address && (
              <p className="text-[10px] text-slate-500 leading-tight">
                {transaction.branch.address}
              </p>
            )}
            {transaction.branch?.phone && (
              <p className="text-[10px] text-slate-500">
                Telp: {transaction.branch.phone}
              </p>
            )}
          </div>

          {/* Transaction Meta */}
          <div className="space-y-1 text-[11px] text-slate-600 pb-2.5 border-b border-dashed border-slate-300">
            <div className="flex justify-between">
              <span>No. Trx:</span>
              <span className="font-bold text-slate-900">
                {transaction.transactionNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Waktu:</span>
              <span>
                {formatDateTime(transaction.paidAt || transaction.createdAt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Kasir:</span>
              <span className="text-slate-800">{effectiveCashier}</span>
            </div>

            {/* Nama Pasien: Hanya tampil jika ada, jika kosong TIDAK dirender */}
            {transaction.patientName && transaction.patientName.trim() && (
              <div className="flex justify-between">
                <span>Pasien:</span>
                <span className="font-semibold text-slate-900">
                  {transaction.patientName}
                </span>
              </div>
            )}

            {/* No HP Pasien: Hanya tampil jika ada */}
            {transaction.patientPhone && transaction.patientPhone.trim() && (
              <div className="flex justify-between">
                <span>No. HP:</span>
                <span>{transaction.patientPhone}</span>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="space-y-2 pb-2.5 border-b border-dashed border-slate-300">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Tindakan / Layanan
            </div>
            {transaction.items?.map((item) => (
              <div key={item.id} className="space-y-0.5">
                <div className="font-medium text-slate-900 leading-snug break-words">
                  {item.name}
                </div>
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

          {/* Financial Summary (Tanpa baris diskon) */}
          <div className="space-y-1 text-[11px] pb-2.5 border-b border-dashed border-slate-300">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatRupiah(transaction.subtotal)}</span>
            </div>

            <div className="flex justify-between text-xs font-bold text-slate-900 pt-1 border-t border-dashed border-slate-200">
              <span>TOTAL TAGIHAN</span>
              <span>{formatRupiah(transaction.total)}</span>
            </div>
          </div>

          {/* Payments Breakdown (Multi-Metode) */}
          <div className="space-y-1 text-[11px] pb-2.5 border-b border-dashed border-slate-300">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Pembayaran
            </div>
            {transaction.payments && transaction.payments.length > 0 ? (
              transaction.payments.map((p, i) => (
                <div key={p.id || i} className="flex justify-between text-slate-600">
                  <span>
                    {p.method === 'QRIS_TRANSFER'
                      ? 'QRIS / Transfer'
                      : p.method === 'DEBIT'
                      ? 'Debit Card'
                      : 'Tunai'}
                  </span>
                  <span>{formatRupiah(p.amount)}</span>
                </div>
              ))
            ) : (
              <div className="flex justify-between text-slate-600">
                <span>Tunai</span>
                <span>{formatRupiah(transaction.total)}</span>
              </div>
            )}

            {changeAmount > 0 && (
              <div className="flex justify-between font-semibold text-slate-900 pt-1 border-t border-dashed border-slate-200">
                <span>Kembalian</span>
                <span>{formatRupiah(String(changeAmount))}</span>
              </div>
            )}
          </div>

          {/* Receipt Footer */}
          <div className="text-center pt-1 text-[10px] text-slate-500 space-y-0.5">
            <p>Terima kasih atas kunjungan Anda</p>
            <p>Semoga lekas sembuh dan sehat selalu</p>
          </div>
        </div>
      </div>

      <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyText}
          className="w-full sm:w-auto text-xs gap-1.5"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success-icon" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
        </Button>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 font-semibold"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak Struk</span>
          </Button>

          {isReprint ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleNewTransactionClick}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Transaksi Baru</span>
            </Button>
          )}
        </div>
      </DialogFooter>
    </Dialog>
  );
}

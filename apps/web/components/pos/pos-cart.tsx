'use client';

import React from 'react';
import { type PosCartItem } from './pos-types';
import { formatRupiah } from '@/lib/formatters';
import { decimalToCents, centsToDecimal } from '@/lib/format/currency';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import {
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  User,
  CreditCard,
  FileText,
  RotateCcw,
  PenLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExtendedCartItem extends PosCartItem {
  originalPrice?: string;
}

interface PosCartProps {
  items: ExtendedCartItem[];
  patientName: string;
  patientPhone: string;
  onUpdatePatientName: (name: string) => void;
  onUpdatePatientPhone: (phone: string) => void;
  onUpdateQuantity: (itemId: string, newQty: number) => void;
  onUpdatePrice?: (itemId: string, newPrice: string) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onSaveDraft: () => void;
  onOpenPayment: () => void;
  isSavingDraft: boolean;
  activeDraftId: string | null;
}

export function PosCart({
  items,
  patientName,
  patientPhone,
  onUpdatePatientName,
  onUpdatePatientPhone,
  onUpdateQuantity,
  onUpdatePrice,
  onRemoveItem,
  onClearCart,
  onSaveDraft,
  onOpenPayment,
  isSavingDraft,
  activeDraftId,
}: PosCartProps) {
  // Hitung subtotal & total tampilan di client menggunakan integer cents (total = subtotal, tanpa diskon)
  const subtotalCents = items.reduce((acc, item) => {
    return acc + decimalToCents(item.price || '0') * item.quantity;
  }, 0);

  const totalCents = subtotalCents;

  return (
    <Card className="flex flex-col h-full border border-border shadow-xs">
      <CardHeader className="py-3 px-4 border-b border-border bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Keranjang Transaksi
            </CardTitle>
            {items.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary-soft text-primary text-[11px] font-semibold">
                {items.reduce((acc, i) => acc + i.quantity, 0)}
              </span>
            )}
          </div>

          {activeDraftId && (
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium">
              Mode DRAFT
            </span>
          )}

          {items.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="text-[11px] text-muted hover:text-danger-text flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-380px)]">
        {/* Customer / Patient Information (Optional) */}
        <div className="p-2.5 rounded-md bg-slate-50 border border-border space-y-2">
          <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted" />
            <span>Data Pasien (Opsional)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Nama Pasien"
              value={patientName}
              onChange={(e) => onUpdatePatientName(e.target.value)}
              className="w-full h-8 px-2.5 py-1 text-xs rounded border border-border bg-surface text-foreground placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
            <input
              type="tel"
              placeholder="No. WhatsApp / HP"
              value={patientPhone}
              onChange={(e) => onUpdatePatientPhone(e.target.value)}
              className="w-full h-8 px-2.5 py-1 text-xs rounded border border-border bg-surface text-foreground placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Cart Items List */}
        {items.length === 0 ? (
          <div className="py-12 text-center text-muted space-y-2">
            <ShoppingCart className="h-10 w-10 mx-auto text-slate-300 stroke-1" />
            <p className="text-xs">Keranjang transaksi masih kosong</p>
            <p className="text-[11px] text-slate-400">
              Pilih tindakan atau layanan medis pada katalog di samping
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => {
              const itemTotalCents = decimalToCents(item.price || '0') * item.quantity;
              const isOverridden =
                Boolean(item.originalPrice) &&
                parseFloat(item.price || '0') !== parseFloat(item.originalPrice || '0');

              return (
                <div
                  key={item.id}
                  className={cn(
                    "p-3 rounded-lg border bg-surface transition-colors space-y-2",
                    isOverridden ? "border-amber-200 bg-amber-50/20" : "border-border hover:border-slate-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {item.name}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className={cn(
                          "flex items-center h-6 rounded border bg-white px-1.5 focus-within:ring-1 focus-within:ring-primary transition-colors",
                          isOverridden
                            ? "border-amber-300 focus-within:border-amber-500"
                            : "border-slate-200 focus-within:border-primary"
                        )}>
                          <span className="text-[10px] font-medium text-slate-400 mr-1 select-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item.price}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              onUpdatePrice?.(item.itemId, raw);
                            }}
                            className={cn(
                              "w-20 text-[11px] bg-transparent text-foreground focus:outline-hidden",
                              isOverridden ? "font-bold text-amber-900" : "font-semibold"
                            )}
                            title="Harga satuan (dapat disesuaikan)"
                            aria-label={`Harga satuan ${item.name}`}
                          />
                        </div>

                        {isOverridden ? (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-800 border border-amber-200 text-[10px] font-medium select-none"
                            title={`Harga master: ${formatRupiah(item.originalPrice || '')}`}
                          >
                            <PenLine className="h-2.5 w-2.5 text-amber-600" />
                            <span>Disesuaikan</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] text-muted hover:text-slate-600 select-none cursor-default"
                            title="Harga satuan dapat disesuaikan kasir"
                          >
                            <PenLine className="h-2.5 w-2.5 text-slate-400" />
                            <span>Bisa disesuaikan</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.itemId)}
                      className="p-1 text-slate-400 hover:text-danger-text transition-colors rounded hover:bg-slate-100"
                      aria-label={`Hapus ${item.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Quantity controls & Line total */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-center border border-border rounded-md bg-slate-50">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.itemId, item.quantity - 1)}
                        className="p-1 text-slate-600 hover:text-foreground hover:bg-slate-200/60 rounded-l-md transition-colors"
                        aria-label="Kurang kuantitas"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-2.5 py-0.5 text-xs font-semibold text-foreground min-w-[28px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.itemId, item.quantity + 1)}
                        className="p-1 text-slate-600 hover:text-foreground hover:bg-slate-200/60 rounded-r-md transition-colors"
                        aria-label="Tambah kuantitas"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="text-xs font-bold text-foreground">
                      {formatRupiah(centsToDecimal(itemTotalCents))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Cart Summary & Actions Footer */}
      {items.length > 0 && (
        <CardFooter className="flex flex-col p-4 border-t border-border bg-slate-50/50 space-y-3">
          <div className="w-full space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatRupiah(centsToDecimal(subtotalCents))}</span>
            </div>

            <div className="flex justify-between font-bold text-sm text-foreground pt-1.5 border-t border-slate-200">
              <span>Total Tagihan</span>
              <span className="text-primary text-base font-extrabold">
                {formatRupiah(centsToDecimal(totalCents))}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSavingDraft}
              onClick={onSaveDraft}
              className="gap-1.5 text-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{isSavingDraft ? 'Menyimpan...' : 'Simpan DRAFT'}</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onOpenPayment}
              className="gap-1.5 text-xs font-semibold"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Bayar Sekarang</span>
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

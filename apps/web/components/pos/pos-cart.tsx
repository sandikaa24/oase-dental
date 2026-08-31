'use client';

import React from 'react';
import { type PosCartItem } from './pos-types';
import { formatRupiah } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import {
  Trash2,
  Plus,
  Minus,
  AlertTriangle,
  ShoppingCart,
  User,
  Tag,
  CreditCard,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PosCartProps {
  items: PosCartItem[];
  patientName: string;
  patientPhone: string;
  discountAmount: string;
  discountReason: string;
  onUpdatePatientName: (name: string) => void;
  onUpdatePatientPhone: (phone: string) => void;
  onUpdateDiscountAmount: (amount: string) => void;
  onUpdateDiscountReason: (reason: string) => void;
  onUpdateQuantity: (itemId: string, newQty: number) => void;
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
  discountAmount,
  discountReason,
  onUpdatePatientName,
  onUpdatePatientPhone,
  onUpdateDiscountAmount,
  onUpdateDiscountReason,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onSaveDraft,
  onOpenPayment,
  isSavingDraft,
  activeDraftId,
}: PosCartProps) {
  // Hitung subtotal tampilan di client
  const subtotalNum = items.reduce((acc, item) => {
    const p = parseFloat(item.price) || 0;
    return acc + p * item.quantity;
  }, 0);

  const discountNum = parseFloat(discountAmount) || 0;
  const totalNum = Math.max(0, subtotalNum - discountNum);

  // Periksa apakah ada produk yang melebihi batas stok tersedia
  const hasInsufficientStock = items.some(
    (item) =>
      item.itemType === 'PRODUCT' &&
      item.availableStock !== null &&
      item.quantity > item.availableStock
  );

  // Validasi diskon: alasan wajib jika diskon > 0
  const isDiscountInvalid = discountNum > 0 && !discountReason.trim();

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
            <div>
              <input
                type="text"
                placeholder="Nama Pasien..."
                value={patientName}
                onChange={(e) => onUpdatePatientName(e.target.value)}
                className="w-full px-2.5 py-1 text-xs rounded border border-border bg-surface text-foreground placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <input
                type="tel"
                placeholder="No. WhatsApp / HP..."
                value={patientPhone}
                onChange={(e) => onUpdatePatientPhone(e.target.value)}
                className="w-full px-2.5 py-1 text-xs rounded border border-border bg-surface text-foreground placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Cart Line Items */}
        {items.length === 0 ? (
          <div className="py-8 text-center text-muted text-xs space-y-2">
            <ShoppingCart className="h-8 w-8 mx-auto text-slate-300 stroke-[1.5]" />
            <p>Keranjang masih kosong</p>
            <p className="text-[11px] text-slate-400">
              Pilih tindakan layanan atau produk di katalog untuk ditambahkan
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => {
              const isOverStock =
                item.itemType === 'PRODUCT' &&
                item.availableStock !== null &&
                item.quantity > item.availableStock;

              const itemTotalNum = (parseFloat(item.price) || 0) * item.quantity;

              return (
                <div
                  key={item.id}
                  className={cn(
                    'p-2.5 rounded-lg border transition-all space-y-2',
                    isOverStock
                      ? 'border-danger-border bg-danger-bg/20'
                      : 'border-border bg-surface hover:border-slate-300'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-[9px] font-bold px-1 py-0.2 rounded uppercase',
                            item.itemType === 'SERVICE'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-blue-100 text-blue-800'
                          )}
                        >
                          {item.itemType === 'SERVICE' ? 'Layanan' : 'Produk'}
                        </span>
                        <h4 className="text-xs font-semibold text-foreground truncate" title={item.name}>
                          {item.name}
                        </h4>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        {formatRupiah(item.price)}
                      </p>
                    </div>

                    {/* Delete item */}
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.itemId)}
                      className="p-1 text-slate-400 hover:text-danger-text transition-colors rounded hover:bg-slate-100"
                      aria-label={`Hapus ${item.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Inline warning for insufficient stock */}
                  {isOverStock && (
                    <div className="flex items-center gap-1.5 text-[11px] text-danger-text font-medium bg-danger-bg p-1.5 rounded border border-danger-border">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Stok tidak mencukupi (Tersedia: {item.availableStock ?? 0})
                      </span>
                    </div>
                  )}

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
                      {formatRupiah(String(itemTotalNum))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Discount section */}
        {items.length > 0 && (
          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700">
              <span className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-muted" />
                <span>Diskon Khusus (Opsional)</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <input
                  type="number"
                  min="0"
                  placeholder="Nominal Diskon (Rp)"
                  value={discountAmount}
                  onChange={(e) => onUpdateDiscountAmount(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs rounded border border-border bg-surface text-foreground placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Alasan Diskon (Wajib jika > 0)"
                  value={discountReason}
                  onChange={(e) => onUpdateDiscountReason(e.target.value)}
                  className={cn(
                    'w-full px-2.5 py-1 text-xs rounded border bg-surface text-foreground placeholder:text-muted focus:outline-hidden focus:ring-1',
                    isDiscountInvalid
                      ? 'border-danger-border focus:ring-danger-border'
                      : 'border-border focus:ring-primary'
                  )}
                />
              </div>
            </div>

            {isDiscountInvalid && (
              <p className="text-[10px] text-danger-text">
                * Alasan diskon wajib diisi jika memberikan potongan harga
              </p>
            )}
          </div>
        )}
      </CardContent>

      {/* Cart Summary & Actions Footer */}
      {items.length > 0 && (
        <CardFooter className="flex flex-col p-4 border-t border-border bg-slate-50/50 space-y-3">
          <div className="w-full space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatRupiah(String(subtotalNum))}</span>
            </div>

            {discountNum > 0 && (
              <div className="flex justify-between text-danger-text">
                <span>Diskon</span>
                <span>-{formatRupiah(String(discountNum))}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-sm text-foreground pt-1.5 border-t border-slate-200">
              <span>Total Tagihan</span>
              <span className="text-primary text-base font-extrabold">
                {formatRupiah(String(totalNum))}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSavingDraft || hasInsufficientStock || isDiscountInvalid}
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
              disabled={hasInsufficientStock || isDiscountInvalid}
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

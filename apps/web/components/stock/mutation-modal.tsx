'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StockItem, StockMovementType } from './stock-types';
import { ArrowDownLeft, ArrowUpRight, Scale, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MutationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StockItem | null;
  branchId: string;
  onSuccess: () => void;
}

interface MutationFormState {
  type: StockMovementType;
  qty: string;
  note: string;
  expiredDate: string;
  minStock: string;
}

const INITIAL_FORM: MutationFormState = {
  type: 'IN',
  qty: '',
  note: '',
  expiredDate: '',
  minStock: '',
};

export function MutationModal({
  open,
  onOpenChange,
  item,
  branchId,
  onSuccess,
}: MutationModalProps) {
  const [form, setForm] = useState<MutationFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [insufficientStockError, setInsufficientStockError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && item) {
      setForm({
        type: 'IN',
        qty: '',
        note: '',
        expiredDate: item.expiredDate || '',
        minStock: String(item.minStock ?? 0),
      });
      setErrors({});
      setInsufficientStockError(null);
      setGlobalError(null);
    }
  }, [open, item]);

  const handleChange = useCallback((field: keyof MutationFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (prev[field]) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return prev;
    });
    if (field === 'qty' || field === 'type') {
      setInsufficientStockError(null);
    }
    setGlobalError(null);
  }, []);

  if (!item) return null;

  const currentStock = item.quantity ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const qtyNum = parseInt(form.qty.trim(), 10);

    if (!form.qty.trim() || isNaN(qtyNum) || qtyNum <= 0) {
      newErrors.qty = 'Jumlah harus berupa bilangan bulat positif lebih besar dari 0';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setGlobalError(null);
    setInsufficientStockError(null);

    try {
      const payload: Record<string, unknown> = {
        productId: item.productId,
        branchId,
        type: form.type,
        qty: qtyNum,
        note: form.note.trim() || null,
      };

      if (form.expiredDate.trim()) {
        payload.expiredDate = form.expiredDate.trim();
      }
      if (form.minStock.trim() && !isNaN(parseInt(form.minStock.trim(), 10))) {
        payload.minStock = parseInt(form.minStock.trim(), 10);
      }

      const res = await fetch('/api/v1/stock/mutation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.code === 'INSUFFICIENT_STOCK') {
          const available = data.available !== undefined ? data.available : currentStock;
          setInsufficientStockError(`Melebihi stok (tersedia: ${available} ${item.unit})`);
          return;
        }

        if (data.details && Array.isArray(data.details)) {
          const detailErrors: Record<string, string> = {};
          data.details.forEach((d: { path: string; message: string }) => {
            detailErrors[d.path] = d.message;
          });
          setErrors(detailErrors);
        }
        throw new Error(data.message || 'Gagal mencatat mutasi stok');
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setGlobalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogClose onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>Catat Mutasi Stok</DialogTitle>
        <DialogDescription>
          Pencatatan pergerakan stok manual barang masuk, keluar, atau penyesuaian fisik.
        </DialogDescription>
      </DialogHeader>

      {/* Info Produk & Stok Saat Ini */}
      <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-border flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm text-foreground">{item.name}</div>
          <div className="text-xs text-muted">
            {item.category} &bull; SKU: {item.sku || '-'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Stok Saat Ini</div>
          <div className="text-base font-bold text-foreground">
            {currentStock.toLocaleString('id-ID')} <span className="text-xs font-normal text-muted">{item.unit}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-3">
        {globalError && (
          <div className="p-3 rounded-lg bg-danger-bg border border-red-200 text-xs text-danger-text flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        {/* Pilihan Tipe Mutasi */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Tipe Mutasi <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleChange('type', 'IN')}
              className={cn(
                'flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all',
                form.type === 'IN'
                  ? 'border-teal-600 bg-teal-50 text-teal-800 font-semibold ring-1 ring-teal-600'
                  : 'border-border bg-surface text-slate-700 hover:bg-slate-50'
              )}
            >
              <ArrowDownLeft className="h-4 w-4 text-emerald-600 mb-1" />
              <span>Barang Masuk (IN)</span>
            </button>

            <button
              type="button"
              onClick={() => handleChange('type', 'OUT')}
              className={cn(
                'flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all',
                form.type === 'OUT'
                  ? 'border-red-600 bg-red-50 text-red-800 font-semibold ring-1 ring-red-600'
                  : 'border-border bg-surface text-slate-700 hover:bg-slate-50'
              )}
            >
              <ArrowUpRight className="h-4 w-4 text-red-600 mb-1" />
              <span>Barang Keluar (OUT)</span>
            </button>

            <button
              type="button"
              onClick={() => handleChange('type', 'ADJUSTMENT')}
              className={cn(
                'flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all text-center',
                form.type === 'ADJUSTMENT'
                  ? 'border-amber-600 bg-amber-50 text-amber-800 font-semibold ring-1 ring-amber-600'
                  : 'border-border bg-surface text-slate-700 hover:bg-slate-50'
              )}
            >
              <Scale className="h-4 w-4 text-amber-600 mb-1" />
              <span>Penyesuaian Fisik</span>
            </button>
          </div>
          {form.type === 'ADJUSTMENT' && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-md mt-1.5 font-medium">
              ℹ️ <strong>Set stok fisik akhir (hasil hitung)</strong>: Nilai yang Anda masukkan akan menjadi jumlah stok baru, dan selisihnya akan dicatat di log mutasi.
            </p>
          )}
        </div>

        {/* Jumlah (Qty) */}
        <div>
          <label htmlFor="mutation-qty" className="block text-xs font-semibold text-foreground mb-1">
            {form.type === 'ADJUSTMENT'
              ? 'Jumlah Stok Fisik Akhir'
              : `Jumlah Barang ${form.type === 'IN' ? 'Masuk' : 'Keluar'} (${item.unit})`}{' '}
            <span className="text-red-500">*</span>
          </label>
          <Input
            id="mutation-qty"
            type="number"
            min="1"
            value={form.qty}
            onChange={(e) => handleChange('qty', e.target.value)}
            placeholder={`Masukkan jumlah ${item.unit}...`}
            error={errors.qty}
            disabled={isSubmitting}
            autoComplete="off"
            autoFocus
          />
          {insufficientStockError && (
            <div className="mt-1.5 p-2 rounded-md bg-danger-bg border border-red-200 text-xs text-danger-text font-medium flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{insufficientStockError}</span>
            </div>
          )}
        </div>

        {/* Catatan / Keterangan */}
        <div>
          <label htmlFor="mutation-note" className="block text-xs font-semibold text-foreground mb-1">
            Catatan / Keterangan
          </label>
          <Input
            id="mutation-note"
            value={form.note}
            onChange={(e) => handleChange('note', e.target.value)}
            placeholder="Contoh: Pengadaan PO-123, Pemakaian ruang poli, Selisih opname fisik..."
            error={errors.note}
            disabled={isSubmitting}
            autoComplete="off"
          />
        </div>

        {/* Tanggal Kadaluarsa & Min Stok (Opsional) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label htmlFor="mutation-expired" className="block text-xs font-semibold text-foreground mb-1">
              Tanggal Kadaluarsa (Baru/Update)
            </label>
            <Input
              id="mutation-expired"
              type="date"
              value={form.expiredDate}
              onChange={(e) => handleChange('expiredDate', e.target.value)}
              error={errors.expiredDate}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="mutation-minStock" className="block text-xs font-semibold text-foreground mb-1">
              Peringatan Min. Stok ({item.unit})
            </label>
            <Input
              id="mutation-minStock"
              type="number"
              min="0"
              value={form.minStock}
              onChange={(e) => handleChange('minStock', e.target.value)}
              placeholder="0"
              error={errors.minStock}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Memproses...' : 'Simpan Mutasi'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

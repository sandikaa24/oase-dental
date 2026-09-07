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
import {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  getSkuPrefixByCategory,
  type ProductCategory,
  type ProductUnit,
} from '@oase/shared';
import { formatThousand, sanitizeDigits } from '@/lib/format/currency';
import { StockItem } from './stock-types';

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productToEdit?: StockItem | null;
  onSuccess: () => void;
}

interface FormState {
  name: string;
  sku: string;
  unit: string;
  category: string;
  costPrice: string; // Menyimpan raw digits integer/sen
}

const INITIAL_FORM: FormState = {
  name: '',
  sku: '',
  unit: 'pcs',
  category: 'BHP',
  costPrice: '',
};

export function ProductModal({
  open,
  onOpenChange,
  productToEdit,
  onSuccess,
}: ProductModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);

  const isEdit = !!productToEdit;

  /**
   * Mengambil SKU berikutnya berdasarkan max(seq produk existing dengan prefix sama) + 1.
   * BINDING: Task B1.6 (BUKAN count+1).
   */
  const fetchNextSku = useCallback(async (categoryName: string): Promise<string> => {
    const prefix = getSkuPrefixByCategory(categoryName);
    try {
      const res = await fetch(`/api/v1/products?limit=100&category=${encodeURIComponent(categoryName)}`);
      if (!res.ok) throw new Error('Gagal mengambil daftar produk untuk SKU');
      const data = await res.json();
      const items: Array<{ sku?: string | null }> = data?.data || [];

      let maxSeq = 0;
      const regex = new RegExp(`^${prefix}-(\\d+)`, 'i');
      items.forEach((item) => {
        if (!item.sku) return;
        const match = item.sku.match(regex);
        if (match && match[1]) {
          const seq = parseInt(match[1], 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      });

      const nextSeq = maxSeq + 1;
      return `${prefix}-${String(nextSeq).padStart(4, '0')}`;
    } catch {
      // Fallback awal jika fetch gagal
      return `${prefix}-0001`;
    }
  }, []);

  useEffect(() => {
    if (open) {
      if (productToEdit) {
        setForm({
          name: productToEdit.name || '',
          sku: productToEdit.sku || '',
          unit: productToEdit.unit || 'pcs',
          category: productToEdit.category || 'BHP',
          costPrice:
            productToEdit.costPrice !== null && productToEdit.costPrice !== undefined
              ? sanitizeDigits(String(productToEdit.costPrice))
              : '',
        });
        setErrors({});
        setGlobalError(null);
      } else {
        // Form baru: set default kategori dan generate SKU pertama
        setForm(INITIAL_FORM);
        setErrors({});
        setGlobalError(null);
        setIsGeneratingSku(true);
        fetchNextSku(INITIAL_FORM.category).then((nextSku) => {
          setForm((prev) => ({ ...prev, sku: nextSku }));
          setIsGeneratingSku(false);
        });
      }
    }
  }, [open, productToEdit, fetchNextSku]);

  // Handler perubahan kategori: jika mode create dan SKU belum diedit manual / sesuai prefix lama, update auto SKU
  const handleCategoryChange = async (newCategory: string) => {
    handleChange('category', newCategory);
    if (!isEdit) {
      setIsGeneratingSku(true);
      const nextSku = await fetchNextSku(newCategory);
      setForm((prev) => ({ ...prev, sku: nextSku }));
      setIsGeneratingSku(false);
    }
  };

  const handleChange = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (prev[field]) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return prev;
    });
    setGlobalError(null);
  }, []);

  // Handler input uang live format Rupiah
  const handleCostPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeDigits(e.target.value);
    handleChange('costPrice', raw);
  };

  const executeSubmit = async (skuToUse: string): Promise<boolean> => {
    const url = isEdit
      ? `/api/v1/products/${productToEdit.productId}`
      : '/api/v1/products';
    const method = isEdit ? 'PUT' : 'POST';

    const costNum = form.costPrice.trim() ? parseInt(form.costPrice.trim(), 10) : null;

    const payload = {
      name: form.name.trim(),
      sku: skuToUse.trim() || null,
      unit: form.unit.trim(),
      category: form.category.trim(),
      costPrice: costNum,
    };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      // Bila error 409 karena duplikasi SKU, lempar sinyal agar bisa di-retry dengan seq+1
      if (res.status === 409 && (data.code === 'DUPLICATE_PRODUCT_SKU' || String(data.message).toLowerCase().includes('sku'))) {
        const err = new Error(data.message || 'Kode SKU produk sudah digunakan');
        (err as unknown as { isSkuDupe: boolean }).isSkuDupe = true;
        throw err;
      }

      if (data.details && Array.isArray(data.details)) {
        const detailErrors: Record<string, string> = {};
        data.details.forEach((d: { path: string; message: string }) => {
          detailErrors[d.path] = d.message;
        });
        setErrors(detailErrors);
      }
      throw new Error(data.message || 'Gagal menyimpan produk');
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi client-side
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Nama produk wajib diisi';
    if (!form.unit.trim()) newErrors.unit = 'Satuan wajib diisi';
    if (!form.category.trim()) newErrors.category = 'Kategori wajib diisi';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setGlobalError(null);

    try {
      try {
        await executeSubmit(form.sku);
      } catch (firstErr: unknown) {
        // Mitigasi B1.6: bila 409 duplikat SKU -> retry dengan seq+1
        if (firstErr && typeof firstErr === 'object' && (firstErr as { isSkuDupe?: boolean }).isSkuDupe) {
          const prefix = getSkuPrefixByCategory(form.category);
          const match = form.sku.match(new RegExp(`^${prefix}-(\\d+)`, 'i'));
          const currentSeq = match && match[1] ? parseInt(match[1], 10) : 0;
          const retrySku = `${prefix}-${String(currentSeq + 1).padStart(4, '0')}`;
          setForm((prev) => ({ ...prev, sku: retrySku }));

          // Retry otomatis percobaan kedua dengan seq + 1
          await executeSubmit(retrySku);
        } else {
          throw firstErr;
        }
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

  const titleText = isEdit ? 'Edit Data Produk' : 'Tambah Produk Baru';
  const descText = isEdit
    ? 'Perbarui informasi master produk klinik.'
    : 'Tambahkan produk baru ke dalam katalog inventori klinik.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogClose onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>{titleText}</DialogTitle>
        <DialogDescription>{descText}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        {globalError && (
          <div className="p-3 rounded-lg bg-danger-bg border border-red-200 text-xs text-danger-text">
            {globalError}
          </div>
        )}

        {/* Nama Produk */}
        <div>
          <label htmlFor="product-name" className="block text-xs font-semibold text-foreground mb-1">
            Nama Produk <span className="text-danger-text">*</span>
          </label>
          <Input
            id="product-name"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Contoh: Komposit Resin A2, Sarung Tangan Latex M, Etching Gel 37%"
            error={errors.name}
            disabled={isSubmitting}
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Kategori (Dropdown dari daftar tetap terpusat) */}
          <div>
            <label htmlFor="product-category" className="block text-xs font-semibold text-foreground mb-1">
              Kategori <span className="text-danger-text">*</span>
            </label>
            <select
              id="product-category"
              value={form.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-hidden focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-primary-soft disabled:opacity-50"
            >
              {PRODUCT_CATEGORIES.map((cat: ProductCategory) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-xs text-danger-text">{errors.category}</p>
            )}
          </div>

          {/* Satuan (Dropdown dari daftar tetap terpusat) */}
          <div>
            <label htmlFor="product-unit" className="block text-xs font-semibold text-foreground mb-1">
              Satuan <span className="text-danger-text">*</span>
            </label>
            <select
              id="product-unit"
              value={form.unit}
              onChange={(e) => handleChange('unit', e.target.value)}
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-hidden focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-primary-soft disabled:opacity-50"
            >
              {PRODUCT_UNITS.map((unit: ProductUnit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            {errors.unit && (
              <p className="mt-1 text-xs text-danger-text">{errors.unit}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* SKU / Kode Produk (Auto-generate dari max seq + 1, masih editable) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="product-sku" className="block text-xs font-semibold text-foreground">
                Kode / SKU
              </label>
              {isGeneratingSku && (
                <span className="text-[11px] text-muted italic animate-pulse">
                  Menghitung SKU...
                </span>
              )}
            </div>
            <Input
              id="product-sku"
              value={form.sku}
              onChange={(e) => handleChange('sku', e.target.value)}
              placeholder="Contoh: BHP-0001, BTD-0001"
              error={errors.sku}
              disabled={isSubmitting || isGeneratingSku}
              autoComplete="off"
            />
          </div>

          {/* Harga Pokok (Input terformat Rupiah live) */}
          <div>
            <label htmlFor="product-costPrice" className="block text-xs font-semibold text-foreground mb-1">
              Harga Pokok
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-xs font-semibold text-muted">
                Rp
              </div>
              <Input
                id="product-costPrice"
                type="text"
                inputMode="numeric"
                value={formatThousand(form.costPrice)}
                onChange={handleCostPriceChange}
                placeholder="0"
                error={errors.costPrice}
                disabled={isSubmitting}
                autoComplete="off"
                className="pl-9 font-mono"
              />
            </div>
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
          <Button type="submit" variant="primary" disabled={isSubmitting || isGeneratingSku}>
            {isSubmitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

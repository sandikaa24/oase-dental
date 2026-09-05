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
  costPrice: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  sku: '',
  unit: '',
  category: '',
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

  const isEdit = !!productToEdit;

  useEffect(() => {
    if (open) {
      if (productToEdit) {
        setForm({
          name: productToEdit.name || '',
          sku: productToEdit.sku || '',
          unit: productToEdit.unit || '',
          category: productToEdit.category || '',
          costPrice:
            productToEdit.costPrice !== null && productToEdit.costPrice !== undefined
              ? String(productToEdit.costPrice)
              : '',
        });
      } else {
        setForm(INITIAL_FORM);
      }
      setErrors({});
      setGlobalError(null);
    }
  }, [open, productToEdit]);

  // Handler stabil untuk mencegah input loss focus
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Nama produk wajib diisi';
    if (!form.unit.trim()) newErrors.unit = 'Satuan wajib diisi';
    if (!form.category.trim()) newErrors.category = 'Kategori wajib diisi';
    if (form.costPrice.trim()) {
      const num = parseFloat(form.costPrice.trim());
      if (isNaN(num) || num < 0) {
        newErrors.costPrice = 'Harga pokok harus berupa angka >= 0';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setGlobalError(null);

    try {
      const url = isEdit
        ? `/api/v1/products/${productToEdit.productId}`
        : '/api/v1/products';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        unit: form.unit.trim(),
        category: form.category.trim(),
        costPrice: form.costPrice.trim() ? parseFloat(form.costPrice.trim()) : null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details && Array.isArray(data.details)) {
          const detailErrors: Record<string, string> = {};
          data.details.forEach((d: { path: string; message: string }) => {
            detailErrors[d.path] = d.message;
          });
          setErrors(detailErrors);
        }
        throw new Error(data.message || 'Gagal menyimpan produk');
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
            Nama Produk <span className="text-red-500">*</span>
          </label>
          <Input
            id="product-name"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Contoh: Amoxicillin 500mg, Sarung Tangan Latex M"
            error={errors.name}
            disabled={isSubmitting}
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* SKU / Kode Produk */}
          <div>
            <label htmlFor="product-sku" className="block text-xs font-semibold text-foreground mb-1">
              Kode / SKU
            </label>
            <Input
              id="product-sku"
              value={form.sku}
              onChange={(e) => handleChange('sku', e.target.value)}
              placeholder="Contoh: OBAT-AMX-500"
              error={errors.sku}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          {/* Satuan */}
          <div>
            <label htmlFor="product-unit" className="block text-xs font-semibold text-foreground mb-1">
              Satuan <span className="text-red-500">*</span>
            </label>
            <Input
              id="product-unit"
              value={form.unit}
              onChange={(e) => handleChange('unit', e.target.value)}
              placeholder="strip, box, botol, ampul, pcs"
              error={errors.unit}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Kategori */}
          <div>
            <label htmlFor="product-category" className="block text-xs font-semibold text-foreground mb-1">
              Kategori <span className="text-red-500">*</span>
            </label>
            <Input
              id="product-category"
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value)}
              placeholder="Obat, Bahan Medis, BHP, dll."
              error={errors.category}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          {/* Harga Pokok */}
          <div>
            <label htmlFor="product-costPrice" className="block text-xs font-semibold text-foreground mb-1">
              Harga Pokok (Rp)
            </label>
            <Input
              id="product-costPrice"
              type="number"
              min="0"
              step="any"
              value={form.costPrice}
              onChange={(e) => handleChange('costPrice', e.target.value)}
              placeholder="0"
              error={errors.costPrice}
              disabled={isSubmitting}
              autoComplete="off"
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
            {isSubmitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
import { formatThousand, sanitizeDigits } from '@/lib/format/currency';
import { Product } from './master-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/placeholder';
import { ShoppingBag, X, Check } from 'lucide-react';

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
  product: Product | null;
}

export function ProductModal({
  open,
  onOpenChange,
  onSuccess,
  product,
}: ProductModalProps) {
  const isEditing = !!product;

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [minStock, setMinStock] = useState('5');
  const [active, setActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (product) {
        setName(product.name);
        setSku(product.sku);
        const numPrice = typeof product.sellPrice === 'string' ? Math.round(Number(product.sellPrice)) : Math.round(product.sellPrice);
        setSellPrice(String(numPrice));
        setUnit(product.unit);
        setMinStock(String(product.minStock));
        setActive(product.active);
      } else {
        setName('');
        setSku('');
        setSellPrice('');
        setUnit('pcs');
        setMinStock('5');
        setActive(true);
      }
    }
  }, [open, product]);

  if (!open) return null;

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeDigits(e.target.value);
    setSellPrice(raw);
  };

  const handleMinStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeDigits(e.target.value);
    setMinStock(raw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedSku = sku.trim().toUpperCase();

    if (!trimmedName) {
      setError('Nama produk tidak boleh kosong.');
      return;
    }
    if (!trimmedSku) {
      setError('SKU produk tidak boleh kosong.');
      return;
    }

    const cleanPrice = parseInt(sellPrice || '0', 10);
    if (cleanPrice < 0) {
      setError('Harga jual produk harus bernilai positif.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        sku: trimmedSku,
        sellPrice: cleanPrice,
        unit: unit.trim() || 'pcs',
        minStock: minStock.trim() ? parseInt(minStock, 10) : 0,
        active,
      };

      if (isEditing && product) {
        await fetchApi(`/api/v1/products/${product.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onSuccess('Produk penjualan berhasil diperbarui');
      } else {
        await fetchApi('/api/v1/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onSuccess('Produk penjualan baru berhasil ditambahkan');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat menyimpan produk.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isEditing ? 'Edit Produk Penjualan' : 'Tambah Produk Baru'}
              </h3>
              <p className="text-[11px] text-muted">Master Item Dijual ke Pasien di POS</p>
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

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && <ErrorBanner title="Gagal Menyimpan" message={error} />}

          {/* SKU & Nama Produk */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700">Kode SKU *</label>
              <Input
                type="text"
                required
                placeholder="PROD-001"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                className="text-xs font-mono font-semibold"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Nama Produk *</label>
              <Input
                type="text"
                required
                placeholder="Contoh: Sikat Gigi Ortho"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Harga Jual & Satuan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Harga Jual (Rp) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">
                  Rp
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="0"
                  value={sellPrice ? formatThousand(parseInt(sellPrice, 10)) : ''}
                  onChange={handlePriceChange}
                  className="pl-9 text-xs font-semibold"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Satuan Unit *</label>
              <Input
                type="text"
                required
                placeholder="pcs / box / botol / pack"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Minimum Stock Warning */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Batas Minimum Stok (Global Alert)</label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 5"
              value={minStock}
              onChange={handleMinStockChange}
              className="text-xs font-mono"
            />
            <p className="text-[11px] text-muted">
              Peringatan stok menipis akan aktif jika saldo cabang di bawah ambang ini
            </p>
          </div>

          {/* Status Aktif (saat edit) */}
          {isEditing && (
            <div className="flex items-center justify-between pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700">Status Aktif</label>
                <p className="text-[11px] text-muted">Produk aktif dapat dipilih di kasir POS dan inventaris</p>
              </div>
              <button
                type="button"
                onClick={() => setActive(!active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  active ? 'bg-primary' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

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
              <span>{isEditing ? 'Simpan Perubahan' : 'Tambah Produk'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

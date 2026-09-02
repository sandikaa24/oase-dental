'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
import { sanitizeDigits } from '@/lib/format/currency';
import { Material } from './master-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Boxes, X, Check } from 'lucide-react';

interface MaterialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
  material: Material | null;
}

export function MaterialModal({
  open,
  onOpenChange,
  onSuccess,
  material,
}: MaterialModalProps) {
  const isEditing = !!material;

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('box');
  const [minStock, setMinStock] = useState('5');
  const [isStockTracked, setIsStockTracked] = useState(true);
  const [active, setActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (material) {
        setName(material.name);
        setSku(material.sku);
        setUnit(material.unit);
        setMinStock(String(material.minStock));
        setIsStockTracked(material.isStockTracked);
        setActive(material.active);
      } else {
        setName('');
        setSku('');
        setUnit('box');
        setMinStock('5');
        setIsStockTracked(true);
        setActive(true);
      }
    }
  }, [open, material]);

  if (!open) return null;

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
      setError('Nama bahan klinis tidak boleh kosong.');
      return;
    }
    if (!trimmedSku) {
      setError('SKU bahan klinis tidak boleh kosong.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        sku: trimmedSku,
        unit: unit.trim() || 'box',
        minStock: minStock.trim() ? parseInt(minStock, 10) : 0,
        isStockTracked,
        active,
      };

      if (isEditing && material) {
        await fetchApi(`/api/v1/materials/${material.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onSuccess('Bahan klinis berhasil diperbarui');
      } else {
        await fetchApi('/api/v1/materials', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onSuccess('Bahan klinis baru berhasil ditambahkan');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat menyimpan bahan.');
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
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isEditing ? 'Edit Bahan Klinis' : 'Tambah Bahan Baru'}
              </h3>
              <p className="text-[11px] text-muted">Material Habis Pakai Perawatan Gigi</p>
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

          {/* SKU & Nama Bahan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700">Kode SKU *</label>
              <Input
                type="text"
                required
                placeholder="MAT-001"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                className="text-xs font-mono font-semibold"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Nama Bahan Klinis *</label>
              <Input
                type="text"
                required
                placeholder="Contoh: Komposit Resin A2, Anestesi Lokal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Satuan & Min Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Satuan Unit *</label>
              <Input
                type="text"
                required
                placeholder="ampul / tube / box / roll"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Batas Min. Stok (Global)</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 5"
                value={minStock}
                onChange={handleMinStockChange}
                className="text-xs font-mono"
              />
            </div>
          </div>

          {/* Switch Tracking Stok */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-slate-800">Lacak Kartu Stok Fisik</label>
              <p className="text-[11px] text-muted">Pantau mutasi barang masuk &amp; sesi stock opname per cabang</p>
            </div>
            <button
              type="button"
              onClick={() => setIsStockTracked(!isStockTracked)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                isStockTracked ? 'bg-primary' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  isStockTracked ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Status Aktif (saat edit) */}
          {isEditing && (
            <div className="flex items-center justify-between pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700">Status Aktif</label>
                <p className="text-[11px] text-muted">Bahan aktif dapat dipilih saat penerimaan barang (Stock In)</p>
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
              <span>{isEditing ? 'Simpan Perubahan' : 'Tambah Bahan'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

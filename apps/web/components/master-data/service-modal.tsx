'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
import { formatThousand, sanitizeDigits } from '@/lib/format/currency';
import { Service, Category } from './master-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Stethoscope, X, Check, Globe } from 'lucide-react';

interface ServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
  service: Service | null;
  categories: Category[];
}

export function ServiceModal({
  open,
  onOpenChange,
  onSuccess,
  service,
  categories,
}: ServiceModalProps) {
  const isEditing = !!service;

  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [showOnPortal, setShowOnPortal] = useState(false);
  const [active, setActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (service) {
        setName(service.name);
        setNameEn(service.nameEn || '');
        setCategoryId(service.categoryId || '');
        const numPrice = typeof service.price === 'string' ? Math.round(Number(service.price)) : Math.round(service.price);
        setPrice(String(numPrice));
        setDescription(service.description || '');
        setDescriptionEn(service.descriptionEn || '');
        setShowOnPortal(service.showOnPortal);
        setActive(service.active);
      } else {
        setName('');
        setNameEn('');
        setCategoryId(categories[0]?.id || '');
        setPrice('');
        setDescription('');
        setDescriptionEn('');
        setShowOnPortal(true);
        setActive(true);
      }
    }
  }, [open, service, categories]);

  if (!open) return null;

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeDigits(e.target.value);
    setPrice(raw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nama layanan tidak boleh kosong.');
      return;
    }

    const cleanPrice = parseInt(price || '0', 10);
    if (cleanPrice < 0) {
      setError('Tarif layanan harus bernilai positif.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        nameEn: nameEn.trim() || undefined,
        categoryId: categoryId || undefined,
        price: cleanPrice,
        description: description.trim() || undefined,
        descriptionEn: descriptionEn.trim() || undefined,
        showOnPortal,
        active,
      };

      if (isEditing && service) {
        await fetchApi(`/api/v1/services/${service.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onSuccess('Layanan medis berhasil diperbarui');
      } else {
        await fetchApi('/api/v1/services', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onSuccess('Layanan medis baru berhasil ditambahkan');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat menyimpan layanan.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isEditing ? 'Edit Layanan Tindakan' : 'Tambah Layanan Baru'}
              </h3>
              <p className="text-[11px] text-muted">Katalog Tindakan Medis &amp; Tarif Pasien</p>
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

          {/* Nama Layanan (ID & EN) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Nama Layanan (ID) *</label>
              <Input
                type="text"
                required
                placeholder="Contoh: Scaling Gigi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Nama Bahasa Inggris (EN)</label>
              <Input
                type="text"
                placeholder="Contoh: Dental Scaling"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Kategori & Durasi */}
          {/* Kategori */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Kategori</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-border bg-white text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="">-- Tanpa Kategori --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {!c.active ? '(Nonaktif)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Tarif Pasien (Rp) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Tarif Layanan (Rp) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">
                Rp
              </span>
              <Input
                type="text"
                inputMode="numeric"
                required
                placeholder="0"
                value={price ? formatThousand(parseInt(price, 10)) : ''}
                onChange={handlePriceChange}
                className="pl-9 text-xs font-semibold"
              />
            </div>
          </div>

          {/* Deskripsi (ID) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Deskripsi Tindakan</label>
            <textarea
              rows={2}
              placeholder="Penjelasan singkat tindakan medis atau catatan dokter..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 rounded-md border border-border bg-white text-xs text-foreground placeholder:text-muted focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Portal Visibility Switch */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <div>
                  <label className="text-xs font-semibold text-slate-800">Tampilkan di Portal Publik</label>
                  <p className="text-[11px] text-muted">Katalog layanan dapat dilihat publik di website resmi klinik</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOnPortal(!showOnPortal)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  showOnPortal ? 'bg-primary' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    showOnPortal ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              * Catatan: Portal publik saat ini dalam tahap persiapan pengembangan.
            </p>
          </div>

          {/* Status Aktif (saat edit) */}
          {isEditing && (
            <div className="flex items-center justify-between pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700">Status Aktif</label>
                <p className="text-[11px] text-muted">Layanan aktif dapat dipilih di kasir POS</p>
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
              <span>{isEditing ? 'Simpan Perubahan' : 'Tambah Layanan'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
import { Category } from './master-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Tags, X, Check } from 'lucide-react';

interface CategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
  category: Category | null;
}

export function CategoryModal({
  open,
  onOpenChange,
  onSuccess,
  category,
}: CategoryModalProps) {
  const isEditing = !!category;
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (category) {
        setName(category.name);
        setActive(category.active);
      } else {
        setName('');
        setActive(true);
      }
    }
  }, [open, category]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nama kategori tidak boleh kosong.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && category) {
        await fetchApi(`/api/v1/categories/${category.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: trimmedName,
            active,
          }),
        });
        onSuccess('Kategori berhasil diperbarui');
      } else {
        await fetchApi('/api/v1/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: trimmedName,
          }),
        });
        onSuccess('Kategori baru berhasil ditambahkan');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat menyimpan kategori.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <Tags className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isEditing ? 'Edit Kategori' : 'Tambah Kategori Baru'}
              </h3>
              <p className="text-[11px] text-muted">Pengelompokan Layanan Tindakan Medis</p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBanner title="Gagal Menyimpan" message={error} />}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Nama Kategori *</label>
            <Input
              type="text"
              required
              placeholder="Contoh: Perawatan Umum, Orthodonti, Bedah Mulut"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs"
            />
          </div>

          {isEditing && (
            <div className="flex items-center justify-between pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700">Status Aktif</label>
                <p className="text-[11px] text-muted">Kategori aktif dapat dipilih saat membuat layanan</p>
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
              <span>{isEditing ? 'Simpan Perubahan' : 'Tambah Kategori'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

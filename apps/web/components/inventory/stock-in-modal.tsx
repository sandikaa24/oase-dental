'use client';

import React, { useState } from 'react';
import { fetchApi } from '@/lib/api-client';
import { formatThousand, sanitizeDigits } from '@/lib/format/currency';
import { StockItem } from './inventory-types';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Plus, Trash2, X, PackagePlus } from 'lucide-react';

interface StockInModalProps {
  open: boolean;
  branchId?: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  availableItems: StockItem[];
}

interface StockInRow {
  itemId: string;
  quantity: string;
  unitCost: string;
}

export function StockInModal({
  open,
  branchId,
  onOpenChange,
  onSuccess,
  availableItems,
}: StockInModalProps) {
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<StockInRow[]>([
    { itemId: '', quantity: '1', unitCost: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleAddRow = () => {
    setRows([...rows, { itemId: '', quantity: '1', unitCost: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof StockInRow, value: string) => {
    const updated = [...rows];
    const currentRow = updated[index];
    if (!currentRow) return;

    if (field === 'quantity') {
      const sanitized = sanitizeDigits(value);
      currentRow.quantity = sanitized;
    } else if (field === 'unitCost') {
      const sanitized = sanitizeDigits(value);
      currentRow.unitCost = sanitized;
    } else {
      currentRow.itemId = value;
    }

    setRows(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validasi baris
    const invalidRow = rows.find((r) => !r.itemId || !r.quantity || parseInt(r.quantity, 10) <= 0);
    if (invalidRow) {
      setError('Pastikan semua baris bahan terpilih dan kuantitas lebih dari 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        branchId: branchId || undefined,
        itemType: 'MATERIAL' as const,
        items: rows.map((r) => ({
          itemId: r.itemId,
          quantity: parseInt(r.quantity, 10),
          unitCost: r.unitCost.trim() ? parseInt(r.unitCost, 10) : undefined,
        })),
        note: note.trim() || undefined,
      };

      await fetchApi('/api/v1/inventory/stock-in', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Reset
      setRows([{ itemId: '', quantity: '1', unitCost: '' }]);
      setNote('');
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat memproses penerimaan barang');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Penerimaan Bahan Masuk (Stock In)
              </h3>
              <p className="text-[11px] text-muted">
                Catat penambahan saldo fisik bahan medis ke cabang aktif
              </p>
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

        {error && (
          <ErrorBanner title="Validasi Gagal" message={error} />
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1">
          {/* List Input Baris Item */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Daftar Bahan Masuk</label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddRow}
                className="h-7 text-xs flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>Tambah Baris</span>
              </Button>
            </div>

            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-slate-50/60">
                  {/* Dropdown Bahan */}
                  <div className="flex-1 min-w-[180px]">
                    <select
                      required
                      value={row.itemId}
                      onChange={(e) => handleRowChange(idx, 'itemId', e.target.value)}
                      className="w-full h-8 rounded border border-border bg-white px-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <option value="">-- Pilih Bahan Medis --</option>
                      {availableItems.map((it) => (
                        <option key={it.itemId} value={it.itemId}>
                          {it.name} ({it.sku}) - Saat ini: {it.quantity} {it.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Input Kuantitas */}
                  <div className="w-24 shrink-0">
                    <input
                      type="text"
                      required
                      placeholder="Jumlah"
                      value={row.quantity}
                      onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                      className="w-full h-8 rounded border border-border bg-white px-2 text-xs text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  {/* Input Harga Beli (Opsional) */}
                  <div className="w-36 shrink-0 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">Rp</span>
                    <input
                      type="text"
                      placeholder="Biaya/Satuan"
                      value={formatThousand(row.unitCost)}
                      onChange={(e) => handleRowChange(idx, 'unitCost', e.target.value)}
                      className="w-full h-8 rounded border border-border bg-white pl-7 pr-2 text-xs text-right font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  {/* Tombol Hapus Baris */}
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(idx)}
                    disabled={rows.length === 1}
                    className="p-1.5 rounded text-muted hover:text-danger-text hover:bg-slate-200 disabled:opacity-30 transition-colors"
                    title="Hapus baris"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Catatan / Keterangan (Opsional) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Catatan Penerimaan (Opsional)</label>
            <textarea
              rows={2}
              placeholder="Contoh: No. Faktur PO-2026/09/01 dari Supplier Dental Medika..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-2.5 rounded-md border border-border bg-white text-xs text-foreground placeholder:text-muted focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5"
            >
              <PackagePlus className="h-4 w-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Barang Masuk'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { fetchApi } from '@/lib/api-client';
import { formatThousand, sanitizeDigits } from '@/lib/format/currency';
import { StockItem, ItemType } from './inventory-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [itemType, setItemType] = useState<ItemType>('MATERIAL');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<StockInRow[]>([
    { itemId: '', quantity: '1', unitCost: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const filteredCatalog = availableItems.filter((it) => it.itemType === itemType);

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
      setError('Pastikan semua baris item terpilih dan kuantitas lebih dari 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        branchId: branchId || undefined,
        itemType,
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

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Gagal memproses penerimaan barang.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-surface rounded-xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Penerimaan Barang (Stock In)</h2>
              <p className="text-xs text-muted">
                Catat barang/bahan yang masuk ke stok cabang aktif secara multi-item
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-slate-200/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && <ErrorBanner title="Penerimaan Gagal" message={error} />}

          {/* Tipe Item Selector */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Jenis Item</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setItemType('MATERIAL');
                  setRows([{ itemId: '', quantity: '1', unitCost: '' }]);
                }}
                className={`py-2 px-3 rounded-lg border text-xs font-medium text-center transition-all ${
                  itemType === 'MATERIAL'
                    ? 'border-primary bg-primary-soft text-primary font-semibold'
                    : 'border-border bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Bahan Klinis (MATERIAL)
              </button>
              <button
                type="button"
                onClick={() => {
                  setItemType('PRODUCT');
                  setRows([{ itemId: '', quantity: '1', unitCost: '' }]);
                }}
                className={`py-2 px-3 rounded-lg border text-xs font-medium text-center transition-all ${
                  itemType === 'PRODUCT'
                    ? 'border-primary bg-primary-soft text-primary font-semibold'
                    : 'border-border bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Produk Jual (PRODUCT)
              </button>
            </div>
          </div>

          {/* Item Rows Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Daftar Item Masuk</span>
              <button
                type="button"
                onClick={handleAddRow}
                className="text-primary hover:underline flex items-center gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-border bg-slate-50/60 flex flex-col sm:flex-row items-start sm:items-center gap-2"
                >
                    <div className="flex-1 w-full sm:w-auto">
                      <select
                        value={row.itemId}
                        onChange={(e) => handleRowChange(idx, 'itemId', e.target.value)}
                        required
                        className="w-full h-9 rounded-md border border-border bg-white px-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        <option value="">-- Pilih Item {itemType === 'PRODUCT' ? 'Produk' : 'Bahan'} --</option>
                        {filteredCatalog.map((it) => (
                          <option key={it.itemId} value={it.itemId}>
                            {it.name} ({it.sku}) — Stok: {it.quantity} {it.unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-28">
                      <Input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Jumlah"
                        value={row.quantity}
                        onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                        className="h-9 text-xs text-right font-mono"
                        required
                      />
                    </div>

                    <div className="w-36">
                      <Input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        prefix="Rp"
                        placeholder="Biaya/Satuan"
                        value={row.unitCost ? formatThousand(row.unitCost) : ''}
                        onChange={(e) => handleRowChange(idx, 'unitCost', e.target.value)}
                        className="h-9 text-xs text-right font-mono"
                      />
                    </div>

                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="p-2 text-danger hover:bg-red-50 rounded-md transition-colors"
                        title="Hapus baris"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Catatan Penerimaan */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Catatan / Referensi Supplier (Opsional)</label>
            <input
              type="text"
              placeholder="Contoh: Faktur No. INV-2026/09/001 dari PT Dentalindo"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-white px-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
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
            >
              Simpan Penerimaan
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

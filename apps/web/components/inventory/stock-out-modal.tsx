'use client';

import React, { useState } from 'react';
import { fetchApi, ApiError } from '@/lib/api-client';
import { sanitizeDigits } from '@/lib/format/currency';
import { StockItem, StockOutReason } from './inventory-types';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Plus, Trash2, X, PackageMinus, AlertTriangle } from 'lucide-react';

interface StockOutModalProps {
  open: boolean;
  branchId?: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  availableItems: StockItem[];
}

interface StockOutRow {
  itemId: string;
  quantity: string;
  reasonType: StockOutReason;
}

export function StockOutModal({
  open,
  branchId,
  onOpenChange,
  onSuccess,
  availableItems,
}: StockOutModalProps) {
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<StockOutRow[]>([
    { itemId: '', quantity: '1', reasonType: 'MANUAL_ADJUSTMENT' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleAddRow = () => {
    setRows([
      ...rows,
      { itemId: '', quantity: '1', reasonType: 'MANUAL_ADJUSTMENT' },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleRowChange = (
    index: number,
    field: keyof StockOutRow,
    value: string
  ) => {
    const updated = [...rows];
    const currentRow = updated[index];
    if (!currentRow) return;

    if (field === 'quantity') {
      const sanitized = sanitizeDigits(value);
      currentRow.quantity = sanitized;
    } else if (field === 'reasonType') {
      currentRow.reasonType = value as StockOutReason;
    } else {
      currentRow.itemId = value;
    }

    setRows(updated);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validasi baris kosong
    const invalidRow = rows.find(
      (r) => !r.itemId || !r.quantity || parseInt(r.quantity, 10) <= 0
    );
    if (invalidRow) {
      setError('Pastikan semua baris bahan terpilih dan jumlah lebih dari 0.');
      return;
    }

    // Validasi ketersediaan stok lokal
    for (const r of rows) {
      const selected = availableItems.find((it) => it.itemId === r.itemId);
      const requestedQty = parseInt(r.quantity, 10);
      if (selected && requestedQty > selected.quantity) {
        setError(
          `Stok untuk "${selected.name}" tidak mencukupi (tersedia: ${selected.quantity}, diminta: ${requestedQty}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        branchId: branchId || undefined,
        items: rows.map((r) => ({
          itemId: r.itemId,
          quantity: parseInt(r.quantity, 10),
          reasonType: r.reasonType,
        })),
        note: note.trim() || undefined,
      };

      await fetchApi('/api/v1/inventory/stock-out', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Reset state
      setRows([{ itemId: '', quantity: '1', reasonType: 'MANUAL_ADJUSTMENT' }]);
      setNote('');
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'INSUFFICIENT_STOCK') {
          setError(`Gagal: Stok fisik tidak mencukupi. ${err.message}`);
        } else {
          setError(err.message || 'Gagal memproses pengeluaran stok');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat memproses pengeluaran stok');
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
            <div className="p-2 rounded-lg bg-danger-bg text-danger-icon">
              <PackageMinus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Catat Pengeluaran Bahan (Stock Out)
              </h3>
              <p className="text-[11px] text-muted">
                Pencatatan pemakaian klinik, kerusakan, atau kadaluwarsa bahan medis
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
              <label className="text-xs font-semibold text-slate-700">
                Daftar Bahan &amp; Alasan Pengeluaran
              </label>
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
              {rows.map((row, idx) => {
                const selectedItem = availableItems.find(
                  (it) => it.itemId === row.itemId
                );
                const isOverStock =
                  selectedItem &&
                  parseInt(row.quantity, 10) > selectedItem.quantity;

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-border bg-slate-50/60 space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {/* Pilih Bahan */}
                      <div className="flex-1 min-w-[180px]">
                        <select
                          required
                          value={row.itemId}
                          onChange={(e) =>
                            handleRowChange(idx, 'itemId', e.target.value)
                          }
                          className="w-full h-8 rounded border border-border bg-white px-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                          <option value="">-- Pilih Bahan Medis --</option>
                          {availableItems.map((it) => (
                            <option key={it.itemId} value={it.itemId}>
                              {it.name} ({it.sku}) - Stok: {it.quantity} {it.unit}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Jumlah Keluar */}
                      <div className="w-24 shrink-0">
                        <input
                          type="text"
                          required
                          placeholder="Jumlah"
                          value={row.quantity}
                          onChange={(e) =>
                            handleRowChange(idx, 'quantity', e.target.value)
                          }
                          className="w-full h-8 rounded border border-border bg-white px-2 text-xs text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>

                      {/* Dropdown Alasan */}
                      <div className="w-48 shrink-0">
                        <select
                          value={row.reasonType}
                          onChange={(e) =>
                            handleRowChange(idx, 'reasonType', e.target.value)
                          }
                          className="w-full h-8 rounded border border-border bg-white px-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                          <option value="MANUAL_ADJUSTMENT">
                            Pemakaian / Koreksi
                          </option>
                          <option value="DAMAGE">Barang Rusak</option>
                          <option value="EXPIRED">Kadaluwarsa</option>
                        </select>
                      </div>

                      {/* Hapus Baris */}
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        disabled={rows.length === 1}
                        className="p-1.5 rounded text-muted hover:text-danger-text hover:bg-slate-200 disabled:opacity-30 transition-colors self-center"
                        title="Hapus baris"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Warning Stok Kurang */}
                    {isOverStock && (
                      <div className="flex items-center gap-1.5 text-[11px] text-danger-text font-medium bg-danger-bg p-1.5 rounded border border-danger-border">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>
                          Jumlah ({row.quantity}) melebihi saldo stok yang tersedia ({selectedItem?.quantity} {selectedItem?.unit}).
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Catatan Tambahan (Opsional) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Catatan Pengeluaran (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Pemakaian tindakan bedah mulut drg. Andi / Rusak saat handling..."
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
              variant="destructive"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 font-semibold"
            >
              <PackageMinus className="h-4 w-4" />
              <span>{isSubmitting ? 'Memproses...' : 'Simpan Stock Out'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

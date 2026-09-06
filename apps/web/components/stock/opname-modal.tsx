'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StockItem } from './stock-types';
import { fetchApi } from '@/lib/api-client';
import {
  ClipboardCheck,
  Search,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

interface OpnameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: StockItem[];
  branchId: string;
  onSuccess: () => void;
}

interface OpnameRow {
  productId: string;
  sku: string | null;
  name: string;
  category: string;
  unit: string;
  systemQty: number;
  physicalQty: number;
  note: string;
}

export function OpnameModal({
  open,
  onOpenChange,
  items,
  branchId,
  onSuccess,
}: OpnameModalProps) {
  const [rows, setRows] = useState<OpnameRow[]>([]);
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Inisialisasi baris saat modal dibuka atau list items diperbarui
  useEffect(() => {
    if (open) {
      setRows(
        items.map((item) => ({
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          category: item.category,
          unit: item.unit,
          systemQty: item.quantity,
          physicalQty: item.quantity,
          note: '',
        }))
      );
      setSearch('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [open, items]);

  const handlePhysicalQtyChange = (productId: string, val: string) => {
    const parsed = val === '' ? 0 : parseInt(val, 10);
    if (isNaN(parsed) || parsed < 0) return;

    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, physicalQty: parsed } : r))
    );
    setErrorMessage(null);
  };

  const handleNoteChange = (productId: string, val: string) => {
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, note: val } : r))
    );
  };

  const handleResetToSystem = (productId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.productId === productId ? { ...r, physicalQty: r.systemQty, note: '' } : r
      )
    );
  };

  // Filtered rows berdasarkan pencarian
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.sku && r.sku.toLowerCase().includes(q)) ||
        r.category.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Hitung jumlah baris yang mengalami selisih
  const changedRows = useMemo(() => {
    return rows.filter((r) => r.physicalQty !== r.systemQty);
  }, [rows]);

  const handleSubmit = async () => {
    if (changedRows.length === 0) return;
    if (!branchId) {
      setErrorMessage('Cabang belum dipilih');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Eksekusi mutasi ADJUSTMENT berurutan untuk setiap produk yang berselisih
      for (const row of changedRows) {
        await fetchApi('/api/v1/stock/mutation', {
          method: 'POST',
          body: JSON.stringify({
            productId: row.productId,
            branchId,
            type: 'ADJUSTMENT',
            qty: row.physicalQty,
            note: row.note.trim() ? `Opname: ${row.note.trim()}` : 'Penyesuaian stok fisik opname',
          }),
        });
      }

      setSuccessMessage(`Berhasil memperbarui stok ${changedRows.length} item.`);
      onSuccess();
      setTimeout(() => {
        onOpenChange(false);
      }, 1200);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Terjadi kesalahan saat memproses stok opname.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-4xl max-h-[90vh] flex flex-col p-6">
      <DialogHeader className="pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-teal-50 border border-teal-200 text-primary">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Stock Opname Fisik
            </DialogTitle>
            <DialogDescription className="text-xs text-muted">
              Cocokkan stok fisik di lapangan dengan data sistem. Selisih akan dicatat sebagai mutasi penyesuaian (ADJUSTMENT).
            </DialogDescription>
          </div>
        </div>
        <DialogClose onClose={() => onOpenChange(false)} />
      </DialogHeader>

      {/* Toolbar Pencarian */}
      <div className="pt-3 pb-2 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari item dalam formulir opname..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="text-xs text-muted shrink-0 font-medium">
          {changedRows.length} dari {rows.length} item berselisih
        </div>
      </div>

      {/* Pesan Feedback */}
      {errorMessage && (
        <div className="mb-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-danger-text flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-danger-text" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="mb-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tabel Opname */}
      <div className="flex-1 overflow-y-auto border border-border rounded-lg min-h-[300px]">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-border sticky top-0 z-10 text-muted font-medium text-left">
            <tr>
              <th className="py-2.5 px-3">Produk / SKU</th>
              <th className="py-2.5 px-2 text-center w-24">Stok Sistem</th>
              <th className="py-2.5 px-2 text-center w-28">Stok Fisik</th>
              <th className="py-2.5 px-2 text-center w-24">Selisih</th>
              <th className="py-2.5 px-3">Catatan / Alasan</th>
              <th className="py-2.5 px-2 text-center w-12">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  Tidak ada item yang sesuai dengan pencarian.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const diff = row.physicalQty - row.systemQty;
                const hasDiff = diff !== 0;

                return (
                  <tr
                    key={row.productId}
                    className={`transition-colors ${
                      hasDiff ? 'bg-amber-50/40' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="py-2 px-3">
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {row.sku && (
                          <span className="font-mono text-[11px] text-muted">
                            {row.sku}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-600 border border-slate-200">
                          {row.category}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center font-medium text-foreground">
                      {row.systemQty}{' '}
                      <span className="text-[11px] text-muted">{row.unit}</span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={row.physicalQty}
                        onChange={(e) =>
                          handlePhysicalQtyChange(row.productId, e.target.value)
                        }
                        disabled={isSubmitting}
                        className="w-20 px-2 py-1 text-xs text-center font-semibold bg-surface border border-border rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      {diff === 0 ? (
                        <span className="text-muted font-medium">-</span>
                      ) : diff > 0 ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ArrowUpRight className="h-3 w-3" />+{diff}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-danger-text border border-red-200">
                          <ArrowDownLeft className="h-3 w-3" />
                          {diff}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.note}
                        onChange={(e) => handleNoteChange(row.productId, e.target.value)}
                        placeholder="Contoh: Barang rusak / selisih hitung"
                        disabled={isSubmitting}
                        className="w-full px-2 py-1 text-xs bg-surface border border-border rounded-md placeholder:text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      {hasDiff && (
                        <button
                          type="button"
                          onClick={() => handleResetToSystem(row.productId)}
                          disabled={isSubmitting}
                          title="Reset ke stok sistem"
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Modal */}
      <div className="pt-4 mt-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-muted">
          {changedRows.length > 0 ? (
            <span className="font-semibold text-amber-700">
              {changedRows.length} produk akan disesuaikan stoknya ke sistem.
            </span>
          ) : (
            <span>Semua stok fisik sama dengan stok sistem (tidak ada selisih).</span>
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none"
          >
            Tutup
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || changedRows.length === 0}
            className="flex-1 sm:flex-none"
          >
            {isSubmitting
              ? 'Menyimpan Penyesuaian...'
              : `Terapkan Opname (${changedRows.length})`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

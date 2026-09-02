import React, { useState } from 'react';
import { fetchApi } from '@/lib/api-client';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { sanitizeDigits } from '@/lib/format/currency';
import { StockOpnameDetail, StockOpnameItemDetail } from './inventory-types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/placeholder';
import {
  ClipboardCheck,
  Save,
  CheckCircle2,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Minus,
  Lock,
  Calendar,
  Building2,
} from 'lucide-react';

interface OpnameFormProps {
  initialData: StockOpnameDetail;
  onRefresh: () => void;
}

export function OpnameForm({ initialData, onRefresh }: OpnameFormProps) {
  const isReadOnly = initialData.status === 'SUBMITTED';

  // State local items
  const [items, setItems] = useState<StockOpnameItemDetail[]>(initialData.items);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePhysicalQtyChange = (index: number, val: string) => {
    if (isReadOnly) return;
    const sanitized = sanitizeDigits(val);
    const parsed = sanitized === '' ? 0 : parseInt(sanitized, 10);

    const updated = [...items];
    const item = updated[index];
    if (item) {
      item.physicalQty = parsed;
      item.difference = parsed - item.systemQty;
    }
    setItems(updated);
    setError(null);
    setSuccessMessage(null);
  };

  const handleNoteChange = (index: number, val: string) => {
    if (isReadOnly) return;
    const updated = [...items];
    const item = updated[index];
    if (item) {
      item.note = val;
    }
    setItems(updated);
  };

  // Validasi stok negatif sebelum submit
  const hasNegativeStockRow = items.some((it) => it.physicalQty < 0);

  // Total selisih & item terpengaruh
  const changedItemsCount = items.filter((it) => it.difference !== 0).length;

  const handleSaveDraft = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSavingDraft(true);

    try {
      const payload = {
        items: items.map((it) => ({
          itemId: it.itemId,
          physicalQty: it.physicalQty,
          note: it.note || undefined,
        })),
      };

      await fetchApi(`/api/v1/stock-opnames/${initialData.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setSuccessMessage('Draf stock opname berhasil disimpan.');
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Gagal menyimpan draf stock opname.');
      }
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmitFinal = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      // 1. Simpan perubahan terakhir dulu via PATCH
      const patchPayload = {
        items: items.map((it) => ({
          itemId: it.itemId,
          physicalQty: it.physicalQty,
          note: it.note || undefined,
        })),
      };

      await fetchApi(`/api/v1/stock-opnames/${initialData.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patchPayload),
      });

      // 2. Eksekusi submit final
      await fetchApi(`/api/v1/stock-opnames/${initialData.id}/submit`, {
        method: 'POST',
      });

      setShowConfirmModal(false);
      setSuccessMessage('Stock opname berhasil difinalisasi. Mutasi stok telah diterapkan.');
      onRefresh();
    } catch (err: unknown) {
      setShowConfirmModal(false);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Gagal memproses finalisasi stock opname.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary Card */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary-soft">
                  SESI OPNAME
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isReadOnly
                      ? 'bg-teal-50 text-teal-800 border border-teal-300'
                      : 'bg-amber-50 text-amber-800 border border-amber-300'
                  }`}
                >
                  {isReadOnly ? <Lock className="h-3 w-3" /> : null}
                  <span>{initialData.status}</span>
                </span>
              </div>
              <h1 className="text-xl font-bold text-foreground">
                Stock Opname: {formatDate(initialData.opnameDate)}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted pt-1">
                <div className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-slate-500" />
                  <span>{initialData.branchName} ({initialData.branchCode})</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  <span>Dibuat: {formatDateTime(initialData.createdAt)}</span>
                </div>
                {initialData.submittedAt && (
                  <div className="flex items-center gap-1 text-teal-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Finalisasi: {formatDateTime(initialData.submittedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Buttons (Only for DRAFT) */}
            {!isReadOnly && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleSaveDraft}
                  isLoading={isSavingDraft}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>Simpan Draf</span>
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isSavingDraft || isSubmitting || hasNegativeStockRow}
                  className="flex items-center gap-1.5"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span>Finalisasi &amp; Submit</span>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Banner Feedback */}
      {error && <ErrorBanner title="Peringatan Opname" message={error} />}
      {successMessage && (
        <div className="p-4 rounded-lg bg-success-bg text-success-text border border-green-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success-icon flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Warning jika ada stok negatif */}
      {hasNegativeStockRow && !isReadOnly && (
        <div className="p-3.5 rounded-lg bg-danger-bg text-danger-text border border-red-200 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-danger-text flex-shrink-0" />
          <span>
            Terdapat baris item dengan jumlah fisik kurang dari 0. Perbaiki data sebelum memfinalisasi.
          </span>
        </div>
      )}

      {/* Table Items Opname */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-slate-50 flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-700">
            Daftar Item Opname ({items.length} item)
          </div>
          <div className="text-xs text-muted">
            Item Selisih: <span className="font-bold text-foreground">{changedItemsCount}</span> dari {items.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-border text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Tipe</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Nama Item</th>
                <th className="py-3 px-4 text-right">Stok Sistem</th>
                <th className="py-3 px-4 text-right">Stok Fisik</th>
                <th className="py-3 px-4 text-right">Selisih</th>
                <th className="py-3 px-4">Keterangan / Alasan Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item, idx) => {
                const isDiff = item.difference !== 0;
                const isPositive = item.difference > 0;
                const isInvalidNegativeStock = item.physicalQty < 0;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      isInvalidNegativeStock ? 'bg-red-50/50' : isDiff ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-medium text-[11px] ${
                          item.itemType === 'PRODUCT'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {item.itemType === 'PRODUCT' ? 'PRODUK' : 'BAHAN'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {item.sku}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-600 whitespace-nowrap">
                      {item.systemQty} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {isReadOnly ? (
                        <span className="font-mono font-bold text-foreground">
                          {item.physicalQty} {item.unit}
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={item.physicalQty}
                            onChange={(e) => handlePhysicalQtyChange(idx, e.target.value)}
                            className="w-20 h-8 px-2 text-right font-mono font-bold text-xs rounded-md border border-border bg-white text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                          <span className="text-muted text-[11px]">{item.unit}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                      {!isDiff ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                          <Minus className="h-3 w-3 inline" /> 0 {item.unit}
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs ${
                            isPositive
                              ? 'bg-success-bg text-success-text'
                              : 'bg-danger-bg text-danger-text'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDownLeft className="h-3 w-3 inline" />
                          )}
                          {isPositive ? `+${item.difference}` : item.difference} {item.unit}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isReadOnly ? (
                        <span className="text-slate-600">{item.note || '-'}</span>
                      ) : (
                        <input
                          type="text"
                          placeholder="Catatan selisih..."
                          value={item.note || ''}
                          onChange={(e) => handleNoteChange(idx, e.target.value)}
                          className="w-full h-8 px-2 text-xs rounded-md border border-border bg-white text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-warning-icon">
              <div className="p-2.5 rounded-full bg-warning-bg">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Konfirmasi Finalisasi Stock Opname
                </h3>
                <p className="text-xs text-muted">Aksi ini bersifat permanen dan ireversibel.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Anda akan memfinalisasi stock opname untuk tanggal{' '}
              <strong className="text-foreground">{formatDate(initialData.opnameDate)}</strong>.
              Sistem akan secara otomatis membuat mutasi pergerakan stok penyesuaian (
              <strong className="text-foreground">{changedItemsCount} item selisih</strong>) dan mengunci sesi ini.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmitFinal}
                isLoading={isSubmitting}
              >
                Ya, Finalisasi &amp; Kunci
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

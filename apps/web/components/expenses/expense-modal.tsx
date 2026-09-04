'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
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
import { Upload, X, AlertCircle, FileText } from 'lucide-react';
import { EXPENSE_CATEGORIES, type ExpenseCategoryType } from '@/lib/validations/expense.schema';

interface ExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner: boolean;
  activeBranchId: string | null;
  branches?: Array<{ id: string; code: string; name: string }>;
}

export function ExpenseModal({
  open,
  onOpenChange,
  isOwner,
  activeBranchId,
  branches = [],
}: ExpenseModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ambil data cabang aktif jika user adalah OWNER
  const { data: branchRes } = useQuery<ApiResponse<Array<{ id: string; name: string; code: string }>>>({
    queryKey: ['branches', 'active'],
    queryFn: () => fetchApi<Array<{ id: string; name: string; code: string }>>('/api/v1/branches?active=true'),
    enabled: isOwner,
  });

  const branchList = isOwner ? (branchRes?.data || branches) : branches;

  // Today in YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0] ?? '';

  const [branchId, setBranchId] = useState<string>(isOwner ? '' : (activeBranchId || ''));
  const [category, setCategory] = useState<ExpenseCategoryType>('OPERASIONAL');
  const [amount, setAmount] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(todayStr);
  const [note, setNote] = useState<string>('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle file select & upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Hanya file gambar (JPEG, PNG, WEBP, GIF) yang diperbolehkan');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Ukuran file tidak boleh melebihi 2MB');
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);
    setUploadFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetchApi<{ url: string }>('/api/v1/uploads/expense-proof', {
        method: 'POST',
        body: formData,
      });

      if (res.data?.url) {
        setProofUrl(res.data.url);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah bukti nota';
      setErrorMessage(msg);
      setUploadFileName(null);
      setProofUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const removeProof = () => {
    setProofUrl(null);
    setUploadFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Mutation create expense
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: {
        branchId?: string;
        category: ExpenseCategoryType;
        amount: string;
        expenseDate: string;
        note: string;
        proofUrl?: string | null;
      } = {
        category,
        amount,
        expenseDate,
        note: note.trim(),
        proofUrl: proofUrl || null,
      };

      if (isOwner && branchId) {
        payload.branchId = branchId;
      }

      return fetchApi('/api/v1/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cash-closings'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || 'Gagal mencatat pengeluaran');
    },
  });

  const resetForm = useCallback(() => {
    setBranchId(isOwner ? '' : (activeBranchId || ''));
    setCategory('OPERASIONAL');
    setAmount('');
    setExpenseDate(todayStr);
    setNote('');
    setProofUrl(null);
    setUploadFileName(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [isOwner, activeBranchId, todayStr]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isOwner && !branchId) {
      setErrorMessage('Cabang wajib dipilih untuk pencatatan pengeluaran');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Jumlah pengeluaran harus lebih besar dari 0');
      return;
    }

    if (!note.trim()) {
      setErrorMessage('Catatan pengeluaran wajib diisi');
      return;
    }

    if (expenseDate > todayStr) {
      setErrorMessage('Tanggal pengeluaran tidak boleh di masa depan');
      return;
    }

    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Catat Pengeluaran Baru</DialogTitle>
        <DialogDescription>
          Pencatatan biaya operasional klinik. Bersifat final dan terekam ke audit log.
        </DialogDescription>
        <DialogClose onClose={() => onOpenChange(false)} />
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMessage && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-danger-bg border border-red-200 text-danger-text text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Cabang (Hanya OWNER) */}
        {isOwner && (
          <div className="space-y-1.5">
            <label htmlFor="expense-branch" className="block text-sm font-medium text-foreground">
              Cabang <span className="text-danger-text">*</span>
            </label>
            <select
              id="expense-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-hidden focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-primary-soft"
              required
            >
              <option value="">Pilih Cabang</option>
              {branchList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Kategori Pengeluaran */}
        <div className="space-y-1.5">
          <label htmlFor="expense-category" className="block text-sm font-medium text-foreground">
            Kategori Pengeluaran
          </label>
          <select
            id="expense-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategoryType)}
            className="flex h-10 w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-hidden focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-primary-soft"
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Nominal Pengeluaran */}
        <div>
          <Input
            id="expense-amount"
            label="Nominal Pengeluaran"
            type="number"
            min="1"
            step="any"
            placeholder="0"
            prefix="Rp"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        {/* Tanggal Pengeluaran */}
        <div>
          <Input
            id="expense-date"
            label="Tanggal Pengeluaran"
            type="date"
            max={todayStr}
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
          />
        </div>

        {/* Catatan / Keterangan */}
        <div className="space-y-1.5">
          <label htmlFor="expense-note" className="block text-sm font-medium text-foreground">
            Catatan / Keperluan
          </label>
          <textarea
            id="expense-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Misal: Pembelian cairan desinfektan dan tisu medis"
            className="flex w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-slate-400 focus-visible:outline-hidden focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
            required
          />
        </div>

        {/* Bukti Nota / Kuitansi (Upload) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Bukti Nota / Kuitansi (Opsional, Maks 2MB)
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
            id="proof-upload-input"
          />

          {!proofUrl && !uploadFileName ? (
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-300 hover:border-primary rounded-lg p-4 flex flex-col items-center justify-center gap-1.5 text-muted hover:text-primary transition-colors bg-slate-50/50"
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs font-medium">
                {isUploading ? 'Sedang mengunggah...' : 'Pilih file gambar bukti nota'}
              </span>
              <span className="text-[11px] text-slate-400">JPG, PNG, WEBP maks 2MB</span>
            </button>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="text-xs font-medium text-slate-700 truncate">
                  {uploadFileName || 'bukti-pengeluaran.jpg'}
                </span>
              </div>
              <button
                type="button"
                onClick={removeProof}
                className="p-1 text-slate-400 hover:text-danger-text transition-colors rounded-sm"
                aria-label="Hapus bukti"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending || isUploading}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={createMutation.isPending || isUploading}
            disabled={createMutation.isPending || isUploading}
          >
            Simpan Pengeluaran
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteMasterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  title: string;
  itemLabel: string;
  isSubmitting: boolean;
}

export function DeleteMasterModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  itemLabel,
  isSubmitting,
}: DeleteMasterModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-danger-text">
            <div className="p-2 rounded-lg bg-danger-bg text-danger-icon">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">{title}</h3>
              <p className="text-[11px] text-muted">Konfirmasi Penghapusan Data Master</p>
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

        <div className="space-y-2 text-xs text-slate-700">
          <p>
            Apakah Anda yakin ingin menghapus data <strong>&quot;{itemLabel}&quot;</strong>?
          </p>
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
            <p className="font-semibold">Ketentuan Penghapusan:</p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800">
              <li>Item yang <strong>sudah pernah ditransaksikan</strong> akan diarsipkan (soft-delete) untuk menjaga integritas riwayat.</li>
              <li>Item yang <strong>belum pernah digunakan</strong> akan dihapus permanen.</li>
            </ul>
          </div>
        </div>

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
            type="button"
            variant="destructive"
            size="md"
            onClick={onConfirm}
            isLoading={isSubmitting}
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            <span>Hapus Data</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

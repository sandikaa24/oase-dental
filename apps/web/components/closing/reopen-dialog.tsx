'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';

interface ReopenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
  isLoading: boolean;
}

/**
 * Dialog reopen closing — hanya dirender untuk OWNER.
 * Validasi reason minimal 10 karakter (sesuai API-CONTRACT §12).
 * §23: Error inline di field, bukan alert().
 */
export function ReopenDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: ReopenDialogProps) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  function handleClose() {
    if (!isLoading) {
      onOpenChange(false);
      setReason('');
      setReasonError('');
    }
  }

  async function handleConfirm() {
    if (reason.trim().length < 10) {
      setReasonError('Alasan harus minimal 10 karakter');
      return;
    }
    setReasonError('');
    await onConfirm(reason.trim());
    setReason('');
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogHeader>
        <DialogClose onClose={handleClose} />
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-warning-bg text-warning-icon">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>Buka Kembali Closing Kas</DialogTitle>
        </div>
        <DialogDescription>
          Tindakan ini akan mengembalikan status kas ke <strong>TERBUKA</strong>.
          Hanya OWNER yang bisa melakukan tindakan ini dan akan dicatat di audit log.
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        <div className="space-y-1">
          <label htmlFor="reopen-reason" className="text-sm font-medium text-foreground">
            Alasan Pembukaan Kembali <span className="text-danger-text">*</span>
          </label>
          <textarea
            id="reopen-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError && e.target.value.trim().length >= 10) {
                setReasonError('');
              }
            }}
            rows={3}
            placeholder="Jelaskan alasan membuka kembali closing ini (minimal 10 karakter)..."
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          />
          {reasonError && (
            <p className="text-xs text-danger-text font-medium">{reasonError}</p>
          )}
          <p className="text-xs text-muted">{reason.length} karakter (min 10)</p>
        </div>
      </div>

      <DialogFooter>
        <Button
          id="cancel-reopen-btn"
          variant="secondary"
          onClick={handleClose}
          disabled={isLoading}
        >
          Batal
        </Button>
        <Button
          id="confirm-reopen-btn"
          variant="primary"
          onClick={handleConfirm}
          disabled={isLoading || reason.trim().length < 10}
          className="gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Membuka...
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4" />
              Buka Kembali
            </>
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

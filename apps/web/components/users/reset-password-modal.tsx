'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
import { User } from './user-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/placeholder';
import { KeyRound, X, Check, Eye, EyeOff, ShieldAlert } from 'lucide-react';

interface ResetPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
  user: User | null;
}

export function ResetPasswordModal({
  open,
  onOpenChange,
  onSuccess,
  user,
}: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNewPassword('');
      setShowPassword(false);
      setError(null);
    }
  }, [open]);

  if (!open || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 8) {
      setError('Password baru minimal harus 8 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      await fetchApi(`/api/v1/users/${user.id}/reset-password`, {
        method: 'PATCH',
        body: JSON.stringify({
          newPassword,
        }),
      });
      onSuccess(`Password untuk akun "${user.email}" berhasil di-reset.`);
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat mereset password.');
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
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Reset Password Akun</h3>
              <p className="text-[11px] text-muted">Akun: {user.email} ({user.role})</p>
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
          {error && <ErrorBanner title="Gagal Reset Password" message={error} />}

          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span>Peringatan Keamanan:</span>
            </div>
            <p>
              Mereset password akan <strong>secara otomatis merevoke seluruh sesi aktif</strong> akun ini di semua browser &amp; perangkat. Pengguna wajib login ulang dengan password baru ini.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Password Baru *</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="Minimal 8 karakter"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-9 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-0.5 rounded"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
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
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              className="gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Reset &amp; Revoke Sesi</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

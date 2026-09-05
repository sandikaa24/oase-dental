'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchApi } from '@/lib/api-client';
import { User, Employee, UserRole } from './user-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Users, X, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface UserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
  user: User | null;
  employees: Employee[];
}

export function UserModal({
  open,
  onOpenChange,
  onSuccess,
  user,
  employees,
}: UserModalProps) {
  const isEditing = !!user;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('CASHIER');
  const [employeeId, setEmployeeId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter karyawan aktif yang belum punya akun user (atau karyawan milik user yang sedang diedit)
  // Memoized agar referensi array stabil dan tidak memicu reset form pada setiap keystroke
  const candidateEmployees = useMemo(
    () =>
      employees.filter(
        (emp) => emp.active && (!emp.user || (isEditing && user?.employeeId === emp.id))
      ),
    [employees, isEditing, user?.employeeId]
  );

  useEffect(() => {
    if (open) {
      setError(null);
      setPassword('');
      setShowPassword(false);
      if (user) {
        setEmail(user.email);
        setRole(user.role);
        setEmployeeId(user.employeeId || '');
      } else {
        setEmail('');
        setRole('CASHIER');
        // Default selection: otomatis memilih karyawan kandidat pertama yang aktif & belum punya akun
        setEmployeeId(candidateEmployees[0]?.id || '');
      }
    }
  }, [open, user, candidateEmployees]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email tidak boleh kosong.');
      return;
    }

    if (role !== 'OWNER' && !employeeId) {
      setError('Pilih data profil karyawan yang terhubung untuk role non-OWNER.');
      return;
    }

    if (!isEditing && (!password || password.length < 8)) {
      setError('Password akun baru minimal harus 8 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && user) {
        const payload: Record<string, unknown> = {
          email: trimmedEmail,
        };
        // Perubahan role hanya jika bukan OWNER ke/dari
        if (user.role !== 'OWNER' && role !== 'OWNER') {
          payload.role = role;
        }
        if (role !== 'OWNER') {
          payload.employeeId = employeeId || null;
        }

        await fetchApi(`/api/v1/users/${user.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onSuccess('Data akun pengguna berhasil diperbarui');
      } else {
        const payload = {
          email: trimmedEmail,
          password,
          role,
          employeeId: role === 'OWNER' ? undefined : employeeId,
        };

        await fetchApi('/api/v1/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onSuccess('Akun pengguna baru berhasil dibuat');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat menyimpan akun pengguna.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isEditing ? 'Edit Akun Pengguna' : 'Tambah Akun Pengguna Baru'}
              </h3>
              <p className="text-[11px] text-muted">Akun Autentikasi &amp; Akses Role Sistem</p>
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

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && <ErrorBanner title="Gagal Menyimpan" message={error} />}

          {/* Role Selection */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>Peran Akun Sistem (Role) *</span>
            </label>
            <select
              value={role}
              disabled={isEditing && user?.role === 'OWNER'}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full h-9 px-3 rounded-md border border-border bg-white text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none disabled:bg-slate-100 disabled:text-muted"
            >
              <option value="CASHIER">CASHIER (Kasir Operasional)</option>
              <option value="MANAGER">MANAGER (Manager Cabang)</option>
              <option value="EMPLOYEE">EMPLOYEE (Staf Medis / Dokter / Perawat)</option>
              <option value="OWNER">OWNER (Pemilik Klinik - Akses Global Penuh)</option>
            </select>
          </div>

          {/* Employee Link (hanya jika role non-OWNER) */}
          {role !== 'OWNER' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Pilih Karyawan Terhubung *</label>
              {candidateEmployees.length === 0 ? (
                <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                  Tidak ada data karyawan aktif yang belum memiliki akun. Silakan tambah data karyawan terlebih dahulu di tab <strong>Data Karyawan</strong>.
                </div>
              ) : (
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-border bg-white text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {candidateEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.position}) — Cabang:{' '}
                      {emp.branches.filter((b) => b.active).map((b) => b.branch.code).join(', ') || 'Belum ditugaskan'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Email Login */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Alamat Email Login *</label>
            <Input
              type="email"
              required
              placeholder="nama@oase.id"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              className="text-xs"
            />
          </div>

          {/* Password (hanya saat create baru) */}
          {!isEditing && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Password Awal *</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  placeholder="Minimal 8 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-0.5 rounded"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
              <span>{isEditing ? 'Simpan Perubahan' : 'Buat Akun Pengguna'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

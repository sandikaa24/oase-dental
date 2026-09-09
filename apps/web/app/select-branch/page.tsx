'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isMultiBranchUser } from '@/lib/auth';
import { fetchApi } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoleBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/placeholder';
import {
  Sparkles,
  Building2,
  Globe,
  CheckCircle2,
  LogOut,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchItem {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  active?: boolean;
}

export default function SelectBranchPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, selectBranch, logout } = useAuth();

  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [remember, setRemember] = useState<boolean>(false);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Guard: Pengalihan bila sesi belum siap atau user single-branch
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
        return;
      }
      if (!isMultiBranchUser(user)) {
        // User terikat 1 cabang langsung masuk tanpa langkah pilih cabang
        router.replace('/admin');
      }
    }
  }, [user, authLoading, router]);

  // Load daftar cabang: OWNER mengambil semua cabang aktif, non-OWNER dari user.branches
  useEffect(() => {
    if (!user) return;

    if (user.role === 'OWNER') {
      setIsLoadingBranches(true);
      fetchApi<BranchItem[]>('/api/v1/branches?active=true&limit=100')
        .then((res) => {
          if (res.success && res.data) {
            setBranches(res.data.filter((b) => b.active !== false));
          }
        })
        .catch(() => {
          setError('Gagal memuat daftar cabang klinik');
        })
        .finally(() => {
          setIsLoadingBranches(false);
        });
    } else {
      setBranches(user.branches || []);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId) {
      setError('Silakan pilih salah satu cabang kerja terlebih dahulu');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await selectBranch(selectedBranchId, remember);
      router.replace('/admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pilihan cabang');
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const isOwner = user.role === 'OWNER';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-xs mb-3">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pilih Cabang Kerja
          </h1>
          <p className="text-xs text-muted mt-1 max-w-sm">
            Tentukan konteks cabang operasional Anda untuk sesi ini. Anda dapat beralih cabang kapan saja melalui switcher.
          </p>
        </div>

        {/* User Persona Chip */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface shadow-xs mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-border shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {user.name || user.email.split('@')[0]}
              </p>
              <p className="text-[11px] text-muted truncate">{user.email}</p>
            </div>
          </div>
          <RoleBadge role={user.role} size="sm" />
        </div>

        <Card className="shadow-xs border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Konteks Cabang Tersedia
            </CardTitle>
            <CardDescription className="text-xs">
              {isOwner
                ? 'Sebagai OWNER, Anda dapat mengelola cabang tertentu atau memilih akses pusat'
                : 'Pilih cabang penempatan tugas Anda untuk memulai aktivitas operasional'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <ErrorBanner
                  title="Perhatian"
                  message={error}
                />
              )}

              {isLoadingBranches ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {/* Pilihan Khusus OWNER: Semua Cabang (Pusat) */}
                  {isOwner && (
                    <label
                      htmlFor="branch-all"
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                        selectedBranchId === 'ALL'
                          ? 'border-primary bg-primary-soft text-foreground ring-1 ring-primary'
                          : 'border-border bg-surface hover:bg-slate-50 text-foreground'
                      )}
                    >
                      <input
                        id="branch-all"
                        type="radio"
                        name="selectedBranch"
                        value="ALL"
                        checked={selectedBranchId === 'ALL'}
                        onChange={() => setSelectedBranchId('ALL')}
                        className="mt-1 h-4 w-4 text-primary focus:ring-primary border-slate-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-xs font-bold truncate">
                            Semua Cabang (Pusat)
                          </span>
                        </div>
                        <p className="text-[11px] text-muted mt-0.5">
                          Akses laporan konsolidasi dan inventaris seluruh cabang klinik
                        </p>
                      </div>
                      {selectedBranchId === 'ALL' && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      )}
                    </label>
                  )}

                  {/* Pilihan Cabang Fisik */}
                  {branches.map((b) => {
                    const isSelected = selectedBranchId === b.id;
                    return (
                      <label
                        key={b.id}
                        htmlFor={`branch-${b.id}`}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                          isSelected
                            ? 'border-primary bg-primary-soft text-foreground ring-1 ring-primary'
                            : 'border-border bg-surface hover:bg-slate-50 text-foreground'
                        )}
                      >
                        <input
                          id={`branch-${b.id}`}
                          type="radio"
                          name="selectedBranch"
                          value={b.id}
                          checked={isSelected}
                          onChange={() => setSelectedBranchId(b.id)}
                          className="mt-1 h-4 w-4 text-primary focus:ring-primary border-slate-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
                            <span className="text-xs font-semibold truncate">
                              {b.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 font-mono bg-slate-100 text-slate-600 rounded">
                              {b.code}
                            </span>
                          </div>
                          {b.address && (
                            <p className="text-[11px] text-muted mt-0.5 flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{b.address}</span>
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Checkbox Ingat Pilihan Saya */}
              <div className="pt-2 border-t border-border">
                <label
                  htmlFor="remember-device"
                  className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-slate-700"
                >
                  <input
                    id="remember-device"
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span>Ingat pilihan saya di perangkat ini</span>
                </label>
                <p className="text-[11px] text-muted ml-6.5 mt-0.5">
                  Login berikutnya di perangkat ini akan langsung masuk ke cabang ini tanpa interstisial.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  isLoading={isSubmitting}
                  disabled={!selectedBranchId || isSubmitting}
                >
                  Lanjutkan ke Dashboard
                </Button>

                <button
                  type="button"
                  onClick={() => logout()}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs text-muted hover:text-foreground transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Bukan akun Anda? Keluar</span>
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

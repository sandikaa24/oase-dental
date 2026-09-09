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
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Guard: Pengalihan bila belum terautentikasi
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
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
      const assigned = user.branches || [];
      setBranches(assigned);
      // Amandemen D4: Untuk staff 1-cabang, otomatis pilih cabang penugasan tunggal agar siap 1-klik
      if (assigned.length === 1 && assigned[0]) {
        setSelectedBranchId(assigned[0].id);
      }
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
      // Amandemen D4: Remember dimatikan pada alur login (false)
      await selectBranch(selectedBranchId, false);
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
  const isMulti = isMultiBranchUser(user);
  const singleBranch = !isMulti && branches.length === 1 ? branches[0] : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-xs mb-3">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isMulti ? 'Pilih Cabang Kerja' : 'Konfirmasi Cabang Kerja'}
          </h1>
          <p className="text-xs text-muted mt-1 max-w-sm">
            {isMulti
              ? 'Tentukan konteks cabang operasional Anda untuk sesi ini. Anda dapat beralih cabang kapan saja melalui switcher.'
              : 'Konfirmasikan penugasan cabang kerja Anda untuk memulai aktivitas operasional klinik.'}
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
              {isMulti ? 'Konteks Cabang Tersedia' : 'Penugasan Cabang Anda'}
            </CardTitle>
            <CardDescription className="text-xs">
              {isOwner
                ? 'Sebagai OWNER, Anda dapat mengelola cabang tertentu atau memilih akses pusat'
                : isMulti
                ? 'Pilih salah satu cabang penugasan tugas Anda untuk memulai aktivitas operasional'
                : 'Mulai kerja di cabang yang telah ditugaskan untuk akun Anda'}
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
              ) : isMulti ? (
                /* TAMPILAN A: Multi-Cabang & OWNER (Daftar Kartu Radio) */
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
              ) : singleBranch ? (
                /* TAMPILAN B: 1-Cabang Terdaftar (Kartu Konfirmasi Tunggal 1-Klik) */
                <div className="p-4 rounded-lg border border-primary/30 bg-primary-soft/30 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-muted">Penugasan Terdaftar</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold">
                          {singleBranch.code}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-foreground mt-0.5">
                        Mulai kerja di: {singleBranch.name}
                      </h3>
                      {singleBranch.address && (
                        <p className="text-xs text-muted mt-1 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{singleBranch.address}</span>
                        </p>
                      )}
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  </div>
                  <p className="text-[11px] text-muted border-t border-border/60 pt-2">
                    Sesi kerja Anda akan tercatat di cabang ini untuk operasional kasir, presensi, dan pencatatan transaksi.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-border bg-slate-50 text-center">
                  <p className="text-xs text-muted">
                    Tidak ada cabang aktif yang ditugaskan ke akun Anda. Hubungi administrator.
                  </p>
                </div>
              )}

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
                  {isMulti
                    ? 'Lanjutkan ke Dashboard'
                    : singleBranch
                    ? `Mulai Kerja di ${singleBranch.name}`
                    : 'Konfirmasi Cabang'}
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

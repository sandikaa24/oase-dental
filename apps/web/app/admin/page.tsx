'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { RoleBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';
import { ClosingStatusBadge } from '@/components/closing/closing-status-badge';
import { formatRupiah, formatDate } from '@/lib/formatters';
import {
  ShoppingCart,
  Receipt,
  Package,
  Clock,
  CalendarDays,
  TrendingUp,
  AlertTriangle,
  Users,
  Building2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type { CashierDashboard } from '@/components/closing/closing-types';

export default function AdminDashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const activeBranch = user.branches?.find((b) => b.id === user.activeBranchId) || (user.branches?.length === 1 ? user.branches[0] : undefined);
  const branchName =
    user.role === 'OWNER'
      ? 'Semua Cabang (Akses Pusat)'
      : activeBranch
      ? `${activeBranch.name} (${activeBranch.code})`
      : 'Cabang Utama';

  const todayStr = formatDate(new Date(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Selamat Datang, {user.name || user.email.split('@')[0]}
            </h1>
            <RoleBadge role={user.role} size="sm" />
          </div>
          <p className="text-sm text-muted mt-1">
            {todayStr} &bull; <span className="font-medium text-foreground">{branchName}</span>
          </p>
        </div>
      </div>

      {/* Role-Specific Adaptive Dashboard Content */}
      {user.role === 'CASHIER' && <CashierDashboardView />}
      {user.role === 'MANAGER' && <ManagerDashboardView />}
      {user.role === 'OWNER' && <OwnerDashboardView />}
      {user.role === 'EMPLOYEE' && <EmployeeDashboardView />}
    </div>
  );
}

function CashierDashboardView() {
  // Fetch data real dari /dashboard/cashier
  const { data: dashData, isLoading: dashLoading } = useQuery<ApiResponse<CashierDashboard>>({
    queryKey: ['cashier-dashboard'],
    queryFn: () => fetchApi<CashierDashboard>('/api/v1/dashboard/cashier'),
    staleTime: 30_000,
  });

  const dash = dashData?.data;

  return (
    <div className="space-y-6">
      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:border-teal-300 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Kasir / POS</CardTitle>
              <div className="p-2 rounded-lg bg-primary-soft text-primary">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>
            <CardDescription>Buka transaksi penjualan baru</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/pos">
              <Button variant="primary" size="sm" className="w-full gap-2">
                Buka POS
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-teal-300 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Tutup Kas (Closing)</CardTitle>
              <div className="p-2 rounded-lg bg-warning-bg text-warning-icon">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
            <CardDescription>Rekapitulasi kas harian &amp; closing shift</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/cash-closing">
              <Button variant="secondary" size="sm" className="w-full gap-2">
                Kelola Kas
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Absensi Saya</CardTitle>
              <div className="p-2 rounded-lg bg-info-bg text-info-icon">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <CardDescription>Catat kehadiran hari ini</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/attendance">
              <Button variant="secondary" size="sm" className="w-full gap-2">
                Catat Absen
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards — data real dari /dashboard/cashier */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Transaksi Hari Ini</CardDescription>
            {dashLoading ? (
              <Skeleton className="h-8 w-12 mt-1" />
            ) : (
              <CardTitle className="text-2xl font-bold">{dash?.transactionCount ?? 0}</CardTitle>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">
              {dash?.transactionCount === 0 ? 'Belum ada transaksi hari ini' : 'Semua metode pembayaran'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Omset Hari Ini</CardDescription>
            {dashLoading ? (
              <Skeleton className="h-8 w-32 mt-1" />
            ) : (
              <CardTitle className="text-2xl font-bold text-primary">
                {formatRupiah(dash?.totalRevenue ?? '0')}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">
              Tunai: {formatRupiah(dash?.cashRevenue ?? '0')} ·
              Non-Tunai: {formatRupiah(dash?.debitRevenue ?? '0')}
            </p>
          </CardContent>
        </Card>

        {/* Widget Status Kas — status real + deep-link ke halaman closing */}
        <Link href="/admin/cash-closing" className="block group">
          <Card className="h-full group-hover:border-teal-300 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription>Status Kas</CardDescription>
              <div className="mt-1">
                {dashLoading ? (
                  <Skeleton className="h-6 w-32" />
                ) : (
                  <ClosingStatusBadge status={dash?.closingStatus ?? null} />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted mt-2">
                {dash?.closingStatus === 'CLOSED'
                  ? 'Kas sudah ditutup hari ini — lihat detail'
                  : 'Pastikan input kas fisik sebelum pulang'}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function ManagerDashboardView() {
  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Peringatan Stok Rendah</CardDescription>
              <div className="p-1.5 rounded-md bg-warning-bg text-warning-icon">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-warning-text">0</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">Bahan di bawah batas minimum</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Opname Pending</CardDescription>
              <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">0</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">Perlu verifikasi &amp; submit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Pengajuan Cuti</CardDescription>
              <div className="p-1.5 rounded-md bg-info-bg text-info-icon">
                <CalendarDays className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-info-text">0</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">Menunggu persetujuan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Kehadiran Staf</CardDescription>
              <div className="p-1.5 rounded-md bg-success-bg text-success-icon">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-success-text">0</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">Hadir tepat waktu hari ini</p>
          </CardContent>
        </Card>
      </div>

      {/* Action shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manajemen Inventaris &amp; Stok</CardTitle>
            <CardDescription>Kelola penerimaan stok masuk dan stok opname berkala</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/inventory">
              <Button variant="secondary" size="sm" className="gap-2">
                Buka Inventaris
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Persetujuan Cuti &amp; Izin</CardTitle>
            <CardDescription>Tinjau dan putuskan permohonan cuti staf cabang</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/leaves">
              <Button variant="secondary" size="sm" className="gap-2">
                Tinjau Cuti
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OwnerDashboardView() {
  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Konsolidasi Omset (7 Hari)</CardDescription>
              <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-primary">
              {formatRupiah('0')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">Semua cabang operasional</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Total Cabang Aktif</CardDescription>
              <div className="p-1.5 rounded-md bg-info-bg text-info-icon">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-info-text">2</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">Cabang Utama &amp; Cabang 2</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Total Pengguna</CardDescription>
              <div className="p-1.5 rounded-md bg-role-owner-bg text-role-owner-text">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-role-owner-text">4</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">Owner, Manager, Kasir, Staf</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Status Audit</CardDescription>
              <div className="p-1.5 rounded-md bg-success-bg text-success-icon">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-base font-semibold text-success-text">
              Sistem Normal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">Audit log aktif mencatat aktivitas</p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Laporan Penjualan</CardTitle>
            <CardDescription>Pantau omset, laba kotor, dan metode pembayaran</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/reports">
              <Button variant="secondary" size="sm" className="gap-2">
                Lihat Laporan
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kelola Pengguna</CardTitle>
            <CardDescription>Tambah dan atur akun pengguna &amp; penugasan cabang</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/users">
              <Button variant="secondary" size="sm" className="gap-2">
                Kelola User
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit Trail</CardTitle>
            <CardDescription>Periksa rekam jejak aktivitas operasional klinik</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/audit-logs">
              <Button variant="secondary" size="sm" className="gap-2">
                Buka Audit Log
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmployeeDashboardView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Presensi &amp; Kehadiran</CardTitle>
              <div className="p-2 rounded-lg bg-primary-soft text-primary">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <CardDescription>Catat kehadiran masuk dan keluar shift Anda</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/attendance">
              <Button variant="primary" size="sm" className="gap-2">
                Presensi Sekarang
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pengajuan Cuti &amp; Izin</CardTitle>
              <div className="p-2 rounded-lg bg-info-bg text-info-icon">
                <CalendarDays className="h-5 w-5" />
              </div>
            </div>
            <CardDescription>Ajukan permohonan cuti tahunan atau izin sakit</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/leaves">
              <Button variant="secondary" size="sm" className="gap-2">
                Ajukan Cuti
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

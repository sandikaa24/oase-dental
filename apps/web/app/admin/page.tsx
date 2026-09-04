'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge, RoleBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorBanner } from '@/components/ui/placeholder';
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
  Building2,
  ArrowRight,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import type { CashierDashboard } from '@/components/closing/closing-types';
import type { OwnerDashboardData } from '@/components/reports/reports-types';

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
  const {
    data: ownerResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<OwnerDashboardData>>({
    queryKey: ['owner-dashboard'],
    queryFn: () => fetchApi<OwnerDashboardData>('/api/v1/dashboard/owner'),
    staleTime: 30_000,
  });

  const dash = ownerResponse?.data;
  const branchSummaries = dash?.summary ?? [];
  const sevenDayTrend = dash?.sevenDayTrend ?? dash?.trending ?? [];

  // Hitung total omzet 7 hari dari tren
  const total7DayRevenue = sevenDayTrend.reduce(
    (acc, curr) => acc + Number(curr.revenue || 0),
    0
  );
  // Hitung total transaksi dan omzet hari ini dari seluruh cabang
  const totalTodayTransactions = branchSummaries.reduce(
    (acc, curr) => acc + curr.todayTransactions,
    0
  );
  const totalTodayRevenue = branchSummaries.reduce(
    (acc, curr) => acc + Number(curr.todayRevenue || 0),
    0
  );

  if (isError) {
    return (
      <ErrorBanner
        title="Gagal Memuat Dashboard Eksekutif"
        message={
          error instanceof Error
            ? error.message
            : 'Terjadi kendala saat mengambil data ringkasan klinik'
        }
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omset Hari Ini */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Omset Hari Ini (Konsolidasi)</CardDescription>
              <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : (
              <CardTitle className="text-2xl font-bold text-primary">
                {formatRupiah(totalTodayRevenue.toFixed(2))}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">
              {isLoading
                ? 'Memuat data cabang...'
                : `${totalTodayTransactions} transaksi hari ini (${branchSummaries.length} cabang)`}
            </p>
          </CardContent>
        </Card>

        {/* Konsolidasi Omset 7 Hari */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Konsolidasi Omset (7 Hari)</CardDescription>
              <div className="p-1.5 rounded-md bg-success-bg text-success-icon">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : (
              <CardTitle className="text-2xl font-bold text-success-text">
                {formatRupiah(total7DayRevenue.toFixed(2))}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">Akumulasi tren 7 hari seluruh cabang</p>
          </CardContent>
        </Card>

        {/* Total Cabang Aktif */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Cabang Operasional</CardDescription>
              <div className="p-1.5 rounded-md bg-info-bg text-info-icon">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-12 mt-1" />
            ) : (
              <CardTitle className="text-2xl font-bold text-info-text">
                {branchSummaries.length}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">Terdaftar dan aktif melayani pasien</p>
          </CardContent>
        </Card>

        {/* Status Audit Trail */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Keamanan &amp; Audit Trail</CardDescription>
              <div className="p-1.5 rounded-md bg-role-owner-bg text-role-owner-text">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-base font-semibold text-role-owner-text">
              Aktif &amp; Terlindungi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">Audit log mencatat setiap aksi sistem</p>
          </CardContent>
        </Card>
      </div>

      {/* Ringkasan Kinerja Hari Ini Per Cabang */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Kinerja Hari Ini Per Cabang
          </h2>
          <span className="text-xs text-muted">Realtime data operasional</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : branchSummaries.length === 0 ? (
          <EmptyState
            title="Belum Ada Cabang"
            description="Belum ada data cabang operasional yang aktif."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {branchSummaries.map((branch) => (
              <Card
                key={branch.branchId}
                className="border-border hover:border-teal-300 transition-colors"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-foreground">
                      {branch.branchName}
                    </CardTitle>
                    <Badge variant="primary" size="sm">
                      AKTIF
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    Omzet Hari Ini
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="text-xl font-bold text-primary">
                    {formatRupiah(branch.todayRevenue)}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border text-xs text-muted">
                    <span>Volume transaksi:</span>
                    <span className="font-semibold text-foreground">
                      {branch.todayTransactions} transaksi
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Grafik Trending Omzet 7 Hari (SVG Murni, Zero Dependency) */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Tren Pendapatan 7 Hari Terakhir (Semua Cabang)
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Grafik konsolidasi omzet harian berdasarkan tanggal operasional
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <Skeleton className="h-56 w-full rounded-lg" />
          ) : sevenDayTrend.length === 0 ? (
            <EmptyState
              title="Belum Ada Data Tren"
              description="Data transaksi 7 hari terakhir belum tersedia."
            />
          ) : (
            <SevenDayTrendChart trend={sevenDayTrend} />
          )}
        </CardContent>
      </Card>

      {/* Navigation Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Laporan &amp; Analitik</CardTitle>
            <CardDescription>
              Pantau omset, laba kotor WAC, persediaan, dan biaya operasional
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/reports">
              <Button variant="secondary" size="sm" className="gap-2">
                Buka Laporan
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Kelola Pengguna</CardTitle>
            <CardDescription>
              Tambah dan atur akun pengguna klinik serta penugasan cabang
            </CardDescription>
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

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Audit Trail</CardTitle>
            <CardDescription>
              Periksa rekam jejak aktivitas operasional dan histori login
            </CardDescription>
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

interface TrendPoint {
  date: string;
  revenue: string;
  transactions?: number;
}

function SevenDayTrendChart({ trend }: { trend: TrendPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const values = trend.map((t) => Number(t.revenue || 0));
  const maxVal = Math.max(...values, 1000000); // minimal 1jt agar skala proporsional

  // Dimensi SVG
  const width = 640;
  const height = 200;
  const paddingX = 50;
  const paddingY = 30;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  // Hitung titik koordinat (x, y)
  const points = trend.map((t, idx) => {
    const x = paddingX + (idx / Math.max(trend.length - 1, 1)) * chartWidth;
    const y = height - paddingY - (Number(t.revenue || 0) / maxVal) * chartHeight;
    return { x, y, ...t };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPoints = `${paddingX},${height - paddingY} ${polylinePoints} ${
    paddingX + chartWidth
  },${height - paddingY}`;

  return (
    <div className="w-full space-y-2">
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-48 sm:h-56 select-none"
        >
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" className="text-teal-400" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" className="text-teal-50" />
            </linearGradient>
          </defs>

          {/* Grid lines horizontal */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = height - paddingY - ratio * chartHeight;
            return (
              <g key={ratio}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  className="stroke-slate-200"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[9px] font-sans"
                >
                  {formatRupiah((maxVal * ratio).toFixed(0))}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <polygon points={areaPoints} fill="url(#trendGradient)" />

          {/* Polyline garis grafik */}
          <polyline
            points={polylinePoints}
            fill="none"
            className="stroke-primary"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Titik data interaktif */}
          {points.map((p, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g
                key={p.date}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : 4}
                  className={`transition-all ${
                    isHovered
                      ? 'fill-primary stroke-surface'
                      : 'fill-surface stroke-primary'
                  }`}
                  strokeWidth={isHovered ? 2.5 : 2}
                />
                {/* Tanggal di sumbu X */}
                <text
                  x={p.x}
                  y={height - paddingY + 18}
                  textAnchor="middle"
                  className={`text-[10px] font-sans ${
                    isHovered ? 'fill-primary font-bold' : 'fill-slate-500'
                  }`}
                >
                  {p.date.slice(5)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tooltip / Active Point Details */}
      <div className="h-7 flex items-center justify-center text-xs">
        {hoveredIdx !== null && points[hoveredIdx] ? (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft text-primary font-medium">
            <span>📅 {formatDate(points[hoveredIdx].date)}:</span>
            <span className="font-bold">{formatRupiah(points[hoveredIdx].revenue)}</span>
            <span className="text-slate-600">
              ({points[hoveredIdx].transactions} transaksi)
            </span>
          </div>
        ) : (
          <span className="text-muted text-[11px]">
            Arahkan kursor pada titik grafik untuk melihat rincian omzet harian
          </span>
        )}
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

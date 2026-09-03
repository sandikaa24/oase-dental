'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api-client';
import { formatDate } from '@/lib/formatters';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Info,
  MapPin,
  Building2,
} from 'lucide-react';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  branchId: string;
  workDate: string;
  checkIn: string | null;
  checkOut: string | null;
  status: 'PRESENT' | 'LATE';
  corrected: boolean;
  correctionNote: string | null;
  createdAt?: string;
  updatedAt?: string;
  employee?: {
    id: string;
    name: string;
    position: string;
  };
  branch?: {
    id: string;
    code: string;
    name: string;
  };
}

interface AttendanceWidgetProps {
  todayAttendance: AttendanceRecord | null;
  isLoadingToday?: boolean;
}

export function AttendanceWidget({ todayAttendance, isLoadingToday }: AttendanceWidgetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Jam real-time operasional Asia/Jakarta (WIB)
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeFmt = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);

      const dateFmt = formatDate(now, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      });

      setCurrentTime(timeFmt);
      setCurrentDateStr(dateFmt);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Mutasi Check-In
  const checkInMutation = useMutation({
    mutationFn: () =>
      fetchApi<AttendanceRecord>('/api/v1/attendance/check-in', {
        method: 'POST',
      }),
    onSuccess: (res) => {
      setActionError(null);
      const isLate = res.data?.status === 'LATE';
      setActionSuccess(
        isLate
          ? 'Check-in berhasil tercatat (Status: Terlambat).'
          : 'Check-in berhasil tercatat tepat waktu.'
      );
      queryClient.invalidateQueries({ queryKey: ['attendance', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'list'] });
    },
    onError: (err: Error) => {
      setActionSuccess(null);
      setActionError(err.message || 'Gagal melakukan check-in');
    },
  });

  // Mutasi Check-Out
  const checkOutMutation = useMutation({
    mutationFn: () =>
      fetchApi<AttendanceRecord>('/api/v1/attendance/check-out', {
        method: 'POST',
      }),
    onSuccess: () => {
      setActionError(null);
      setActionSuccess('Check-out berhasil tercatat. Presensi hari ini selesai.');
      queryClient.invalidateQueries({ queryKey: ['attendance', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'list'] });
    },
    onError: (err: Error) => {
      setActionSuccess(null);
      setActionError(err.message || 'Gagal melakukan check-out');
    },
  });

  // Format jam helper (HH:mm WIB)
  const formatTimeOnly = (isoString?: string | null) => {
    if (!isoString) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(isoString));
  };

  const activeBranchName =
    user?.branches?.find((b) => b.id === user.activeBranchId)?.name ||
    (user?.role === 'OWNER' && !user.activeBranchId
      ? 'Semua Cabang (Pusat)'
      : 'Cabang Belum Dipilih');

  const activeBranchCode =
    user?.branches?.find((b) => b.id === user.activeBranchId)?.code ||
    (user?.role === 'OWNER' && !user.activeBranchId ? 'HQ' : '-');

  // Persona Guard: Akun non-employee (misal default OWNER tanpa tautan data karyawan)
  const hasEmployeeProfile = user ? user.role !== 'OWNER' || !!user.name : false;
  if (!hasEmployeeProfile) {
    return (
      <Card className="p-6 border-border bg-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-muted text-muted-foreground shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold text-foreground">Panel Presensi Karyawan</h2>
                <Badge variant="neutral">Mode Administrator</Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Akun Anda terdaftar sebagai Administrator Sistem tanpa tautan profil karyawan.
                Anda tidak perlu melakukan absensi mandiri, namun dapat memantau dan mengoreksi presensi seluruh tim klinik.
              </p>
            </div>
          </div>
          <div className="text-right shrink-0 bg-muted/40 p-4 rounded-xl border border-border">
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {currentTime || '--:--:--'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">WIB (Asia/Jakarta)</div>
          </div>
        </div>
      </Card>
    );
  }

  const isCheckedIn = !!todayAttendance?.checkIn;
  const isCheckedOut = !!todayAttendance?.checkOut;

  return (
    <Card className="p-6 border-border bg-card">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Kolom Kiri: Info Waktu & Cabang */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Presensi Mandiri</h2>
                <Badge variant="primary" size="sm">
                  {activeBranchCode}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                {activeBranchName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground pt-1">
            <span className="font-medium text-foreground">{currentDateStr}</span>
            <span>•</span>
            <span className="font-mono text-base font-bold text-foreground bg-muted px-2.5 py-0.5 rounded-md">
              {currentTime || '--:--:--'} WIB
            </span>
          </div>
        </div>

        {/* Kolom Tengah: Status Presensi Hari Ini */}
        <div className="flex-1 max-w-md bg-muted/40 p-4 rounded-xl border border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Status Kehadiran Hari Ini
          </div>

          {isLoadingToday ? (
            <div className="text-sm text-muted-foreground animate-pulse">Memeriksa presensi...</div>
          ) : !isCheckedIn ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span>Belum melakukan check-in shift kerja hari ini.</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {todayAttendance?.status === 'PRESENT' ? (
                    <Badge variant="success" size="sm" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Hadir Tepat Waktu
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm" className="gap-1">
                      <AlertTriangle className="w-3 h-3" /> Terlambat
                    </Badge>
                  )}
                  {todayAttendance?.corrected && (
                    <Badge variant="info" size="sm">
                      Dikoreksi
                    </Badge>
                  )}
                </div>
                {isCheckedOut && (
                  <span className="text-xs font-medium text-success-text">Shift Selesai</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-muted-foreground">Masuk: </span>
                  <span className="font-semibold text-foreground">
                    {formatTimeOnly(todayAttendance?.checkIn)} WIB
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Keluar: </span>
                  <span className="font-semibold text-foreground">
                    {isCheckedOut ? `${formatTimeOnly(todayAttendance?.checkOut)} WIB` : '-'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Tombol Aksi */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {!isCheckedIn ? (
            <Button
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending || !user?.activeBranchId}
              variant="primary"
              className="gap-2 px-6 h-11"
            >
              <LogIn className="w-4 h-4" />
              {checkInMutation.isPending ? 'Mencatat Masuk...' : 'Check-In Sekarang'}
            </Button>
          ) : !isCheckedOut ? (
            <Button
              onClick={() => checkOutMutation.mutate()}
              disabled={checkOutMutation.isPending || !user?.activeBranchId}
              variant="secondary"
              className="gap-2 px-6 h-11 border-border text-foreground hover:bg-muted"
            >
              <LogOut className="w-4 h-4" />
              {checkOutMutation.isPending ? 'Mencatat Keluar...' : 'Check-Out Shift'}
            </Button>
          ) : (
            <Button disabled variant="secondary" className="gap-2 px-6 h-11 opacity-60">
              <CheckCircle2 className="w-4 h-4 text-success-icon" />
              Presensi Hari Ini Selesai
            </Button>
          )}
        </div>
      </div>

      {/* Pesan Feedback Sukses / Gagal */}
      {actionSuccess && (
        <div className="mt-4 p-3 rounded-lg bg-success-bg text-success-text border border-green-200 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success-icon shrink-0" />
            {actionSuccess}
          </span>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-xs underline hover:opacity-80"
          >
            Tutup
          </button>
        </div>
      )}

      {actionError && (
        <div className="mt-4 p-3 rounded-lg bg-danger-bg text-danger-text border border-red-200 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-danger-icon shrink-0" />
            {actionError}
          </span>
          <button
            onClick={() => setActionError(null)}
            className="text-xs underline hover:opacity-80"
          >
            Tutup
          </button>
        </div>
      )}

      {!user?.activeBranchId && (
        <div className="mt-4 p-3 rounded-lg bg-warning-bg text-warning-text border border-amber-200 text-sm flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-warning-icon" />
          <span>Pilih cabang aktif terlebih dahulu di header atas untuk melakukan absensi.</span>
        </div>
      )}
    </Card>
  );
}

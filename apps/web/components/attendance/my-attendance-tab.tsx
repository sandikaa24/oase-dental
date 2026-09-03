'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { formatDate } from '@/lib/formatters';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Info,
} from 'lucide-react';
import type { AttendanceRecord } from './attendance-widget';

export function MyAttendanceTab() {
  // Default: bulan berjalan WIB (YYYY-MM)
  const currentMonthWib = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthWib);

  const {
    data: resData,
    isLoading,
    isError,
    error,
  } = useQuery<ApiResponse<AttendanceRecord[]>>({
    queryKey: ['attendance', 'me', selectedMonth],
    queryFn: () =>
      fetchApi<AttendanceRecord[]>(`/api/v1/attendance/me?month=${selectedMonth}`),
  });

  const records = resData?.data || [];

  // Hitung ringkasan
  const presentCount = records.filter((r) => r.status === 'PRESENT').length;
  const lateCount = records.filter((r) => r.status === 'LATE').length;
  const totalDays = records.length;

  const formatTimeOnly = (isoString?: string | null) => {
    if (!isoString) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(isoString));
  };

  return (
    <div className="space-y-6">
      {/* Filter & Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Riwayat Kehadiran Pribadi</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daftar jam masuk, jam keluar, dan status presensi Anda per bulan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="month-select" className="text-xs font-medium text-muted-foreground">
            Bulan:
          </label>
          <input
            id="month-select"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Kartu Ringkasan Bulanan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-border bg-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Total Presensi</div>
              <div className="text-2xl font-bold text-foreground mt-1">{totalDays} hari</div>
            </div>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border bg-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Hadir Tepat Waktu</div>
              <div className="text-2xl font-bold text-success-text mt-1">{presentCount} hari</div>
            </div>
            <div className="p-2 rounded-lg bg-success-bg text-success-icon">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border bg-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Terlambat</div>
              <div className="text-2xl font-bold text-warning-text mt-1">{lateCount} hari</div>
            </div>
            <div className="p-2 rounded-lg bg-warning-bg text-warning-icon">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabel Riwayat Presensi */}
      <Card className="border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-danger-text">
            Terjadi kesalahan saat memuat data presensi: {(error as Error)?.message || 'Gagal memuat'}
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground mb-3">
              <Clock className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">Belum Ada Catatan Presensi</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Tidak ditemukan data kehadiran Anda pada bulan {selectedMonth}. Pastikan Anda melakukan check-in saat memulai shift.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Tanggal Kerja</th>
                  <th className="px-4 py-3">Cabang</th>
                  <th className="px-4 py-3">Jam Masuk</th>
                  <th className="px-4 py-3">Jam Keluar</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      {formatDate(item.workDate, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'Asia/Jakarta',
                      })}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        {item.branch?.name || item.branch?.code || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-foreground font-medium whitespace-nowrap">
                      {formatTimeOnly(item.checkIn)} WIB
                    </td>
                    <td className="px-4 py-3 font-mono text-foreground font-medium whitespace-nowrap">
                      {item.checkOut ? `${formatTimeOnly(item.checkOut)} WIB` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.status === 'PRESENT' ? (
                        <Badge variant="success" size="sm">
                          Tepat Waktu
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          Terlambat
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.corrected ? (
                        <div className="flex items-start gap-1.5 text-info-text">
                          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span className="text-xs">
                            <strong className="font-semibold">Koreksi:</strong>{' '}
                            {item.correctionNote || 'Dikoreksi oleh Owner'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

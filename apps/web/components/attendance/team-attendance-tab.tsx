'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { formatDate } from '@/lib/formatters';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Building2,
  FileEdit,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { AttendanceRecord } from './attendance-widget';

interface BranchItem {
  id: string;
  code: string;
  name: string;
}

interface EmployeeItem {
  id: string;
  name: string;
  position: string;
  active: boolean;
}

interface TeamAttendanceTabProps {
  onOpenCorrection: (record: AttendanceRecord) => void;
}

export function TeamAttendanceTab({ onOpenCorrection }: TeamAttendanceTabProps) {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  // Default tanggal hari ini WIB
  const todayWib = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [dateFilter, setDateFilter] = useState<string>(todayWib);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isOwner ? '' : user?.activeBranchId || ''
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Cabang efektif: untuk MANAGER selalu activeBranchId
  const effectiveBranchId = isOwner ? selectedBranchId : user?.activeBranchId || '';

  // ─── 1. Query Cabang (khusus OWNER untuk filter) ───────────────────────────
  const { data: branchesRes } = useQuery<ApiResponse<BranchItem[]>>({
    queryKey: ['branches', 'list'],
    queryFn: () => fetchApi<BranchItem[]>('/api/v1/branches'),
    enabled: isOwner,
  });
  const branches = branchesRes?.data || [];

  // ─── 2. Query Karyawan (PENAJAMAN 1 BINDING: dari /employees, bukan users) ──
  const { data: employeesRes } = useQuery<ApiResponse<EmployeeItem[]>>({
    queryKey: ['employees', 'filter', { branchId: effectiveBranchId }],
    queryFn: () => {
      const url =
        '/api/v1/employees?limit=100&active=true' +
        (effectiveBranchId ? `&branchId=${effectiveBranchId}` : '');
      return fetchApi<EmployeeItem[]>(url);
    },
    enabled: !!user,
  });
  const employees = employeesRes?.data || [];

  // ─── 3. Query List Absensi Tim ────────────────────────────────────────────
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: '20',
  });
  if (dateFilter) queryParams.set('date', dateFilter);
  if (effectiveBranchId) queryParams.set('branchId', effectiveBranchId);
  if (selectedEmployeeId) queryParams.set('employeeId', selectedEmployeeId);

  const {
    data: listRes,
    isLoading,
    isError,
    error,
  } = useQuery<ApiResponse<AttendanceRecord[]>>({
    queryKey: [
      'attendance',
      'list',
      {
        page,
        date: dateFilter,
        branchId: effectiveBranchId,
        employeeId: selectedEmployeeId,
      },
    ],
    queryFn: () => fetchApi<AttendanceRecord[]>(`/api/v1/attendance?${queryParams.toString()}`),
  });

  const records = listRes?.data || [];
  const meta = listRes?.meta || { total: 0, totalPages: 1 };

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
      {/* Filter Bar */}
      <Card className="p-4 border-border bg-card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filter Tanggal */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Tanggal Presensi
            </label>
            <div className="relative">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs bg-muted/40 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Filter Cabang */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Cabang Klinik
            </label>
            {isOwner ? (
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setSelectedEmployeeId(''); // reset karyawan saat cabang berganti
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-xs bg-muted/40 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Semua Cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-1.5 text-xs bg-muted/70 border border-border rounded-lg text-muted-foreground truncate">
                {user?.branches?.find((b) => b.id === user.activeBranchId)?.name || 'Cabang Aktif'}
              </div>
            )}
          </div>

          {/* Filter Karyawan (PENAJAMAN 1 BINDING: dari Master Employee) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Karyawan
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => {
                setSelectedEmployeeId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-muted/40 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Semua Karyawan</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} — {emp.position}
                </option>
              ))}
            </select>
          </div>

          {/* Reset / Info */}
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDateFilter(todayWib);
                if (isOwner) setSelectedBranchId('');
                setSelectedEmployeeId('');
                setPage(1);
              }}
              className="w-full h-8 text-xs border-border text-muted-foreground hover:text-foreground"
            >
              Reset Filter
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabel Data Kehadiran Tim */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Daftar Kehadiran Tim</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            Total {meta.total ?? records.length} catatan presensi
          </span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-danger-text">
            Terjadi kesalahan saat memuat data presensi tim: {(error as Error)?.message || 'Gagal memuat'}
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground mb-3">
              <Clock className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">Tidak Ada Data Presensi</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Tidak ditemukan catatan presensi yang cocok dengan filter tanggal atau cabang yang dipilih.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Karyawan</th>
                  <th className="px-4 py-3">Cabang</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Jam Masuk</th>
                  <th className="px-4 py-3">Jam Keluar</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Catatan Koreksi</th>
                  {isOwner && <th className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {item.employee?.name || 'Karyawan Tanpa Nama'}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.employee?.position || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        {item.branch?.name || item.branch?.code || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      {formatDate(item.workDate, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'Asia/Jakarta',
                      })}
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
                        <div className="space-y-1">
                          <Badge variant="info" size="sm">
                            Dikoreksi
                          </Badge>
                          {item.correctionNote && (
                            <p className="text-[11px] text-muted-foreground max-w-xs truncate" title={item.correctionNote}>
                              {item.correctionNote}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onOpenCorrection(item)}
                          className="h-7 text-xs px-2.5 gap-1 border-border text-foreground hover:bg-muted"
                        >
                          <FileEdit className="w-3 h-3" />
                          Koreksi
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {meta.totalPages && meta.totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Halaman {page} dari {meta.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 px-2 border-border"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(meta.totalPages || 1, p + 1))}
                disabled={page >= (meta.totalPages || 1)}
                className="h-8 px-2 border-border"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

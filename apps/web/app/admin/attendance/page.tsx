'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { AttendanceWidget, type AttendanceRecord } from '@/components/attendance/attendance-widget';
import { MyAttendanceTab } from '@/components/attendance/my-attendance-tab';
import { TeamAttendanceTab } from '@/components/attendance/team-attendance-tab';
import { AttendanceCorrectionModal } from '@/components/attendance/attendance-correction-modal';
import { Clock, UserCheck, Users } from 'lucide-react';

export default function AttendancePage() {
  const { user } = useAuth();

  // Izin melihat presensi seluruh tim
  const canViewTeam = user?.role === 'OWNER' || user?.role === 'MANAGER';
  // User terhubung ke profil karyawan (non-OWNER atau OWNER yang memiliki nama karyawan)
  const hasEmployeeProfile = user ? user.role !== 'OWNER' || !!user.name : false;

  // State tab aktif: default 'team' jika akun tanpa employeeId (mis. OWNER), sebaliknya 'me'
  const [activeTab, setActiveTab] = useState<'me' | 'team'>(
    hasEmployeeProfile ? 'me' : canViewTeam ? 'team' : 'me'
  );

  // Modal Koreksi OWNER
  const [correctionTarget, setCorrectionTarget] = useState<AttendanceRecord | null>(null);

  // Ambil data presensi hari ini untuk widget
  // (ambil dari /attendance/me bulan berjalan WIB, cari record tanggal hari ini)
  const currentMonthWib = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);

  const todayDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const { data: myMonthRes, isLoading: isLoadingMyMonth } = useQuery<
    ApiResponse<AttendanceRecord[]>
  >({
    queryKey: ['attendance', 'me', currentMonthWib],
    queryFn: () =>
      fetchApi<AttendanceRecord[]>(`/api/v1/attendance/me?month=${currentMonthWib}`),
    enabled: hasEmployeeProfile,
  });

  const todayRecord =
    myMonthRes?.data?.find((r) => {
      // Bandingkan format YYYY-MM-DD
      const recordDate = r.workDate.slice(0, 10);
      return recordDate === todayDateStr;
    }) || null;

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Absensi & Presensi Karyawan
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pencatatan presensi masuk dan keluar shift kerja operasional serta rekapitulasi kehadiran tim klinik.
            </p>
          </div>
        </div>
      </div>

      {/* Widget Presensi Mandiri */}
      <AttendanceWidget
        todayAttendance={todayRecord}
        isLoadingToday={isLoadingMyMonth}
      />

      {/* Navigasi Tab */}
      <div className="border-b border-border">
        <nav className="flex space-x-6">
          {hasEmployeeProfile && (
            <button
              type="button"
              onClick={() => setActiveTab('me')}
              className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'me'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Riwayat Presensi Saya
            </button>
          )}

          {canViewTeam && (
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'team'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-4 h-4" />
              Kehadiran Seluruh Tim
            </button>
          )}
        </nav>
      </div>

      {/* Konten Tab */}
      {activeTab === 'me' && hasEmployeeProfile && <MyAttendanceTab />}
      {activeTab === 'team' && canViewTeam && (
        <TeamAttendanceTab onOpenCorrection={(record) => setCorrectionTarget(record)} />
      )}

      {/* Modal Koreksi Presensi (OWNER Only) */}
      <AttendanceCorrectionModal
        isOpen={!!correctionTarget}
        onClose={() => setCorrectionTarget(null)}
        record={correctionTarget}
      />
    </div>
  );
}

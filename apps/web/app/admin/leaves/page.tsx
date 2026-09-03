'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { MyLeavesTab } from '@/components/leaves/my-leaves-tab';
import { TeamLeavesTab } from '@/components/leaves/team-leaves-tab';
import { LeaveRequestModal } from '@/components/leaves/leave-request-modal';
import { CalendarDays, User, Users } from 'lucide-react';

export default function LeavesPage() {
  const { user } = useAuth();

  // OWNER & MANAGER memiliki akses memutuskan pengajuan tim (LEAVE_DECIDE)
  const canDecide = user?.role === 'OWNER' || user?.role === 'MANAGER';
  // User terhubung ke profil karyawan
  const hasEmployeeProfile = user ? user.role !== 'OWNER' || !!user.name : false;

  // State modal pengajuan baru
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);

  // Default tab:
  // Jika akun OWNER tanpa employeeId -> default 'team'
  // Jika role ber-employeeId -> default 'me'
  const [activeTab, setActiveTab] = useState<'me' | 'team'>(
    hasEmployeeProfile ? 'me' : canDecide ? 'team' : 'me'
  );

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Cuti & Izin</h1>
          </div>
          <p className="text-xs text-muted">
            Kelola pengajuan cuti, izin, dan sakit karyawan klinik
          </p>
        </div>

        {hasEmployeeProfile && (
          <button
            onClick={() => setIsApplyModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all gap-1.5 self-start sm:self-auto"
          >
            + Ajukan Cuti/Izin
          </button>
        )}
      </div>

      {/* Navigasi Tab */}
      {canDecide && (
        <div className="flex border-b border-slate-200">
          {hasEmployeeProfile && (
            <button
              type="button"
              onClick={() => setActiveTab('me')}
              className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'me'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <User className="w-4 h-4" />
              Pengajuan Saya
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'team'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            Persetujuan Tim
          </button>
        </div>
      )}

      {/* Konten Tab */}
      {activeTab === 'me' && (
        <MyLeavesTab
          onOpenApplyModal={() => setIsApplyModalOpen(true)}
          hasEmployeeProfile={hasEmployeeProfile}
        />
      )}

      {activeTab === 'team' && canDecide && (
        <TeamLeavesTab
          isOwner={user?.role === 'OWNER'}
          activeBranchId={user?.activeBranchId || null}
          currentEmployeeName={user?.name || null}
        />
      )}

      {/* Modal Form Pengajuan */}
      <LeaveRequestModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
      />
    </div>
  );
}

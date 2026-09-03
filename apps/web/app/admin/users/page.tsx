'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { UsersTab } from '@/components/users/users-tab';
import { EmployeesTab } from '@/components/users/employees-tab';
import { Employee } from '@/components/users/user-types';
import { Branch } from '@/components/branches/branch-types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, ShieldX } from 'lucide-react';

type TabType = 'users' | 'employees';

export default function UsersPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const [activeTab, setActiveTab] = useState<TabType>('users');

  // Fetch branches untuk assignment karyawan
  const { data: branchesResponse } = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: async () => {
      return fetchApi<Branch[]>('/api/v1/branches?limit=100&active=true');
    },
    enabled: isOwner,
  });
  const branches = branchesResponse?.data ?? [];

  // Fetch employees untuk dropdown user modal
  const { data: employeesResponse } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: async () => {
      return fetchApi<Employee[]>('/api/v1/employees?limit=100');
    },
    enabled: isOwner,
  });
  const employees = employeesResponse?.data ?? [];

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border-border text-center shadow-sm">
          <CardContent className="p-8 space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-bg text-danger-icon mx-auto">
              <ShieldX className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Akses Ditolak</h2>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Halaman Manajemen Pengguna &amp; Karyawan hanya dapat diakses oleh akun dengan peran <strong>OWNER</strong>.
            </p>
            <div className="pt-2">
              <Link href="/admin">
                <Button variant="secondary" size="md">
                  Kembali ke Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'users', label: 'Akun Pengguna Sistem', icon: Users },
    { id: 'employees', label: 'Data Staf & Karyawan', icon: UserCheck },
  ];

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Pengguna &amp; Karyawan
              </h1>
              <p className="text-xs text-muted">
                Pendaftaran akun autentikasi login, hak akses role, dan data penugasan cabang staf klinik
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation Navigation Bar */}
      <div className="flex items-center gap-1 border-b border-border pb-px overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-primary text-primary bg-primary-soft/30 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-foreground hover:bg-slate-50 rounded-t-lg'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panels */}
      <div>
        {activeTab === 'users' && <UsersTab employees={employees} />}
        {activeTab === 'employees' && <EmployeesTab branches={branches} />}
      </div>
    </div>
  );
}

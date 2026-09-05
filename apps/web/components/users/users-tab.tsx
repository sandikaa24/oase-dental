'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { User, Employee, UserRole } from './user-types';
import { UserModal } from './user-modal';
import { ResetPasswordModal } from './reset-password-modal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorBanner } from '@/components/ui/placeholder';
import {
  Users,
  Plus,
  Search,
  Edit2,
  KeyRound,
  Power,
  ChevronLeft,
  ChevronRight,
  Building2,
} from 'lucide-react';

interface UsersTabProps {
  employees: Employee[];
}

export function UsersTab({ employees }: UsersTabProps) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [search, setSearch] = useState('');

  // Modals state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [userForReset, setUserForReset] = useState<User | null>(null);

  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['users', page, roleFilter, activeFilter],
    queryFn: async () => {
      let url = `/api/v1/users?page=${page}&limit=20`;
      if (roleFilter) url += `&role=${roleFilter}`;
      if (activeFilter !== undefined) url += `&active=${activeFilter}`;
      return fetchApi<User[]>(url);
    },
  });

  const users = data?.data ?? [];
  const meta = data?.meta;

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.employee?.name && u.employee.name.toLowerCase().includes(q))
    );
  });

  const handleOpenCreate = () => {
    setSelectedUser(null);
    setUserModalOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setSelectedUser(u);
    setUserModalOpen(true);
  };

  const handleOpenReset = (u: User) => {
    setUserForReset(u);
    setResetModalOpen(true);
  };

  const handleToggleStatus = async (u: User) => {
    if (u.id === currentUser?.id) {
      setFeedbackMessage({
        type: 'error',
        text: 'Anda tidak dapat menonaktifkan akun Anda sendiri.',
      });
      return;
    }

    try {
      await fetchApi(`/api/v1/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !u.active }),
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFeedbackMessage({
        type: 'success',
        text: `Akun "${u.email}" berhasil ${!u.active ? 'diaktifkan' : 'dinonaktifkan'}. Pengguna tidak dapat melakukan login atau rotasi token sesi berikutnya.`,
      });
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengubah status aktif akun',
      });
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'OWNER':
        return <Badge variant="default" className="bg-purple-100 text-purple-800 border-purple-200">OWNER</Badge>;
      case 'MANAGER':
        return <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">MANAGER</Badge>;
      case 'CASHIER':
        return <Badge variant="default" className="bg-emerald-100 text-emerald-800 border-emerald-200">CASHIER</Badge>;
      case 'EMPLOYEE':
        return <Badge variant="default" className="bg-slate-100 text-slate-800 border-slate-200">EMPLOYEE</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-xs font-semibold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Cari email atau nama staf..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-md border border-border bg-white text-xs text-foreground placeholder:text-muted focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* Filter & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-md border border-border bg-white text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="">-- Semua Role --</option>
            <option value="OWNER">OWNER</option>
            <option value="MANAGER">MANAGER</option>
            <option value="CASHIER">CASHIER</option>
            <option value="EMPLOYEE">EMPLOYEE</option>
          </select>

          {/* Active Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveFilter(undefined);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                activeFilter === undefined
                  ? 'bg-white text-primary shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-foreground'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFilter(true);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                activeFilter === true
                  ? 'bg-white text-primary shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-foreground'
              }`}
            >
              Aktif
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFilter(false);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                activeFilter === false
                  ? 'bg-white text-primary shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-foreground'
              }`}
            >
              Nonaktif
            </button>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreate}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Akun User</span>
          </Button>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Akun Pengguna"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat memuat data akun'}
        />
      )}

      {/* Table Data */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-border text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Email Login</th>
                  <th className="py-3 px-4">Karyawan Terhubung</th>
                  <th className="py-3 px-4 text-center">Peran (Role)</th>
                  <th className="py-3 px-4">Cabang Penugasan</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-36" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-16 mx-auto" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-14 mx-auto" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <EmptyState
                        icon={<Users className="h-6 w-6 text-muted" />}
                        title="Tidak Ada Akun Pengguna"
                        description={search ? 'Tidak ditemukan akun yang sesuai dengan pencarian.' : 'Belum ada akun pengguna terdaftar.'}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const assignedBranches = u.employee?.branches.filter((b) => b.active) ?? [];
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{u.email}</div>
                          {u.username ? (
                            <div className="text-[11px] font-mono text-muted">@{u.username}</div>
                          ) : (
                            <div className="text-[11px] font-mono text-slate-400">-</div>
                          )}
                          {u.id === currentUser?.id && (
                            <span className="text-[10px] text-primary font-semibold">(Akun Anda)</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {u.employee ? (
                            <div>
                              <div className="font-semibold text-slate-800">{u.employee.name}</div>
                              <div className="text-[10px] text-muted">{u.employee.position}</div>
                            </div>
                          ) : (
                            <span className="text-muted italic text-[11px]">- (Global Owner)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {getRoleBadge(u.role)}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {u.role === 'OWNER' ? (
                            <span className="text-[11px] font-semibold text-purple-700">Semua Cabang (Global)</span>
                          ) : assignedBranches.length === 0 ? (
                            <span className="text-muted text-[11px] italic">Belum ada cabang</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {assignedBranches.map((b) => (
                                <span
                                  key={b.branchId}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200"
                                >
                                  <Building2 className="h-2.5 w-2.5 text-muted" />
                                  <span>{b.branch.code}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {u.active ? (
                            <Badge variant="success">Aktif</Badge>
                          ) : (
                            <Badge variant="default" className="bg-slate-200 text-slate-700">Nonaktif</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Reset Password */}
                            <button
                              type="button"
                              title="Reset password akun"
                              onClick={() => handleOpenReset(u)}
                              className="p-1.5 rounded-md text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>

                            {/* Edit Akun */}
                            <button
                              type="button"
                              title="Edit akun"
                              onClick={() => handleOpenEdit(u)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-primary hover:bg-primary-soft transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            {/* Toggle Active Status */}
                            <button
                              type="button"
                              disabled={u.id === currentUser?.id}
                              title={
                                u.id === currentUser?.id
                                  ? 'Tidak dapat menonaktifkan akun sendiri'
                                  : u.active
                                  ? 'Nonaktifkan akun user'
                                  : 'Aktifkan akun user'
                              }
                              onClick={() => handleToggleStatus(u)}
                              className={`p-1.5 rounded-md transition-colors ${
                                u.id === currentUser?.id
                                  ? 'text-slate-200 cursor-not-allowed'
                                  : u.active
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages && meta.totalPages > 1 ? (
            <div className="p-3 border-t border-border flex items-center justify-between text-xs bg-slate-50/50">
              <span className="text-muted">
                Halaman {meta.page} dari {meta.totalPages} (Total {meta.total} akun)
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= (meta.totalPages || 1)}
                  onClick={() => setPage(page + 1)}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Modal Create & Edit User */}
      <UserModal
        open={userModalOpen}
        onOpenChange={setUserModalOpen}
        onSuccess={(msg) => {
          queryClient.invalidateQueries({ queryKey: ['users'] });
          queryClient.invalidateQueries({ queryKey: ['employees'] });
          if (msg) setFeedbackMessage({ type: 'success', text: msg });
        }}
        user={selectedUser}
        employees={employees}
      />

      {/* Modal Reset Password */}
      <ResetPasswordModal
        open={resetModalOpen}
        onOpenChange={setResetModalOpen}
        onSuccess={(msg) => {
          queryClient.invalidateQueries({ queryKey: ['users'] });
          if (msg) setFeedbackMessage({ type: 'success', text: msg });
        }}
        user={userForReset}
      />
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { Employee } from './user-types';
import { Branch } from '../branches/branch-types';
import { EmployeeModal } from './employee-modal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorBanner } from '@/components/ui/placeholder';
import {
  UserCheck,
  Plus,
  Search,
  Edit2,
  Power,
  ChevronLeft,
  ChevronRight,
  Phone,
  Building2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface EmployeesTabProps {
  branches: Branch[];
}

export function EmployeesTab({ branches }: EmployeesTabProps) {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [search, setSearch] = useState('');

  // Modals state
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['employees', page, activeFilter],
    queryFn: async () => {
      let url = `/api/v1/employees?page=${page}&limit=20`;
      if (activeFilter !== undefined) url += `&active=${activeFilter}`;
      return fetchApi<Employee[]>(url);
    },
  });

  const employees = data?.data ?? [];
  const meta = data?.meta;

  const filteredEmployees = employees.filter((emp) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return emp.name.toLowerCase().includes(q) || emp.position.toLowerCase().includes(q);
  });

  const handleOpenCreate = () => {
    setSelectedEmployee(null);
    setEmployeeModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEmployeeModalOpen(true);
  };

  const handleToggleStatus = async (emp: Employee) => {
    try {
      await fetchApi(`/api/v1/employees/${emp.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !emp.active }),
      });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFeedbackMessage({
        type: 'success',
        text: `Karyawan "${emp.name}" berhasil ${!emp.active ? 'diaktifkan' : 'dinonaktifkan'}.`,
      });
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengubah status aktif karyawan',
      });
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
            placeholder="Cari nama karyawan atau posisi/jabatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-md border border-border bg-white text-xs text-foreground placeholder:text-muted focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* Filter & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
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

          {isOwner && (
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenCreate}
              className="gap-1.5 text-xs shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Karyawan</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Data Karyawan"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat memuat data karyawan'}
        />
      )}

      {/* Table Data */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-border text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Nama Karyawan</th>
                  <th className="py-3 px-4">Posisi / Jabatan</th>
                  <th className="py-3 px-4">No. Telepon</th>
                  <th className="py-3 px-4">Penugasan Cabang</th>
                  <th className="py-3 px-4 text-center">Akun Login</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {isOwner && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-36" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-28" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-20 mx-auto" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-14 mx-auto" /></td>
                      {isOwner && <td className="py-3 px-4"><Skeleton className="h-4 w-16 ml-auto" /></td>}
                    </tr>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={isOwner ? 7 : 6} className="p-8 text-center">
                      <EmptyState
                        icon={<UserCheck className="h-6 w-6 text-muted" />}
                        title="Tidak Ada Karyawan"
                        description={search ? 'Tidak ditemukan karyawan yang sesuai dengan pencarian.' : 'Belum ada data staf karyawan klinik.'}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const assignedBranches = emp.branches.filter((b) => b.active);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {emp.name}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {emp.position}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {emp.phone ? (
                            <span className="flex items-center gap-1 font-mono text-[11px]">
                              <Phone className="h-3 w-3 text-muted" />
                              <span>{emp.phone}</span>
                            </span>
                          ) : (
                            <span className="text-muted italic">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {assignedBranches.length === 0 ? (
                            <span className="text-muted text-[11px] italic">Belum ditugaskan</span>
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
                          {emp.user ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-teal-700 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                              <span>{emp.user.email}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                              <span>Belum Ada Akun</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {emp.active ? (
                            <Badge variant="success">Aktif</Badge>
                          ) : (
                            <Badge variant="default" className="bg-slate-200 text-slate-700">Nonaktif</Badge>
                          )}
                        </td>
                        {isOwner && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Edit Data Karyawan */}
                              <button
                                type="button"
                                title="Edit profil & penugasan cabang"
                                onClick={() => handleOpenEdit(emp)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-primary hover:bg-primary-soft transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>

                              {/* Toggle Active Status */}
                              <button
                                type="button"
                                title={emp.active ? 'Nonaktifkan karyawan' : 'Aktifkan karyawan'}
                                onClick={() => handleToggleStatus(emp)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  emp.active
                                    ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
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
                Halaman {meta.page} dari {meta.totalPages} (Total {meta.total} karyawan)
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

      {/* Modal Create & Edit Employee */}
      <EmployeeModal
        open={employeeModalOpen}
        onOpenChange={setEmployeeModalOpen}
        onSuccess={(msg) => {
          queryClient.invalidateQueries({ queryKey: ['employees'] });
          queryClient.invalidateQueries({ queryKey: ['users'] });
          if (msg) setFeedbackMessage({ type: 'success', text: msg });
        }}
        employee={selectedEmployee}
        branches={branches}
      />
    </div>
  );
}

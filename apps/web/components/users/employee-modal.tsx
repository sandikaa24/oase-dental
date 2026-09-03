'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
import { Employee } from './user-types';
import { Branch } from '../branches/branch-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/placeholder';
import { UserCheck, X, Check, Building2 } from 'lucide-react';

interface EmployeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
  employee: Employee | null;
  branches: Branch[];
}

export function EmployeeModal({
  open,
  onOpenChange,
  onSuccess,
  employee,
  branches,
}: EmployeeModalProps) {
  const isEditing = !!employee;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('Kasir');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (employee) {
        setName(employee.name);
        setPhone(employee.phone || '');
        setPosition(employee.position);
        const activeAssigned = employee.branches.filter((b) => b.active).map((b) => b.branchId);
        setSelectedBranchIds(activeAssigned);
      } else {
        setName('');
        setPhone('');
        setPosition('Kasir');
        const firstBranch = branches[0];
        setSelectedBranchIds(firstBranch ? [firstBranch.id] : []);
      }
    }
  }, [open, employee, branches]);

  if (!open) return null;

  const handleToggleBranch = (branchId: string) => {
    if (selectedBranchIds.includes(branchId)) {
      setSelectedBranchIds(selectedBranchIds.filter((id) => id !== branchId));
    } else {
      setSelectedBranchIds([...selectedBranchIds, branchId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedPosition = position.trim();

    if (!trimmedName) {
      setError('Nama karyawan tidak boleh kosong.');
      return;
    }
    if (!trimmedPosition) {
      setError('Jabatan/posisi karyawan tidak boleh kosong.');
      return;
    }
    if (selectedBranchIds.length === 0) {
      setError('Minimal pilih 1 cabang klinik penugasan.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        phone: phone.trim() || undefined,
        position: trimmedPosition,
        branchIds: selectedBranchIds,
      };

      if (isEditing && employee) {
        await fetchApi(`/api/v1/employees/${employee.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onSuccess('Data karyawan berhasil diperbarui');
      } else {
        await fetchApi('/api/v1/employees', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onSuccess('Karyawan baru berhasil ditambahkan');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat menyimpan data karyawan.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isEditing ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
              </h3>
              <p className="text-[11px] text-muted">Profil Personal &amp; Penugasan Cabang Staf</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md text-muted hover:text-foreground hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && <ErrorBanner title="Gagal Menyimpan" message={error} />}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Nama Lengkap Karyawan *</label>
            <Input
              type="text"
              required
              placeholder="Contoh: drg. Rina Oktaviana / Siti Rahma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Jabatan / Posisi *</label>
              <Input
                type="text"
                required
                placeholder="Dokter Gigi / Perawat / Kasir"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">No. Telepon / HP</label>
              <Input
                type="text"
                placeholder="Contoh: 081234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          {/* Penugasan Cabang (Multi-select) */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>Penugasan Cabang Operasional * (Pilih minimal 1)</span>
            </label>
            <div className="p-3 rounded-lg border border-border bg-slate-50 space-y-2 max-h-48 overflow-y-auto">
              {branches.length === 0 ? (
                <p className="text-xs text-muted">Belum ada cabang klinik yang terdaftar.</p>
              ) : (
                branches.map((b) => {
                  const isChecked = selectedBranchIds.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className="flex items-start gap-2.5 p-1.5 rounded hover:bg-white cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleBranch(b.id)}
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <div className="text-xs">
                        <div className="font-semibold text-foreground">
                          {b.name} <span className="text-muted font-mono font-normal">({b.code})</span>
                        </div>
                        <div className="text-[11px] text-muted line-clamp-1">{b.address}</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              className="gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>{isEditing ? 'Simpan Perubahan' : 'Tambah Karyawan'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

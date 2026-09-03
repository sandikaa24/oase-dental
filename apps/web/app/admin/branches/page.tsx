'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { BranchTable } from '@/components/branches/branch-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, ShieldX } from 'lucide-react';

export default function BranchesPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

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
              Halaman Manajemen Cabang hanya dapat diakses oleh akun dengan peran <strong>OWNER</strong>.
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

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Manajemen Cabang Klinik
              </h1>
              <p className="text-xs text-muted">
                Pengelolaan kode cabang, alamat, telepon operasional, dan pengaturan jam kerja shift
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Data Cabang */}
      <BranchTable />
    </div>
  );
}

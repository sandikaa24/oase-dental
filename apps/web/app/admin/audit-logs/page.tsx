'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Permission } from '@oase/shared';
import { AuditLogsTab } from '@/components/reports/audit-logs-tab';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ShieldX } from 'lucide-react';

export default function AuditLogsPage() {
  const { user, hasPermission } = useAuth();

  // Guard: OWNER atau user dengan izin AUDIT_LOG_VIEW
  const canAccess =
    user?.role === 'OWNER' || hasPermission(Permission.AUDIT_LOG_VIEW);

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border-border text-center shadow-sm">
          <CardContent className="p-8 space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-bg text-danger-icon mx-auto">
              <ShieldX className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Akses Ditolak</h2>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Anda tidak memiliki izin wewenang (<code>AUDIT_LOG_VIEW</code>) untuk melihat rekam jejak audit sistem.
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary-soft text-primary">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Audit Trail &amp; Rekam Jejak
            </h1>
            <p className="text-xs text-muted">
              Pencatatan aktivitas operasional klinik, perubahan data, dan histori login
            </p>
          </div>
        </div>
      </div>

      {/* Embedded Shared Component */}
      <AuditLogsTab />
    </div>
  );
}

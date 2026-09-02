'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { StockOpnameDetail } from '@/components/inventory/inventory-types';
import { OpnameForm } from '@/components/inventory/opname-form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/placeholder';
import { ArrowLeft, ShieldX } from 'lucide-react';

export default function StockOpnameDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();

  const canAccess = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stock-opname-detail', id],
    queryFn: async () => {
      return fetchApi<StockOpnameDetail>(`/api/v1/stock-opnames/${id}`);
    },
    enabled: canAccess && !!id && !!user,
  });

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
              Hanya <strong>OWNER</strong> dan <strong>MANAGER</strong> yang memiliki wewenang untuk melihat atau memproses sesi stock opname.
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
      {/* Top Navigation */}
      <div>
        <Link
          href="/admin/inventory/opname"
          className="text-xs text-muted hover:text-primary inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Daftar Stock Opname</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : isError || !data?.data ? (
        <ErrorBanner
          title="Gagal Memuat Detail Stock Opname"
          message={error instanceof Error ? error.message : 'Sesi stock opname tidak ditemukan atau akses ditolak'}
        />
      ) : (
        <OpnameForm initialData={data.data} onRefresh={() => refetch()} />
      )}
    </div>
  );
}

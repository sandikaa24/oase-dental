'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { ClosingDetailCard } from '@/components/closing/closing-detail-card';
import { ReopenDialog } from '@/components/closing/reopen-dialog';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { CashClosing } from '@/components/closing/closing-types';

export default function CashClosingDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);

  const canReopen = user?.role === 'OWNER';

  const {
    data: closingData,
    isLoading,
    error,
    refetch,
  } = useQuery<ApiResponse<CashClosing>>({
    queryKey: ['closing-detail', params.id],
    queryFn: () => fetchApi<CashClosing>(`/api/v1/cash-closings/${params.id}`),
    enabled: !!params.id && !!user,
    staleTime: 30_000,
  });

  const { mutateAsync: reopenClosing, isPending: isReopening } = useMutation({
    mutationFn: (reason: string) =>
      fetchApi(`/api/v1/cash-closings/${params.id}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      setReopenError(null);
      setReopenOpen(false);
      queryClient.invalidateQueries({ queryKey: ['closing-detail', params.id] });
      queryClient.invalidateQueries({ queryKey: ['closing-history'] });
      queryClient.invalidateQueries({ queryKey: ['closing-preview'] });
      queryClient.invalidateQueries({ queryKey: ['cashier-dashboard'] });
    },
    onError: (err: Error) => {
      setReopenError(err.message);
    },
  });

  // Guard role
  if (user && user.role !== 'OWNER' && user.role !== 'CASHIER') {
    return (
      <ErrorBanner
        title="Akses Ditolak"
        message="Halaman ini hanya dapat diakses oleh Kasir dan Owner."
      />
    );
  }

  const fetchError = error as Error | null;

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <Link href="/admin/cash-closing">
          <Button variant="secondary" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Detail Closing Kas</h1>
      </div>

      {reopenError && (
        <ErrorBanner
          title="Gagal Membuka Kembali Kas"
          message={reopenError}
          onRetry={() => setReopenError(null)}
        />
      )}

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {fetchError && !isLoading && (
        <ErrorBanner
          title="Gagal Memuat Data"
          message={fetchError.message}
          onRetry={() => refetch()}
        />
      )}

      {closingData?.data && !isLoading && (
        <ClosingDetailCard
          closing={closingData.data}
          canReopen={canReopen}
          onReopen={() => setReopenOpen(true)}
        />
      )}

      <ReopenDialog
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        onConfirm={async (reason) => {
          await reopenClosing(reason);
        }}
        isLoading={isReopening}
      />
    </div>
  );
}

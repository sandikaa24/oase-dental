'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { ClosingPreviewPanel } from '@/components/closing/closing-preview-panel';
import { ClosingForm } from '@/components/closing/closing-form';
import { ClosingDetailCard } from '@/components/closing/closing-detail-card';
import { ClosingHistoryTable } from '@/components/closing/closing-history-table';
import { ReopenDialog } from '@/components/closing/reopen-dialog';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt, History } from 'lucide-react';
import type { ClosingPreview, CashClosing } from '@/components/closing/closing-types';

export default function CashClosingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [historyPage, setHistoryPage] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reopenTarget, setReopenTarget] = useState<CashClosing | null>(null);
  const [reopenError, setReopenError] = useState<string | null>(null);

  const canReopen = user?.role === 'OWNER';

  // ─── Fetch preview (untuk kasir & owner aktif di branch) ─────────────────
  const {
    data: previewData,
    isLoading: previewLoading,
    error: previewError,
    refetch: refetchPreview,
  } = useQuery<ApiResponse<ClosingPreview>>({
    queryKey: ['closing-preview'],
    queryFn: () => fetchApi<ClosingPreview>('/api/v1/cash-closings/preview'),
    enabled: !!user && (user.role === 'CASHIER' || user.role === 'OWNER'),
    staleTime: 30_000, // 30 detik
  });

  const preview = previewData?.data;

  // ─── Fetch riwayat closing ────────────────────────────────────────────────
  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery<ApiResponse<CashClosing[]>>({
    queryKey: ['closing-history', historyPage],
    queryFn: () => fetchApi<CashClosing[]>(`/api/v1/cash-closings?page=${historyPage}&limit=10`),
    enabled: !!user,
    staleTime: 30_000,
  });

  // ─── Submit closing ───────────────────────────────────────────────────────
  const { mutateAsync: submitClosing, isPending: isSubmitting } = useMutation({
    mutationFn: (payload: { actualCash: string; note: string | null }) =>
      fetchApi('/api/v1/cash-closings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setSubmitError(null);
      // Invalidasi preview & riwayat agar tampilkan status terbaru
      queryClient.invalidateQueries({ queryKey: ['closing-preview'] });
      queryClient.invalidateQueries({ queryKey: ['closing-history'] });
      queryClient.invalidateQueries({ queryKey: ['cashier-dashboard'] });
    },
    onError: (err: Error) => {
      setSubmitError(err.message);
    },
  });

  // ─── Reopen closing ───────────────────────────────────────────────────────
  const { mutateAsync: reopenClosing, isPending: isReopening } = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      fetchApi(`/api/v1/cash-closings/${id}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      setReopenError(null);
      setReopenTarget(null);
      queryClient.invalidateQueries({ queryKey: ['closing-preview'] });
      queryClient.invalidateQueries({ queryKey: ['closing-history'] });
      queryClient.invalidateQueries({ queryKey: ['cashier-dashboard'] });
    },
    onError: (err: Error) => {
      setReopenError(err.message);
    },
  });

  const handleSubmit = useCallback(
    async (actualCash: string, note: string | null) => {
      await submitClosing({ actualCash, note });
    },
    [submitClosing]
  );

  const handleReopen = useCallback(
    async (reason: string) => {
      if (!reopenTarget) return;
      await reopenClosing({ id: reopenTarget.id, reason });
    },
    [reopenClosing, reopenTarget]
  );

  // Guard: EMPLOYEE dan MANAGER tidak boleh akses halaman ini
  if (user && user.role !== 'OWNER' && user.role !== 'CASHIER') {
    return (
      <div className="space-y-4">
        <ErrorBanner
          title="Akses Ditolak"
          message="Halaman ini hanya dapat diakses oleh Kasir dan Owner."
        />
      </div>
    );
  }

  // Error pada preview
  const previewFetchError = previewError as Error | null;

  return (
    <div className="space-y-6">
      {/* Header halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-warning-bg text-warning-icon">
              <Receipt className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Tutup Kas Harian</h1>
          </div>
          <p className="text-sm text-muted mt-1">
            Rekonsiliasi kas tunai dan closing kas shift kasir
          </p>
        </div>
      </div>

      {/* Error reopen banner */}
      {reopenError && (
        <ErrorBanner
          title="Gagal Membuka Kembali Kas"
          message={reopenError}
          onRetry={() => setReopenError(null)}
        />
      )}

      {/* Seksi Preview & Form — hanya untuk CASHIER dan OWNER */}
      {(user?.role === 'CASHIER' || user?.role === 'OWNER') && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Status Kas Hari Ini
          </h2>

          {previewLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-border bg-surface p-4">
                  <Skeleton className="h-4 w-28 mb-2" />
                  <Skeleton className="h-7 w-36" />
                </div>
              ))}
            </div>
          )}

          {previewFetchError && !previewLoading && (
            <ErrorBanner
              title="Gagal Memuat Preview Kas"
              message={previewFetchError.message}
              onRetry={() => refetchPreview()}
            />
          )}

          {preview && !previewLoading && (
            <>
              {/* Preview metrik */}
              <ClosingPreviewPanel preview={preview} />

              {/* Form atau read-only detail */}
              {preview.alreadyClosedToday ? (
                /* Hari ini sudah closing — tampilkan detail read-only */
                <div className="space-y-2">
                  {historyData?.data && historyData.data[0] && (
                    <ClosingDetailCard
                      closing={historyData.data[0]}
                      canReopen={canReopen}
                      onReopen={() => historyData.data && historyData.data[0] && setReopenTarget(historyData.data[0])}
                    />
                  )}
                </div>
              ) : (
                /* Belum closing — tampilkan form */
                <ClosingForm
                  expectedCash={preview.expectedCash}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                  submitError={submitError}
                />
              )}
            </>
          )}
        </section>
      )}

      {/* Seksi Riwayat Closing */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted" />
          <h2 className="text-base font-semibold text-foreground">Riwayat Closing</h2>
        </div>

        {historyError && (
          <ErrorBanner
            title="Gagal Memuat Riwayat"
            message={(historyError as Error).message}
            onRetry={() => refetchHistory()}
          />
        )}

        <ClosingHistoryTable
          closings={historyData?.data ?? []}
          isLoading={historyLoading}
          currentPage={historyPage}
          totalPages={historyData?.meta?.totalPages ?? 1}
          total={historyData?.meta?.total ?? 0}
          onPageChange={setHistoryPage}
        />
      </section>

      {/* Dialog reopen */}
      <ReopenDialog
        open={!!reopenTarget}
        onOpenChange={(open) => !open && setReopenTarget(null)}
        onConfirm={handleReopen}
        isLoading={isReopening}
      />
    </div>
  );
}

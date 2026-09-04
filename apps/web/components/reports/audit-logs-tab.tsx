'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ApiResponse } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge, RoleBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorBanner } from '@/components/ui/placeholder';
import { formatDateTime } from '@/lib/formatters';
import {
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
} from 'lucide-react';
import type { AuditLogItem } from './reports-types';

export function AuditLogsTab() {
  const [action, setAction] = useState<string>('');
  const [entity, setEntity] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const queryParams = new URLSearchParams();
  if (action) queryParams.set('action', action);
  if (entity) queryParams.set('entity', entity);
  if (dateFrom) queryParams.set('dateFrom', dateFrom);
  if (dateTo) queryParams.set('dateTo', dateTo);
  queryParams.set('page', String(page));
  queryParams.set('limit', '20');

  const {
    data: auditResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<AuditLogItem[]>>({
    queryKey: ['audit-logs', action, entity, dateFrom, dateTo, page],
    queryFn: () => fetchApi<AuditLogItem[]>(`/api/v1/audit-logs?${queryParams.toString()}`),
  });

  const logs = auditResponse?.data ?? [];
  const meta = auditResponse?.meta;

  const getActionBadge = (act: string) => {
    switch (act) {
      case 'CREATE':
        return <Badge variant="success">CREATE</Badge>;
      case 'UPDATE':
        return <Badge variant="warning">UPDATE</Badge>;
      case 'DELETE':
        return <Badge variant="danger">DELETE</Badge>;
      case 'LOGIN':
        return <Badge variant="info">LOGIN</Badge>;
      case 'LOGOUT':
        return <Badge variant="neutral">LOGOUT</Badge>;
      default:
        return <Badge variant="primary">{act}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filter Action */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                Filter Aksi (Action)
              </label>
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Semua Aksi</option>
                <option value="LOGIN">LOGIN</option>
                <option value="LOGOUT">LOGOUT</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="STOCK_IN">STOCK_IN</option>
                <option value="STOCK_OPNAME">STOCK_OPNAME</option>
                <option value="CLOSING">CLOSING</option>
              </select>
            </div>

            {/* Filter Entity */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                Filter Entitas (Entity)
              </label>
              <input
                type="text"
                placeholder="Mis. User, Transaction, Stock..."
                value={entity}
                onChange={(e) => {
                  setEntity(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-slate-400"
              />
            </div>

            {/* Date From */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Dari Tanggal
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Date To */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs rounded-md border border-border bg-surface px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {isError && (
        <ErrorBanner
          title="Gagal Memuat Audit Log"
          message={error instanceof Error ? error.message : 'Terjadi kesalahan sistem'}
          onRetry={() => refetch()}
        />
      )}

      {/* Table of Audit Logs */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Rekam Jejak Operasional (Audit Trail)</h3>
            <p className="text-xs text-muted">Histori tidak dapat diubah (immutable) mencatat setiap write &amp; login ke sistem</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Tidak Ada Catatan Audit"
              description="Tidak ditemukan log aktivitas yang sesuai dengan filter pencarian."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Waktu (WIB)</th>
                  <th className="py-3 px-4">Aktor Pengguna</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                  <th className="py-3 px-4">Entitas Terkait</th>
                  <th className="py-3 px-4">Alamat IP</th>
                  <th className="py-3 px-4 text-center">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      {log.actor ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {log.actor.name || log.actor.email}
                          </span>
                          <RoleBadge role={log.actor.role} size="sm" />
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Sistem / Anonim</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-foreground">{log.entity}</span>
                      {log.entityId && (
                        <span className="block font-mono text-[11px] text-muted truncate max-w-[160px]">
                          ID: {log.entityId}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {log.ip || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="h-7 px-2.5 text-xs gap-1"
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-500" />
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {meta?.totalPages && meta.totalPages > 1 && (
          <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted">
            <span>
              Menampilkan halaman {meta.page || 1} dari {meta.totalPages} ({meta.total || 0} log aktivitas)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-md border border-border bg-surface hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={page >= (meta.totalPages || 1)}
                onClick={() => setPage((p) => Math.min(meta.totalPages || 1, p + 1))}
                className="p-1.5 rounded-md border border-border bg-surface hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail Perubahan Log */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <Card className="w-full max-w-2xl bg-surface border-border shadow-md max-h-[85vh] flex flex-col">
            <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Detail Catatan Audit Log
                </CardTitle>
                <p className="text-xs text-muted">
                  ID: {selectedLog.id} &bull; {formatDateTime(selectedLog.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-md text-slate-400 hover:text-foreground hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>

            <CardContent className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 pb-2 border-b border-border">
                <div>
                  <span className="text-slate-400 block">Aksi / Entitas</span>
                  <span className="font-semibold text-foreground">
                    {selectedLog.action} &bull; {selectedLog.entity}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Aktor / IP</span>
                  <span className="font-semibold text-foreground">
                    {selectedLog.actor?.name || selectedLog.actor?.email || 'Sistem'} ({selectedLog.ip || 'Local'})
                  </span>
                </div>
              </div>

              {selectedLog.note && (
                <div>
                  <span className="text-slate-400 block mb-1">Catatan Tambahan:</span>
                  <div className="p-2.5 rounded-md bg-slate-50 border border-border text-foreground">
                    {selectedLog.note}
                  </div>
                </div>
              )}

              {/* State Before / After */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Data Sebelum (Before):</span>
                  <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 overflow-x-auto text-[11px] max-h-48 font-mono">
                    {selectedLog.before
                      ? JSON.stringify(selectedLog.before, null, 2)
                      : '// Tidak ada data state awal'}
                  </pre>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Data Sesudah (After):</span>
                  <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 overflow-x-auto text-[11px] max-h-48 font-mono">
                    {selectedLog.after
                      ? JSON.stringify(selectedLog.after, null, 2)
                      : '// Tidak ada data state akhir'}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

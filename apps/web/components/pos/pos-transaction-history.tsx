'use client';

import React, { useState } from 'react';
import { type PosTransaction } from './pos-types';
import { formatRupiah, formatDateTime } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/placeholder';
import {
  Search,
  Receipt,
  FileEdit,
  Printer,
  Ban,
  Clock,
  CheckCircle,
  XCircle,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PosTransactionHistoryProps {
  transactions: PosTransaction[];
  isLoading: boolean;
  userRole?: string;
  onResumeDraft: (trx: PosTransaction) => void;
  onViewReceipt: (trx: PosTransaction) => void;
  onCancelTransaction?: (trx: PosTransaction) => void;
}

export function PosTransactionHistory({
  transactions,
  isLoading,
  userRole,
  onResumeDraft,
  onViewReceipt,
  onCancelTransaction,
}: PosTransactionHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PAID' | 'CANCELLED'>('ALL');
  const [search, setSearch] = useState('');

  const filteredTransactions = transactions.filter((trx) => {
    if (statusFilter !== 'ALL' && trx.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTrxNo = trx.transactionNumber.toLowerCase().includes(q);
      const matchPatient = trx.patientName?.toLowerCase().includes(q);
      if (!matchTrxNo && !matchPatient) return false;
    }
    return true;
  });

  return (
    <Card className="border border-border shadow-xs">
      <CardHeader className="py-3 px-4 border-b border-border bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Riwayat Transaksi Cabang
            </CardTitle>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari no. transaksi / pasien..."
                className="w-full pl-8 pr-3 py-1 text-xs rounded border border-border bg-surface text-foreground placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center p-0.5 rounded-md bg-slate-200/70 border border-border text-[11px]">
              {(['ALL', 'PAID', 'DRAFT', 'CANCELLED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    'px-2 py-0.5 rounded font-medium transition-colors',
                    statusFilter === status
                      ? 'bg-surface text-primary font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-foreground'
                  )}
                >
                  {status === 'ALL'
                    ? 'Semua'
                    : status === 'PAID'
                    ? 'Lunas'
                    : status === 'DRAFT'
                    ? 'Draft'
                    : 'Batal'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-border space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-3 w-48" />
              </div>
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-8 w-8" />}
            title="Tidak ada transaksi"
            description={
              search
                ? `Tidak ditemukan transaksi dengan kata kunci "${search}"`
                : 'Belum ada transaksi di cabang ini'
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((trx) => (
              <div
                key={trx.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-border bg-surface hover:border-slate-300 transition-colors gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-foreground">
                      {trx.transactionNumber}
                    </span>

                    {trx.status === 'PAID' && (
                      <Badge variant="success" className="text-[10px] py-0">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Lunas
                      </Badge>
                    )}
                    {trx.status === 'DRAFT' && (
                      <Badge variant="warning" className="text-[10px] py-0">
                        <Clock className="h-3 w-3 mr-1" />
                        Draft
                      </Badge>
                    )}
                    {trx.status === 'CANCELLED' && (
                      <Badge variant="danger" className="text-[10px] py-0">
                        <XCircle className="h-3 w-3 mr-1" />
                        Batal
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted">
                    <span>{formatDateTime(trx.paidAt || trx.createdAt)}</span>
                    {trx.patientName && (
                      <span className="flex items-center gap-1 text-slate-700 font-medium">
                        <User className="h-3 w-3" />
                        {trx.patientName}
                      </span>
                    )}
                  </div>

                  {trx.items && trx.items.length > 0 && (
                    <div className="text-[11px] text-slate-500">
                      {trx.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <div className="text-sm font-extrabold text-primary">
                    {formatRupiah(trx.total)}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {trx.status === 'DRAFT' && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => onResumeDraft(trx)}
                        className="h-7 px-2.5 text-xs gap-1"
                      >
                        <FileEdit className="h-3 w-3" />
                        <span>Lanjutkan</span>
                      </Button>
                    )}

                    {trx.status === 'PAID' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onViewReceipt(trx)}
                        className="h-7 px-2.5 text-xs gap-1"
                      >
                        <Printer className="h-3 w-3" />
                        <span>Struk</span>
                      </Button>
                    )}

                    {trx.status === 'PAID' && userRole === 'OWNER' && onCancelTransaction && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => onCancelTransaction(trx)}
                        className="h-7 px-2.5 text-xs gap-1"
                      >
                        <Ban className="h-3 w-3" />
                        <span>Batal</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

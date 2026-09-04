'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  TrendingUp,
  Package,
  CreditCard,
  Boxes,
  PieChart,
  ShieldAlert,
  ShieldX,
} from 'lucide-react';
import type { ReportTabId } from '@/components/reports/reports-types';
import { SalesTab } from '@/components/reports/sales-tab';
import { ProductsTab } from '@/components/reports/products-tab';
import { ExpensesTab } from '@/components/reports/expenses-tab';
import { InventoryTab } from '@/components/reports/inventory-tab';
import { GrossProfitTab } from '@/components/reports/gross-profit-tab';
import { AuditLogsTab } from '@/components/reports/audit-logs-tab';

interface TabItem {
  id: ReportTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: string[];
}

const ALL_TABS: TabItem[] = [
  {
    id: 'sales',
    label: 'Penjualan',
    icon: TrendingUp,
    allowedRoles: ['OWNER'],
  },
  {
    id: 'products',
    label: 'Produk Terlaris',
    icon: Package,
    allowedRoles: ['OWNER'],
  },
  {
    id: 'expenses',
    label: 'Pengeluaran',
    icon: CreditCard,
    allowedRoles: ['OWNER', 'MANAGER'],
  },
  {
    id: 'inventory',
    label: 'Persediaan (WAC)',
    icon: Boxes,
    allowedRoles: ['OWNER', 'MANAGER'],
  },
  {
    id: 'gross-profit',
    label: 'Laba Kotor',
    icon: PieChart,
    allowedRoles: ['OWNER'],
  },
  {
    id: 'audit-logs',
    label: 'Audit Log',
    icon: ShieldAlert,
    allowedRoles: ['OWNER'],
  },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const role = user?.role || '';

  // Filter tabs yang diperbolehkan untuk role pengguna saat ini (tersembunyi untuk role tanpa akses)
  const availableTabs = ALL_TABS.filter((tab) => tab.allowedRoles.includes(role));

  // Tentukan default tab berdasarkan role:
  // OWNER default ke 'sales', MANAGER default ke 'inventory'
  const defaultTabId = availableTabs[0]?.id || 'sales';
  const [activeTab, setActiveTab] = useState<ReportTabId>(defaultTabId);

  // Jika activeTab saat ini tidak diizinkan untuk role (misal state tersimpan), fallback ke first available tab
  const currentTabId = availableTabs.some((t) => t.id === activeTab)
    ? activeTab
    : defaultTabId;

  // Guard: Role tanpa izin laporan sama sekali (misal CASHIER atau EMPLOYEE)
  if (!user || availableTabs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border-border text-center shadow-sm">
          <CardContent className="p-8 space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-bg text-danger-icon mx-auto">
              <ShieldX className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Akses Ditolak</h2>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Anda tidak memiliki izin wewenang untuk mengakses modul Laporan &amp; Analitik klinik.
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
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Laporan &amp; Analitik Klinik
            </h1>
            <p className="text-xs text-muted">
              {role === 'OWNER'
                ? 'Konsolidasi kinerja keuangan, penjualan obat, stok bahan, dan audit trail'
                : 'Laporan operasional persediaan bahan medis dan pencatatan beban cabang'}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-border pb-px overflow-x-auto">
        {availableTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTabId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-primary text-primary bg-primary-soft/30 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-foreground hover:bg-slate-50 rounded-t-lg'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panels */}
      <div>
        {currentTabId === 'sales' && <SalesTab />}
        {currentTabId === 'products' && <ProductsTab />}
        {currentTabId === 'expenses' && <ExpensesTab />}
        {currentTabId === 'inventory' && <InventoryTab />}
        {currentTabId === 'gross-profit' && <GrossProfitTab />}
        {currentTabId === 'audit-logs' && <AuditLogsTab />}
      </div>
    </div>
  );
}

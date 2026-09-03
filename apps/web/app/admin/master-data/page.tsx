'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchApi } from '@/lib/api-client';
import { Permission } from '@oase/shared';
import { MasterTabType, Category } from '@/components/master-data/master-types';
import { ServicesTab } from '@/components/master-data/services-tab';
import { MaterialsTab } from '@/components/master-data/materials-tab';
import { CategoriesTab } from '@/components/master-data/categories-tab';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Database,
  Stethoscope,
  Boxes,
  Tags,
  ShieldX,
} from 'lucide-react';

export default function MasterDataPage() {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<MasterTabType>('services');

  // Permission Guard: OWNER, MANAGER, CASHIER yang memiliki MASTER_DATA_READ
  const canAccess =
    user?.role === 'OWNER' ||
    user?.role === 'MANAGER' ||
    user?.role === 'CASHIER' ||
    hasPermission(Permission.MASTER_DATA_READ) ||
    hasPermission(Permission.MASTER_DATA_MANAGE);

  // Fetch daftar kategori untuk diteruskan ke tab layanan & modal
  const { data: categoriesResponse } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => {
      return fetchApi<Category[]>('/api/v1/categories?limit=100');
    },
    enabled: canAccess && !!user,
  });

  const categories = categoriesResponse?.data ?? [];

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
              Anda tidak memiliki izin wewenang (<code>MASTER_DATA_READ</code>) untuk melihat katalog master data klinik.
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

  const tabs: { id: MasterTabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'services', label: 'Layanan Medis', icon: Stethoscope },
    { id: 'materials', label: 'Bahan Klinis', icon: Boxes },
    { id: 'categories', label: 'Kategori Tindakan', icon: Tags },
  ];

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Master Data Klinik
              </h1>
              <p className="text-xs text-muted">
                Katalog global tindakan medis, bahan klinis, dan kategori
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation Navigation Bar */}
      <div className="flex items-center gap-1 border-b border-border pb-px overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
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
        {activeTab === 'services' && <ServicesTab categories={categories} />}
        {activeTab === 'materials' && <MaterialsTab />}
        {activeTab === 'categories' && <CategoriesTab />}
      </div>
    </div>
  );
}

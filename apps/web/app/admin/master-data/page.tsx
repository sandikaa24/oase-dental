import { Placeholder } from '@/components/ui/placeholder';
import { Database } from 'lucide-react';

export default function MasterDataPage() {
  return (
    <Placeholder
      title="Master Data Klinik"
      description="Pengelolaan katalog layanan tindakan medis gigi, produk penjualan, dan bahan/material klinik."
      badgeText="Fase 2"
      icon={<Database className="h-8 w-8" />}
    />
  );
}

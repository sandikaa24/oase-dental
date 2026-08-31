import { Placeholder } from '@/components/ui/placeholder';
import { Package } from 'lucide-react';

export default function InventoryPage() {
  return (
    <Placeholder
      title="Inventaris, Stok & Opname"
      description="Modul kartu stok, penerimaan barang (stock in), dan penyesuaian stok opname."
      badgeText="Fase 5"
      icon={<Package className="h-8 w-8" />}
    />
  );
}

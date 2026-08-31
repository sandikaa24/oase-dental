import { Placeholder } from '@/components/ui/placeholder';
import { ShoppingCart } from 'lucide-react';

export default function PosPage() {
  return (
    <Placeholder
      title="Kasir & Penjualan (POS)"
      description="Modul Point of Sale untuk pencatatan transaksi, pemilihan layanan & produk, serta struk kasir."
      badgeText="Fase 3"
      icon={<ShoppingCart className="h-8 w-8" />}
    />
  );
}

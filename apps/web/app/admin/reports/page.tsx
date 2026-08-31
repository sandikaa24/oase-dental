import { Placeholder } from '@/components/ui/placeholder';
import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  return (
    <Placeholder
      title="Laporan &amp; Analitik Eksekutif"
      description="Laporan omset penjualan, laba kotor, rekap kas, dan ekspor data CSV multi-cabang."
      badgeText="Fase 7"
      icon={<BarChart3 className="h-8 w-8" />}
    />
  );
}

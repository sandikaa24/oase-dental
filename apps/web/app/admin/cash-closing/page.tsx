import { Placeholder } from '@/components/ui/placeholder';
import { Receipt } from 'lucide-react';

export default function CashClosingPage() {
  return (
    <Placeholder
      title="Tutup Kas & Rekonsiliasi Kas Harian"
      description="Modul closing kasir harian, hitung kas fisik, dan deteksi selisih omset tunai."
      badgeText="Fase 4"
      icon={<Receipt className="h-8 w-8" />}
    />
  );
}

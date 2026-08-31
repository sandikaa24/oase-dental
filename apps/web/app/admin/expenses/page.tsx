import { Placeholder } from '@/components/ui/placeholder';
import { CreditCard } from 'lucide-react';

export default function ExpensesPage() {
  return (
    <Placeholder
      title="Pengeluaran Operasional"
      description="Pencatatan pengeluaran harian klinik beserta upload bukti kuitansi / nota."
      badgeText="Fase 6"
      icon={<CreditCard className="h-8 w-8" />}
    />
  );
}

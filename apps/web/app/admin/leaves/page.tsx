import { Placeholder } from '@/components/ui/placeholder';
import { CalendarDays } from 'lucide-react';

export default function LeavesPage() {
  return (
    <Placeholder
      title="Manajemen Cuti & Izin"
      description="Pengajuan cuti staf dan persetujuan / penolakan oleh Branch Manager."
      badgeText="Fase 6"
      icon={<CalendarDays className="h-8 w-8" />}
    />
  );
}

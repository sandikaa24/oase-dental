import { Placeholder } from '@/components/ui/placeholder';
import { Clock } from 'lucide-react';

export default function AttendancePage() {
  return (
    <Placeholder
      title="Absensi & Kehadiran Karyawan"
      description="Pencatatan presensi masuk dan keluar shift serta rekapitulasi kehadiran karyawan."
      badgeText="Fase 6"
      icon={<Clock className="h-8 w-8" />}
    />
  );
}

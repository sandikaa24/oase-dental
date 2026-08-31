import { Placeholder } from '@/components/ui/placeholder';
import { Building2 } from 'lucide-react';

export default function BranchesPage() {
  return (
    <Placeholder
      title="Manajemen Cabang Klinik"
      description="Pengelolaan profil cabang, alamat, nomor telepon operasional, dan status aktif cabang."
      badgeText="Fase 1"
      icon={<Building2 className="h-8 w-8" />}
    />
  );
}

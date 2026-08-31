import { Placeholder } from '@/components/ui/placeholder';
import { Globe } from 'lucide-react';

export default function PortalManagementPage() {
  return (
    <Placeholder
      title="Manajemen Konten Portal Publik"
      description="Pengaturan konten website publik, profil klinik, daftar layanan tampil, dan kontak cabang."
      badgeText="Fase 8"
      icon={<Globe className="h-8 w-8" />}
    />
  );
}

import { Placeholder } from '@/components/ui/placeholder';
import { Users } from 'lucide-react';

export default function UsersPage() {
  return (
    <Placeholder
      title="Manajemen Pengguna &amp; Akun"
      description="Pendaftaran pengguna baru, penentuan role sistem, dan penugasan akses cabang staf."
      badgeText="Fase 1"
      icon={<Users className="h-8 w-8" />}
    />
  );
}

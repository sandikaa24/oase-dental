import { Placeholder } from '@/components/ui/placeholder';
import { ShieldAlert } from 'lucide-react';

export default function AuditLogsPage() {
  return (
    <Placeholder
      title="Audit Trail &amp; Log Aktivitas"
      description="Histori pencatatan aktivitas transaksi, stok, perubahan status, dan tindakan sensitif sistem."
      badgeText="Fase 7"
      icon={<ShieldAlert className="h-8 w-8" />}
    />
  );
}

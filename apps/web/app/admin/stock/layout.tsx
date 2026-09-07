import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Server-side guard untuk modul Stok (/admin/stock).
 * BINDING: Task B1.6 — CASHIER dilarang keras mengakses modul stok (langsung redirect ke /admin).
 */
export default async function StockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (token) {
    try {
      const payload = await verifyAccessToken(token);
      if (payload.role === 'CASHIER') {
        redirect('/admin');
      }
    } catch {
      // Jika token invalid/expired, AdminLayout atau AdminShell yang menangani redirect ke /login
    }
  }

  return <>{children}</>;
}

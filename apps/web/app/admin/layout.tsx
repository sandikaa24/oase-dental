import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth';
import { AdminShell } from '@/components/layout/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const hasAccessToken = cookieStore.has(ACCESS_TOKEN_COOKIE);
  const hasRefreshToken = cookieStore.has(REFRESH_TOKEN_COOKIE);

  // Server-side guard: jika tidak ada access/refresh token, lempar ke login
  if (!hasAccessToken && !hasRefreshToken) {
    redirect('/login');
  }

  return <AdminShell>{children}</AdminShell>;
}

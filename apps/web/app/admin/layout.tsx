import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  BRANCH_CONTEXT_COOKIE,
  verifyAccessToken,
  isMultiBranchUser,
} from '@/lib/auth';
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

  // Server-side guard konteks cabang (Amandemen A3: gunakan isMultiBranchUser bersama)
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (accessToken) {
    try {
      const payload = await verifyAccessToken(accessToken);
      const isMulti = isMultiBranchUser(payload);
      if (isMulti) {
        const branchContext = cookieStore.get(BRANCH_CONTEXT_COOKIE)?.value;
        if (!branchContext) {
          redirect('/select-branch');
        }
      }
    } catch {
      // Jika access token invalid/expired, lempar ke login bila tidak ada refresh token
      if (!hasRefreshToken) {
        redirect('/login');
      }
    }
  }

  return <AdminShell>{children}</AdminShell>;
}


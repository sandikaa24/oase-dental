import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Root landing route (/).
 * 
 * Placeholder guard:
 * - Jika terdapat cookie session (access_token atau refresh_token), redirect ke /admin.
 * - Jika tidak ada cookie auth sama sekali, redirect ke /login.
 * 
 * CATATAN ARSITEKTUR:
 * Logika ini bersifat placeholder sementara. Saat Portal Publik (PRD §7.10)
 * diimplementasikan, rute root (/) ini akan menjadi halaman portal publik
 * utama dan alur redirect ke dashboard ini dipindahkan ke tombol login portal.
 */
export default function RootPage() {
  const cookieStore = cookies();
  const hasAccessToken = cookieStore.has(ACCESS_TOKEN_COOKIE);
  const hasRefreshToken = cookieStore.has(REFRESH_TOKEN_COOKIE);

  if (hasAccessToken || hasRefreshToken) {
    redirect('/admin');
  }

  redirect('/login');
}

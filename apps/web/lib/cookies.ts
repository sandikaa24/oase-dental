import type { NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth';

const ACCESS_MAX_AGE = 15 * 60; // 15 menit, sama dengan umur JWT access
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 hari, sama dengan umur JWT refresh

function baseOptions() {
  const isSecure =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isSecure,
    path: '/',
  };
}

/**
 * Set cookie access + refresh pada response.
 * httpOnly agar tidak terbaca JavaScript client.
 */
export function setAuthCookies(
  res: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
): void {
  res.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    maxAge: ACCESS_MAX_AGE,
  });

  res.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    maxAge: REFRESH_MAX_AGE,
  });
}

/**
 * Hapus kedua cookie auth (dipakai saat logout).
 */
export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_TOKEN_COOKIE, '', { ...baseOptions(), maxAge: 0 });
  res.cookies.set(REFRESH_TOKEN_COOKIE, '', { ...baseOptions(), maxAge: 0 });
}
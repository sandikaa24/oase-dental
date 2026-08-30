import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken, type AccessTokenPayload } from './auth';
import { ForbiddenError, UnauthorizedError } from './errors';
import type { UserRole } from '@oase/shared';

/**
 * Context user hasil verifikasi access token.
 * branchId SELALU dari JWT claim, tidak pernah dari client (AGENTS.md aturan 7).
 */
export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  branchId: string | null;
  employeeId: string | null;
}

/**
 * Ambil & verifikasi access token dari httpOnly cookie.
 * Throw UnauthorizedError jika cookie tidak ada atau token invalid/expired.
 */
export async function requireAuth(): Promise<AuthContext> {
  const store = cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    throw new UnauthorizedError('Token tidak ditemukan');
  }

  let payload: AccessTokenPayload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    // Jangan bocorkan detail kriptografis ke client.
    throw new UnauthorizedError('Token tidak valid atau kedaluwarsa');
  }

  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role as UserRole,
    branchId: payload.branchId,
    employeeId: payload.employeeId,
  };
}

/**
 * Pastikan role user termasuk salah satu role yang diizinkan.
 * Throw ForbiddenError jika tidak.
 */
export function requireRole(auth: AuthContext, ...allowed: UserRole[]): void {
  if (!allowed.includes(auth.role)) {
    throw new ForbiddenError('Role tidak diizinkan mengakses resource ini');
  }
}

/**
 * Ambil IP client untuk audit log (tanpa menyimpan PII lain).
 */
export function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    return first ? first.trim() : null;
  }
  return req.headers.get('x-real-ip');
}
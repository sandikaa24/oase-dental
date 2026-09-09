import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  BRANCH_CONTEXT_COOKIE,
  verifyAccessToken,
  type AccessTokenPayload,
} from './auth';
import { ForbiddenError, UnauthorizedError, BranchContextRequiredError } from './errors';
import { hasPermission, type Permission, type UserRole } from '@oase/shared';


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
  branchCount?: number;
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
    branchCount: payload.branchCount,
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
 * Pastikan role user punya permission tertentu berdasarkan PERMISSION_MATRIX
 * di @oase/shared (sumber tunggal, BINDING dari PRD Bagian 5).
 * Throw ForbiddenError (403 FORBIDDEN) jika tidak.
 *
 * Catatan lapisan: guard ini memakai code FORBIDDEN untuk role/permission check.
 * Penolakan akses cabang adalah lapisan berbeda dan tetap memakai
 * BranchAccessDeniedError (403 BRANCH_ACCESS_DENIED) — jangan digabung.
 */
export function requirePermission(auth: AuthContext, permission: Permission): void {
  if (!hasPermission(auth.role, permission)) {
    throw new ForbiddenError('Permission tidak mencukupi untuk aksi ini');
  }
}

/**
 * Pastikan user memiliki konteks cabang aktif (Guard Konteks Server-side).
 * - Multi-cabang tanpa konteks: throw BranchContextRequiredError (400 BRANCH_CONTEXT_REQUIRED)
 * - Konteks "ALL" pada endpoint aksi fisik (POS/closing/mutasi/check-in): ditolak bila allowAllForOwner = false.
 * - Single-cabang: otomatis valid menggunakan branch aktifnya.
 */
export async function requireBranchContext(
  auth: AuthContext,
  options: { allowAllForOwner?: boolean } = {}
): Promise<string | null> {
  const store = cookies();
  const branchContext = store.get(BRANCH_CONTEXT_COOKIE)?.value ?? auth.branchId;

  if (!branchContext) {
    throw new BranchContextRequiredError(
      'Konteks cabang belum dipilih. Silakan pilih cabang kerja terlebih dahulu.'
    );
  }

  if (branchContext === 'ALL') {
    if (auth.role !== 'OWNER') {
      throw new ForbiddenError('Hanya OWNER yang dapat mengakses konteks Semua Cabang');
    }
    if (!options.allowAllForOwner) {
      throw new BranchContextRequiredError(
        'Pilih salah satu cabang fisik spesifik untuk melakukan tindakan operasional ini.'
      );
    }
    return null;
  }

  return branchContext;
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
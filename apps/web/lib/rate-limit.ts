import { TooManyRequestsError } from './errors';

/**
 * Rate Limiter Bertahap (Escalating Lockout) untuk proteksi brute force login.
 * 
 * Aturan Bisnis & Penalti:
 * - Hitungan salah per email + IP.
 * - Salah 1–5: tanpa penalti (error kredensial biasa).
 * - Salah ke-6: blokir 15 detik.
 * - Salah ke-7: blokir 30 detik.
 * - Salah ke-8: blokir 60 detik (1 menit).
 * - Salah ke-9: blokir 300 detik (5 menit).
 * - Salah ke-10+: blokir 900 detik (15 menit - maksimum).
 * 
 * Anti-Bypass:
 * - Menunggu masa lockout TIDAK me-reset failureCount.
 * - Satu-satunya reset ke nol: recordLoginSuccess().
 */

export interface LockoutTier {
  readonly failures: number;
  readonly lockoutSeconds: number;
}

export const LOGIN_LOCKOUT_TIERS: readonly LockoutTier[] = [
  { failures: 6,  lockoutSeconds: 15 },
  { failures: 7,  lockoutSeconds: 30 },
  { failures: 8,  lockoutSeconds: 60 },
  { failures: 9,  lockoutSeconds: 300 },
  { failures: 10, lockoutSeconds: 900 }, // 10+ = maksimum
];

export interface RateLimitRecord {
  failureCount: number;
  lockedUntil: number;   // Epoch ms timestamp sampai kapan terkunci
  lastFailedAt: number;  // Epoch ms timestamp kegagalan terakhir
}

export interface RateLimitOptions {
  now?: number;
  bypassEnvCheck?: boolean;
}

// In-memory store per ip:email (singleton via globalThis agar tidak terhapus saat Fast Refresh dev)
const globalForRateLimit = globalThis as unknown as {
  rateLimitFailureStore?: Map<string, RateLimitRecord>;
};

const failureStore = globalForRateLimit.rateLimitFailureStore ?? new Map<string, RateLimitRecord>();

if (process.env.NODE_ENV !== 'production') {
  globalForRateLimit.rateLimitFailureStore = failureStore;
}

const INACTIVE_CLEANUP_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 jam

export function getRateLimitKey(ip: string | null | undefined, email: string): string {
  const safeIp = ip?.trim() || 'unknown';
  return `${safeIp}:${email.trim().toLowerCase()}`;
}

export function getLockoutDurationSeconds(failureCount: number): number {
  if (failureCount < 6) return 0;
  const tier = LOGIN_LOCKOUT_TIERS.find((t) => t.failures === failureCount);
  if (tier) return tier.lockoutSeconds;
  return LOGIN_LOCKOUT_TIERS[LOGIN_LOCKOUT_TIERS.length - 1]?.lockoutSeconds ?? 900;
}

function isRateLimitEnabled(options?: RateLimitOptions): boolean {
  if (options?.bypassEnvCheck) return true;
  if (process.env.RATE_LIMIT_ENABLED === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

/**
 * Memeriksa apakah suatu key sedang dalam masa penalti lockout.
 * Melemparkan TooManyRequestsError (HTTP 429) jika still locked.
 */
export function checkLoginRateLimit(key: string, options?: RateLimitOptions): void {
  if (!isRateLimitEnabled(options)) {
    return;
  }

  const now = options?.now ?? Date.now();
  const record = failureStore.get(key);

  if (!record) {
    return;
  }

  // Aturan 1: now < lockedUntil -> lempar TooManyRequestsError dengan sisa detik
  if (now < record.lockedUntil) {
    const remainingSeconds = Math.max(1, Math.ceil((record.lockedUntil - now) / 1000));
    throw new TooManyRequestsError(
      `Terlalu banyak percobaan login. Coba lagi dalam ${remainingSeconds} detik.`
    );
  }

  // Aturan 2: Lockout lewat (now >= lockedUntil) -> lolos, failureCount TIDAK di-reset.
}

/**
 * Mencatat kegagalan percobaan login dan mengeset masa lockout sesuai tier bertahap.
 */
export function recordLoginFailure(key: string, options?: RateLimitOptions): void {
  if (!isRateLimitEnabled(options)) {
    return;
  }

  const now = options?.now ?? Date.now();
  const existing = failureStore.get(key);
  const failureCount = (existing?.failureCount ?? 0) + 1;
  const lockoutSeconds = getLockoutDurationSeconds(failureCount);
  const lockedUntil = lockoutSeconds > 0 ? now + lockoutSeconds * 1000 : 0;

  failureStore.set(key, {
    failureCount,
    lockedUntil,
    lastFailedAt: now,
  });

  if (failureStore.size > 10000) {
    cleanupOldEntries(now);
  }
}

/**
 * Menghapus rekaman kegagalan saat user berhasil login.
 * Ini adalah SATU-SATUNYA pemulangan hitungan ke nol.
 */
export function recordLoginSuccess(key: string, options?: RateLimitOptions): void {
  if (!isRateLimitEnabled(options)) {
    return;
  }
  failureStore.delete(key);
}

/**
 * Pembersihan memori (anti-leak):
 * - Entri dihapus jika tidak aktif >24 jam DAN tidak sedang terkunci.
 * - Jika setelah pembersihan masih >10.000, entri tertua yang tidak terkunci dihapus.
 */
export function cleanupOldEntries(now: number = Date.now()): void {
  for (const [key, record] of failureStore.entries()) {
    const isInactive = now - record.lastFailedAt > INACTIVE_CLEANUP_THRESHOLD_MS;
    const isNotLocked = now >= record.lockedUntil;
    if (isInactive && isNotLocked) {
      failureStore.delete(key);
    }
  }

  if (failureStore.size > 10000) {
    const entries = Array.from(failureStore.entries())
      .filter(([, r]) => now >= r.lockedUntil)
      .sort((a, b) => a[1].lastFailedAt - b[1].lastFailedAt);

    for (const [key] of entries) {
      if (failureStore.size <= 10000) break;
      failureStore.delete(key);
    }
  }
}

/**
 * Khusus unit testing rate limiter.
 */
export function _resetStoreForTesting(): void {
  failureStore.clear();
}

export function _getRecordForTesting(key: string): RateLimitRecord | undefined {
  return failureStore.get(key);
}

export function _getStoreSizeForTesting(): number {
  return failureStore.size;
}

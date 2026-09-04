import { TooManyRequestsError } from './errors';

/**
 * Sliding-window in-memory rate limiter untuk proteksi brute force login.
 * Batasan: Maksimal 5 kali percobaan gagal per IP/email dalam jendela 15 menit.
 * 
 * Aturan Khusus:
 * - Wajib di-bypass saat NODE_ENV !== 'production' agar test suite regresi tidak terblokir.
 */

interface RateLimitConfig {
  maxFailures: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxFailures: 5,
  windowMs: 15 * 60 * 1000, // 15 menit
};

// Map penyimpanan riwayat timestamp kegagalan login per key
const failureStore = new Map<string, number[]>();

export function getRateLimitKey(ip: string | null | undefined, email: string): string {
  const safeIp = ip?.trim() || 'unknown';
  return `${safeIp}:${email.trim().toLowerCase()}`;
}

/**
 * Memeriksa apakah suatu key telah melebihi batas percobaan login gagal.
 * Melemparkan TooManyRequestsError (HTTP 429) jika kuota terlampaui.
 */
export function checkLoginRateLimit(key: string, config: RateLimitConfig = DEFAULT_CONFIG): void {
  // Bypass pada environment non-produksi (development & testing)
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const now = Date.now();
  const windowStart = now - config.windowMs;

  const timestamps = failureStore.get(key) || [];
  // Bersihkan rekaman yang sudah di luar jendela sliding window
  const activeTimestamps = timestamps.filter((t) => t > windowStart);

  if (activeTimestamps.length >= config.maxFailures) {
    throw new TooManyRequestsError();
  }

  if (activeTimestamps.length !== timestamps.length) {
    if (activeTimestamps.length === 0) {
      failureStore.delete(key);
    } else {
      failureStore.set(key, activeTimestamps);
    }
  }
}

/**
 * Mencatat kegagalan percobaan login.
 */
export function recordLoginFailure(key: string, config: RateLimitConfig = DEFAULT_CONFIG): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const now = Date.now();
  const windowStart = now - config.windowMs;

  const timestamps = failureStore.get(key) || [];
  const activeTimestamps = timestamps.filter((t) => t > windowStart);
  activeTimestamps.push(now);

  failureStore.set(key, activeTimestamps);

  // Prevent memory leak jika ada jutaan key unik
  if (failureStore.size > 10000) {
    cleanupOldEntries(config.windowMs);
  }
}

/**
 * Menghapus rekaman kegagalan saat user berhasil login.
 */
export function recordLoginSuccess(key: string): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  failureStore.delete(key);
}

function cleanupOldEntries(windowMs: number): void {
  const now = Date.now();
  const threshold = now - windowMs;

  for (const [key, timestamps] of failureStore.entries()) {
    const valid = timestamps.filter((t) => t > threshold);
    if (valid.length === 0) {
      failureStore.delete(key);
    } else {
      failureStore.set(key, valid);
    }
  }
}

/**
 * Khusus unit testing rate limiter (bila perlu memanipulasi store).
 */
export function _resetStoreForTesting(): void {
  failureStore.clear();
}

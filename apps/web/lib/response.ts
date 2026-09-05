import { NextResponse } from 'next/server';
import type { AppError } from './errors';

/**
 * Response helper — standar global (lihat PRD 6.1).
 * Sukses: { success: true, data, meta? }
 */
export function ok<T>(data: T, meta?: { page: number; limit: number; total: number; totalPages: number }) {
  return NextResponse.json(
    meta ? { success: true as const, data, meta } : { success: true as const, data },
  );
}

/**
 * Response gagal — standar global.
 * { success: false, message, code }
 */
export function fail(error: AppError) {
  const payload: Record<string, unknown> = {
    success: false as const,
    message: error.message,
    code: error.code,
  };
  if ('available' in error && (error as { available?: number }).available !== undefined) {
    payload.available = (error as { available?: number }).available;
  }
  return NextResponse.json(payload, { status: error.statusCode });
}
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
  return NextResponse.json(
    {
      success: false as const,
      message: error.message,
      code: error.code,
    },
    { status: error.statusCode },
  );
}
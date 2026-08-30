import { ZodError } from 'zod';
import { AppError } from './errors';
import { fail } from './response';
import { NextResponse } from 'next/server';

/**
 * Error handler terpusat untuk semua route handler.
 * Pakai: export const POST = withErrorHandler(async (req) => { ... });
 *
 * - ZodError  -> 400 VALIDATION_ERROR + details (path + message)
 * - AppError  -> status & code sesuai class-nya
 * - lainnya   -> 500 INTERNAL_ERROR (detail asli di-log, tidak dibocorkan)
 */
export function withErrorHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error);
    }
  };
}

/**
 * Ubah error apa pun menjadi response sesuai konvensi PRD 6.1/6.2.
 */
export function handleError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    return NextResponse.json(
      {
        success: false as const,
        message: 'Validasi gagal',
        code: 'VALIDATION_ERROR',
        details,
      },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    return fail(error);
  }

  // Error tak terduga: log untuk debugging, jangan bocorkan detail ke client.
  console.error('[UNHANDLED_ERROR]', error);

  return NextResponse.json(
    {
      success: false as const,
      message: 'Terjadi kesalahan pada server',
      code: 'INTERNAL_ERROR',
    },
    { status: 500 },
  );
}
import { z } from 'zod';

/**
 * Schema validasi untuk POST /cash-closings
 * actualCash: string angka (karena Decimal), note opsional.
 */
export const createClosingSchema = z.object({
  actualCash: z
    .string({ required_error: 'Kas fisik wajib diisi' })
    .regex(/^\d+(\.\d{1,2})?$/, 'Kas fisik harus berupa angka positif (maks 2 desimal)'),
  note: z.string().max(500, 'Catatan maksimal 500 karakter').nullable().optional(),
});
export type CreateClosingInput = z.infer<typeof createClosingSchema>;

/**
 * Schema validasi untuk GET /cash-closings (query params)
 */
export const closingListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  status: z.enum(['OPEN', 'CLOSED']).optional(),
  branchId: z.string().uuid('branchId harus berformat UUID').optional(),
});
export type ClosingListQuery = z.infer<typeof closingListQuerySchema>;

/**
 * Schema validasi untuk POST /cash-closings/:id/reopen
 * reason wajib min 10 karakter (sesuai API-CONTRACT).
 */
export const reopenClosingSchema = z.object({
  reason: z
    .string({ required_error: 'Alasan reopen wajib diisi' })
    .min(10, 'Alasan harus minimal 10 karakter'),
});
export type ReopenClosingInput = z.infer<typeof reopenClosingSchema>;

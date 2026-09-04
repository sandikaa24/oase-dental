import { z } from 'zod';

export const EXPENSE_CATEGORIES = [
  'OPERASIONAL',
  'GAJI',
  'SEWA',
  'UTILITAS',
  'SUPPLIER',
  'LAINNYA',
] as const;

export type ExpenseCategoryType = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Schema validasi untuk POST /expenses
 */
export const createExpenseSchema = z.object({
  branchId: z.string().uuid('branchId harus berformat UUID').optional(),
  category: z.enum(EXPENSE_CATEGORIES, {
    errorMap: () => ({ message: 'Kategori pengeluaran tidak valid' }),
  }),
  amount: z
    .union([z.number(), z.string()])
    .refine((v) => {
      const num = typeof v === 'number' ? v : parseFloat(v);
      return !isNaN(num) && num > 0;
    }, { message: 'Jumlah pengeluaran harus lebih besar dari 0' }),
  expenseDate: z
    .string({ required_error: 'Tanggal pengeluaran wajib diisi' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  note: z
    .string({ required_error: 'Catatan pengeluaran wajib diisi' })
    .trim()
    .min(1, 'Catatan pengeluaran wajib diisi')
    .max(500, 'Catatan pengeluaran maksimal 500 karakter'),
  proofUrl: z
    .string()
    .url('Format URL bukti tidak valid')
    .nullable()
    .optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

/**
 * Schema validasi untuk GET /expenses (query params)
 */
export const expenseListQuerySchema = z.object({
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
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD').optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD').optional(),
  branchId: z.string().uuid('branchId harus berformat UUID').optional(),
});

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;

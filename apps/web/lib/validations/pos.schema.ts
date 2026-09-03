import { z } from 'zod';

const itemTypeEnum = z.enum(['SERVICE']);
const paymentMethodEnum = z.enum(['CASH', 'DEBIT', 'QRIS_TRANSFER']);
const transactionStatusEnum = z.enum(['DRAFT', 'PAID', 'CANCELLED']);

export const transactionItemInputSchema = z
  .object({
    itemType: itemTypeEnum.optional().default('SERVICE'),
    itemId: z.string().uuid('itemId harus berupa UUID valid'),
    quantity: z.number().int().min(1, 'Quantity minimal 1'),
    price: z
      .union([z.number(), z.string()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null || val === '') return undefined;
        if (typeof val === 'string') {
          const cleaned = val.replace(/[^0-9.]/g, '').trim();
          return cleaned;
        }
        return String(val);
      })
      .refine(
        (val) => {
          if (val === undefined) return true;
          const num = parseFloat(val);
          return !isNaN(num) && num > 0;
        },
        { message: 'Harga item harus lebih besar dari 0' }
      )
      .refine(
        (val) => {
          if (val === undefined) return true;
          const num = parseFloat(val);
          return !isNaN(num) && num <= 999_999_999;
        },
        { message: 'Harga item maksimal 999.999.999 (9 digit)' }
      ),
  })
  .strict();

export const createTransactionSchema = z
  .object({
    items: z
      .array(transactionItemInputSchema)
      .min(1, 'Transaksi minimal memiliki 1 item'),
    patientName: z.string().optional().nullable(),
    patientPhone: z.string().optional().nullable(),
  })
  .strict();

export const updateTransactionSchema = z
  .object({
    items: z.array(transactionItemInputSchema).min(1).optional(),
    patientName: z.string().optional().nullable(),
    patientPhone: z.string().optional().nullable(),
  })
  .strict();

export const paymentInputSchema = z.object({
  method: paymentMethodEnum,
  amount: z
    .union([z.number(), z.string()])
    .transform((val) => String(val))
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      { message: 'Amount pembayaran harus lebih besar dari 0' }
    ),
});

export const payTransactionSchema = z.object({
  payments: z
    .array(paymentInputSchema)
    .min(1, 'Minimal 1 metode pembayaran diperlukan'),
});

export const cancelTransactionSchema = z.object({
  reason: z
    .string()
    .min(10, 'Alasan pembatalan minimal 10 karakter'),
});

export const transactionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: transactionStatusEnum.optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date harus YYYY-MM-DD')
    .optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format dateFrom harus YYYY-MM-DD')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format dateTo harus YYYY-MM-DD')
    .optional(),
  cashierId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  search: z.string().optional(),
});

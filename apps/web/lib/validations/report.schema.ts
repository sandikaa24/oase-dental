import { z } from 'zod';
import { PaymentMethod, ExpenseCategory } from '@prisma/client';

export const baseReportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format dateFrom harus YYYY-MM-DD').optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format dateTo harus YYYY-MM-DD').optional(),
  branchId: z.string().uuid().optional(),
});

export const salesReportQuerySchema = baseReportQuerySchema.extend({
  method: z.nativeEnum(PaymentMethod).optional(),
  groupBy: z.enum(['day', 'month']).optional(),
});

export const expenseReportQuerySchema = baseReportQuerySchema.extend({
  category: z.nativeEnum(ExpenseCategory).optional(),
});

export const auditLogQuerySchema = baseReportQuerySchema.extend({
  action: z.string().optional(),
  entity: z.string().optional(),
  actorId: z.string().uuid().optional(),
});

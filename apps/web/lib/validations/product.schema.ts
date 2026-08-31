import { z } from 'zod';

/**
 * Body Product (API-CONTRACT 7): { name, sku, sellPrice, unit, minStock }.
 * sellPrice = Decimal(12,2) → number non-negatif.
 */
export const createProductSchema = z
  .object({
    name: z.string().min(1),
    sku: z.string().min(1),
    sellPrice: z.number().nonnegative(),
    unit: z.string().min(1),
    minStock: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const updateProductSchema = createProductSchema.partial();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
});

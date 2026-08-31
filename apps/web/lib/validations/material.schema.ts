import { z } from 'zod';

/**
 * Body Material (API-CONTRACT 7): { name, sku, unit, minStock, isStockTracked }.
 * Material tidak dijual (tidak ada harga jual), hanya dipakai/distok.
 */
export const createMaterialSchema = z
  .object({
    name: z.string().min(1),
    sku: z.string().min(1),
    unit: z.string().min(1),
    minStock: z.number().int().min(0).optional(),
    isStockTracked: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const updateMaterialSchema = createMaterialSchema.partial();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
});

import { z } from 'zod';

/**
 * Body Material (API-CONTRACT 7): { name, sku, unit, minStock, isStockTracked }.
 * Material tidak dijual (tidak ada harga jual), hanya dipakai/distok.
 */
export const createMaterialSchema = z
  .object({
    name: z.string().min(1, 'Nama bahan klinis wajib diisi'),
    sku: z.string().min(1, 'SKU bahan klinis wajib diisi'),
    unit: z.string().min(1, 'Satuan unit wajib diisi'),
    category: z.string().min(1).optional().default('Bahan Tindakan'),
    costPrice: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === undefined || val === null || val === '') return null;
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num) ? null : num;
      })
      .refine((val) => val === null || val >= 0, {
        message: 'Harga pokok (costPrice) tidak boleh negatif',
      }),
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

import { z } from 'zod';

/**
 * Body create/update Service (API-CONTRACT 7):
 * { categoryId?, name, nameEn?, description?, descriptionEn?, price,
 *   durationMinutes?, active?, showOnPortal? }
 * price = Decimal(12,2) → divalidasi sebagai number non-negatif,
 * disimpan Prisma sebagai Decimal (AGENTS.md aturan 5: uang bukan Float mentah).
 */
export const createServiceSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    name: z.string().min(1),
    nameEn: z.string().min(1).optional(),
    description: z.string().optional(),
    descriptionEn: z.string().optional(),
    price: z.number().nonnegative(),
    durationMinutes: z.number().int().positive().optional(),
    active: z.boolean().optional(),
    showOnPortal: z.boolean().optional(),
  })
  .strict();

export const updateServiceSchema = createServiceSchema.partial();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
});

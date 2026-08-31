import { z } from 'zod';

export const createCategorySchema = z
  .object({
    name: z.string().min(1),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().min(1).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
});

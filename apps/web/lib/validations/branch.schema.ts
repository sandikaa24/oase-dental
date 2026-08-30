import { z } from 'zod';

export const createBranchSchema = z.object({
  code: z.string().min(1).max(10).toUpperCase(),
  name: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().optional(),
}).strict();

export const updateBranchSchema = createBranchSchema.partial();

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const timeMessage = 'Format waktu harus HH:MM';

export const workingHoursSchema = z.object({
  openTime: z.string().regex(timeRegex, timeMessage),
  closeTime: z.string().regex(timeRegex, timeMessage),
  lateAfter: z.string().regex(timeRegex, timeMessage),
}).refine((data) => {
  return data.closeTime > data.openTime;
}, {
  message: 'Waktu tutup harus lebih besar dari waktu buka',
  path: ['closeTime'],
});

export const statusSchema = z.object({
  active: z.boolean(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
});

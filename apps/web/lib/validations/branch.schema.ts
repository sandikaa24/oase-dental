import { z } from 'zod';

export const createBranchSchema = z.object({
  code: z.string().min(1).max(10).toUpperCase(),
  name: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  geofenceRadius: z.number().int().min(10).max(5000).optional().default(100),
}).strict();

export const updateBranchSchema = z.object({
  code: z.string().min(1).max(10).toUpperCase().optional(),
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  phone: z.string().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  geofenceRadius: z.number().int().min(10).max(5000).optional(),
}).strict();

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

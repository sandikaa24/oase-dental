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

export const workingHoursSchema = z
  .object({
    // Kolom lama (turunan / backward compatibility)
    openTime: z.string().regex(timeRegex, timeMessage).optional(),
    closeTime: z.string().regex(timeRegex, timeMessage).optional(),
    lateAfter: z.string().regex(timeRegex, timeMessage).optional(),

    // Kolom multi-shift baru
    morningOpen: z.string().regex(timeRegex, timeMessage).optional(),
    morningClose: z.string().regex(timeRegex, timeMessage).optional(),
    morningLateAfter: z.string().regex(timeRegex, timeMessage).optional(),
    eveningOpen: z.string().regex(timeRegex, timeMessage).optional(),
    eveningClose: z.string().regex(timeRegex, timeMessage).optional(),
    eveningLateAfter: z.string().regex(timeRegex, timeMessage).optional(),
    saturdayEveningClosed: z.boolean().optional(),
    sundayClosed: z.boolean().optional(),
    daysSchedule: z.record(z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    // Tentukan nilai morning
    const morningOpen = data.morningOpen ?? data.openTime ?? '09:00';
    const morningClose = data.morningClose ?? '13:00';
    const morningLateAfter = data.morningLateAfter ?? data.lateAfter ?? '09:15';

    // Tentukan nilai evening
    const eveningOpen = data.eveningOpen ?? '16:00';
    const eveningClose = data.eveningClose ?? data.closeTime ?? '21:00';
    const eveningLateAfter = data.eveningLateAfter ?? '16:15';

    // Validasi shift pagi
    if (morningClose <= morningOpen) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Waktu selesai shift pagi harus lebih besar dari jam buka',
        path: ['morningClose'],
      });
    }
    if (morningLateAfter < morningOpen || morningLateAfter > morningClose) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Batas terlambat shift pagi harus berada dalam window shift pagi',
        path: ['morningLateAfter'],
      });
    }

    // Validasi shift sore
    if (eveningOpen < morningClose) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Shift sore harus dimulai setelah shift pagi selesai',
        path: ['eveningOpen'],
      });
    }
    if (eveningClose <= eveningOpen) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Waktu selesai shift sore harus lebih besar dari jam buka sore',
        path: ['eveningClose'],
      });
    }
    if (eveningLateAfter < eveningOpen || eveningLateAfter > eveningClose) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Batas terlambat shift sore harus berada dalam window shift sore',
        path: ['eveningLateAfter'],
      });
    }

    // Validasi lama: closeTime > openTime
    if (data.closeTime && data.openTime && data.closeTime <= data.openTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Waktu tutup harus lebih besar dari waktu buka',
        path: ['closeTime'],
      });
    }
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

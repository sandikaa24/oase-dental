import { z } from 'zod';

// Regex YYYY-MM
const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// GET /attendance/me query schema
export const attendanceMeQuerySchema = z.object({
  month: z
    .string()
    .regex(monthRegex, 'Format month harus YYYY-MM (contoh: 2026-02)')
    .optional(),
});

// GET /attendance query schema (OWNER, MANAGER)
export const attendanceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  date: z
    .string()
    .regex(dateRegex, 'Format date harus YYYY-MM-DD (contoh: 2026-02-28)')
    .optional(),
  branchId: z.string().uuid('branchId harus berupa UUID valid').optional(),
  employeeId: z.string().uuid('employeeId harus berupa UUID valid').optional(),
});

// POST /attendance/:id/correct schema (OWNER)
export const attendanceCorrectSchema = z.object({
  checkIn: z.string().datetime({ message: 'checkIn harus format ISO 8601' }).optional().nullable(),
  checkOut: z.string().datetime({ message: 'checkOut harus format ISO 8601' }).optional().nullable(),
  note: z.string().min(1, 'Catatan koreksi wajib diisi'),
}).refine((data) => {
  if (data.checkIn && data.checkOut) {
    return new Date(data.checkOut) >= new Date(data.checkIn);
  }
  return true;
}, {
  message: 'Waktu check-out tidak boleh mendahului check-in',
  path: ['checkOut'],
});

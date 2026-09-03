import { z } from 'zod';
import { getJakartaDateTime } from '../services/attendance.service';

const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * POST /leave-requests
 * Body schema:
 * - type: CUTI | IZIN | SAKIT
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 * - reason: string min 10 max 500
 *
 * Validasi bisnis:
 * 1. endDate >= startDate
 * 2. Backdate maksimal 1 hari dari hari ini di zona waktu Asia/Jakarta (WIB).
 */
export const createLeaveRequestSchema = z
  .object({
    type: z.enum(['CUTI', 'IZIN', 'SAKIT'], {
      errorMap: () => ({ message: 'Tipe cuti/izin harus CUTI, IZIN, atau SAKIT' }),
    }),
    startDate: z
      .string()
      .regex(dateRegex, 'Format startDate harus YYYY-MM-DD (contoh: 2026-03-10)'),
    endDate: z
      .string()
      .regex(dateRegex, 'Format endDate harus YYYY-MM-DD (contoh: 2026-03-12)'),
    reason: z
      .string()
      .min(10, 'Alasan cuti/izin minimal 10 karakter')
      .max(500, 'Alasan cuti/izin maksimal 500 karakter'),
  })
  .refine(
    (data) => {
      return data.endDate >= data.startDate;
    },
    {
      message: 'Tanggal selesai tidak boleh sebelum tanggal mulai',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      // Hitung batas H-1 dari hari ini waktu WIB
      const { dateStr } = getJakartaDateTime();
      const today = new Date(`${dateStr}T00:00:00.000Z`);
      const hMinus1 = new Date(today);
      hMinus1.setUTCDate(today.getUTCDate() - 1);

      const reqStart = new Date(`${data.startDate}T00:00:00.000Z`);
      return reqStart >= hMinus1;
    },
    {
      message: 'Pengajuan cuti/izin tidak boleh backdate lebih dari 1 hari',
      path: ['startDate'],
    }
  );

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

/**
 * GET /leave-requests
 * Query parameter schema
 */
export const leaveRequestQuerySchema = z.object({
  scope: z.enum(['me']).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  employeeId: z.string().uuid('employeeId harus berupa UUID valid').optional(),
  branchId: z.string().uuid('branchId harus berupa UUID valid').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type LeaveRequestQueryParams = z.infer<typeof leaveRequestQuerySchema>;

/**
 * POST /leave-requests/:id/decide
 * Body schema
 */
export const decideLeaveRequestSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED'], {
    errorMap: () => ({ message: 'Keputusan harus APPROVED atau REJECTED' }),
  }),
  note: z.string().max(500, 'Catatan keputusan maksimal 500 karakter').optional(),
});

export type DecideLeaveRequestInput = z.infer<typeof decideLeaveRequestSchema>;

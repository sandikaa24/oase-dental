import { z } from 'zod';

export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  phone: z.string().optional(),
  position: z.string().min(1, 'Posisi/jabatan wajib diisi'),
  branchIds: z
    .array(z.string().uuid('branchId harus berupa UUID valid'))
    .min(1, 'Minimal 1 cabang wajib dipilih'),
}).strict();

export const updateEmployeeSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').optional(),
  phone: z.string().optional().nullable(),
  position: z.string().min(1, 'Posisi/jabatan wajib diisi').optional(),
  // Jika branchIds disertakan → REPLACE semantics (nonaktifkan yang hilang, aktifkan/buat yang baru)
  branchIds: z
    .array(z.string().uuid('branchId harus berupa UUID valid'))
    .min(1, 'Minimal 1 cabang wajib dipilih')
    .optional(),
}).strict();

export const employeeStatusSchema = z.object({
  active: z.boolean(),
}).strict();

export const employeeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // Filter active: true | false | undefined (semua)
  active: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
  // Filter by branchId
  branchId: z.string().uuid().optional(),
  // Pencarian nama (case-insensitive contains)
  search: z.string().optional(),
});

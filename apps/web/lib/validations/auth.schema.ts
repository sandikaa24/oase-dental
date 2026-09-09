import { z } from 'zod';

/**
 * Schema request POST /auth/login.
 */
export const loginSchema = z
  .object({
    email: z.string().trim().min(1, 'Username atau email wajib diisi').optional(),
    identifier: z.string().trim().min(1, 'Username atau email wajib diisi').optional(),
    password: z.string().min(1, 'Password wajib diisi'),
  })
  .refine((data) => !!(data.email || data.identifier), {
    message: 'Username atau email wajib diisi',
    path: ['identifier'],
  })
  .transform((data) => {
    const raw = (data.identifier || data.email)!;
    const normalized = raw.trim().toLowerCase();
    return {
      identifier: normalized,
      email: normalized,
      password: data.password,
    };
  });

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Schema request POST /auth/switch-branch.
 * branchId di sini adalah TUJUAN switch, bukan branch aktif untuk otorisasi —
 * branch aktif tetap selalu diambil dari JWT claim.
 * @deprecated Gunakan selectBranchSchema untuk POST /auth/select-branch.
 */
export const switchBranchSchema = z.object({
  branchId: z.string().uuid('branchId harus UUID yang valid'),
});

export type SwitchBranchInput = z.infer<typeof switchBranchSchema>;

/**
 * Schema request POST /auth/select-branch (Amandemen A1: satu pintu semua role).
 * branchId: UUID cabang ATAU "ALL" (khusus OWNER).
 */
export const selectBranchSchema = z.object({
  branchId: z.string().trim().min(1, 'Cabang kerja wajib dipilih'),
  remember: z.boolean().optional(),
});

export type SelectBranchInput = z.infer<typeof selectBranchSchema>;
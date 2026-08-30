import { z } from 'zod';

/**
 * Schema request POST /auth/login.
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Schema request POST /auth/switch-branch.
 * branchId di sini adalah TUJUAN switch, bukan branch aktif untuk otorisasi —
 * branch aktif tetap selalu diambil dari JWT claim.
 */
export const switchBranchSchema = z.object({
  branchId: z.string().uuid('branchId harus UUID yang valid'),
});

export type SwitchBranchInput = z.infer<typeof switchBranchSchema>;
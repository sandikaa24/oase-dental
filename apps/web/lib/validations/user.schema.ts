import { z } from 'zod';

// Role enum dari schema Prisma — dipakai untuk validasi body
export const UserRoleEnum = z.enum(['OWNER', 'MANAGER', 'CASHIER', 'EMPLOYEE']);
export type UserRoleType = z.infer<typeof UserRoleEnum>;

/**
 * Helper terpusat kebijakan panjang minimal password berbasis role:
 * - CASHIER / EMPLOYEE: minimal 6 karakter
 * - MANAGER: minimal 8 karakter
 * - OWNER: minimal 12 karakter
 */
export function getMinPasswordLength(role: UserRoleType | string): number {
  switch (role) {
    case 'OWNER':
      return 12;
    case 'MANAGER':
      return 8;
    case 'CASHIER':
    case 'EMPLOYEE':
    default:
      return 6;
  }
}

/**
 * Schema validasi username:
 * - Panjang: 3–20 karakter
 * - Karakter: [a-z0-9._-]
 * - Normalisasi: lowercase
 */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username minimal 3 karakter')
  .max(20, 'Username maksimal 20 karakter')
  .regex(/^[a-z0-9._-]+$/, 'Username hanya boleh berisi huruf kecil, angka, titik, underscore, dan strip');

export const optionalUsernameSchema = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  }
  return val;
}, usernameSchema.nullable().optional());

export const createUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Email tidak valid'),
    username: optionalUsernameSchema,
    password: z.string().min(1, 'Password wajib diisi'),
    role: UserRoleEnum,
    // Non-OWNER wajib punya employeeId — validasi bisnis ditangani di service
    employeeId: z.string().uuid('employeeId harus berupa UUID valid').optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const minLen = getMinPasswordLength(data.role);
    if (data.password.length < minLen) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: minLen,
        type: 'string',
        inclusive: true,
        message: `Password untuk role ${data.role} minimal ${minLen} karakter`,
        path: ['password'],
      });
    }
  });

// PATCH /users/:id: boleh update email, username, role, employeeId
// Perubahan role ke/dari OWNER dilarang di service (keputusan U2)
export const updateUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Email tidak valid').optional(),
    username: optionalUsernameSchema,
    role: UserRoleEnum.optional(),
    employeeId: z.string().uuid('employeeId harus berupa UUID valid').optional().nullable(),
  })
  .strict();

export const userStatusSchema = z
  .object({
    active: z.boolean(),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(6, 'Password baru minimal 6 karakter'),
  })
  .strict();

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: UserRoleEnum.optional(),
  // Filter active: true | false | undefined (semua)
  active: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
  // Filter by branchId (employee-branch assignment)
  branchId: z.string().uuid().optional(),
});

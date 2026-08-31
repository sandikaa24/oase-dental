import { z } from 'zod';

// Role enum dari schema Prisma — dipakai untuk validasi body
const UserRoleEnum = z.enum(['OWNER', 'MANAGER', 'CASHIER', 'EMPLOYEE']);

export const createUserSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  role: UserRoleEnum,
  // Non-OWNER wajib punya employeeId — validasi bisnis ditangani di service
  employeeId: z.string().uuid('employeeId harus berupa UUID valid').optional(),
}).strict();

// PATCH /users/:id: boleh update email, role, employeeId
// Perubahan role ke/dari OWNER dilarang di service (keputusan U2)
export const updateUserSchema = z.object({
  email: z.string().email('Email tidak valid').optional(),
  role: UserRoleEnum.optional(),
  employeeId: z.string().uuid('employeeId harus berupa UUID valid').optional().nullable(),
}).strict();

export const userStatusSchema = z.object({
  active: z.boolean(),
}).strict();

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
}).strict();

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

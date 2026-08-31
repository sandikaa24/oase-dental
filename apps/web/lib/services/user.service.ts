import { prisma } from '../prisma';
import { type UserRole, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { hashPassword } from '../auth';

// ─── Select publik: TIDAK ada passwordHash ────────────────────────────────────
const userPublicSelect = {
  id: true,
  email: true,
  role: true,
  employeeId: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      name: true,
      phone: true,
      position: true,
      active: true,
      branches: {
        select: {
          branchId: true,
          active: true,
          branch: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// listUsers
// ─────────────────────────────────────────────────────────────────────────────
export async function listUsers(
  page: number,
  limit: number,
  filters: {
    role?: UserRole;
    active?: boolean;
    branchId?: string;
  }
) {
  const where: Prisma.UserWhereInput = {};

  if (filters.role) {
    where.role = filters.role;
  }

  if (filters.active !== undefined) {
    where.active = filters.active;
  }

  if (filters.branchId) {
    // Filter berdasarkan employee branch assignment
    where.employee = {
      branches: {
        some: {
          branchId: filters.branchId,
          active: true,
        },
      },
    };
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userPublicSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─────────────────────────────────────────────────────────────────────────────
// getUserById
// ─────────────────────────────────────────────────────────────────────────────
export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userPublicSelect,
  });

  if (!user) {
    throw new NotFoundError('User tidak ditemukan');
  }

  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// createUser
// Aturan (U1):
//   - role !== OWNER → employeeId wajib, employee harus active
//   - employeeId unique di DB → P2002 → 409 DUPLICATE
// ─────────────────────────────────────────────────────────────────────────────
export async function createUser(
  input: {
    email: string;
    password: string;
    role: UserRole;
    employeeId?: string;
  },
  actorId: string,
  ip: string | null
) {
  // U1: non-OWNER wajib punya employeeId
  if (input.role !== 'OWNER' && !input.employeeId) {
    throw new ValidationError('employeeId wajib untuk role non-OWNER');
  }

  // U1: jika employeeId diberikan, employee harus exist dan active
  if (input.employeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: { id: true, active: true },
    });

    if (!employee) {
      throw new ValidationError('Employee dengan ID ini tidak ditemukan');
    }

    if (!employee.active) {
      throw new ValidationError('Employee sudah tidak aktif, tidak bisa membuat user');
    }
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: input.role,
          employeeId: input.employeeId ?? null,
        },
        select: userPublicSelect,
      });

      // Audit log CREATE — tanpa menyimpan password/hash
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CREATE',
          entity: 'User',
          entityId: created.id,
          after: { email: created.email, role: created.role, employeeId: created.employeeId },
          ip,
        },
      });

      return created;
    });

    return user;
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      const meta = (error as { meta?: { target?: string[] } }).meta;
      if (meta?.target?.includes('email')) {
        throw new ConflictError('Email sudah terdaftar', 'DUPLICATE');
      }
      if (meta?.target?.includes('employeeId')) {
        // employeeId unique → employee ini sudah punya user
        throw new ConflictError('Karyawan ini sudah memiliki akun user', 'DUPLICATE');
      }
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateUser
// Aturan (U2): perubahan role ke/dari OWNER dilarang → 400
// ─────────────────────────────────────────────────────────────────────────────
export async function updateUser(
  id: string,
  input: {
    email?: string;
    role?: UserRole;
    employeeId?: string | null;
  },
  actorId: string,
  ip: string | null
) {
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, employeeId: true, active: true },
  });

  if (!existing) {
    throw new NotFoundError('User tidak ditemukan');
  }

  // U2: Larang perubahan role ke/dari OWNER
  if (input.role !== undefined) {
    const fromOwner = existing.role === 'OWNER';
    const toOwner = input.role === 'OWNER';
    if (fromOwner || toOwner) {
      throw new ValidationError(
        'Perubahan role ke atau dari OWNER tidak diizinkan. ' +
        'Buat user baru dengan role yang diinginkan jika diperlukan.'
      );
    }
  }

  // Jika employeeId diberikan (non-null), employee harus exist dan active
  if (input.employeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: { id: true, active: true },
    });

    if (!employee) {
      throw new ValidationError('Employee dengan ID ini tidak ditemukan');
    }

    if (!employee.active) {
      throw new ValidationError('Employee sudah tidak aktif');
    }
  }

  const before = { email: existing.email, role: existing.role, employeeId: existing.employeeId };

  try {
    const user = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (input.email !== undefined) updateData.email = input.email;
      if (input.role !== undefined) updateData.role = input.role;
      if ('employeeId' in input) updateData.employeeId = input.employeeId ?? null;

      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        select: userPublicSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE',
          entity: 'User',
          entityId: id,
          before,
          after: { ...input },
          ip,
        },
      });

      return updated;
    });

    return user;
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      const meta = (error as { meta?: { target?: string[] } }).meta;
      if (meta?.target?.includes('email')) {
        throw new ConflictError('Email sudah terdaftar', 'DUPLICATE');
      }
      if (meta?.target?.includes('employeeId')) {
        throw new ConflictError('Karyawan ini sudah memiliki akun user', 'DUPLICATE');
      }
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// setUserStatus (U3: nonaktifkan diri sendiri → tolak)
// ─────────────────────────────────────────────────────────────────────────────
export async function setUserStatus(
  id: string,
  active: boolean,
  actorId: string,
  ip: string | null
) {
  // U3: OWNER tidak boleh menonaktifkan diri sendiri
  if (!active && id === actorId) {
    throw new ValidationError('Tidak dapat menonaktifkan akun sendiri');
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, active: true, email: true },
  });

  if (!existing) {
    throw new NotFoundError('User tidak ditemukan');
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { active },
      select: userPublicSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'UPDATE',
        entity: 'User',
        entityId: id,
        before: { active: existing.active },
        after: { active },
        ip,
        note: active ? 'User diaktifkan' : 'User dinonaktifkan',
      },
    });

    return updated;
  });

  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// resetPassword (U4)
// Hash bcryptjs, tanpa perlu password lama. Response TIDAK mengandung hash.
// ─────────────────────────────────────────────────────────────────────────────
export async function resetPassword(
  id: string,
  newPassword: string,
  actorId: string,
  ip: string | null
) {
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });

  if (!existing) {
    throw new NotFoundError('User tidak ditemukan');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { passwordHash },
    });

    // Revoke semua refresh token user ini supaya sesi lama langsung invalid
    await tx.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Audit log — TIDAK menyimpan password atau hash (keamanan)
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'UPDATE',
        entity: 'User',
        entityId: id,
        ip,
        note: 'Password di-reset oleh OWNER',
      },
    });
  });

  // Response: data user tanpa passwordHash
  return getUserById(id);
}

// ─── Helper: deteksi Prisma error code ───────────────────────────────────────
function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === code
  );
}

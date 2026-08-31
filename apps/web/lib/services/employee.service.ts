import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../errors';


// ─── Tipe select publik Employee (tanpa field sensitif) ───────────────────────
const employeePublicSelect = {
  id: true,
  name: true,
  phone: true,
  position: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  branches: {
    select: {
      id: true,
      active: true,
      branchId: true,
      branch: { select: { id: true, code: true, name: true } },
    },
  },
  // Sertakan user tapi tanpa passwordHash
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      active: true,
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// listEmployees
// ─────────────────────────────────────────────────────────────────────────────
export async function listEmployees(
  page: number,
  limit: number,
  filters: {
    active?: boolean;
    branchId?: string;
    search?: string;
  }
) {
  const where: Prisma.EmployeeWhereInput = {};

  if (filters.active !== undefined) {
    where.active = filters.active;
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  if (filters.branchId) {
    where.branches = {
      some: {
        branchId: filters.branchId,
        active: true,
      },
    };
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: employeePublicSelect,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getEmployeeById
// ─────────────────────────────────────────────────────────────────────────────
export async function getEmployeeById(id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: employeePublicSelect,
  });

  if (!employee) {
    throw new NotFoundError('Karyawan tidak ditemukan');
  }

  return employee;
}

// ─────────────────────────────────────────────────────────────────────────────
// createEmployee
// Buat employee + EmployeeBranch rows dalam satu $transaction.
// ─────────────────────────────────────────────────────────────────────────────
export async function createEmployee(
  input: {
    name: string;
    phone?: string;
    position: string;
    branchIds: string[];
  },
  actorId: string,
  ip: string | null
) {
  // Validasi: semua branchId harus exist dan active
  const branches = await prisma.branch.findMany({
    where: { id: { in: input.branchIds }, active: true },
    select: { id: true },
  });

  if (branches.length !== input.branchIds.length) {
    throw new ValidationError(
      'Satu atau lebih branchId tidak ditemukan atau tidak aktif'
    );
  }

  const employee = await prisma.$transaction(async (tx) => {
    const emp = await tx.employee.create({
      data: {
        name: input.name,
        phone: input.phone,
        position: input.position,
      },
    });

    // Buat EmployeeBranch untuk setiap branchId
    for (const branchId of input.branchIds) {
      await tx.employeeBranch.create({
        data: { employeeId: emp.id, branchId, active: true },
      });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'CREATE',
        entity: 'Employee',
        entityId: emp.id,
        after: { name: emp.name, position: emp.position, branchIds: input.branchIds },
        ip,
      },
    });

    return emp;
  });

  // Re-query dengan select publik untuk response
  return getEmployeeById(employee.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// updateEmployee
// Update field + branchIds REPLACE semantics jika branchIds disertakan.
// REPLACE: nonaktifkan assignment yang hilang (active:false), upsert yang baru.
// Idempoten: kirim daftar sama dua kali → row tidak duplikat.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateEmployee(
  id: string,
  input: {
    name?: string;
    phone?: string | null;
    position?: string;
    branchIds?: string[];
  },
  actorId: string,
  ip: string | null
) {
  const existing = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, name: true, position: true, phone: true },
  });

  if (!existing) {
    throw new NotFoundError('Karyawan tidak ditemukan');
  }

  // Jika branchIds disertakan, validasi semua exist dan aktif
  if (input.branchIds !== undefined) {
    const validBranches = await prisma.branch.findMany({
      where: { id: { in: input.branchIds }, active: true },
      select: { id: true },
    });

    if (validBranches.length !== input.branchIds.length) {
      throw new ValidationError(
        'Satu atau lebih branchId tidak ditemukan atau tidak aktif'
      );
    }
  }

  const before = { ...existing };

  await prisma.$transaction(async (tx) => {
    // Update field dasar employee
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.position !== undefined) updateData.position = input.position;

    if (Object.keys(updateData).length > 0) {
      await tx.employee.update({ where: { id }, data: updateData });
    }

    // REPLACE semantics untuk branchIds
    if (input.branchIds !== undefined) {
      const newBranchIds = new Set(input.branchIds);

      // Ambil semua assignment yang ada (aktif maupun tidak)
      const existingAssignments = await tx.employeeBranch.findMany({
        where: { employeeId: id },
        select: { id: true, branchId: true, active: true },
      });

      for (const assignment of existingAssignments) {
        if (newBranchIds.has(assignment.branchId)) {
          // Ada di list baru: pastikan aktif
          if (!assignment.active) {
            await tx.employeeBranch.update({
              where: { id: assignment.id },
              data: { active: true },
            });
          }
          // Hapus dari set supaya tahu mana yang perlu dibuat baru
          newBranchIds.delete(assignment.branchId);
        } else {
          // Tidak ada di list baru: nonaktifkan (JANGAN delete row)
          if (assignment.active) {
            await tx.employeeBranch.update({
              where: { id: assignment.id },
              data: { active: false },
            });
          }
        }
      }

      // Sisa newBranchIds = belum ada row → buat baru
      for (const branchId of newBranchIds) {
        // Gunakan upsert supaya idempoten jika ada race condition
        await tx.employeeBranch.upsert({
          where: { employeeId_branchId: { employeeId: id, branchId } },
          create: { employeeId: id, branchId, active: true },
          update: { active: true },
        });
      }
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'UPDATE',
        entity: 'Employee',
        entityId: id,
        before,
        after: { ...input },
        ip,
      },
    });
  });

  return getEmployeeById(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// setEmployeeStatus
// Soft delete: active:false. Tidak kaskade ke user.active (keputusan U6):
// auth.service.ts sudah cek employee.active saat login, jadi user otomatis
// tidak bisa login jika employee-nya nonaktif.
// ─────────────────────────────────────────────────────────────────────────────
export async function setEmployeeStatus(
  id: string,
  active: boolean,
  actorId: string,
  ip: string | null
) {
  const existing = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, active: true, name: true },
  });

  if (!existing) {
    throw new NotFoundError('Karyawan tidak ditemukan');
  }

  const employee = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id },
      data: { active },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'UPDATE',
        entity: 'Employee',
        entityId: id,
        before: { active: existing.active },
        after: { active },
        ip,
        note: active ? 'Karyawan diaktifkan' : 'Karyawan dinonaktifkan',
      },
    });

    return updated;
  });

  return getEmployeeById(employee.id);
}


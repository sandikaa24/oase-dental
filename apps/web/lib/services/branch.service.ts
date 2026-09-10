import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { ConflictError, NotFoundError } from '../errors';

export async function listBranches(page: number, limit: number, active?: boolean) {
  const where = active !== undefined ? { active } : {};
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      orderBy: { code: 'asc' },
      skip,
      take: limit,
      include: { workingHours: true },
    }),
    prisma.branch.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getBranchById(id: string) {
  const branch = await prisma.branch.findUnique({
    where: { id },
    include: { workingHours: true },
  });

  if (!branch) {
    throw new NotFoundError('Cabang tidak ditemukan');
  }

  return branch;
}

export async function createBranch(input: {
  code: string;
  name: string;
  address: string;
  phone?: string;
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadius?: number;
}) {
  try {
    const branch = await prisma.branch.create({
      data: input,
    });
    return branch;
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && 'meta' in error) {
      const err = error as { code: string; meta?: { target?: string[] } };
      if (err.code === 'P2002' && err.meta?.target?.includes('code')) {
        throw new ConflictError('Kode cabang sudah digunakan', 'DUPLICATE');
      }
    }
    throw error;
  }
}

export async function updateBranch(
  id: string,
  input: {
    code?: string;
    name?: string;
    address?: string;
    phone?: string;
    latitude?: number | null;
    longitude?: number | null;
    geofenceRadius?: number;
  }
) {
  // Check existence first to distinguish between NotFound and other errors
  const existing = await prisma.branch.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Cabang tidak ditemukan');
  }

  try {
    const branch = await prisma.branch.update({
      where: { id },
      data: input,
    });
    return branch;
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && 'meta' in error) {
      const err = error as { code: string; meta?: { target?: string[] } };
      if (err.code === 'P2002' && err.meta?.target?.includes('code')) {
        throw new ConflictError('Kode cabang sudah digunakan', 'DUPLICATE');
      }
    }
    throw error;
  }
}

export async function upsertWorkingHours(
  id: string,
  input: {
    openTime?: string;
    closeTime?: string;
    lateAfter?: string;
    morningOpen?: string;
    morningClose?: string;
    morningLateAfter?: string;
    eveningOpen?: string;
    eveningClose?: string;
    eveningLateAfter?: string;
    saturdayEveningClosed?: boolean;
    sundayClosed?: boolean;
    daysSchedule?: Record<string, unknown> | null;
  }
) {
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) {
    throw new NotFoundError('Cabang tidak ditemukan');
  }

  // Shift baru dengan fallback standar
  const morningOpen = input.morningOpen ?? input.openTime ?? '09:00';
  const morningClose = input.morningClose ?? '13:00';
  const morningLateAfter = input.morningLateAfter ?? input.lateAfter ?? '09:15';
  const eveningOpen = input.eveningOpen ?? '16:00';
  const eveningClose = input.eveningClose ?? input.closeTime ?? '21:00';
  const eveningLateAfter = input.eveningLateAfter ?? '16:15';
  const saturdayEveningClosed = input.saturdayEveningClosed ?? true;
  const sundayClosed = input.sundayClosed ?? true;

  // Kolom lama SEBAGAI TURUNAN: auto-sync dari kolom shift baru
  const openTime = morningOpen;
  const closeTime = eveningClose;
  const lateAfter = morningLateAfter;

  const dataToSave = {
    morningOpen,
    morningClose,
    morningLateAfter,
    eveningOpen,
    eveningClose,
    eveningLateAfter,
    saturdayEveningClosed,
    sundayClosed,
    daysSchedule: (input.daysSchedule as Prisma.InputJsonValue) ?? undefined,
    openTime,
    closeTime,
    lateAfter,
  };

  const workingHours = await prisma.branchWorkingHour.upsert({
    where: { branchId: id },
    create: {
      branchId: id,
      ...dataToSave,
    },
    update: dataToSave,
  });

  return workingHours;
}

export async function setStatus(id: string, active: boolean) {
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) {
    throw new NotFoundError('Cabang tidak ditemukan');
  }

  // TODO: FASE 1 - Nonaktifkan BRANCH TANPA cek transaksi (belum ada modul transaksi).
  // Sesuai kontrak: tolak jika masih ada transaksi aktif. Nanti tambahkan logika cek transaksi di sini.

  const updatedBranch = await prisma.branch.update({
    where: { id },
    data: { active },
  });

  return updatedBranch;
}

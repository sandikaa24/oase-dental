import { prisma } from '../prisma';
import { NotFoundError } from '../errors';

/**
 * Service (Layanan) — master data GLOBAL (tidak ada branchId).
 * Soft delete via kolom deletedAt (keputusan B1 Tugas 4):
 *  - belum dipakai TransactionItem  -> hard delete
 *  - sudah dipakai                  -> soft delete (set deletedAt)
 * Semua list/get/filter mengecualikan deletedAt != null.
 * PATCH pada item yang sudah deleted -> 404.
 *
 * Catatan: Service.name TIDAK unique di schema (known limitation),
 * jadi tidak ada mapping 409 DUPLICATE di sini.
 */

const NOT_DELETED = { deletedAt: null };

export async function listServices(page: number, limit: number, active?: boolean) {
  const where = active !== undefined ? { active, ...NOT_DELETED } : { ...NOT_DELETED };
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.service.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getServiceById(id: string) {
  const service = await prisma.service.findFirst({ where: { id, ...NOT_DELETED } });
  if (!service) {
    throw new NotFoundError('Layanan tidak ditemukan');
  }
  return service;
}

export async function createService(input: {
  categoryId?: string;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  price: number;
  durationMinutes?: number;
  active?: boolean;
  showOnPortal?: boolean;
}) {
  return prisma.service.create({ data: input });
}

export async function updateService(
  id: string,
  input: {
    categoryId?: string;
    name?: string;
    nameEn?: string;
    description?: string;
    descriptionEn?: string;
    price?: number;
    durationMinutes?: number;
    active?: boolean;
    showOnPortal?: boolean;
  },
) {
  // Item yang sudah soft-deleted diperlakukan seolah tidak ada -> 404.
  const existing = await prisma.service.findFirst({ where: { id, ...NOT_DELETED } });
  if (!existing) {
    throw new NotFoundError('Layanan tidak ditemukan');
  }
  return prisma.service.update({ where: { id }, data: input });
}

/**
 * Hapus layanan (keputusan B1).
 * belum dipakai TransactionItem -> hard delete;
 * sudah dipakai -> soft delete (deletedAt = now).
 * Fallback: jika hard delete tetap kena FK (P2003) karena referensi lain,
 * jatuhkan ke soft delete agar histori tidak rusak (dilaporkan di evidence).
 */
export async function deleteService(id: string) {
  const existing = await prisma.service.findFirst({ where: { id, ...NOT_DELETED } });
  if (!existing) {
    throw new NotFoundError('Layanan tidak ditemukan');
  }

  const usedCount = await prisma.transactionItem.count({ where: { serviceId: id } });

  if (usedCount > 0) {
    const soft = await prisma.service.update({ where: { id }, data: { deletedAt: new Date() } });
    return { mode: 'soft', service: soft };
  }

  try {
    await prisma.service.delete({ where: { id } });
    return { mode: 'hard', service: existing };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const err = error as { code: string };
      if (err.code === 'P2003') {
        const soft = await prisma.service.update({ where: { id }, data: { deletedAt: new Date() } });
        return { mode: 'soft', service: soft };
      }
    }
    throw error;
  }
}

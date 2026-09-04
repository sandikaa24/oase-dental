import { Prisma, AuditAction } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getDateRange } from './report.service';

export async function getAuditLogs(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  action: string | undefined,
  entity: string | undefined,
  actorId: string | undefined,
  page: number = 1,
  limit: number = 20
) {
  const { from, to } = getDateRange(dateFrom, dateTo);

  const where: Prisma.AuditLogWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(action && { action: action as AuditAction }),
    ...(entity && { entity }),
    ...(actorId && { actorId }),
  };

  const total = await prisma.auditLog.count({ where });
  const data = await prisma.auditLog.findMany({
    where,
    include: {
      actor: { select: { email: true, employee: { select: { name: true } } } }
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

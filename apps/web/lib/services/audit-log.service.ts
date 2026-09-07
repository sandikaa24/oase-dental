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
  const rawData = await prisma.auditLog.findMany({
    where,
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          role: true,
          employee: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const data = rawData.map((log) => ({
    ...log,
    actor: log.actor
      ? {
          id: log.actor.id,
          email: log.actor.email,
          role: log.actor.role,
          name: log.actor.employee?.name || log.actor.email,
        }
      : null,
  }));

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

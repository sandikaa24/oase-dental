import { prisma } from '../prisma';
import { Prisma, type UserRole, type LeaveType } from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ScheduleOverlapError,
  ValidationError,
} from '../errors';
import type {
  CreateLeaveRequestInput,
  DecideLeaveRequestInput,
  LeaveRequestQueryParams,
} from '../validations/leave.schema';

const leavePublicSelect = {
  id: true,
  employeeId: true,
  type: true,
  startDate: true,
  endDate: true,
  reason: true,
  status: true,
  decidedBy: true,
  decidedAt: true,
  decisionNote: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      name: true,
      position: true,
      branches: {
        select: {
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
  },
};

/**
 * POST /leave-requests
 * Membuat pengajuan cuti/izin/sakit baru.
 * - Guard akun harus terhubung ke employeeId
 * - Guard bentrok jadwal (overlap) dengan pengajuan status PENDING atau APPROVED milik sendiri (409 SCHEDULE_OVERLAP)
 */
export async function createLeaveRequest(
  employeeId: string | null,
  input: CreateLeaveRequestInput
) {
  if (!employeeId) {
    throw new ValidationError(
      'Akun belum terhubung ke data karyawan untuk mengajukan cuti/izin'
    );
  }

  const startDate = new Date(`${input.startDate}T00:00:00.000Z`);
  const endDate = new Date(`${input.endDate}T00:00:00.000Z`);

  // Deteksi Overlap:
  // Rentang [A, B] tumpang tindih dengan [startDate, endDate] jika:
  // A <= endDate AND B >= startDate
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  if (overlapping) {
    throw new ScheduleOverlapError(
      `Tanggal pengajuan bentrok dengan pengajuan cuti/izin ${overlapping.status} yang sudah ada`
    );
  }

  const leave = await prisma.leaveRequest.create({
    data: {
      employeeId,
      type: input.type as LeaveType,
      startDate,
      endDate,
      reason: input.reason,
      status: 'PENDING',
    },
    select: leavePublicSelect,
  });

  return leave;
}

/**
 * POST /leave-requests/:id/cancel
 * Membatalkan pengajuan cuti berstatus PENDING oleh pengaju sendiri.
 * Keputusan binding 1: HARD DELETE record PENDING agar slot tanggal bebas kembali.
 * Non-pengaju -> 403 FORBIDDEN.
 * Status bukan PENDING -> 409 INVALID_TRANSACTION_STATE.
 */
export async function cancelLeaveRequest(
  id: string,
  requesterEmployeeId: string | null
) {
  if (!requesterEmployeeId) {
    throw new ForbiddenError('Akses ditolak: akun tidak terhubung ke karyawan');
  }

  const existing = await prisma.leaveRequest.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Pengajuan cuti/izin tidak ditemukan');
  }

  if (existing.employeeId !== requesterEmployeeId) {
    throw new ForbiddenError('Hanya pengaju yang dapat membatalkan pengajuan cuti/izin ini');
  }

  if (existing.status !== 'PENDING') {
    throw new ConflictError(
      'Pengajuan cuti/izin yang sudah diputus tidak dapat dibatalkan',
      'INVALID_TRANSACTION_STATE'
    );
  }

  // Hard delete record PENDING
  await prisma.leaveRequest.delete({
    where: { id },
  });

  return { id, cancelled: true, message: 'Pengajuan cuti/izin berhasil dibatalkan' };
}

/**
 * POST /leave-requests/:id/decide
 * Memutuskan (APPROVED / REJECTED) pengajuan cuti.
 * Keputusan binding 2: Self-Decision Guard = 403 FORBIDDEN.
 * Status bukan PENDING -> 409 INVALID_TRANSACTION_STATE.
 * Audit log LEAVE_APPROVED / LEAVE_REJECTED di dalam prisma.$transaction.
 */
export async function decideLeaveRequest(
  id: string,
  input: DecideLeaveRequestInput,
  deciderUserId: string,
  deciderEmployeeId: string | null,
  deciderRole: UserRole,
  activeBranchId: string | null,
  ip: string | null
) {
  const existing = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      employee: {
        include: {
          branches: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('Pengajuan cuti/izin tidak ditemukan');
  }

  // Self-Decision Guard (Keputusan binding 2): Tolak jika decider memutuskan pengajuannya sendiri
  if (deciderEmployeeId && existing.employeeId === deciderEmployeeId) {
    throw new ForbiddenError('Tidak dapat memutuskan pengajuan cuti/izin milik sendiri');
  }

  // Status Immutability
  if (existing.status !== 'PENDING') {
    throw new ConflictError(
      'Pengajuan cuti/izin sudah pernah diputus dan tidak dapat diubah lagi',
      'INVALID_TRANSACTION_STATE'
    );
  }

  // Scope Isolation untuk MANAGER
  if (deciderRole === 'MANAGER') {
    if (!activeBranchId) {
      throw new ValidationError('Cabang aktif diperlukan untuk memutuskan pengajuan cuti/izin');
    }
    const belongsToBranch = existing.employee.branches.some(
      (b) => b.branchId === activeBranchId
    );
    if (!belongsToBranch) {
      throw new ForbiddenError(
        'Manager hanya dapat memutuskan pengajuan cuti/izin karyawan di cabang aktifnya'
      );
    }
  }

  const newStatus = input.decision;
  const auditAction = newStatus === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED';
  const now = new Date();

  const beforeSnapshot = {
    id: existing.id,
    employeeId: existing.employeeId,
    type: existing.type,
    startDate: existing.startDate,
    endDate: existing.endDate,
    status: existing.status,
    reason: existing.reason,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.leaveRequest.update({
      where: { id },
      data: {
        status: newStatus,
        decidedBy: deciderUserId,
        decidedAt: now,
        decisionNote: input.note ?? null,
      },
      select: leavePublicSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId: deciderUserId,
        action: auditAction,
        entity: 'LeaveRequest',
        entityId: id,
        before: beforeSnapshot,
        after: {
          status: newStatus,
          decidedBy: deciderUserId,
          decidedAt: now,
          decisionNote: input.note ?? null,
        },
        note: `Pengajuan cuti/izin ${newStatus}: ${input.note ?? '-'}`,
        ip,
      },
    });

    return res;
  });

  return updated;
}

/**
 * GET /leave-requests
 * Mengambil daftar pengajuan cuti.
 * Jika scope === 'me' -> pengajuan milik sendiri (membutuhkan employeeId).
 * Jika list all (OWNER / MANAGER) -> filter cabang & status:
 * - MANAGER: otomatis terisolasi ke activeBranchId.
 * - OWNER: bebas melihat semua, atau filter cabang via query branchId.
 */
export async function getLeaveRequests(
  params: LeaveRequestQueryParams,
  user: {
    userId: string;
    employeeId: string | null;
    role: UserRole;
    activeBranchId: string | null;
  }
) {
  const isMeScope = params.scope === 'me' || user.role === 'CASHIER' || user.role === 'EMPLOYEE';

  if (isMeScope) {
    if (!user.employeeId) {
      return {
        data: [],
        total: 0,
        page: params.page,
        limit: params.limit,
        totalPages: 0,
      };
    }

    const where: Prisma.LeaveRequestWhereInput = {
      employeeId: user.employeeId,
    };

    if (params.status) {
      where.status = params.status;
    }

    const skip = (params.page - 1) * params.limit;

    const [data, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        select: leavePublicSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  // List all untuk OWNER / MANAGER
  const where: Prisma.LeaveRequestWhereInput = {};

  if (params.status) {
    where.status = params.status;
  }

  if (params.employeeId) {
    where.employeeId = params.employeeId;
  }

  if (user.role === 'MANAGER') {
    if (!user.activeBranchId) {
      throw new ValidationError('Cabang aktif diperlukan untuk melihat data pengajuan tim');
    }
    where.employee = {
      branches: {
        some: {
          branchId: user.activeBranchId,
        },
      },
    };
  } else if (user.role === 'OWNER' && params.branchId) {
    where.employee = {
      branches: {
        some: {
          branchId: params.branchId,
        },
      },
    };
  }

  const skip = (params.page - 1) * params.limit;

  const [data, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      select: leavePublicSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: params.limit,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

import { prisma } from '../prisma';
import type { WorkShift, SwapStatus, UserRole } from '@prisma/client';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  ScheduleOverlapError,
} from '../errors';

const shiftAssignmentSelect = {
  id: true,
  employeeId: true,
  branchId: true,
  date: true,
  shift: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      name: true,
      position: true,
    },
  },
  branch: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
} as const;

const swapRequestSelect = {
  id: true,
  requesterId: true,
  targetId: true,
  date: true,
  requesterShift: true,
  targetShift: true,
  status: true,
  decidedBy: true,
  decidedAt: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  requester: {
    select: {
      id: true,
      name: true,
      position: true,
    },
  },
  target: {
    select: {
      id: true,
      name: true,
      position: true,
    },
  },
} as const;

/**
 * GET list penugasan shift
 */
export async function listShiftAssignments(params: {
  branchId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  employeeId?: string;
}) {
  const where: {
    branchId?: string;
    employeeId?: string;
    date?: Date | { gte?: Date; lte?: Date };
  } = {};

  if (params.branchId) {
    where.branchId = params.branchId;
  }
  if (params.employeeId) {
    where.employeeId = params.employeeId;
  }
  if (params.date) {
    where.date = new Date(`${params.date}T00:00:00+07:00`);
  } else if (params.startDate || params.endDate) {
    where.date = {};
    if (params.startDate) {
      where.date.gte = new Date(`${params.startDate}T00:00:00+07:00`);
    }
    if (params.endDate) {
      where.date.lte = new Date(`${params.endDate}T00:00:00+07:00`);
    }
  }

  const assignments = await prisma.shiftAssignment.findMany({
    where,
    select: shiftAssignmentSelect,
    orderBy: [{ date: 'asc' }, { shift: 'asc' }],
  });

  return assignments;
}

/**
 * POST buat/assign shift harian ke karyawan (OWNER)
 * Memvalidasi bentrok: 1 staf tidak bisa memiliki 2 assignment pada shift yang sama di hari yang sama.
 */
export async function createShiftAssignment(
  input: {
    employeeId: string;
    branchId: string;
    date: string;
    shift: WorkShift;
  },
  actorId: string,
  ip?: string | null
) {
  // Cek karyawan
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
  });
  if (!employee || !employee.active) {
    throw new NotFoundError('Data karyawan tidak ditemukan atau nonaktif');
  }

  // Cek cabang
  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
  });
  if (!branch || !branch.active) {
    throw new NotFoundError('Cabang tidak ditemukan atau nonaktif');
  }

  const assignmentDate = new Date(`${input.date}T00:00:00+07:00`);

  // Validasi bentrok shift
  const existing = await prisma.shiftAssignment.findUnique({
    where: {
      employeeId_date_shift: {
        employeeId: input.employeeId,
        date: assignmentDate,
        shift: input.shift,
      },
    },
  });

  if (existing) {
    throw new ScheduleOverlapError(
      `Karyawan sudah ditugaskan pada shift ${input.shift} untuk tanggal ${input.date}`
    );
  }

  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.shiftAssignment.create({
      data: {
        employeeId: input.employeeId,
        branchId: input.branchId,
        date: assignmentDate,
        shift: input.shift,
        source: 'MANUAL',
      },
      select: shiftAssignmentSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'CREATE',
        entity: 'ShiftAssignment',
        entityId: created.id,
        note: `Penugasan shift: ${employee.name} ditugaskan pada shift ${input.shift} di ${branch.name} (${input.date})`,
        ip,
      },
    });

    return created;
  });

  return assignment;
}

/**
 * DELETE hapus penugasan shift (OWNER)
 */
export async function deleteShiftAssignment(
  id: string,
  actorId: string,
  ip?: string | null
) {
  const existing = await prisma.shiftAssignment.findUnique({
    where: { id },
    include: { employee: true, branch: true },
  });

  if (!existing) {
    throw new NotFoundError('Penugasan shift tidak ditemukan');
  }

  await prisma.$transaction(async (tx) => {
    await tx.shiftAssignment.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'DELETE',
        entity: 'ShiftAssignment',
        entityId: id,
        note: `Penugasan shift dihapus: ${existing.employee.name} (${existing.shift}, ${existing.branch.name})`,
        ip,
      },
    });
  });

  return { success: true };
}

/**
 * POST ajukan tukar shift (Karyawan -> Rekan)
 * Validasi: 1 request aktif per pasangan per tanggal.
 */
export async function createSwapRequest(
  requesterEmployeeId: string,
  input: {
    targetEmployeeId: string;
    date: string;
    requesterShift: WorkShift;
    targetShift: WorkShift;
    note?: string;
  },
  actorId: string,
  ip?: string | null
) {
  if (requesterEmployeeId === input.targetEmployeeId) {
    throw new ValidationError('Tidak dapat mengajukan tukar shift dengan diri sendiri');
  }

  const targetEmployee = await prisma.employee.findUnique({
    where: { id: input.targetEmployeeId },
  });
  if (!targetEmployee || !targetEmployee.active) {
    throw new NotFoundError('Rekan kerja target tidak ditemukan atau nonaktif');
  }

  const swapDate = new Date(`${input.date}T00:00:00+07:00`);

  // Validasi: satu request aktif per pasangan per tanggal
  const activeExisting = await prisma.shiftSwapRequest.findFirst({
    where: {
      date: swapDate,
      status: { in: ['PENDING_PEER', 'PENDING_OWNER'] },
      OR: [
        { requesterId: requesterEmployeeId, targetId: input.targetEmployeeId },
        { requesterId: input.targetEmployeeId, targetId: requesterEmployeeId },
      ],
    },
  });

  if (activeExisting) {
    throw new ConflictError(
      'Sudah ada pengajuan tukar shift yang masih aktif antara Anda dan rekan ini pada tanggal tersebut',
      'ACTIVE_SWAP_EXISTS'
    );
  }

  const swapRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.shiftSwapRequest.create({
      data: {
        requesterId: requesterEmployeeId,
        targetId: input.targetEmployeeId,
        date: swapDate,
        requesterShift: input.requesterShift,
        targetShift: input.targetShift,
        status: 'PENDING_PEER',
        note: input.note,
      },
      select: swapRequestSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'SHIFT_SWAP_REQUESTED',
        entity: 'ShiftSwapRequest',
        entityId: created.id,
        note: `Pengajuan tukar shift diajukan oleh ${requesterEmployeeId} kepada ${input.targetEmployeeId} untuk tanggal ${input.date}`,
        ip,
      },
    });

    return created;
  });

  return swapRequest;
}

/**
 * POST respons rekan kerja atas pengajuan tukar shift (PEER)
 * approved = true -> status menjadi PENDING_OWNER
 * approved = false -> status menjadi REJECTED
 */
export async function respondSwapPeer(
  id: string,
  peerEmployeeId: string,
  approved: boolean,
  note?: string,
  actorId?: string,
  ip?: string | null
) {
  const swap = await prisma.shiftSwapRequest.findUnique({
    where: { id },
    include: { requester: true, target: true },
  });

  if (!swap) {
    throw new NotFoundError('Pengajuan tukar shift tidak ditemukan');
  }

  if (swap.targetId !== peerEmployeeId) {
    throw new ValidationError('Anda bukan penerima pengajuan tukar shift ini');
  }

  if (swap.status !== 'PENDING_PEER') {
    throw new ConflictError(
      'Pengajuan tukar shift ini sudah tidak dalam status menunggu persetujuan rekan',
      'INVALID_TRANSACTION_STATE'
    );
  }

  const newStatus: SwapStatus = approved ? 'PENDING_OWNER' : 'REJECTED';

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.shiftSwapRequest.update({
      where: { id },
      data: {
        status: newStatus,
        note: note ? `${swap.note ? `${swap.note} | ` : ''}Catatan Rekan: ${note}` : swap.note,
      },
      select: swapRequestSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId: actorId ?? peerEmployeeId,
        action: approved ? 'UPDATE' : 'SHIFT_SWAP_REJECTED',
        entity: 'ShiftSwapRequest',
        entityId: id,
        note: approved
          ? `Tukar shift disetujui rekan (${swap.target.name}), menunggu persetujuan Owner`
          : `Tukar shift ditolak oleh rekan (${swap.target.name})`,
        ip,
      },
    });

    return res;
  });

  return updated;
}

/**
 * POST keputusan akhir Owner atas pengajuan tukar shift (OWNER)
 * approved = true -> tukar shift secara atomik (ShiftAssignment kedua staf bertukar, source = SWAP)
 * approved = false -> status REJECTED
 */
export async function decideSwapOwner(
  id: string,
  approved: boolean,
  ownerUserId: string,
  note?: string,
  ip?: string | null
) {
  const swap = await prisma.shiftSwapRequest.findUnique({
    where: { id },
    include: { requester: true, target: true },
  });

  if (!swap) {
    throw new NotFoundError('Pengajuan tukar shift tidak ditemukan');
  }

  if (swap.status !== 'PENDING_OWNER') {
    throw new ConflictError(
      'Pengajuan tukar shift harus disetujui rekan terlebih dahulu sebelum diputuskan Owner',
      'INVALID_TRANSACTION_STATE'
    );
  }

  if (!approved) {
    const rejected = await prisma.$transaction(async (tx) => {
      const res = await tx.shiftSwapRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          decidedBy: ownerUserId,
          decidedAt: new Date(),
          note: note ? `${swap.note ? `${swap.note} | ` : ''}Catatan Owner: ${note}` : swap.note,
        },
        select: swapRequestSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId: ownerUserId,
          action: 'SHIFT_SWAP_REJECTED',
          entity: 'ShiftSwapRequest',
          entityId: id,
          note: `Tukar shift ditolak oleh Owner: ${note ?? '-'}`,
          ip,
        },
      });

      return res;
    });

    return rejected;
  }

  // JIKA DISETUJUI OWNER: Tukar penugasan kedua staf secara atomik
  const approvedResult = await prisma.$transaction(async (tx) => {
    // Cari assignment requester
    const reqAssignment = await tx.shiftAssignment.findUnique({
      where: {
        employeeId_date_shift: {
          employeeId: swap.requesterId,
          date: swap.date,
          shift: swap.requesterShift,
        },
      },
    });

    // Cari assignment target
    const tgtAssignment = await tx.shiftAssignment.findUnique({
      where: {
        employeeId_date_shift: {
          employeeId: swap.targetId,
          date: swap.date,
          shift: swap.targetShift,
        },
      },
    });

    // Hapus sementara salah satu assignment jika ada untuk menghindari P2002 saat swap shift
    if (reqAssignment && tgtAssignment) {
      await tx.shiftAssignment.delete({ where: { id: reqAssignment.id } });
      await tx.shiftAssignment.delete({ where: { id: tgtAssignment.id } });

      // Buat ulang dengan assignment tertukar (source: SWAP)
      await tx.shiftAssignment.create({
        data: {
          employeeId: swap.requesterId,
          branchId: tgtAssignment.branchId,
          date: swap.date,
          shift: swap.targetShift,
          source: 'SWAP',
        },
      });

      await tx.shiftAssignment.create({
        data: {
          employeeId: swap.targetId,
          branchId: reqAssignment.branchId,
          date: swap.date,
          shift: swap.requesterShift,
          source: 'SWAP',
        },
      });
    } else if (reqAssignment && !tgtAssignment) {
      // Rekan belum ada assignment khusus (default shift): update assignment requester
      await tx.shiftAssignment.update({
        where: { id: reqAssignment.id },
        data: {
          employeeId: swap.targetId,
          shift: swap.requesterShift,
          source: 'SWAP',
        },
      });
      await tx.shiftAssignment.create({
        data: {
          employeeId: swap.requesterId,
          branchId: reqAssignment.branchId,
          date: swap.date,
          shift: swap.targetShift,
          source: 'SWAP',
        },
      });
    }

    // Update status swap request
    const res = await tx.shiftSwapRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        decidedBy: ownerUserId,
        decidedAt: new Date(),
        note: note ? `${swap.note ? `${swap.note} | ` : ''}Catatan Owner: ${note}` : swap.note,
      },
      select: swapRequestSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId: ownerUserId,
        action: 'SHIFT_SWAP_APPROVED',
        entity: 'ShiftSwapRequest',
        entityId: id,
        note: `Tukar shift disetujui Owner: ${swap.requester.name} (${swap.requesterShift}) bertukar jadwal dengan ${swap.target.name} (${swap.targetShift}) pada ${swap.date.toISOString().slice(0, 10)}`,
        ip,
      },
    });

    return res;
  });

  return approvedResult;
}

/**
 * GET list pengajuan tukar shift
 */
export async function listSwapRequests(
  params: {
    employeeId?: string;
    status?: SwapStatus;
    date?: string;
    page: number;
    limit: number;
  },
  role: UserRole
) {
  const where: {
    status?: SwapStatus;
    date?: Date;
    OR?: Array<{ requesterId: string } | { targetId: string }>;
  } = {};

  if (params.status) {
    where.status = params.status;
  }
  if (params.date) {
    where.date = new Date(`${params.date}T00:00:00+07:00`);
  }

  // Jika bukan OWNER, batasi hanya permohonan yang melibatkan employeeId staf tersebut
  if (role !== 'OWNER' && params.employeeId) {
    where.OR = [
      { requesterId: params.employeeId },
      { targetId: params.employeeId },
    ];
  }

  const skip = (params.page - 1) * params.limit;

  const [data, total] = await Promise.all([
    prisma.shiftSwapRequest.findMany({
      where,
      select: swapRequestSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: params.limit,
    }),
    prisma.shiftSwapRequest.count({ where }),
  ]);

  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

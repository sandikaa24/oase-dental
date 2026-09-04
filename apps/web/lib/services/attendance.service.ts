import { prisma } from '../prisma';
import { Prisma, type UserRole, type AttendanceStatus } from '@prisma/client';
import {
  AlreadyCheckedInError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../errors';

/**
 * Helper: Dapatkan tanggal (YYYY-MM-DD), jam (HH:mm), dan workDate (@db.Date)
 * dalam zona waktu operasional server (Asia/Jakarta / WIB).
 */
export function getJakartaDateTime(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}`;
  const workDate = new Date(`${dateStr}T00:00:00+07:00`);

  return { dateStr, timeStr, workDate };
}

const attendancePublicSelect = {
  id: true,
  employeeId: true,
  branchId: true,
  workDate: true,
  checkIn: true,
  checkOut: true,
  status: true,
  corrected: true,
  correctionNote: true,
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

/**
 * Check-in absensi (SELF)
 * Sesuai kontrak: tolak jika sudah ada record hari ini (400 ALREADY_CHECKED_IN).
 * Status dihitung vs lateAfter branch (fallback 08:00 jika tidak ada).
 */
export async function checkIn(
  employeeId: string | null,
  branchId: string | null
) {
  // D1: User tanpa employeeId (mis. default OWNER) ditolak
  if (!employeeId) {
    throw new ValidationError(
      'Akun belum terhubung ke data karyawan untuk melakukan absensi'
    );
  }

  // A1: Wajib activeBranchId
  if (!branchId) {
    throw new ValidationError('Branch aktif diperlukan untuk absensi');
  }

  // Cek apakah cabang aktif
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { workingHours: true },
  });

  if (!branch || !branch.active) {
    throw new ValidationError('Cabang tidak ditemukan atau sudah tidak aktif');
  }

  // Cek apakah karyawan aktif
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, active: true },
  });

  if (!employee || !employee.active) {
    throw new ValidationError('Data karyawan tidak ditemukan atau sudah tidak aktif');
  }

  const { workDate, timeStr } = getJakartaDateTime();

  // A4: Tolak jika sudah ada record hari ini
  const existing = await prisma.attendance.findUnique({
    where: {
      employeeId_workDate_branchId: {
        employeeId,
        workDate,
        branchId,
      },
    },
  });

  if (existing) {
    throw new AlreadyCheckedInError('Sudah melakukan check-in hari ini');
  }

  // A2 & D3: Tentukan status PRESENT vs LATE vs lateAfter
  const lateAfter = branch.workingHours?.lateAfter ?? '08:00';
  const status: AttendanceStatus = timeStr > lateAfter ? 'LATE' : 'PRESENT';

  const attendance = await prisma.attendance.create({
    data: {
      employeeId,
      branchId,
      workDate,
      checkIn: new Date(),
      status,
    },
    select: attendancePublicSelect,
  });

  return attendance;
}

/**
 * Check-out absensi (SELF)
 * A3: Check-out tanpa check-in -> 409 INVALID_TRANSACTION_STATE
 * T10: Check-out kedua kali pada hari sama -> 409 INVALID_TRANSACTION_STATE
 */
export async function checkOut(
  employeeId: string | null,
  branchId: string | null
) {
  // D1: User tanpa employeeId ditolak
  if (!employeeId) {
    throw new ValidationError(
      'Akun belum terhubung ke data karyawan untuk melakukan absensi'
    );
  }

  // A1: Wajib activeBranchId
  if (!branchId) {
    throw new ValidationError('Branch aktif diperlukan untuk absensi');
  }

  const { workDate } = getJakartaDateTime();

  const attendance = await prisma.attendance.findUnique({
    where: {
      employeeId_workDate_branchId: {
        employeeId,
        workDate,
        branchId,
      },
    },
  });

  // A3: Belum check-in
  if (!attendance) {
    throw new ConflictError(
      'Belum melakukan check-in hari ini',
      'INVALID_TRANSACTION_STATE'
    );
  }

  // T10: Sudah check-out sebelumnya
  if (attendance.checkOut !== null) {
    throw new ConflictError(
      'Sudah melakukan check-out hari ini',
      'INVALID_TRANSACTION_STATE'
    );
  }

  const updated = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      checkOut: new Date(),
    },
    select: attendancePublicSelect,
  });

  return updated;
}

/**
 * GET /attendance/me (SELF)
 * Riwayat absensi sendiri dengan filter bulan (?month=YYYY-MM).
 * Default: bulan berjalan WIB jika tidak diisi.
 */
export async function getMyAttendance(
  employeeId: string | null,
  monthStr?: string
) {
  if (!employeeId) {
    throw new ValidationError('Akun belum terhubung ke data karyawan');
  }

  const targetStr = monthStr ?? getJakartaDateTime().dateStr.slice(0, 7);
  const parts = targetStr.split('-');
  const year = parseInt(parts[0] ?? '2026', 10);
  const month = parseInt(parts[1] ?? '1', 10);

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0)); // Hari terakhir bulan tersebut

  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      workDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: attendancePublicSelect,
    orderBy: { workDate: 'desc' },
  });

  return attendances;
}

/**
 * GET /attendance (OWNER, MANAGER)
 * List absensi semua karyawan.
 * D4: MANAGER otomatis dibatasi ke activeBranchId (auth.branchId).
 */
export async function listAttendances(
  params: {
    page: number;
    limit: number;
    date?: string;
    branchId?: string;
    employeeId?: string;
  },
  role: UserRole,
  activeBranchId: string | null
) {
  const where: Prisma.AttendanceWhereInput = {};

  if (role === 'MANAGER') {
    if (!activeBranchId) {
      throw new ValidationError('Branch aktif diperlukan untuk melihat data absensi');
    }
    where.branchId = activeBranchId;
  } else if (params.branchId) {
    where.branchId = params.branchId;
  }

  if (params.employeeId) {
    where.employeeId = params.employeeId;
  }

  if (params.date) {
    where.workDate = new Date(`${params.date}T00:00:00.000Z`);
  }

  const skip = (params.page - 1) * params.limit;

  const [data, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      select: attendancePublicSelect,
      orderBy: { workDate: 'desc' },
      skip,
      take: params.limit,
    }),
    prisma.attendance.count({ where }),
  ]);

  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

/**
 * POST /attendance/:id/correct (OWNER)
 * Koreksi manual jam checkIn/checkOut + catatan wajib.
 * Audit action: ATTENDANCE_CORRECTED.
 */
export async function correctAttendance(
  id: string,
  input: {
    checkIn?: string | null;
    checkOut?: string | null;
    note: string;
  },
  actorId: string,
  ip: string | null
) {
  const existing = await prisma.attendance.findUnique({
    where: { id },
    include: { branch: { include: { workingHours: true } } },
  });

  if (!existing) {
    throw new NotFoundError('Data absensi tidak ditemukan');
  }

  const before = {
    checkIn: existing.checkIn,
    checkOut: existing.checkOut,
    status: existing.status,
    corrected: existing.corrected,
    correctionNote: existing.correctionNote,
  };

  const updateData: Prisma.AttendanceUpdateInput = {
    corrected: true,
    correctionNote: input.note,
  };

  let newStatus = existing.status;

  if (input.checkIn !== undefined) {
    if (input.checkIn === null) {
      updateData.checkIn = null;
    } else {
      const checkInDate = new Date(input.checkIn);
      updateData.checkIn = checkInDate;

      // Recalculate status jika checkIn dikoreksi
      const { timeStr } = getJakartaDateTime(checkInDate);
      const lateAfter = existing.branch.workingHours?.lateAfter ?? '08:00';
      newStatus = timeStr > lateAfter ? 'LATE' : 'PRESENT';
      updateData.status = newStatus;
    }
  }

  if (input.checkOut !== undefined) {
    updateData.checkOut = input.checkOut ? new Date(input.checkOut) : null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.attendance.update({
      where: { id },
      data: updateData,
      select: attendancePublicSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'ATTENDANCE_CORRECTED',
        entity: 'Attendance',
        entityId: id,
        before,
        after: {
          checkIn: res.checkIn,
          checkOut: res.checkOut,
          status: res.status,
          correctionNote: input.note,
        },
        note: `Koreksi absensi: ${input.note}`,
        ip,
      },
    });

    return res;
  });

  return updated;
}

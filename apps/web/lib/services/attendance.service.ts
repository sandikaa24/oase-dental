import { prisma } from '../prisma';
import { Prisma, type UserRole, type AttendanceStatus, type WorkShift } from '@prisma/client';
import {
  AlreadyCheckedInError,
  ConflictError,
  NotFoundError,
  ValidationError,
  GpsRequiredError,
  OutOfRangeError,
} from '../errors';
import { calculateDistanceMeters } from '../utils/geo';

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
  shift: true,
  latitude: true,
  longitude: true,
  distanceMeters: true,
  accuracyMeters: true,
  autoCheckout: true,
  lateCheckoutMinutes: true,
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
      latitude: true,
      longitude: true,
      geofenceRadius: true,
    },
  },
} as const;

/**
 * Mekanisme Lazy-Check AUTO_CHECKOUT:
 * Dipanggil pada setiap aktivitas presensi. Mengevaluasi record presensi yang masih
 * belum check-out (checkOut: null) dan waktu operasional sudah melewati batas shift + 30 menit.
 * Batas shift:
 * - MORNING (09:00 - 13:00) -> Cutoff +30m: 13:30 WIB
 * - EVENING (16:00 - 21:00) -> Cutoff +30m: 21:30 WIB
 */
export async function runLazyAutoCheckout(): Promise<number> {
  const { workDate, timeStr } = getJakartaDateTime();

  const pendingAttendances = await prisma.attendance.findMany({
    where: {
      checkOut: null,
      workDate: { lte: workDate },
    },
  });

  let count = 0;
  for (const att of pendingAttendances) {
    const isPastDate = att.workDate < workDate;
    const cutoffTime = att.shift === 'MORNING' ? '13:30' : '21:30';
    const isPastCutoffToday = !isPastDate && timeStr > cutoffTime;

    if (isPastDate || isPastCutoffToday) {
      const { dateStr } = getJakartaDateTime(att.workDate);
      const autoCheckoutDate = new Date(`${dateStr}T${cutoffTime}:00+07:00`);

      await prisma.$transaction(async (tx) => {
        await tx.attendance.update({
          where: { id: att.id },
          data: {
            checkOut: autoCheckoutDate,
            autoCheckout: true,
            lateCheckoutMinutes: 30,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: 'SYSTEM',
            action: 'ATTENDANCE_AUTO_CHECKOUT',
            entity: 'Attendance',
            entityId: att.id,
            note: `Auto-checkout: Karyawan ${att.employeeId} tidak melakukan presensi pulang melewati batas shift ${att.shift} + 30 menit`,
          },
        });
      });
      count++;
    }
  }

  return count;
}

/**
 * Check-in absensi (SELF)
 * Sesuai aturan Fitur A (Geofence 100M Anti-Bypass) & Fitur B (Shift Fleksibel):
 * 1. Cabang punya koordinat -> koordinat client wajib. Tanpa koordinat = 403 GPS_REQUIRED + audit log.
 *    Di luar radius = 403 OUT_OF_RANGE + audit log.
 * 2. Cabang tanpa koordinat -> lolos (masa transisi) + audit log flag GEO_NOT_CONFIGURED.
 * 3. Cabang & shift ditentukan dari penugasan (ShiftAssignment) hari ini jika ada,
 *    atau default shift standar cabang jika tidak ada penugasan khusus.
 */
export async function checkIn(
  employeeId: string | null,
  branchId: string | null,
  coords?: { latitude?: number | null; longitude?: number | null; accuracy?: number | null },
  actorId?: string,
  ip?: string | null
) {
  // D1: User tanpa employeeId ditolak
  if (!employeeId) {
    throw new ValidationError(
      'Akun belum terhubung ke data karyawan untuk melakukan absensi'
    );
  }

  // Jalankan lazy-check auto checkout
  await runLazyAutoCheckout().catch(() => {});

  const { workDate, timeStr } = getJakartaDateTime();

  // Cek apakah ada ShiftAssignment untuk staf hari ini
  const assignment = await prisma.shiftAssignment.findFirst({
    where: {
      employeeId,
      date: workDate,
    },
    include: { branch: true },
  });

  // Tentukan cabang validasi dan shift aktif
  let targetBranchId = branchId;
  let activeShift: WorkShift = timeStr < '15:00' ? 'MORNING' : 'EVENING';

  if (assignment) {
    targetBranchId = assignment.branchId;
    activeShift = assignment.shift;
  }

  // A1: Wajib targetBranchId
  if (!targetBranchId) {
    throw new ValidationError('Branch aktif diperlukan untuk absensi');
  }

  // Cek apakah cabang target aktif
  const branch = await prisma.branch.findUnique({
    where: { id: targetBranchId },
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

  // Cek apakah sudah check-in pada shift ini hari ini
  const existing = await prisma.attendance.findUnique({
    where: {
      employeeId_workDate_shift: {
        employeeId,
        workDate,
        shift: activeShift,
      },
    },
  });

  if (existing) {
    throw new AlreadyCheckedInError('Sudah melakukan check-in hari ini');
  }

  // ─── VALIDASI GEOFENCE (FITUR A) ───
  const hasBranchCoords = branch.latitude !== null && branch.longitude !== null;
  let distanceMeters: number | null = null;
  const accuracyMeters: number | null = coords?.accuracy ?? null;

  if (hasBranchCoords) {
    // 1. Cabang SUDAH punya koordinat -> koordinat client WAJIB
    if (
      coords?.latitude === undefined ||
      coords?.latitude === null ||
      coords?.longitude === undefined ||
      coords?.longitude === null
    ) {
      await prisma.auditLog.create({
        data: {
          actorId: actorId ?? employeeId,
          action: 'ATTENDANCE_OUT_OF_RANGE',
          entity: 'Attendance',
          entityId: branch.id,
          note: `Check-in ditolak: GPS_REQUIRED pada cabang berkoordinat (${branch.name})`,
          ip,
        },
      });
      throw new GpsRequiredError('Koordinat GPS wajib disertakan untuk melakukan absensi pada cabang ini');
    }

    // Hitung jarak Haversine
    distanceMeters = calculateDistanceMeters(
      coords.latitude,
      coords.longitude,
      branch.latitude!,
      branch.longitude!
    );

    const radius = branch.geofenceRadius || 100;
    if (distanceMeters > radius) {
      await prisma.auditLog.create({
        data: {
          actorId: actorId ?? employeeId,
          action: 'ATTENDANCE_OUT_OF_RANGE',
          entity: 'Attendance',
          entityId: branch.id,
          note: `Check-in ditolak: di luar radius geofence. Jarak: ${distanceMeters}m (radius: ${radius}m), akurasi: ${accuracyMeters ?? 'N/A'}m`,
          ip,
        },
      });
      throw new OutOfRangeError(
        `Posisi Anda berada di luar radius absensi cabang (${distanceMeters}m, maksimal ${radius} meter)`,
        distanceMeters,
        radius
      );
    }
  }

  // Tentukan status PRESENT vs LATE
  const lateAfter = activeShift === 'MORNING' ? (branch.workingHours?.lateAfter ?? '09:15') : '16:15';
  const status: AttendanceStatus = timeStr > lateAfter ? 'LATE' : 'PRESENT';

  const attendance = await prisma.$transaction(async (tx) => {
    const created = await tx.attendance.create({
      data: {
        employeeId,
        branchId: targetBranchId!,
        workDate,
        shift: activeShift,
        checkIn: new Date(),
        status,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        distanceMeters,
        accuracyMeters,
      },
      select: attendancePublicSelect,
    });

    if (!hasBranchCoords) {
      // 2. Cabang BELUM punya koordinat -> lolos dengan flag GEO_NOT_CONFIGURED
      await tx.auditLog.create({
        data: {
          actorId: actorId ?? employeeId,
          action: 'CREATE',
          entity: 'Attendance',
          entityId: created.id,
          note: `Presensi dicatat (GEO_NOT_CONFIGURED: Cabang ${branch.name} belum dikonfigurasi koordinat geofence)`,
          ip,
        },
      });
    } else {
      // Audit log keberhasilan presensi dengan koordinat & akurasi
      await tx.auditLog.create({
        data: {
          actorId: actorId ?? employeeId,
          action: 'CREATE',
          entity: 'Attendance',
          entityId: created.id,
          note: `Check-in berhasil di ${branch.name}. Jarak: ${distanceMeters}m (radius: ${branch.geofenceRadius}m), Akurasi: ${accuracyMeters ?? 'N/A'}m`,
          ip,
        },
      });
    }

    return created;
  });

  return attendance;
}

/**
 * Check-out absensi (SELF)
 * A3: Belum check-in -> 409 INVALID_TRANSACTION_STATE
 * T10: Sudah check-out sebelumnya -> 409 INVALID_TRANSACTION_STATE
 * Fitur B: Menghitung keterlambatan pulang (lateCheckoutMinutes) jika melewati batas selesai shift.
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

  await runLazyAutoCheckout().catch(() => {});

  const { workDate, timeStr } = getJakartaDateTime();

  // Cari record absensi hari ini yang belum check-out
  const attendance = await prisma.attendance.findFirst({
    where: {
      employeeId,
      workDate,
      checkOut: null,
    },
    orderBy: { checkIn: 'desc' },
  });

  // Jika tidak ditemukan record yang belum checkout
  if (!attendance) {
    const anyToday = await prisma.attendance.findFirst({
      where: {
        employeeId,
        workDate,
      },
      orderBy: { checkIn: 'desc' },
    });

    if (!anyToday) {
      // A3: Belum check-in
      throw new ConflictError(
        'Belum melakukan check-in hari ini',
        'INVALID_TRANSACTION_STATE'
      );
    }

    // T10: Sudah check-out sebelumnya
    throw new ConflictError(
      'Sudah melakukan check-out hari ini',
      'INVALID_TRANSACTION_STATE'
    );
  }

  // Hitung selisih keterlambatan checkout jika melewati batas shift
  const shiftEndTime = attendance.shift === 'MORNING' ? '13:00' : '21:00';
  let lateCheckoutMinutes: number | null = null;

  if (timeStr > shiftEndTime) {
    const [currH, currM] = timeStr.split(':').map(Number);
    const [endH, endM] = shiftEndTime.split(':').map(Number);
    const diff = (currH * 60 + currM) - (endH * 60 + endM);
    if (diff > 0) {
      lateCheckoutMinutes = diff;
    }
  }

  const updated = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      checkOut: new Date(),
      lateCheckoutMinutes,
    },
    select: attendancePublicSelect,
  });

  return updated;
}

/**
 * GET /attendance/me (SELF)
 * Riwayat absensi sendiri dengan filter bulan (?month=YYYY-MM).
 */
export async function getMyAttendance(
  employeeId: string | null,
  monthStr?: string
) {
  if (!employeeId) {
    throw new ValidationError('Akun belum terhubung ke data karyawan');
  }

  await runLazyAutoCheckout().catch(() => {});

  const targetStr = monthStr ?? getJakartaDateTime().dateStr.slice(0, 7);
  const parts = targetStr.split('-');
  const year = parseInt(parts[0] ?? '2026', 10);
  const month = parseInt(parts[1] ?? '1', 10);

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));

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
 * List absensi seluruh staf.
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
  await runLazyAutoCheckout().catch(() => {});

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
      const lateAfter = existing.shift === 'MORNING'
        ? (existing.branch.workingHours?.lateAfter ?? '09:15')
        : '16:15';
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

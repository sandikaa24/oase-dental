/**
 * Custom error classes untuk OASE.
 * Setiap error punya HTTP status code + machine-readable code.
 */
export abstract class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validasi gagal', code: string = 'VALIDATION_ERROR') {
    super(message, 400, code);
  }
}

export class AlreadyCheckedInError extends AppError {
  constructor(message: string = 'Sudah melakukan check-in hari ini') {
    super(message, 400, 'ALREADY_CHECKED_IN');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Autentikasi diperlukan') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Akses ditolak') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class BranchAccessDeniedError extends AppError {
  constructor(message: string = 'Tidak punya akses ke cabang ini') {
    super(message, 403, 'BRANCH_ACCESS_DENIED');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Data tidak ditemukan') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = 'INVALID_TRANSACTION_STATE') {
    super(message, 409, code);
  }
}

export class InsufficientStockError extends AppError {
  constructor(message: string = 'Stok tidak mencukupi') {
    super(message, 409, 'INSUFFICIENT_STOCK');
  }
}

export class ClosingPeriodLockedError extends AppError {
  constructor(message: string = 'Periode sudah ditutup') {
    super(message, 409, 'CLOSING_PERIOD_LOCKED');
  }
}

export class ScheduleOverlapError extends AppError {
  constructor(message: string = 'Jadwal bentrok') {
    super(message, 409, 'SCHEDULE_OVERLAP');
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Terlalu banyak percobaan login. Coba lagi dalam 15 detik.') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}
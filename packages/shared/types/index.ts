export const UserRole = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  EMPLOYEE: 'EMPLOYEE'
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const TransactionStatus = {
  DRAFT: 'DRAFT',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED'
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const PaymentMethod = {
  CASH: 'CASH',
  DEBIT: 'DEBIT',
  QRIS_TRANSFER: 'QRIS_TRANSFER'
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const ItemType = {
  MATERIAL: 'MATERIAL'
} as const;
export type ItemType = (typeof ItemType)[keyof typeof ItemType];

export const MovementType = {
  STOCK_IN: 'STOCK_IN',
  TRANSACTION: 'TRANSACTION',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
  DAMAGE: 'DAMAGE',
  EXPIRED: 'EXPIRED',
  OPNAME: 'OPNAME'
} as const;
export type MovementType = (typeof MovementType)[keyof typeof MovementType];

export const ExpenseCategory = {
  OPERASIONAL: 'OPERASIONAL',
  GAJI: 'GAJI',
  SEWA: 'SEWA',
  UTILITAS: 'UTILITAS',
  SUPPLIER: 'SUPPLIER',
  LAINNYA: 'LAINNYA'
} as const;
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const LeaveType = {
  CUTI: 'CUTI',
  IZIN: 'IZIN',
  SAKIT: 'SAKIT'
} as const;
export type LeaveType = (typeof LeaveType)[keyof typeof LeaveType];

export const LeaveStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
} as const;
export type LeaveStatus = (typeof LeaveStatus)[keyof typeof LeaveStatus];

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  LATE: 'LATE'
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const OpnameStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED'
} as const;
export type OpnameStatus = (typeof OpnameStatus)[keyof typeof OpnameStatus];

export const ClosingStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED'
} as const;
export type ClosingStatus = (typeof ClosingStatus)[keyof typeof ClosingStatus];

export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  SWITCH_BRANCH: 'SWITCH_BRANCH',
  TRANSACTION_PAID: 'TRANSACTION_PAID',
  TRANSACTION_CANCELLED: 'TRANSACTION_CANCELLED',
  CASH_CLOSING_CREATED: 'CASH_CLOSING_CREATED',
  CASH_CLOSING_CLOSED: 'CASH_CLOSING_CLOSED',
  CASH_CLOSING_REOPENED: 'CASH_CLOSING_REOPENED',
  STOCK_OPNAME_SUBMITTED: 'STOCK_OPNAME_SUBMITTED',
  LEAVE_APPROVED: 'LEAVE_APPROVED',
  LEAVE_REJECTED: 'LEAVE_REJECTED',
  ATTENDANCE_CORRECTED: 'ATTENDANCE_CORRECTED',
  ATTENDANCE_OUT_OF_RANGE: 'ATTENDANCE_OUT_OF_RANGE',
  ATTENDANCE_AUTO_CHECKOUT: 'ATTENDANCE_AUTO_CHECKOUT',
  SHIFT_SWAP_REQUESTED: 'SHIFT_SWAP_REQUESTED',
  SHIFT_SWAP_APPROVED: 'SHIFT_SWAP_APPROVED',
  SHIFT_SWAP_REJECTED: 'SHIFT_SWAP_REJECTED'
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const WorkShift = {
  MORNING: 'MORNING',
  EVENING: 'EVENING'
} as const;
export type WorkShift = (typeof WorkShift)[keyof typeof WorkShift];

export const ShiftSource = {
  MANUAL: 'MANUAL',
  SWAP: 'SWAP'
} as const;
export type ShiftSource = (typeof ShiftSource)[keyof typeof ShiftSource];

export const SwapStatus = {
  PENDING_PEER: 'PENDING_PEER',
  PENDING_OWNER: 'PENDING_OWNER',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
} as const;
export type SwapStatus = (typeof SwapStatus)[keyof typeof SwapStatus];

/**
 * Kandidat user untuk pengecekan multi-cabang (Amandemen A3).
 * Mencegah hardcode OWNER/MANAGER saja:
 * - OWNER selalu multi-cabang (akses pusat & seluruh cabang).
 * - Non-OWNER (apapun rolenya) dianggap multi-cabang jika memiliki >1 assignment aktif.
 */
export interface MultiBranchCandidate {
  role: string | UserRole;
  branchCount?: number;
  branches?: Array<{ id: string }> | null;
}

export function isMultiBranchUser(candidate: MultiBranchCandidate): boolean {
  if (candidate.role === 'OWNER') return true;

  if (typeof candidate.branchCount === 'number') {
    return candidate.branchCount > 1;
  }

  if (Array.isArray(candidate.branches)) {
    return candidate.branches.length > 1;
  }

  return false;
}
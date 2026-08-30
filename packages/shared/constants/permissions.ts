import type { UserRole } from '../types';

/**
 * Daftar permission aksi yang bisa dimiliki role.
 * Mapping ini BINDING dari PRD Bagian 5 & API-CONTRACT.
 */
export const Permission = {
  USER_MANAGE: 'USER_MANAGE',
  BRANCH_MANAGE: 'BRANCH_MANAGE',
  MASTER_DATA_MANAGE: 'MASTER_DATA_MANAGE',
  MASTER_DATA_READ: 'MASTER_DATA_READ',
  POS_CREATE: 'POS_CREATE',
  TRANSACTION_CANCEL: 'TRANSACTION_CANCEL',
  CASH_CLOSING_CREATE: 'CASH_CLOSING_CREATE',
  CASH_CLOSING_REOPEN: 'CASH_CLOSING_REOPEN',
  STOCK_IN: 'STOCK_IN',
  STOCK_OPNAME_MANAGE: 'STOCK_OPNAME_MANAGE',
  STOCK_REPORT: 'STOCK_REPORT',
  EXPENSE_CREATE: 'EXPENSE_CREATE',
  EXPENSE_REPORT: 'EXPENSE_REPORT',
  ATTENDANCE_SELF: 'ATTENDANCE_SELF',
  ATTENDANCE_VIEW_ALL: 'ATTENDANCE_VIEW_ALL',
  LEAVE_REQUEST: 'LEAVE_REQUEST',
  LEAVE_DECIDE: 'LEAVE_DECIDE',
  SALES_REPORT: 'SALES_REPORT',
  AUDIT_LOG_VIEW: 'AUDIT_LOG_VIEW',
  PORTAL_CONTENT_MANAGE: 'PORTAL_CONTENT_MANAGE'
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL_PERMISSIONS: Permission[] = [
  Permission.USER_MANAGE,
  Permission.BRANCH_MANAGE,
  Permission.MASTER_DATA_MANAGE,
  Permission.MASTER_DATA_READ,
  Permission.POS_CREATE,
  Permission.TRANSACTION_CANCEL,
  Permission.CASH_CLOSING_CREATE,
  Permission.CASH_CLOSING_REOPEN,
  Permission.STOCK_IN,
  Permission.STOCK_OPNAME_MANAGE,
  Permission.STOCK_REPORT,
  Permission.EXPENSE_CREATE,
  Permission.EXPENSE_REPORT,
  Permission.ATTENDANCE_SELF,
  Permission.ATTENDANCE_VIEW_ALL,
  Permission.LEAVE_REQUEST,
  Permission.LEAVE_DECIDE,
  Permission.SALES_REPORT,
  Permission.AUDIT_LOG_VIEW,
  Permission.PORTAL_CONTENT_MANAGE
];

/**
 * Matriks permission per role — BINDING dari PRD Bagian 5.
 * Semua role non-OWNER mewarisi permission EMPLOYEE
 * (ATTENDANCE_SELF + LEAVE_REQUEST).
 */
export const PERMISSION_MATRIX: Record<UserRole, readonly Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  MANAGER: [
    Permission.MASTER_DATA_READ,
    Permission.STOCK_IN,
    Permission.STOCK_OPNAME_MANAGE,
    Permission.STOCK_REPORT,
    Permission.EXPENSE_CREATE,
    Permission.EXPENSE_REPORT,
    Permission.ATTENDANCE_SELF,
    Permission.ATTENDANCE_VIEW_ALL,
    Permission.LEAVE_REQUEST,
    Permission.LEAVE_DECIDE
  ],
  CASHIER: [
    Permission.MASTER_DATA_READ,
    Permission.POS_CREATE,
    Permission.CASH_CLOSING_CREATE,
    Permission.ATTENDANCE_SELF,
    Permission.LEAVE_REQUEST
  ],
  EMPLOYEE: [Permission.ATTENDANCE_SELF, Permission.LEAVE_REQUEST]
};

/** Cek apakah role punya permission tertentu. */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const perms = PERMISSION_MATRIX[role];
  return perms ? perms.includes(permission) : false;
}

/** Daftar permission sebuah role (urut dari matriks). */
export function getPermissions(role: UserRole): Permission[] {
  return [...PERMISSION_MATRIX[role]];
}

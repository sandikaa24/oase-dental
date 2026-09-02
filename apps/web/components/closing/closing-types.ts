/**
 * TypeScript types untuk modul Cash Closing.
 * Derived dari response shape API-CONTRACT §12 dan §14.
 */

export type ClosingStatus = 'OPEN' | 'CLOSED';

export interface ClosingBranch {
  id: string;
  code: string;
  name: string;
}

export interface ClosingUserRef {
  id: string;
  email: string;
  employee: { name: string } | null;
}

export interface CashClosing {
  id: string;
  branchId: string;
  branch: ClosingBranch;
  status: ClosingStatus;
  periodStart: string; // ISO string
  closingDate: string; // ISO string
  expectedCash: string; // Decimal string
  actualCash: string; // Decimal string
  variance: string; // Decimal string (bisa negatif)
  note: string | null;
  closedBy: string;
  closedByUser: ClosingUserRef | null;
  reopenedBy: string | null;
  reopenedByUser: ClosingUserRef | null;
  reopenedReason: string | null;
  reopenedAt: string | null; // ISO string
  createdAt: string; // ISO string
}

export interface ClosingPreview {
  branchId: string;
  periodStart: string; // ISO string
  expectedCash: string; // Decimal string
  transactionCount: number;
  totalRevenue: string; // Decimal string
  alreadyClosedToday: boolean;
  lastClosingDate: string | null; // ISO string
}

export interface ClosingListResponse {
  data: CashClosing[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CashierDashboard {
  date: string; // YYYY-MM-DD
  branchId: string;
  transactionCount: number;
  totalRevenue: string; // Decimal string
  cashRevenue: string; // Decimal string
  debitRevenue: string; // Decimal string
  qrisRevenue: string; // Decimal string
  closingStatus: ClosingStatus | null;
  closingId: string | null;
}

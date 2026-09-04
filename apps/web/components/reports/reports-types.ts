export type ReportTabId =
  | 'sales'
  | 'products'
  | 'expenses'
  | 'inventory'
  | 'gross-profit'
  | 'audit-logs';

export interface SalesReportData {
  transactions: Array<{
    id: string;
    transactionNumber: string;
    branchId: string;
    cashierId: string;
    patientName: string | null;
    patientPhone: string | null;
    status: string;
    subtotal: string;
    discount: string;
    total: string;
    paymentMethod: string;
    paidAmount: string;
    changeAmount: string;
    transactionDate: string;
    branch?: { name: string; code: string };
    cashier?: { name: string; email: string };
  }>;
  summary: {
    transactionCount: number;
    totalRevenue: string;
    cashRevenue: string;
    debitRevenue: string;
    qrisRevenue: string;
    transferRevenue: string;
  };
}

export interface ProductReportItem {
  itemId: string;
  name: string;
  quantity: number;
  revenue: string;
}

export interface ExpenseReportItem {
  id: string;
  branchId: string;
  category: 'OPERASIONAL' | 'MEDIS' | 'UTILITAS' | 'GAJI_BONUS' | 'LAINNYA';
  amount: string;
  expenseDate: string;
  note: string | null;
  proofUrl: string | null;
  branch?: { id: string; name: string; code: string };
}

export interface ExpensesReportData {
  data: ExpenseReportItem[];
  summary: {
    _sum: {
      amount: string | null;
    };
  };
}

export interface InventoryReportItem {
  id: string;
  branchId: string;
  itemId: string;
  itemName: string;
  currentQuantity: number;
  minStock: number;
  isLowStock: boolean;
  wac: string;
  totalValuation: string;
}

export interface GrossProfitData {
  period: {
    dateFrom: string;
    dateTo: string;
  };
  totalRevenue: string;
  totalCOGS: string;
  totalExpense: string;
  grossProfit: string;
}

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  note: string | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OwnerDashboardData {
  summary: Array<{
    branchId: string;
    branchName: string;
    todayTransactions: number;
    todayRevenue: string;
  }>;
  sevenDayTrend?: Array<{
    date: string;
    revenue: string;
    transactions?: number;
  }>;
  trending?: Array<{
    date: string;
    revenue: string;
    transactions?: number;
  }>;
}

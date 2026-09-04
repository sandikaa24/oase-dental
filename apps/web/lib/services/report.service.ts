import { Prisma, PaymentMethod, ExpenseCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Jakarta';

// Helper to get default date range (last 30 days) if not provided
export function getDateRange(dateFrom?: string, dateTo?: string) {
  const now = new Date();
  const defaultTo = endOfDay(toZonedTime(now, TZ));
  const defaultFrom = startOfDay(subDays(defaultTo, 30));

  const from = dateFrom ? startOfDay(new Date(dateFrom)) : defaultFrom;
  const to = dateTo ? endOfDay(new Date(dateTo)) : defaultTo;
  return { from, to };
}

// 1. Laporan Penjualan (Sales)
export async function getSalesReport(
  branchId: string | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  method: string | undefined,
  page: number = 1,
  limit: number = 20
) {
  const { from, to } = getDateRange(dateFrom, dateTo);

  const where: Prisma.TransactionWhereInput = {
    status: 'PAID',
    transactionDate: { gte: from, lte: to },
    ...(branchId && { branchId }),
    ...(method && { payments: { some: { method: method as PaymentMethod } } }),
  };

  const total = await prisma.transaction.count({ where });
  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      branch: true,
      items: true,
      payments: true,
    },
    orderBy: { transactionDate: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  // Calculate totals across all matching (not just paginated)
  const allTx = await prisma.transaction.findMany({
    where,
    select: {
      total: true,
      payments: { select: { amount: true, method: true } },
    },
  });

  const totalRevenue = allTx.reduce((acc, tx) => acc + Number(tx.total), 0);
  const paymentBreakdown = allTx.reduce((acc: Record<string, number>, tx) => {
    tx.payments.forEach((p) => {
      acc[p.method] = (acc[p.method] || 0) + Number(p.amount);
    });
    return acc;
  }, {});

  return {
    transactions,
    summary: {
      transactionCount: total,
      totalRevenue: totalRevenue.toFixed(2),
      paymentBreakdown,
    },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// 2. Laporan Produk/Layanan Terlaris
export async function getProductsReport(
  branchId: string | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  page: number = 1,
  limit: number = 20
) {
  const { from, to } = getDateRange(dateFrom, dateTo);

  const where: Prisma.TransactionItemWhereInput = {
    transaction: {
      status: 'PAID',
      transactionDate: { gte: from, lte: to },
      ...(branchId && { branchId }),
    },
  };

  // Agregasi manual via Prisma
  const items = await prisma.transactionItem.groupBy({
    by: ['itemId', 'name'],
    where,
    _sum: {
      quantity: true,
      lineTotal: true,
    },
    orderBy: {
      _sum: { quantity: 'desc' },
    },
    skip: (page - 1) * limit,
    take: limit,
  });

  // Count total distinct items requires distinct query or raw query
  // Fallback to simplistic total for MVP
  const totalItems = await prisma.transactionItem.findMany({
    where,
    distinct: ['itemId'],
    select: { itemId: true }
  });
  const total = totalItems.length;

  const data = items.map(item => ({
    itemId: item.itemId,
    name: item.name,
    quantity: item._sum.quantity || 0,
    revenue: Number(item._sum.lineTotal || 0).toFixed(2),
  }));

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// 3. Laporan Pengeluaran
export async function getExpensesReport(
  branchId: string | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  category: string | undefined,
  page: number = 1,
  limit: number = 20
) {
  const { from, to } = getDateRange(dateFrom, dateTo);

  const where: Prisma.ExpenseWhereInput = {
    expenseDate: { gte: from, lte: to },
    ...(branchId && { branchId }),
    ...(category && { category: category as ExpenseCategory }),
  };

  const total = await prisma.expense.count({ where });
  const data = await prisma.expense.findMany({
    where,
    include: { branch: true },
    orderBy: { expenseDate: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const summary = await prisma.expense.aggregate({
    where,
    _sum: { amount: true }
  });

  return {
    data,
    summary: { totalExpense: Number(summary._sum.amount || 0).toFixed(2) },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// 4. Laporan Gross Profit (WAC)
export async function getGrossProfitReport(
  branchId: string | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined
) {
  const { from, to } = getDateRange(dateFrom, dateTo);

  // a. Total Penjualan (Omzet)
  const sales = await prisma.transaction.aggregate({
    where: {
      status: 'PAID',
      transactionDate: { gte: from, lte: to },
      ...(branchId && { branchId }),
    },
    _sum: { total: true },
  });
  const totalRevenue = Number(sales._sum.total || 0);

  // b. Total Pengeluaran
  const expenses = await prisma.expense.aggregate({
    where: {
      expenseDate: { gte: from, lte: to },
      ...(branchId && { branchId }),
    },
    _sum: { amount: true },
  });
  const totalExpense = Number(expenses._sum.amount || 0);

  // c. HPP / Biaya Stock In dalam periode (WAC period)
  // PRD: "HPP Periode (Biaya Stock In): Dihitung dari movement STOCK_IN (jumlah × unitCost) dalam rentang tanggal yang dipilih."
  const stockIns = await prisma.inventoryMovement.findMany({
    where: {
      referenceType: 'STOCK_IN',
      createdAt: { gte: from, lte: to },
      ...(branchId && { branchId }),
      unitCost: { not: null },
    },
    select: { quantityDelta: true, unitCost: true },
  });

  let totalCOGS = 0;
  stockIns.forEach(move => {
    totalCOGS += move.quantityDelta * Number(move.unitCost);
  });

  const grossProfit = totalRevenue - totalCOGS - totalExpense;

  return {
    period: { dateFrom: from.toISOString(), dateTo: to.toISOString() },
    totalRevenue: totalRevenue.toFixed(2),
    totalCOGS: totalCOGS.toFixed(2), // Biaya Stock In
    totalExpense: totalExpense.toFixed(2),
    grossProfit: grossProfit.toFixed(2),
  };
}

// 5. Laporan Inventory (dengan WAC berjalan)
export async function getInventoryReport(
  branchId: string | undefined,
  page: number = 1,
  limit: number = 20
) {
  const where: Prisma.StockLevelWhereInput = {
    ...(branchId && { branchId }),
  };

  const total = await prisma.stockLevel.count({ where });
  const stockLevels = await prisma.stockLevel.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
  });

  // Calculate WAC per item from ALL STOCK_IN movements
  // WAC = SUM(unitCost * qty) / SUM(qty)
  const data = await Promise.all(
    stockLevels.map(async (sl) => {
      // Get all stock in for this branch & item
      const stockIns = await prisma.inventoryMovement.findMany({
        where: {
          branchId: sl.branchId,
          itemId: sl.itemId,
          referenceType: 'STOCK_IN',
          unitCost: { not: null },
        },
        select: { quantityDelta: true, unitCost: true }
      });

      let totalVal = 0;
      let totalQty = 0;
      stockIns.forEach(move => {
        totalVal += move.quantityDelta * Number(move.unitCost);
        totalQty += move.quantityDelta;
      });

      const wac = totalQty > 0 ? (totalVal / totalQty) : 0;
      const valuation = sl.quantity * wac;

      // also need min stock to determine if low
      // for MVP we lookup Material
      const material = await prisma.material.findUnique({
        where: { id: sl.itemId },
        select: { name: true, minStock: true }
      });

      return {
        id: sl.id,
        branchId: sl.branchId,
        itemId: sl.itemId,
        itemName: material?.name || 'Unknown',
        currentQuantity: sl.quantity,
        minStock: material?.minStock || 0,
        isLowStock: material ? sl.quantity <= material.minStock : false,
        wac: wac.toFixed(2),
        totalValuation: valuation.toFixed(2),
      };
    })
  );

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// 6. Laporan Absensi
export async function getAttendanceReport(
  branchId: string | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  page: number = 1,
  limit: number = 20
) {
  const { from, to } = getDateRange(dateFrom, dateTo);

  const where: Prisma.AttendanceWhereInput = {
    workDate: { gte: from, lte: to },
    ...(branchId && { branchId }),
  };

  // We want to group by employeeId
  const items = await prisma.attendance.groupBy({
    by: ['employeeId'],
    where,
    _count: { _all: true },
    orderBy: { employeeId: 'asc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const totalEmployees = await prisma.attendance.findMany({
    where,
    distinct: ['employeeId'],
    select: { employeeId: true }
  });
  const total = totalEmployees.length;

  const data = await Promise.all(
    items.map(async (item) => {
      const employee = await prisma.employee.findUnique({
        where: { id: item.employeeId },
        select: { name: true }
      });

      const presentCount = await prisma.attendance.count({
        where: { ...where, employeeId: item.employeeId, status: 'PRESENT' }
      });
      const lateCount = await prisma.attendance.count({
        where: { ...where, employeeId: item.employeeId, status: 'LATE' }
      });

      return {
        employeeId: item.employeeId,
        name: employee?.name || 'Unknown',
        totalDays: item._count._all,
        presentCount,
        lateCount,
      };
    })
  );

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// 7. Owner Dashboard
export async function getOwnerDashboard() {
  const branches = await prisma.branch.findMany({ where: { active: true } });
  
  const { from, to } = getDateRange(
    startOfDay(toZonedTime(new Date(), TZ)).toISOString(),
    endOfDay(toZonedTime(new Date(), TZ)).toISOString()
  );

  const summary = await Promise.all(branches.map(async (b) => {
    const tx = await prisma.transaction.aggregate({
      where: {
        branchId: b.id,
        status: 'PAID',
        transactionDate: { gte: from, lte: to }
      },
      _count: { _all: true },
      _sum: { total: true }
    });

    return {
      branchId: b.id,
      branchName: b.name,
      todayTransactions: tx._count._all,
      todayRevenue: Number(tx._sum.total || 0).toFixed(2),
    };
  }));

  // 7-day trend (global)
  const weekStart = startOfDay(subDays(toZonedTime(new Date(), TZ), 6));
  const weekEnd = endOfDay(toZonedTime(new Date(), TZ));

  const weekTx = await prisma.transaction.findMany({
    where: {
      status: 'PAID',
      transactionDate: { gte: weekStart, lte: weekEnd }
    },
    select: { transactionDate: true, total: true }
  });

  const trending = Array.from({ length: 7 }).map((_, i) => {
    const d = startOfDay(subDays(toZonedTime(new Date(), TZ), 6 - i));
    const dStr = format(d, 'yyyy-MM-dd');
    const dayTotal = weekTx
      .filter(t => format(new Date(t.transactionDate), 'yyyy-MM-dd') === dStr)
      .reduce((acc, t) => acc + Number(t.total), 0);
    return { date: dStr, revenue: dayTotal.toFixed(2) };
  });

  return { summary, trending, sevenDayTrend: trending };
}

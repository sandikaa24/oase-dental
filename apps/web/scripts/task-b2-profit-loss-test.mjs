/**
 * TASK B2 — TEST SUITE LAPORAN LABA RUGI MENDALAM (PROFIT & LOSS)
 *
 * Menguji:
 * 1. Snapshot costPrice di SEMUA tipe StockMovement (IN, OUT, ADJUSTMENT)
 * 2. Boundary tanggal inklusif sampai akhir hari (dateTo 23:59:59.999) di SEMUA sumber
 * 3. Skema nyata StockMovement & formula HPP (OUT + ADJUSTMENT delta)
 * 4. Status transaksi (hanya PAID masuk pendapatan, DRAFT & CANCELLED tidak)
 * 5. Penanganan produk lama tanpa costPrice (fallback 0, uncostedMovementCount)
 * 6. RBAC & Anti-IDOR (OWNER konsolidasi/cabang, MANAGER cabang aktif, CASHIER 403)
 * 7. Backward compatibility endpoint lama /reports/gross-profit
 *
 * Jalankan: node apps/web/scripts/task-b2-profit-loss-test.mjs
 */

import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

// ─── Proteksi Lingkungan (AGENTS.md Aturan 16) ──────────────────────────────
const dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('supabase') || dbUrl.includes('pooler.') || dbUrl.includes('staging')) {
  console.error('⛔ FATAL: Test suite menolak berjalan pada database remote/staging!');
  console.error('   DATABASE_URL terdeteksi mengandung kata terlarang.');
  process.exit(1);
}

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL || 'owner@oase.id';
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD || '1234';
const CASHIER_EMAIL = 'cashier@oase.id';
const CASHIER_PASSWORD = '1234';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function req(path, method = 'GET', body = null, cookie = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });

  const setCookie = res.headers.get('set-cookie') || '';
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, setCookie };
}

function extractCookie(cookieHeader) {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(/,(?=\s*[a-zA-Z0-9_-]+=)/);
  const accessToken = parts.find((p) => p.trim().startsWith('access_token='));
  return accessToken ? accessToken.trim().split(';')[0] : '';
}

async function login(email, password) {
  const res = await req('/api/v1/auth/login', 'POST', { email, password });
  if (res.status !== 200 || !res.setCookie) {
    throw new Error(`Login gagal untuk ${email}: status ${res.status}`);
  }
  return extractCookie(res.setCookie);
}

async function main() {
  console.log('\n============================================================');
  console.log('🧪 MEMULAI TEST SUITE TASK B2 — LAPORAN LABA RUGI MENDALAM');
  console.log('============================================================\n');

  // 0. Otentikasi dan Identifikasi Data Dasar
  console.log('--- Tahap 0: Login Akun Pengujian ---');
  const ownerCookie = await login(OWNER_EMAIL, OWNER_PASSWORD);
  const cashierCookie = await login(CASHIER_EMAIL, CASHIER_PASSWORD);

  // Ambil cabang dari DB
  const branches = await prisma.branch.findMany({ where: { active: true }, orderBy: { code: 'asc' } });
  if (branches.length < 2) {
    throw new Error('Diperlukan minimal 2 cabang aktif untuk pengujian konsolidasi.');
  }
  const branchJkt = branches[0];
  const branchBdg = branches[1];

  // Pastikan user MANAGER cabang Jkt ada dengan Employee dan terpasang di branch JKT
  const rndMgr = Math.floor(Math.random() * 90000) + 10000;
  const mgrEmp = await prisma.employee.create({
    data: {
      name: `Manager B2 ${rndMgr}`,
      position: 'Branch Manager',
      phone: `0813${rndMgr}`,
      branches: {
        create: {
          branchId: branchJkt.id,
        },
      },
    },
  });

  const hash = await bcrypt.hash('Password123', 10);
  const mgrEmail = `mgr.b2.${rndMgr}@oase.id`;
  const managerUser = await prisma.user.create({
    data: {
      email: mgrEmail,
      passwordHash: hash,
      role: 'MANAGER',
      employeeId: mgrEmp.id,
      active: true,
    },
  });

  let managerCookie = await login(mgrEmail, 'Password123');
  // Pastikan activeBranchId MANAGER terpasang ke branch JKT
  const switchRes = await req('/api/v1/auth/switch-branch', 'POST', { branchId: branchJkt.id }, managerCookie);
  if (switchRes.setCookie) {
    managerCookie = extractCookie(switchRes.setCookie);
  }

  console.log(`  Cabang 1 (JKT): ${branchJkt.name} (${branchJkt.id})`);
  console.log(`  Cabang 2 (BDG): ${branchBdg.name} (${branchBdg.id})`);
  console.log(`  Owner, Manager (${branchJkt.code}), Cashier berhasil login.\n`);

  // 1. Uji Snapshot costPrice di SEMUA tipe StockMovement (IN, OUT, ADJUSTMENT)
  console.log('--- Uji 1: Snapshot costPrice di SEMUA tipe StockMovement (IN, OUT, ADJUSTMENT) ---');
  const testProduct = await prisma.material.create({
    data: {
      name: `Produk Uji B2 ${Date.now()}`,
      sku: `BHP-TEST-${Date.now()}`,
      unit: 'pcs',
      category: 'BHP',
      costPrice: new Prisma.Decimal('50000.00'),
      active: true,
    },
  });

  // a. Mutasi IN
  const inRes = await req('/api/v1/stock/mutation', 'POST', {
    materialId: testProduct.id,
    branchId: branchJkt.id,
    type: 'IN',
    qty: 20,
    note: 'Pengujian IN snapshot costPrice',
  }, ownerCookie);
  assert(inRes.status === 201 || inRes.status === 200, 'Mutasi IN berhasil dicatat (200/201)');

  const inDb = await prisma.stockMovement.findFirst({
    where: { materialId: testProduct.id, type: 'IN' },
    orderBy: { createdAt: 'desc' },
  });
  assert(inDb !== null, 'Record StockMovement IN ditemukan di DB');
  assert(Number(inDb?.costPrice) === 50000, `StockMovement IN menyimpan snapshot costPrice Rp 50.000 (aktual: ${inDb?.costPrice})`);

  // b. Mutasi OUT
  const outRes = await req('/api/v1/stock/mutation', 'POST', {
    materialId: testProduct.id,
    branchId: branchJkt.id,
    type: 'OUT',
    qty: 5,
    note: 'Pengujian OUT snapshot costPrice',
  }, ownerCookie);
  assert(outRes.status === 201 || outRes.status === 200, 'Mutasi OUT berhasil dicatat (200/201)');

  const outDb = await prisma.stockMovement.findFirst({
    where: { materialId: testProduct.id, type: 'OUT' },
    orderBy: { createdAt: 'desc' },
  });
  assert(outDb !== null, 'Record StockMovement OUT ditemukan di DB');
  assert(Number(outDb?.costPrice) === 50000, `StockMovement OUT menyimpan snapshot costPrice Rp 50.000 (aktual: ${outDb?.costPrice})`);

  // c. Mutasi ADJUSTMENT
  // Stok awal 20 - 5 = 15. Disesuaikan menjadi 12 (susut 3 pcs)
  const adjRes = await req('/api/v1/stock/mutation', 'POST', {
    materialId: testProduct.id,
    branchId: branchJkt.id,
    type: 'ADJUSTMENT',
    qty: 12,
    note: 'Pengujian ADJUSTMENT snapshot costPrice',
  }, ownerCookie);
  assert(adjRes.status === 201 || adjRes.status === 200, 'Mutasi ADJUSTMENT berhasil dicatat (200/201)');

  const adjDb = await prisma.stockMovement.findFirst({
    where: { materialId: testProduct.id, type: 'ADJUSTMENT' },
    orderBy: { createdAt: 'desc' },
  });
  assert(adjDb !== null, 'Record StockMovement ADJUSTMENT ditemukan di DB');
  assert(Number(adjDb?.costPrice) === 50000, `StockMovement ADJUSTMENT menyimpan snapshot costPrice Rp 50.000 (aktual: ${adjDb?.costPrice})`);
  assert(adjDb?.qtyBefore === 15 && adjDb?.qtyAfter === 12, `StockMovement ADJUSTMENT merekam qtyBefore=15, qtyAfter=12`);

  // 2. Uji Boundary Tanggal Inklusif 23:59:59.999 pada SEMUA Sumber
  console.log('\n--- Uji 2: Boundary Tanggal Inklusif 23:59:59.999 pada SEMUA Sumber ---');
  const targetDateStr = '2026-09-15';
  const nextDateStr = '2026-09-16';

  // Bersihkan data tanggal uji agar isolasi terjamin
  await prisma.transactionPayment.deleteMany({ where: { transaction: { transactionNumber: { startsWith: 'TRX-BND-' } } } });
  await prisma.transaction.deleteMany({ where: { transactionNumber: { startsWith: 'TRX-BND-' } } });
  await prisma.expense.deleteMany({ where: { note: { contains: 'boundary test' } } });
  await prisma.stockMovement.deleteMany({ where: { createdAt: { gte: new Date(`${targetDateStr}T00:00:00.000Z`), lte: new Date(`${nextDateStr}T23:59:59.999Z`) } } });
  await prisma.stockMovement.deleteMany({ where: { materialId: testProduct.id } });

  // Transaksi 1: PAID persis pada 23:59:59 di targetDateStr (HARUS MASUK)
  const boundaryTxIn = await prisma.transaction.create({
    data: {
      transactionNumber: `TRX-BND-IN-${Date.now()}`,
      branchId: branchJkt.id,
      status: 'PAID',
      subtotal: new Prisma.Decimal('1000000.00'),
      total: new Prisma.Decimal('1000000.00'),
      transactionDate: new Date(`${targetDateStr}T23:59:59.000Z`),
      paidAt: new Date(`${targetDateStr}T23:59:59.000Z`),
      cashierId: managerUser.id,
      payments: {
        create: {
          method: 'CASH',
          amount: new Prisma.Decimal('1000000.00'),
        },
      },
    },
  });

  // Transaksi 2: PAID pada 00:00:01 di nextDateStr (TIDAK BOLEH MASUK)
  const boundaryTxOut = await prisma.transaction.create({
    data: {
      transactionNumber: `TRX-BND-OUT-${Date.now()}`,
      branchId: branchJkt.id,
      status: 'PAID',
      subtotal: new Prisma.Decimal('5000000.00'),
      total: new Prisma.Decimal('5000000.00'),
      transactionDate: new Date(`${nextDateStr}T00:00:01.000Z`),
      paidAt: new Date(`${nextDateStr}T00:00:01.000Z`),
      cashierId: managerUser.id,
      payments: {
        create: {
          method: 'CASH',
          amount: new Prisma.Decimal('5000000.00'),
        },
      },
    },
  });

  // Mutasi Stok OUT pada 23:59:59 di targetDateStr (HARUS MASUK HPP: 2 × 50.000 = 100.000)
  const boundaryMovementIn = await prisma.stockMovement.create({
    data: {
      materialId: testProduct.id,
      branchId: branchJkt.id,
      type: 'OUT',
      qty: 2,
      qtyBefore: 10,
      qtyAfter: 8,
      costPrice: new Prisma.Decimal('50000.00'),
      userId: managerUser.id,
      createdAt: new Date(`${targetDateStr}T23:59:59.000Z`),
    },
  });

  // Mutasi Stok OUT pada 00:00:01 di nextDateStr (TIDAK BOLEH MASUK)
  const boundaryMovementOut = await prisma.stockMovement.create({
    data: {
      materialId: testProduct.id,
      branchId: branchJkt.id,
      type: 'OUT',
      qty: 10,
      qtyBefore: 8,
      qtyAfter: 0,
      costPrice: new Prisma.Decimal('50000.00'),
      userId: managerUser.id,
      createdAt: new Date(`${nextDateStr}T00:00:01.000Z`),
    },
  });

  // Expense pada targetDateStr (HARUS MASUK: 300.000)
  const boundaryExpenseIn = await prisma.expense.create({
    data: {
      branchId: branchJkt.id,
      category: 'UTILITAS',
      amount: new Prisma.Decimal('300000.00'),
      expenseDate: new Date(`${targetDateStr}T00:00:00.000Z`),
      note: 'Listrik boundary test',
      createdBy: managerUser.id,
    },
  });

  // Expense pada nextDateStr (TIDAK BOLEH MASUK: 1.000.000)
  const boundaryExpenseOut = await prisma.expense.create({
    data: {
      branchId: branchJkt.id,
      category: 'SEWA',
      amount: new Prisma.Decimal('1000000.00'),
      expenseDate: new Date(`${nextDateStr}T00:00:00.000Z`),
      note: 'Sewa boundary test luar',
      createdBy: managerUser.id,
    },
  });

  // Query Laba Rugi untuk rentang tepat targetDateStr s/d targetDateStr
  const bndRes = await req(
    `/api/v1/reports/profit-loss?dateFrom=${targetDateStr}&dateTo=${targetDateStr}&branchId=${branchJkt.id}`,
    'GET',
    null,
    ownerCookie
  );

  assert(bndRes.status === 200, 'GET /reports/profit-loss boundary 23:59 mengembalikan status 200');
  const bndData = bndRes.data?.data;
  assert(Number(bndData?.summary?.totalRevenue) === 1000000, `Boundary: Total pendapatan persis Rp 1.000.000 (transaksi 23:59:59 masuk, esok hari tidak; aktual: ${bndData?.summary?.totalRevenue})`);
  assert(Number(bndData?.summary?.totalCOGS) === 100000, `Boundary: Total COGS persis Rp 100.000 (mutasi 23:59:59 masuk, esok hari tidak; aktual: ${bndData?.summary?.totalCOGS})`);
  assert(Number(bndData?.summary?.totalExpense) === 300000, `Boundary: Total Expense persis Rp 300.000 (aktual: ${bndData?.summary?.totalExpense})`);
  // Laba Kotor = 1.000.000 - 100.000 = 900.000
  assert(Number(bndData?.summary?.grossProfit) === 900000, `Boundary: Laba Kotor persis Rp 900.000 (aktual: ${bndData?.summary?.grossProfit})`);
  // Laba Bersih = 900.000 - 300.000 = 600.000
  assert(Number(bndData?.summary?.netProfit) === 600000, `Boundary: Laba Bersih persis Rp 600.000 (aktual: ${bndData?.summary?.netProfit})`);
  assert(bndData?.summary?.status === 'SURPLUS', `Boundary: Status kinerja SURPLUS`);

  // 3. Uji Formula Skema Nyata StockMovement (ADJUSTMENT negatif vs positif)
  console.log('\n--- Uji 3: Formula Akuntansi HPP (ADJUSTMENT Susut vs Surplus) ---');
  // Tambahkan mutasi ADJUSTMENT di dalam periode target:
  // a. ADJUSTMENT negatif: qtyBefore=8, qtyAfter=6 (susut 2 pcs x 50.000 = +100.000 beban)
  await prisma.stockMovement.create({
    data: {
      materialId: testProduct.id,
      branchId: branchJkt.id,
      type: 'ADJUSTMENT',
      qty: 6,
      qtyBefore: 8,
      qtyAfter: 6,
      costPrice: new Prisma.Decimal('50000.00'),
      userId: managerUser.id,
      createdAt: new Date(`${targetDateStr}T12:00:00.000Z`),
      note: 'Susut 2 pcs',
    },
  });

  const bndResAdj1 = await req(
    `/api/v1/reports/profit-loss?dateFrom=${targetDateStr}&dateTo=${targetDateStr}&branchId=${branchJkt.id}`,
    'GET',
    null,
    ownerCookie
  );
  // COGS lama 100.000 + susut 100.000 = 200.000
  assert(Number(bndResAdj1.data?.data?.summary?.totalCOGS) === 200000, `ADJUSTMENT negatif (susut 2 pcs) menambah HPP menjadi Rp 200.000 (aktual: ${bndResAdj1.data?.data?.summary?.totalCOGS})`);

  // b. ADJUSTMENT positif: qtyBefore=6, qtyAfter=7 (surplus 1 pcs x 50.000 = -50.000 koreksi beban)
  await prisma.stockMovement.create({
    data: {
      materialId: testProduct.id,
      branchId: branchJkt.id,
      type: 'ADJUSTMENT',
      qty: 7,
      qtyBefore: 6,
      qtyAfter: 7,
      costPrice: new Prisma.Decimal('50000.00'),
      userId: managerUser.id,
      createdAt: new Date(`${targetDateStr}T14:00:00.000Z`),
      note: 'Surplus 1 pcs',
    },
  });

  const bndResAdj2 = await req(
    `/api/v1/reports/profit-loss?dateFrom=${targetDateStr}&dateTo=${targetDateStr}&branchId=${branchJkt.id}`,
    'GET',
    null,
    ownerCookie
  );
  // COGS lama 200.000 - 50.000 = 150.000
  assert(Number(bndResAdj2.data?.data?.summary?.totalCOGS) === 150000, `ADJUSTMENT positif (surplus 1 pcs) mengoreksi HPP menjadi Rp 150.000 (aktual: ${bndResAdj2.data?.data?.summary?.totalCOGS})`);

  // 4. Uji Status Transaksi (DRAFT dan CANCELLED tidak masuk pendapatan)
  console.log('\n--- Uji 4: Status Transaksi (DRAFT & CANCELLED Ditolak Masuk Pendapatan) ---');
  const draftTx = await prisma.transaction.create({
    data: {
      transactionNumber: `TRX-DRAFT-${Date.now()}`,
      branchId: branchJkt.id,
      status: 'DRAFT',
      subtotal: new Prisma.Decimal('9990000.00'),
      total: new Prisma.Decimal('9990000.00'),
      transactionDate: new Date(`${targetDateStr}T10:00:00.000Z`),
      cashierId: managerUser.id,
    },
  });

  const cancelledTx = await prisma.transaction.create({
    data: {
      transactionNumber: `TRX-CANCELLED-${Date.now()}`,
      branchId: branchJkt.id,
      status: 'CANCELLED',
      subtotal: new Prisma.Decimal('8880000.00'),
      total: new Prisma.Decimal('8880000.00'),
      transactionDate: new Date(`${targetDateStr}T10:00:00.000Z`),
      paidAt: new Date(`${targetDateStr}T10:00:00.000Z`),
      cashierId: managerUser.id,
    },
  });

  const bndResStatus = await req(
    `/api/v1/reports/profit-loss?dateFrom=${targetDateStr}&dateTo=${targetDateStr}&branchId=${branchJkt.id}`,
    'GET',
    null,
    ownerCookie
  );
  assert(Number(bndResStatus.data?.data?.summary?.totalRevenue) === 1000000, `Transaksi DRAFT & CANCELLED tidak menambah total pendapatan (tetap Rp 1.000.000; aktual: ${bndResStatus.data?.data?.summary?.totalRevenue})`);

  // 5. Uji Produk Lama Tanpa costPrice (Null Safety & uncostedMovementCount)
  console.log('\n--- Uji 5: Kasus Produk Lama Tanpa costPrice ---');
  const uncostedProduct = await prisma.material.create({
    data: {
      name: `Produk Lama Tanpa HPP ${Date.now()}`,
      sku: `ATK-TEST-${Date.now()}`,
      unit: 'pcs',
      category: 'ATK',
      costPrice: null, // Null!
      active: true,
    },
  });

  await prisma.stockMovement.create({
    data: {
      materialId: uncostedProduct.id,
      branchId: branchJkt.id,
      type: 'OUT',
      qty: 5,
      qtyBefore: 10,
      qtyAfter: 5,
      costPrice: null, // Snapshot juga null
      userId: managerUser.id,
      createdAt: new Date(`${targetDateStr}T11:00:00.000Z`),
    },
  });

  const uncostedRes = await req(
    `/api/v1/reports/profit-loss?dateFrom=${targetDateStr}&dateTo=${targetDateStr}&branchId=${branchJkt.id}`,
    'GET',
    null,
    ownerCookie
  );
  assert(uncostedRes.status === 200, 'Query laporan dengan produk tanpa costPrice berhasil 200 OK');
  assert(!isNaN(Number(uncostedRes.data?.data?.summary?.totalCOGS)), 'Total COGS bukan NaN');
  assert((uncostedRes.data?.data?.summary?.uncostedMovementCount ?? 0) >= 1, `uncostedMovementCount mendeteksi minimal 1 item tanpa HPP (aktual: ${uncostedRes.data?.data?.summary?.uncostedMovementCount})`);

  // 6. Uji Multi-Cabang & RBAC
  console.log('\n--- Uji 6: Multi-Cabang, Konsolidasi, & RBAC Guard ---');
  // a. OWNER query konsolidasi (tanpa branchId)
  const konsolidasiRes = await req(
    `/api/v1/reports/profit-loss?dateFrom=${targetDateStr}&dateTo=${targetDateStr}`,
    'GET',
    null,
    ownerCookie
  );
  assert(konsolidasiRes.status === 200, 'OWNER berhasil query konsolidasi semua cabang (200 OK)');
  const branchComps = konsolidasiRes.data?.data?.branchComparisons;
  assert(Array.isArray(branchComps) && branchComps.length >= 2, `Komparasi antar cabang tersedia (panjang: ${branchComps?.length})`);
  const jktComp = branchComps.find((b) => b.branchId === branchJkt.id);
  assert(Number(jktComp?.revenue) === 1000000, `Komparasi Cabang JKT menunjukkan pendapatan Rp 1.000.000`);

  // b. MANAGER query cabang sendiri
  const mgrOwnRes = await req(
    `/api/v1/reports/profit-loss?dateFrom=${targetDateStr}&dateTo=${targetDateStr}&branchId=${branchJkt.id}`,
    'GET',
    null,
    managerCookie
  );
  assert(mgrOwnRes.status === 200, 'MANAGER berhasil query cabang aktifnya sendiri (200 OK)');

  // c. MANAGER query cabang lain (Anti-IDOR)
  const mgrOtherRes = await req(
    `/api/v1/reports/profit-loss?dateFrom=${targetDateStr}&dateTo=${targetDateStr}&branchId=${branchBdg.id}`,
    'GET',
    null,
    managerCookie
  );
  assert(mgrOtherRes.status === 403, 'MANAGER query cabang lain ditolak 403 Forbidden (Anti-IDOR)');

  // d. CASHIER query (Ditolak 403)
  const cashierRes = await req(
    `/api/v1/reports/profit-loss?dateFrom=${targetDateStr}&dateTo=${targetDateStr}`,
    'GET',
    null,
    cashierCookie
  );
  assert(cashierRes.status === 403, 'CASHIER ditolak mengakses laporan laba rugi (403 Forbidden)');

  // 7. Uji Backward Compatibility Endpoint Lama /reports/gross-profit
  console.log('\n--- Uji 7: Backward Compatibility Endpoint Lama /reports/gross-profit ---');
  const oldRes = await req(
    `/api/v1/reports/gross-profit?dateFrom=${targetDateStr}&dateTo=${targetDateStr}`,
    'GET',
    null,
    ownerCookie
  );
  assert(oldRes.status === 200, 'Endpoint lama /reports/gross-profit tetap 200 OK untuk OWNER');
  assert('totalRevenue' in (oldRes.data?.data || {}), 'Response /reports/gross-profit memiliki totalRevenue');
  assert('totalCOGS' in (oldRes.data?.data || {}), 'Response /reports/gross-profit memiliki totalCOGS');
  assert('totalExpense' in (oldRes.data?.data || {}), 'Response /reports/gross-profit memiliki totalExpense');
  assert('grossProfit' in (oldRes.data?.data || {}), 'Response /reports/gross-profit memiliki grossProfit');

  const oldMgrRes = await req('/api/v1/reports/gross-profit', 'GET', null, managerCookie);
  assert(oldMgrRes.status === 403, 'Endpoint lama /reports/gross-profit tetap menolak MANAGER (403)');

  const oldCashierRes = await req('/api/v1/reports/gross-profit', 'GET', null, cashierCookie);
  assert(oldCashierRes.status === 403, 'Endpoint lama /reports/gross-profit tetap menolak CASHIER (403)');

  // Pembersihan Data Uji
  console.log('\n--- Membersihkan Data Pengujian ---');
  await prisma.transactionPayment.deleteMany({ where: { transactionId: { in: [boundaryTxIn.id, boundaryTxOut.id] } } });
  await prisma.transaction.deleteMany({ where: { id: { in: [boundaryTxIn.id, boundaryTxOut.id, draftTx.id, cancelledTx.id] } } });
  await prisma.stockMovement.deleteMany({ where: { materialId: { in: [testProduct.id, uncostedProduct.id] } } });
  await prisma.materialBranchStock.deleteMany({ where: { materialId: { in: [testProduct.id, uncostedProduct.id] } } });
  await prisma.material.deleteMany({ where: { id: { in: [testProduct.id, uncostedProduct.id] } } });
  await prisma.expense.deleteMany({ where: { id: { in: [boundaryExpenseIn.id, boundaryExpenseOut.id] } } });
  await prisma.auditLog.deleteMany({ where: { entity: 'StockMovement' } });
  await prisma.refreshToken.deleteMany({ where: { userId: managerUser.id } });
  await prisma.user.deleteMany({ where: { id: managerUser.id } });
  await prisma.employeeBranch.deleteMany({ where: { employeeId: mgrEmp.id } });
  await prisma.employee.deleteMany({ where: { id: mgrEmp.id } });

  console.log('\n============================================================');
  console.log(`📊 HASIL TEST SUITE TASK B2: ${passed} PASS, ${failed} FAIL`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Terjadi error saat menjalankan test suite:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * FASE 2 — TUGAS 3: INVENTORY BAHAN MEDIS & KARTU STOK
 * 
 * Model Bisnis Baru:
 * - Inventaris murni Bahan Medis (MATERIAL)
 * - Stock-In, Stock Opname, Stock-Out Manual
 * - Riwayat Kartu Stok (STOCK_IN, OPNAME, MANUAL_ADJUSTMENT)
 * - Penjagaan Stok Tidak Boleh Negatif (Rollback atomik)
 * - Integrasi POS Layanan Murni (tidak memutasi stok bahan)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

async function req(path, method, body, cookieString) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieString) headers['Cookie'] = cookieString;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, setCookie, rawText: text };
  } catch (err) {
    return { error: err.message, status: 0, data: null, rawText: '' };
  }
}

function extractAccessCookie(cookieHeader) {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(', ');
  const token = parts.find((p) => p.startsWith('access_token='));
  return token ? token.split(';')[0] : '';
}

async function login(email, password = '1234') {
  const r = await req('/auth/login', 'POST', { email, password });
  return {
    cookie: extractAccessCookie(r.setCookie),
    status: r.status,
    data: r.data,
    setCookie: r.setCookie,
  };
}

function show(label, r) {
  const preview =
    typeof r.data === 'object'
      ? JSON.stringify(r.data).slice(0, 200)
      : r.rawText?.slice(0, 200);
  console.log(`${label} → status ${r.status} | ${preview}`);
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ' | ' + detail : ''}`);
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('=== STARTING PHASE 2 TASK 3 INVENTORY TESTS (BAHAN MEDIS) ===');
  console.log('══════════════════════════════════════════════════════════\n');

  // ─── INV-1: Setup Data & Akun ───
  console.log('─── INV-1. Setup Data & Akun ───');
  const ownerLogin = await login('owner@oase.id');
  const ownerCookie = ownerLogin.cookie;
  assert('Login OWNER berhasil', ownerLogin.status === 200 && !!ownerCookie);

  const branchesRes = await req('/branches?limit=100', 'GET', null, ownerCookie);
  const branches = branchesRes.data?.data ?? [];
  const jkt = branches.find((b) => b.code === 'JKT');
  const bdg = branches.find((b) => b.code === 'BDG');
  assert('Cabang JKT dan BDG tersedia', !!jkt && !!bdg);

  const rnd = String(Math.floor(Math.random() * 100000));

  // 1. Buat Material Master baru
  const matRes = await req(
    '/materials',
    'POST',
    {
      name: 'Material Inventory ' + rnd,
      sku: 'MTL-INV-' + rnd,
      unit: 'ampul',
      minStock: 10,
    },
    ownerCookie
  );
  assert('Create material master berhasil', matRes.status === 201);
  const testMaterial = matRes.data?.data;

  // 2. Buat Manager & Cashier untuk pengujian
  const mgrEmpRes = await req(
    '/employees',
    'POST',
    {
      name: 'Manager Inv ' + rnd,
      position: 'Manager Cabang',
      phone: '0813' + rnd,
      branchIds: [jkt.id, bdg.id],
    },
    ownerCookie
  );
  const mgrEmpId = mgrEmpRes.data?.data?.id;
  const mgrEmail = `manager.inv.${rnd}@oase.id`;
  await req(
    '/users',
    'POST',
    {
      email: mgrEmail,
      password: 'Password123',
      role: 'MANAGER',
      employeeId: mgrEmpId,
    },
    ownerCookie
  );

  const mgrLogin = await login(mgrEmail, 'Password123');
  const mgrSwitchRes = await req('/auth/switch-branch', 'POST', { branchId: jkt.id }, mgrLogin.cookie);
  const mgrCookie = extractAccessCookie(mgrSwitchRes.setCookie);
  assert('Manager login & switch-branch ke JKT berhasil', mgrSwitchRes.status === 200);

  const cashierEmpRes = await req(
    '/employees',
    'POST',
    {
      name: 'Kasir Inv ' + rnd,
      position: 'Kasir',
      phone: '0812' + rnd,
      branchIds: [jkt.id],
    },
    ownerCookie
  );
  const cashierEmpId = cashierEmpRes.data?.data?.id;
  const cashierEmail = `kasir.inv.${rnd}@oase.id`;
  await req(
    '/users',
    'POST',
    {
      email: cashierEmail,
      password: 'Password123',
      role: 'CASHIER',
      employeeId: cashierEmpId,
    },
    ownerCookie
  );

  const cashierLogin = await login(cashierEmail, 'Password123');
  const cashierSwitchRes = await req('/auth/switch-branch', 'POST', { branchId: jkt.id }, cashierLogin.cookie);
  const cashierCookie = extractAccessCookie(cashierSwitchRes.setCookie);
  assert('Cashier login & switch-branch ke JKT berhasil', cashierSwitchRes.status === 200);

  // Pastikan stok awal bahan di JKT kosong / 0
  const initStock = await prisma.stockLevel.findUnique({
    where: {
      branchId_itemType_itemId: {
        branchId: jkt.id,
        itemType: 'MATERIAL',
        itemId: testMaterial.id,
      },
    },
  });
  assert('INV-1: Stok awal bahan di JKT adalah 0 / belum ada', !initStock || initStock.quantity === 0);

  // ─── INV-2: Stock-in (+50) ───
  console.log('\n─── INV-2. Stock-in (+50 ampul) [MANAGER] ───');
  const inv2_stockIn = await req(
    '/inventory/stock-in',
    'POST',
    {
      itemType: 'MATERIAL',
      items: [{ itemId: testMaterial.id, quantity: 50, unitCost: 35000 }],
      note: 'Pembelian stok awal bahan dari distributor',
    },
    mgrCookie
  );
  show('INV-2 Stock-in', inv2_stockIn);
  assert('INV-2: status 201 CREATED', inv2_stockIn.status === 201);

  // Verifikasi DB: StockLevel & InventoryMovement
  const dbStockInv2 = await prisma.stockLevel.findUnique({
    where: {
      branchId_itemType_itemId: {
        branchId: jkt.id,
        itemType: 'MATERIAL',
        itemId: testMaterial.id,
      },
    },
  });
  assert('INV-2: DB StockLevel saldo bertambah menjadi 50', dbStockInv2?.quantity === 50, `qty=${dbStockInv2?.quantity}`);

  const dbMovementInv2 = await prisma.inventoryMovement.findFirst({
    where: {
      branchId: jkt.id,
      itemId: testMaterial.id,
      referenceType: 'STOCK_IN',
    },
  });
  assert('INV-2: DB InventoryMovement quantityDelta == +50', dbMovementInv2?.quantityDelta === 50);
  assert('INV-2: DB InventoryMovement notes memuat biaya unit', dbMovementInv2?.notes?.includes('35000'));

  // ─── INV-3: Stock Opname (Hitung Fisik 45 → DB Stok 45, Delta -5) ───
  console.log('\n─── INV-3. Stock Opname (Snapshot 50, Fisik 45, Delta -5) ───');
  const rndYear = 2030 + Math.floor(Math.random() * 60);
  const rndDay = Math.floor(Math.random() * 25) + 1;
  const opnameDateStr = `${rndYear}-03-${String(rndDay).padStart(2, '0')}`;

  // 1. Create DRAFT Stock Opname
  const inv3_create = await req(
    '/stock-opnames',
    'POST',
    {
      opnameDate: opnameDateStr,
      itemType: 'MATERIAL',
      note: 'Opname bulanan rutin bahan cabang JKT',
    },
    mgrCookie
  );
  show('INV-3 Create DRAFT Opname', inv3_create);
  assert('INV-3: status 201 DRAFT', inv3_create.status === 201);
  const opnameId = inv3_create.data?.data?.id;

  const itemSnapshot = inv3_create.data?.data?.items?.find((i) => i.itemId === testMaterial.id);
  assert('INV-3: systemQty ter-snapshot 50', itemSnapshot?.systemQty === 50, `sysQty=${itemSnapshot?.systemQty}`);

  // 2. Input Hasil Hitung Fisik (PATCH)
  const inv3_patch = await req(
    `/stock-opnames/${opnameId}`,
    'PATCH',
    {
      items: [
        {
          itemId: testMaterial.id,
          physicalQty: 45,
          note: '5 ampul pecah saat pengiriman',
        },
      ],
    },
    mgrCookie
  );
  show('INV-3 PATCH Opname', inv3_patch);
  assert('INV-3: status 200 OK PATCH', inv3_patch.status === 200);

  // 3. Submit Opname (POST /submit)
  const inv3_submit = await req(
    `/stock-opnames/${opnameId}/submit`,
    'POST',
    null,
    mgrCookie
  );
  show('INV-3 Submit Opname', inv3_submit);
  assert('INV-3: status 200 OK Submit', inv3_submit.status === 200);
  assert('INV-3: status berubah jadi SUBMITTED', inv3_submit.data?.data?.status === 'SUBMITTED');

  // Verifikasi DB: Stok berubah jadi 45 dan movement OPNAME tercatat delta -5
  const dbStockInv3 = await prisma.stockLevel.findUnique({
    where: {
      branchId_itemType_itemId: {
        branchId: jkt.id,
        itemType: 'MATERIAL',
        itemId: testMaterial.id,
      },
    },
  });
  assert('INV-3: DB StockLevel berubah persis menjadi 45', dbStockInv3?.quantity === 45, `qty=${dbStockInv3?.quantity}`);

  const opnameMovement = await prisma.inventoryMovement.findFirst({
    where: {
      referenceId: opnameId,
      itemId: testMaterial.id,
    },
  });
  assert('INV-3: DB InventoryMovement OPNAME quantityDelta == -5', opnameMovement?.quantityDelta === -5);

  // ─── INV-4: Riwayat Kartu Stok (3 Sumber: STOCK_IN, OPNAME, MANUAL_ADJUSTMENT) ───
  console.log('\n─── INV-4. Riwayat Movement Kartu Stok (3 Sumber Terpadu) ───');
  // Lakukan 1 Stock Out Manual (2 ampul dipakai)
  const stockOutRes = await req(
    '/inventory/stock-out',
    'POST',
    {
      items: [{ itemId: testMaterial.id, quantity: 2, reasonType: 'MANUAL_ADJUSTMENT' }],
      note: 'Pemakaian di poli gigi',
    },
    mgrCookie
  );
  assert('Stock Out manual 2 ampul sukses (201 Created)', stockOutRes.status === 201);

  // Ambil kartu stok via GET /inventory/stock/MATERIAL/:id/movements
  const cardRes = await req(
    `/inventory/stock/MATERIAL/${testMaterial.id}/movements`,
    'GET',
    null,
    mgrCookie
  );
  show('INV-4 Kartu Stok', cardRes);
  assert('INV-4: GET Kartu stok status 200', cardRes.status === 200);

  const movements = cardRes.data?.data?.movements ?? [];
  const hasStockIn = movements.some((m) => m.referenceType === 'STOCK_IN' && m.quantityDelta === 50);
  const hasOpname = movements.some((m) => m.referenceType === 'OPNAME' && m.quantityDelta === -5);
  const hasStockOut = movements.some((m) => m.referenceType === 'MANUAL_ADJUSTMENT' && m.quantityDelta === -2);

  assert('INV-4: Movement STOCK_IN (+50) ada di kartu stok', hasStockIn);
  assert('INV-4: Movement OPNAME (-5) ada di kartu stok', hasOpname);
  assert('INV-4: Movement MANUAL_ADJUSTMENT (-2) ada di kartu stok', hasStockOut);

  // ─── INV-5: Konsistensi Akumulasi Movement ───
  console.log('\n─── INV-5. Konsistensi Akumulasi Movement vs Saldo StockLevel ───');
  const allDbMovements = await prisma.inventoryMovement.findMany({
    where: {
      branchId: jkt.id,
      itemId: testMaterial.id,
    },
  });
  const sumDelta = allDbMovements.reduce((sum, m) => sum + m.quantityDelta, 0);

  const finalDbStock = await prisma.stockLevel.findUnique({
    where: {
      branchId_itemType_itemId: {
        branchId: jkt.id,
        itemType: 'MATERIAL',
        itemId: testMaterial.id,
      },
    },
  });
  assert('INV-5: Akumulasi movement (50 - 5 - 2 = 43)', sumDelta === 43, `sumDelta=${sumDelta}`);
  assert('INV-5: StockLevel saldo persis sama dengan akumulasi movement (43)', finalDbStock?.quantity === sumDelta);

  // ─── INV-6: Guard Role & Scope ───
  console.log('\n─── INV-6. Guard Role & Scope ───');
  const cashierStockIn = await req(
    '/inventory/stock-in',
    'POST',
    {
      itemType: 'MATERIAL',
      items: [{ itemId: testMaterial.id, quantity: 5 }],
    },
    cashierCookie
  );
  assert('INV-6: CASHIER ditolak stock-in (403 FORBIDDEN)', cashierStockIn.status === 403);

  const cashierStockList = await req('/inventory/stock', 'GET', null, cashierCookie);
  assert('INV-6: CASHIER ditolak GET /inventory/stock (403 FORBIDDEN)', cashierStockList.status === 403);

  const cashierOpname = await req(
    '/stock-opnames',
    'POST',
    { opnameDate: '2026-12-31', itemType: 'MATERIAL' },
    cashierCookie
  );
  assert('INV-6: CASHIER ditolak POST /stock-opnames (403 FORBIDDEN)', cashierOpname.status === 403);

  const noCookie = await req('/inventory/stock', 'GET');
  assert('INV-6: Tanpa cookie → 401 UNAUTHORIZED', noCookie.status === 401);

  // OWNER filter branch BDG
  const ownerBdgStock = await req(`/inventory/stock?branchId=${bdg.id}`, 'GET', null, ownerCookie);
  assert('INV-6: OWNER filter ?branchId=BDG status 200', ownerBdgStock.status === 200);

  // ─── INV-7: Penyesuaian Menghasilkan Stok Negatif Ditolak ───
  console.log('\n─── INV-7. Adjustment Stok Negatif Ditolak 409 INSUFFICIENT_STOCK ───');
  const opnameDate2Str = `${rndYear}-04-${String(rndDay).padStart(2, '0')}`;

  const opname2 = await req(
    '/stock-opnames',
    'POST',
    {
      opnameDate: opnameDate2Str,
      itemType: 'MATERIAL',
    },
    mgrCookie
  );
  const opname2Id = opname2.data?.data?.id;

  // Set physicalQty menjadi 0 (delta = 0 - 43 = -43)
  await req(
    `/stock-opnames/${opname2Id}`,
    'PATCH',
    {
      items: [{ itemId: testMaterial.id, physicalQty: 0 }],
    },
    mgrCookie
  );

  // Kurangi stok di DB menjadi 10 via Stock Out (keluarkan 33 ampul)
  await req(
    '/inventory/stock-out',
    'POST',
    {
      items: [{ itemId: testMaterial.id, quantity: 33, reasonType: 'MANUAL_ADJUSTMENT' }],
    },
    mgrCookie
  );
  // Stok saat ini adalah 10. Jika delta -43 dieksekusi -> 10 - 43 = -33 (negatif!)

  const submitNeg = await req(
    `/stock-opnames/${opname2Id}/submit`,
    'POST',
    null,
    mgrCookie
  );
  show('INV-7 Submit Opname Negatif', submitNeg);
  assert('INV-7: Submit ditolak 409 Conflict', submitNeg.status === 409);
  assert('INV-7: Error code INSUFFICIENT_STOCK', submitNeg.data?.code === 'INSUFFICIENT_STOCK');

  // Verifikasi stok tetap 10 dan status opname tetap DRAFT
  const dbStockAfterNeg = await prisma.stockLevel.findUnique({
    where: {
      branchId_itemType_itemId: {
        branchId: jkt.id,
        itemType: 'MATERIAL',
        itemId: testMaterial.id,
      },
    },
  });
  assert('INV-7: Saldo stok tetap 10 (tidak berubah jadi negatif)', dbStockAfterNeg?.quantity === 10);

  // ─── INV-8: Validasi Input Invalid ───
  console.log('\n─── INV-8. Validasi Input Invalid (qty 0 / itemId acak / duplicate date) ───');
  const inv8_qty0 = await req(
    '/inventory/stock-in',
    'POST',
    {
      itemType: 'MATERIAL',
      items: [{ itemId: testMaterial.id, quantity: 0 }],
    },
    mgrCookie
  );
  assert('INV-8: Stock-in qty 0 ditolak (400)', inv8_qty0.status === 400);

  const inv8_randItem = await req(
    '/inventory/stock-in',
    'POST',
    {
      itemType: 'MATERIAL',
      items: [{ itemId: '00000000-0000-0000-0000-000000000000', quantity: 10 }],
    },
    mgrCookie
  );
  assert('INV-8: Stock-in itemId acak ditolak (404)', inv8_randItem.status === 404);

  const inv8_dupDate = await req(
    '/stock-opnames',
    'POST',
    { opnameDate: opnameDateStr, itemType: 'MATERIAL' },
    mgrCookie
  );
  assert('INV-8: Create opname tanggal sama ditolak (409 DUPLICATE)', inv8_dupDate.status === 409);

  // ─── INV-9: IDOR & Branch Scope ───
  console.log('\n─── INV-9. IDOR & Branch Scope ───');
  const bdgDateStr = `${rndYear}-05-${String(rndDay).padStart(2, '0')}`;
  const bdgOpname = await prisma.stockOpname.upsert({
    where: {
      branchId_opnameDate: {
        branchId: bdg.id,
        opnameDate: new Date(`${bdgDateStr}T00:00:00.000Z`),
      },
    },
    create: {
      branchId: bdg.id,
      opnameDate: new Date(`${bdgDateStr}T00:00:00.000Z`),
      status: 'DRAFT',
    },
    update: {},
  });
  // MANAGER (aktif di JKT) coba akses opname BDG -> 403
  const mgrAccessBdg = await req(`/stock-opnames/${bdgOpname.id}`, 'GET', null, mgrCookie);
  show('INV-9 IDOR Access', mgrAccessBdg);
  assert('INV-9: MANAGER ditolak akses opname cabang lain (403 FORBIDDEN)', mgrAccessBdg.status === 403);

  // ─── INV-10: Regresi Kanari POS & Integrasi Utuh ───
  console.log('\n─── INV-10. Regresi Kanari POS & Integrasi Utuh ───');
  // 1. Buat 1 layanan medis
  const svcRes = await req(
    '/services',
    'POST',
    {
      name: 'Layanan Kanari ' + rnd,
      price: 150000,
    },
    ownerCookie
  );
  const canarySvc = svcRes.data?.data;

  // 2. Transaksi POS kasir untuk layanan medis
  const t10_draft = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: canarySvc.id, quantity: 2 }],
    },
    cashierCookie
  );
  assert('INV-10: Create POS DRAFT berhasil', t10_draft.status === 201);

  const t10_pay = await req(
    `/transactions/${t10_draft.data?.data?.id}/pay`,
    'POST',
    { payments: [{ method: 'CASH', amount: 300000 }] },
    cashierCookie
  );
  assert('INV-10: Pay POS Transaksi berhasil (201)', t10_pay.status === 201);

  // 3. Stok bahan tidak terpengaruh oleh transaksi POS
  const stockAfterPos = await prisma.stockLevel.findUnique({
    where: {
      branchId_itemType_itemId: {
        branchId: jkt.id,
        itemType: 'MATERIAL',
        itemId: testMaterial.id,
      },
    },
  });
  assert('INV-10: Saldo stok bahan TIDAK berubah setelah transaksi POS kasir (tetap 10)', stockAfterPos?.quantity === 10, `stock=${stockAfterPos?.quantity}`);

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('=== PHASE 2 TASK 3 INVENTORY TESTS SELESAI ===');
  if (process.exitCode === 1) {
    console.error('⚠️  Ada pengujian yang GAGAL');
  } else {
    console.log('✅ Semua INV-1 s/d INV-10 HIJAU');
  }
  console.log('══════════════════════════════════════════════════════════');
}

run()
  .catch((err) => {
    console.error('Error saat menjalankan test Inventory:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

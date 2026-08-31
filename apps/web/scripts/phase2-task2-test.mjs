/**
 * FASE 2 — TUGAS 2: POS (Transactions, TransactionItems, Payment, Stock Deduction, Cancellation)
 * Bukti kriteria POS-1 s/d POS-12.
 *
 * Jalankan saat dev server aktif: node apps/web/scripts/phase2-task2-test.mjs
 * Override base URL: API_BASE=http://localhost:3000/api/v1
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
  console.log('=== STARTING PHASE 2 TASK 2 POS TESTS ===');
  console.log('══════════════════════════════════════════════════════════\n');

  // ─── POS-1: Setup ───
  console.log('─── POS-1. Setup Data & Akun ───');
  const ownerLogin = await login('owner@oase.id');
  const ownerCookie = ownerLogin.cookie;
  assert('Login OWNER berhasil', ownerLogin.status === 200 && !!ownerCookie);

  const branchesRes = await req('/branches', 'GET', null, ownerCookie);
  const branches = branchesRes.data?.data ?? [];
  const jkt = branches.find((b) => b.code === 'JKT');
  const bdg = branches.find((b) => b.code === 'BDG');
  assert('Cabang JKT dan BDG tersedia', !!jkt && !!bdg);

  const rnd = String(Math.floor(Math.random() * 100000));

  // 1. Buat Product & Service Master
  const prodRes = await req(
    '/products',
    'POST',
    {
      name: 'Produk POS ' + rnd,
      sku: 'PRD-POS-' + rnd,
      sellPrice: 50000,
      unit: 'pcs',
      minStock: 5,
    },
    ownerCookie
  );
  assert('Create product master berhasil', prodRes.status === 201);
  const testProduct = prodRes.data?.data;

  const svcRes = await req(
    '/services',
    'POST',
    {
      name: 'Layanan Tambal Gigi ' + rnd,
      price: 100000,
      durationMinutes: 30,
    },
    ownerCookie
  );
  assert('Create service master berhasil', svcRes.status === 201);
  const testService = svcRes.data?.data;

  // 2. Setup StockLevel awal untuk produk di cabang JKT via Prisma langsung (POS-1)
  await prisma.stockLevel.upsert({
    where: {
      branchId_itemType_itemId: {
        branchId: jkt.id,
        itemType: 'PRODUCT',
        itemId: testProduct.id,
      },
    },
    create: {
      branchId: jkt.id,
      itemType: 'PRODUCT',
      itemId: testProduct.id,
      quantity: 10,
    },
    update: {
      quantity: 10,
    },
  });
  console.log('  Setup StockLevel JKT untuk product diset ke 10');

  // 3. Buat Cashier baru untuk test POS
  const empRes = await req(
    '/employees',
    'POST',
    {
      name: 'Kasir POS ' + rnd,
      position: 'Kasir',
      phone: '0812' + rnd,
      branchIds: [jkt.id, bdg.id],
    },
    ownerCookie
  );
  const cashierEmpId = empRes.data?.data?.id;
  const cashierEmail = `kasir.pos.${rnd}@oase.id`;
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

  // 4. Buat Manager baru untuk test POS-9b
  const mgrEmpRes = await req(
    '/employees',
    'POST',
    {
      name: 'Manager POS ' + rnd,
      position: 'Manager Cabang',
      phone: '0813' + rnd,
      branchIds: [jkt.id],
    },
    ownerCookie
  );
  const mgrEmpId = mgrEmpRes.data?.data?.id;
  const mgrEmail = `manager.pos.${rnd}@oase.id`;
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

  const cashierLogin = await login(cashierEmail, 'Password123');
  let cashierCookie = cashierLogin.cookie;
  const switchRes = await req('/auth/switch-branch', 'POST', { branchId: jkt.id }, cashierCookie);
  cashierCookie = extractAccessCookie(switchRes.setCookie);
  assert('Cashier login & switch-branch ke JKT berhasil', switchRes.status === 200);

  // ─── POS-2: POST /transactions (Create DRAFT) & Pay ───
  console.log('\n─── POS-2. Create DRAFT & Pay (2x Product @50k + 1x Service @100k) ───');
  const t2_create = await req(
    '/transactions',
    'POST',
    {
      items: [
        { itemType: 'PRODUCT', itemId: testProduct.id, quantity: 2 },
        { itemType: 'SERVICE', itemId: testService.id, quantity: 1 },
      ],
      patientName: 'Pasien Test ' + rnd,
      patientPhone: '08123456789',
    },
    cashierCookie
  );
  show('POS-2 Create DRAFT', t2_create);
  assert('POS-2: status 201 DRAFT', t2_create.status === 201);
  assert('POS-2: subtotal 200000', t2_create.data?.data?.subtotal === '200000', `subtotal=${t2_create.data?.data?.subtotal}`);
  assert('POS-2: total 200000', t2_create.data?.data?.total === '200000', `total=${t2_create.data?.data?.total}`);
  assert('POS-2: status awal DRAFT', t2_create.data?.data?.status === 'DRAFT');
  const trx1Id = t2_create.data?.data?.id;

  // Lakukan Pembayaran
  const t2_pay = await req(
    `/transactions/${trx1Id}/pay`,
    'POST',
    {
      payments: [{ method: 'CASH', amount: 250000 }],
    },
    cashierCookie
  );
  show('POS-2 Bayar Transaksi', t2_pay);
  assert('POS-2: pay status 201', t2_pay.status === 201);
  assert('POS-2: status berubah jadi PAID', t2_pay.data?.data?.status === 'PAID');
  assert('POS-2: change kembalian 50000', t2_pay.data?.data?.change === '50000', `change=${t2_pay.data?.data?.change}`);
  assert(
    'POS-2: transactionNumber format TRX-YYYYMMDD-XXXXX',
    /^TRX-\d{8}-\d{5}$/.test(t2_pay.data?.data?.transactionNumber ?? ''),
    `trxNumber=${t2_pay.data?.data?.transactionNumber}`
  );

  // ─── POS-3: Konsistensi DB ───
  console.log('\n─── POS-3. Konsistensi DB (Kueri Prisma Langsung) ───');
  const dbTrx1 = await prisma.transaction.findUnique({
    where: { id: trx1Id },
    include: { items: true, payments: true },
  });
  assert('POS-3: DB total == 200000', dbTrx1?.total.toString() === '200000');
  assert('POS-3: DB items count == 2', dbTrx1?.items.length === 2);
  assert('POS-3: DB payments count == 1', dbTrx1?.payments.length === 1);

  // Cek StockLevel & InventoryMovement di DB
  const dbStock = await prisma.stockLevel.findUnique({
    where: {
      branchId_itemType_itemId: {
        branchId: jkt.id,
        itemType: 'PRODUCT',
        itemId: testProduct.id,
      },
    },
  });
  assert('POS-3: StockLevel berkurang dari 10 menjadi 8', dbStock?.quantity === 8, `stock=${dbStock?.quantity}`);

  const dbMovements = await prisma.inventoryMovement.findMany({
    where: { referenceId: trx1Id },
  });
  assert('POS-3: InventoryMovement tercatat 1 baris untuk product', dbMovements.length === 1);
  assert('POS-3: Movement quantityDelta == -2', dbMovements[0]?.quantityDelta === -2);
  assert('POS-3: Movement referenceType == TRANSACTION', dbMovements[0]?.referenceType === 'TRANSACTION');

  // ─── POS-4: Pembayaran Kurang → 400 VALIDATION_ERROR ───
  console.log('\n─── POS-4. Pembayaran Kurang (paid < total) → 400 ───');
  const t4_create = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemType: 'PRODUCT', itemId: testProduct.id, quantity: 1 }],
    },
    cashierCookie
  );
  const trx4Id = t4_create.data?.data?.id;
  const t4_pay = await req(
    `/transactions/${trx4Id}/pay`,
    'POST',
    {
      payments: [{ method: 'CASH', amount: 30000 }], // total 50000, bayar 30000
    },
    cashierCookie
  );
  show('POS-4 Bayar Kurang', t4_pay);
  assert('POS-4: ditolak 400 VALIDATION_ERROR', t4_pay.status === 400);

  // ─── POS-5: Input Invalid (qty 0 / itemId acak) → 400 ───
  console.log('\n─── POS-5. Validasi Input (qty 0 / itemId acak) → 400 ───');
  const t5_qty0 = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemType: 'PRODUCT', itemId: testProduct.id, quantity: 0 }],
    },
    cashierCookie
  );
  assert('POS-5: qty 0 ditolak (400)', t5_qty0.status === 400);

  const t5_randItem = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemType: 'PRODUCT', itemId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
    },
    cashierCookie
  );
  assert('POS-5: itemId acak ditolak (400)', t5_randItem.status === 400);

  // ─── POS-6: Anti-tamper Harga Client ───
  console.log('\n─── POS-6. Anti-tamper Harga Client ───');
  const t6_tamper = await req(
    '/transactions',
    'POST',
    {
      items: [
        {
          itemType: 'PRODUCT',
          itemId: testProduct.id,
          quantity: 2,
          price: 1, // coba palsukan harga jadi Rp 1
        },
      ],
    },
    cashierCookie
  );
  show('POS-6 Anti-tamper', t6_tamper);
  assert('POS-6: subtotal tetap dihitung dari harga master DB (100000)', t6_tamper.data?.data?.subtotal === '100000', `subtotal=${t6_tamper.data?.data?.subtotal}`);

  // ─── POS-7: Stok Kurang → 409 INSUFFICIENT_STOCK & Atomik Rollback ───
  console.log('\n─── POS-7. Stok Kurang → 409 INSUFFICIENT_STOCK & Rollback Atomik ───');
  const t7_create = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemType: 'PRODUCT', itemId: testProduct.id, quantity: 50 }], // stok sisa 8
    },
    cashierCookie
  );
  const trx7Id = t7_create.data?.data?.id;

  const t7_pay = await req(
    `/transactions/${trx7Id}/pay`,
    'POST',
    {
      payments: [{ method: 'CASH', amount: 3000000 }],
    },
    cashierCookie
  );
  show('POS-7 Stok Kurang', t7_pay);
  assert('POS-7: status 409 Conflict', t7_pay.status === 409);
  assert('POS-7: error code INSUFFICIENT_STOCK', t7_pay.data?.code === 'INSUFFICIENT_STOCK');

  // Verifikasi Atomik Rollback di Database: Transaksi tidak menjadi PAID dan stok tidak berubah
  const dbTrx7 = await prisma.transaction.findUnique({ where: { id: trx7Id } });
  assert('POS-7: DB status transaksi tetap DRAFT', dbTrx7?.status === 'DRAFT');
  const dbPayments7 = await prisma.transactionPayment.findMany({ where: { transactionId: trx7Id } });
  assert('POS-7: DB tidak ada payment tersimpan', dbPayments7.length === 0);
  const dbMovements7 = await prisma.inventoryMovement.findMany({ where: { referenceId: trx7Id } });
  assert('POS-7: DB 0 InventoryMovement tercipta saat rollback', dbMovements7.length === 0);
  const dbStock7 = await prisma.stockLevel.findUnique({
    where: {
      branchId_itemType_itemId: {
        branchId: jkt.id,
        itemType: 'PRODUCT',
        itemId: testProduct.id,
      },
    },
  });
  assert('POS-7: DB saldo stok tetap 8 (tidak berkurang)', dbStock7?.quantity === 8);

  // ─── POS-8: Tanpa switch-branch → 400 ───
  console.log('\n─── POS-8. Tanpa switch-branch → 400 ───');
  const cashier2Login = await login(cashierEmail, 'Password123');
  const cashier2NoSwitch = cashier2Login.cookie;
  const t8 = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemType: 'PRODUCT', itemId: testProduct.id, quantity: 1 }],
    },
    cashier2NoSwitch
  );
  show('POS-8 Tanpa switch-branch', t8);
  assert('POS-8: ditolak 400', t8.status === 400);

  // ─── POS-9: Guard & Scope ───
  console.log('\n─── POS-9. Guard & Scope Role ───');
  const t9_cashierList = await req('/transactions', 'GET', null, cashierCookie);
  show('POS-9 CASHIER GET /transactions', t9_cashierList);
  assert('POS-9: CASHIER GET /transactions status 200', t9_cashierList.status === 200);
  const allJkt = t9_cashierList.data?.data?.every((t) => t.branchId === jkt.id);
  assert('POS-9: Semua transaksi yang dilihat CASHIER adalah cabang aktif JKT', allJkt);

  const t9_noCookie = await req('/transactions', 'GET');
  assert('POS-9: tanpa cookie → 401', t9_noCookie.status === 401);

  // ─── POS-9b: MANAGER GET /transactions → 403 (kontrak POS hanya OWNER+CASHIER) ───
  console.log('\n─── POS-9b. MANAGER GET /transactions → 403 ───');
  const mgrLogin = await login(mgrEmail, 'Password123');
  const t9b_mgr = await req('/transactions', 'GET', null, mgrLogin.cookie);
  show('POS-9b MANAGER GET /transactions', t9b_mgr);
  assert('POS-9b: MANAGER ditolak GET /transactions (403 FORBIDDEN)', t9b_mgr.status === 403);

  // ─── POS-10: VOID / Cancel Transaksi PAID [OWNER] ───
  console.log('\n─── POS-10. Cancel Transaksi PAID (OWNER) & Stok Kembali ───');
  // CASHIER coba cancel -> 403
  const t10_cashierCancel = await req(
    `/transactions/${trx1Id}/cancel`,
    'POST',
    { reason: 'Kasir mencoba membatalkan transaksi' },
    cashierCookie
  );
  show('POS-10 CASHIER coba cancel', t10_cashierCancel);
  assert('POS-10: CASHIER ditolak cancel (403 FORBIDDEN)', t10_cashierCancel.status === 403);

  // OWNER cancel -> 200
  const t10_ownerCancel = await req(
    `/transactions/${trx1Id}/cancel`,
    'POST',
    { reason: 'Pasien meminta pembatalan transaksi dan refund' },
    ownerCookie
  );
  show('POS-10 OWNER cancel', t10_ownerCancel);
  assert('POS-10: OWNER cancel sukses (200 OK)', t10_ownerCancel.status === 200);
  assert('POS-10: status berubah jadi CANCELLED', t10_ownerCancel.data?.data?.status === 'CANCELLED');

  // Verifikasi DB: Stok bertambah kembali 2 (dari 8 menjadi 10)
  const dbStockAfterCancel = await prisma.stockLevel.findUnique({
    where: {
      branchId_itemType_itemId: {
        branchId: jkt.id,
        itemType: 'PRODUCT',
        itemId: testProduct.id,
      },
    },
  });
  assert('POS-10: Stok kembali pulih ke 10 di StockLevel', dbStockAfterCancel?.quantity === 10, `stock=${dbStockAfterCancel?.quantity}`);

  const cancelMovement = await prisma.inventoryMovement.findFirst({
    where: { referenceId: trx1Id, quantityDelta: 2 },
  });
  assert('POS-10: InventoryMovement pemulihan stok (+2) tercatat di DB', !!cancelMovement);

  // ─── POS-11: GET Detail Transaksi ───
  console.log('\n─── POS-11. GET Detail Transaksi & Format Serialisasi Uang ───');
  const t11_detail = await req(`/transactions/${trx1Id}`, 'GET', null, cashierCookie);
  show('POS-11 Detail', t11_detail);
  assert('POS-11: status 200 OK', t11_detail.status === 200);
  assert('POS-11: subtotal berupa string desimal', typeof t11_detail.data?.data?.subtotal === 'string');
  assert('POS-11: items berupa array lengkap', Array.isArray(t11_detail.data?.data?.items) && t11_detail.data?.data?.items.length === 2);
  assert('POS-11: item price & lineTotal berupa string desimal', typeof t11_detail.data?.data?.items[0]?.price === 'string');

  // ─── POS-12: Regresi Mini Uang & Decimal Precision ───
  console.log('\n─── POS-12. Presisi Aritmatika Uang Decimal ───');
  // Buat 1 product dengan harga berdesimal 12345.5
  const prodDecRes = await req(
    '/products',
    'POST',
    {
      name: 'Produk Decimal ' + rnd,
      sku: 'PRD-DEC-' + rnd,
      sellPrice: 12345.5,
      unit: 'pcs',
      minStock: 0,
    },
    ownerCookie
  );
  assert('POS-12: create product decimal berhasil', prodDecRes.status === 201);
  const decProd = prodDecRes.data?.data;
  await prisma.stockLevel.upsert({
    where: {
      branchId_itemType_itemId: {
        branchId: jkt.id,
        itemType: 'PRODUCT',
        itemId: decProd.id,
      },
    },
    create: {
      branchId: jkt.id,
      itemType: 'PRODUCT',
      itemId: decProd.id,
      quantity: 100,
    },
    update: {
      quantity: 100,
    },
  });

  const t12_create = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemType: 'PRODUCT', itemId: decProd.id, quantity: 3 }],
      discountAmount: '1000.5',
      discountReason: 'Diskon promo member',
    },
    cashierCookie
  );
  // 3 * 12345.5 = 37036.5 - 1000.5 = 36036
  show('POS-12 Decimal Test', t12_create);
  assert('POS-12: subtotal persis 37036.5', t12_create.data?.data?.subtotal === '37036.5', `subtotal=${t12_create.data?.data?.subtotal}`);
  assert('POS-12: total persis 36036 tanpa float artifact', t12_create.data?.data?.total === '36036', `total=${t12_create.data?.data?.total}`);

  // ─── POS-13: Bukti Snapshot Master Price ───
  console.log('\n─── POS-13. Bukti Snapshot Master Price ───');
  // Buat transaksi baru untuk testProduct (harga master saat ini 50000) dan selesaikan pembayaran
  const t13_draft = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemType: 'PRODUCT', itemId: testProduct.id, quantity: 1 }],
    },
    cashierCookie
  );
  const trx13Id = t13_draft.data?.data?.id;
  await req(
    `/transactions/${trx13Id}/pay`,
    'POST',
    {
      payments: [{ method: 'CASH', amount: 50000 }],
    },
    cashierCookie
  );

  // Naikkan harga testProduct di master menjadi 95000
  const t13_patchMaster = await req(
    `/products/${testProduct.id}`,
    'PATCH',
    { sellPrice: 95000 },
    ownerCookie
  );
  assert('POS-13: update harga master product berhasil (95000)', t13_patchMaster.status === 200);

  // Detail transaksi lama harus tetap 50000 (tidak terpengaruh perubahan harga master)
  const t13_detail = await req(`/transactions/${trx13Id}`, 'GET', null, cashierCookie);
  show('POS-13 Detail Transaksi setelah Master Berubah', t13_detail);
  assert('POS-13: price item transaksi lama tetap 50000', t13_detail.data?.data?.items[0]?.price === '50000', `price=${t13_detail.data?.data?.items[0]?.price}`);
  assert('POS-13: total transaksi lama tetap 50000 (snapshot terbukti)', t13_detail.data?.data?.total === '50000', `total=${t13_detail.data?.data?.total}`);

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('=== PHASE 2 TASK 2 POS TESTS SELESAI ===');
  if (process.exitCode === 1) {
    console.error('⚠️  Ada pengujian yang GAGAL');
  } else {
    console.log('✅ Semua POS-1 s/d POS-12 HIJAU');
  }
  console.log('══════════════════════════════════════════════════════════');
}

run()
  .catch((err) => {
    console.error('Error saat menjalankan test POS:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

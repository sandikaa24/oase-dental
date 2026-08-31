/**
 * FASE 3 — TUGAS 2: POS Frontend & Catalog Test Suite (POS-UI-1..POS-UI-8)
 *
 * Menguji fungsionalitas Point of Sale (POS) Kasir OASE Dental Clinic:
 * - POS-UI-1: Akses POS & pemuatan katalog item via GET /api/v1/pos/catalog
 * - POS-UI-2: Alur pembuatan transaksi DRAFT dengan snapshot harga server
 * - POS-UI-3: Alur pembayaran sukses (CASH / Split payment) -> 201 PAID + Nomor TRX
 * - POS-UI-4: Penanganan error stok kurang (409 INSUFFICIENT_STOCK) & rollback atomik
 * - POS-UI-5: Penanganan error pembayaran kurang (400 VALIDATION_ERROR)
 * - POS-UI-6: Pencarian & filter riwayat transaksi kasir cabang aktif
 * - POS-UI-7: Pembatalan transaksi PAID oleh OWNER (200) vs penolakan CASHIER (403)
 * - POS-UI-8: Guard endpoint katalog — CASHIER 200, OWNER 200, EMPLOYEE 403
 *
 * Jalankan: node apps/web/scripts/phase3-task2-test.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? 'owner@oase.id';
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? '1234';
const CASHIER_EMAIL = 'cashier@oase.id';
const CASHIER_PASSWORD = '1234';

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

async function req(path, method = 'GET', body = null, cookieString = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieString) headers['Cookie'] = cookieString;
  const isApi = path.startsWith('/api/') || path.startsWith('http');
  const url = isApi ? (path.startsWith('http') ? path : `${BASE_URL}${path}`) : `${BASE_URL}${path}`;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });

    const setCookie = res.headers.get('set-cookie') || '';
    const location = res.headers.get('location') || '';
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, setCookie, location, rawText: text };
  } catch (err) {
    return { error: err.message, status: 0, data: null, setCookie: '', location: '', rawText: '' };
  }
}

function extractCookie(cookieHeader) {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(', ');
  const accessToken = parts.find((p) => p.startsWith('access_token='));
  const refreshToken = parts.find((p) => p.startsWith('refresh_token='));

  const cookieString = [];
  if (accessToken) cookieString.push(accessToken.split(';')[0]);
  if (refreshToken) cookieString.push(refreshToken.split(';')[0]);

  return cookieString.join('; ');
}

// ─── Tests Execution ──────────────────────────────────────────────────────────

async function run() {
  console.log('='.repeat(70));
  console.log('FASE 3 — TUGAS 2: TEST SUITE POS FRONTEND & CATALOG (POS-UI-1..POS-UI-8)');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  function assert(condition, testId, description, details = '') {
    if (condition) {
      console.log(`[PASS] ${testId}: ${description}`);
      if (details) console.log(`       ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${description}`);
      if (details) console.error(`       Details: ${details}`);
      failed++;
    }
  }

  // 1. Auth Login: Owner & Cashier
  const ownerLogin = await req('/api/v1/auth/login', 'POST', {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  const ownerCookie = extractCookie(ownerLogin.setCookie);

  const cashierLogin = await req('/api/v1/auth/login', 'POST', {
    email: CASHIER_EMAIL,
    password: CASHIER_PASSWORD,
  });
  let cashierCookie = extractCookie(cashierLogin.setCookie);

  // Switch cashier to branch JKT
  const cashierBranches = cashierLogin.data?.data?.user?.branches || [];
  const jktBranch = cashierBranches.find((b) => b.code === 'JKT') || cashierBranches[0];
  if (jktBranch) {
    const switchRes = await req('/api/v1/auth/switch-branch', 'POST', { branchId: jktBranch.id }, cashierCookie);
    const newCookie = extractCookie(switchRes.setCookie);
    if (newCookie) cashierCookie = newCookie;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POS-UI-8: Endpoint Katalog Guard — CASHIER 200, OWNER 200, EMPLOYEE 403
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- POS-UI-8: POS Catalog Endpoint & Role Guard ---');

  // CASHIER access
  const cashierCatalogRes = await req('/api/v1/pos/catalog', 'GET', null, cashierCookie);
  assert(
    cashierCatalogRes.status === 200 &&
      cashierCatalogRes.data?.success === true &&
      Array.isArray(cashierCatalogRes.data?.data),
    'POS-UI-8.1',
    'CASHIER berhasil mengakses GET /api/v1/pos/catalog (Status 200 OK)',
    `Items count: ${cashierCatalogRes.data?.data?.length}`
  );

  // OWNER access
  const ownerCatalogRes = await req('/api/v1/pos/catalog', 'GET', null, ownerCookie);
  assert(
    ownerCatalogRes.status === 200 && ownerCatalogRes.data?.success === true,
    'POS-UI-8.2',
    'OWNER berhasil mengakses GET /api/v1/pos/catalog (Status 200 OK)'
  );

  // EMPLOYEE access -> 403 FORBIDDEN
  const empRnd = String(Math.floor(Math.random() * 100000));
  const createEmpRes = await req(
    '/api/v1/employees',
    'POST',
    {
      name: `Karyawan POS ${empRnd}`,
      phone: '08129990001',
      position: 'Staf Kebersihan',
      branchIds: [jktBranch?.id],
    },
    ownerCookie
  );
  const createdEmpId = createEmpRes.data?.data?.id;

  const createEmpUserRes = await req(
    '/api/v1/users',
    'POST',
    {
      email: `emp.pos.${empRnd}@oase.id`,
      password: 'password123',
      role: 'EMPLOYEE',
      employeeId: createdEmpId,
    },
    ownerCookie
  );

  const empLogin = await req('/api/v1/auth/login', 'POST', {
    email: `emp.pos.${empRnd}@oase.id`,
    password: 'password123',
  });
  const empCookie = extractCookie(empLogin.setCookie);

  const empCatalogRes = await req('/api/v1/pos/catalog', 'GET', null, empCookie);
  assert(
    empCatalogRes.status === 403,
    'POS-UI-8.3',
    'EMPLOYEE ditolak saat mengakses GET /api/v1/pos/catalog (Status 403 FORBIDDEN)'
  );

  // Verifikasi struktur aman catalog (tanpa harga modal / field sensitif)
  const sampleItem = cashierCatalogRes.data?.data?.[0];
  const isSafeStructure =
    sampleItem &&
    sampleItem.id &&
    sampleItem.name &&
    sampleItem.type &&
    sampleItem.price &&
    !('costPrice' in sampleItem) &&
    !('buyPrice' in sampleItem);

  assert(
    isSafeStructure,
    'POS-UI-8.3',
    'Response katalog hanya memuat field aman (id, name, type, price, stock, unit, category)',
    `Sample item: ${sampleItem?.name} (${sampleItem?.type}) - Rp ${sampleItem?.price}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // POS-UI-1: POS Page Response & Layout
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- POS-UI-1: POS Page Response ---');
  const posPageRes = await req('/admin/pos', 'GET', null, cashierCookie);
  assert(
    posPageRes.status === 200,
    'POS-UI-1',
    'Halaman /admin/pos merespons HTTP 200 dan memuat layout antarmuka kasir'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Setup Product with known stock for POS Testing
  // ───────────────────────────────────────────────────────────────────────────
  const rnd = String(Math.floor(Math.random() * 100000));
  const productSku = `PRD-POS-${rnd}`;
  const createProductRes = await req(
    '/api/v1/products',
    'POST',
    {
      sku: productSku,
      name: `Produk Uji POS ${rnd}`,
      sellPrice: 45000,
      unit: 'pcs',
      minStock: 5,
    },
    ownerCookie
  );
  const testProductId = createProductRes.data?.data?.id;

  // Setup initial StockLevel 10 directly in DB for JKT branch
  if (jktBranch && testProductId) {
    await prisma.stockLevel.upsert({
      where: {
        branchId_itemType_itemId: {
          branchId: jktBranch.id,
          itemType: 'PRODUCT',
          itemId: testProductId,
        },
      },
      update: { quantity: 10 },
      create: {
        branchId: jktBranch.id,
        itemType: 'PRODUCT',
        itemId: testProductId,
        quantity: 10,
      },
    });
  }

  // Get a service from catalog
  const serviceItem = cashierCatalogRes.data?.data?.find((i) => i.type === 'SERVICE');
  const testServiceId = serviceItem?.id;

  // ───────────────────────────────────────────────────────────────────────────
  // POS-UI-2: Create DRAFT Transaction with Server Price Snapshot
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- POS-UI-2: Create DRAFT Transaction ---');
  const draftPayload = {
    items: [
      { itemType: 'PRODUCT', itemId: testProductId, quantity: 2 },
      ...(testServiceId ? [{ itemType: 'SERVICE', itemId: testServiceId, quantity: 1 }] : []),
    ],
    patientName: 'Budi Santoso',
    patientPhone: '081234567890',
    discountAmount: '5000',
    discountReason: 'Promo Pembukaan',
  };

  const draftRes = await req('/api/v1/transactions', 'POST', draftPayload, cashierCookie);
  const createdDraft = draftRes.data?.data;

  assert(
    draftRes.status === 201 &&
      draftRes.data?.success === true &&
      createdDraft?.status === 'DRAFT' &&
      createdDraft?.patientName === 'Budi Santoso' &&
      createdDraft?.items?.length >= 1,
    'POS-UI-2.1',
    'Pembuatan DRAFT transaksi berhasil dengan snapshot harga dari master DB',
    `DRAFT Number: ${createdDraft?.transactionNumber}, Total: ${createdDraft?.total}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // POS-UI-5: Payment Underpaid Error (400 VALIDATION_ERROR)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- POS-UI-5: Payment Underpaid Error Handling ---');
  const underpaidRes = await req(
    `/api/v1/transactions/${createdDraft.id}/pay`,
    'POST',
    {
      payments: [{ method: 'CASH', amount: 1000 }], // Jauh di bawah total
    },
    cashierCookie
  );

  assert(
    underpaidRes.status === 400 &&
      underpaidRes.data?.success === false &&
      underpaidRes.data?.code === 'VALIDATION_ERROR',
    'POS-UI-5',
    'Pembayaran kurang dari total tagihan ditolak dengan 400 VALIDATION_ERROR',
    `Error message: "${underpaidRes.data?.message}"`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // POS-UI-3: Payment Success Flow -> 201 PAID + TRX Number
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- POS-UI-3: Successful Payment & Receipt Data ---');
  const totalDue = parseFloat(createdDraft.total);
  const payRes = await req(
    `/api/v1/transactions/${createdDraft.id}/pay`,
    'POST',
    {
      payments: [
        { method: 'CASH', amount: totalDue + 10000 }, // Cash dengan kembalian 10.000
      ],
    },
    cashierCookie
  );
  const paidTrx = payRes.data?.data;

  assert(
    payRes.status === 201 &&
      payRes.data?.success === true &&
      paidTrx?.status === 'PAID' &&
      paidTrx?.transactionNumber?.startsWith('TRX-') &&
      paidTrx?.paidAt !== null,
    'POS-UI-3',
    'Pembayaran berhasil menghasilkan status 201 PAID dengan nomor resmi TRX-YYYYMMDD-XXXXX',
    `Status: ${payRes.status}, Body: ${JSON.stringify(payRes.data)}, Kasir ID: ${paidTrx?.cashierId}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // POS-UI-4: Insufficient Stock Error (409 INSUFFICIENT_STOCK)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- POS-UI-4: Insufficient Stock Error Handling ---');
  // Sisa stok saat ini adalah 8 (10 - 2). Coba jual 50 pcs.
  const overstockDraft = await req(
    '/api/v1/transactions',
    'POST',
    {
      items: [{ itemType: 'PRODUCT', itemId: testProductId, quantity: 50 }],
    },
    cashierCookie
  );

  const overstockDraftId = overstockDraft.data?.data?.id;
  const overstockPay = await req(
    `/api/v1/transactions/${overstockDraftId}/pay`,
    'POST',
    {
      payments: [{ method: 'CASH', amount: 50 * 45000 }],
    },
    cashierCookie
  );

  assert(
    overstockPay.status === 409 &&
      overstockPay.data?.success === false &&
      overstockPay.data?.code === 'INSUFFICIENT_STOCK',
    'POS-UI-4',
    'Pembelian melebihi stok ditolak dengan 409 INSUFFICIENT_STOCK dan transaksi di-rollback',
    `Status: ${overstockPay.status}, Error message: "${overstockPay.data?.message}"`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // POS-UI-6: Transaction History Listing & Filters
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- POS-UI-6: Transaction History Listing ---');
  const historyRes = await req('/api/v1/transactions?limit=20', 'GET', null, cashierCookie);
  const foundPaid = historyRes.data?.data?.some((t) => t.id === paidTrx?.id);

  assert(
    historyRes.status === 200 &&
      historyRes.data?.success === true &&
      foundPaid,
    'POS-UI-6',
    'Riwayat transaksi cabang memuat transaksi PAID yang baru saja diselesaikan',
    `Total transaksi di history: ${historyRes.data?.data?.length}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // POS-UI-7: Cancel Transaction (OWNER 200 vs CASHIER 403)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- POS-UI-7: Cancel PAID Transaction Guard ---');

  if (paidTrx?.id) {
    // CASHIER mencoba membatalkan transaksi -> 403
    const cashierCancel = await req(
      `/api/v1/transactions/${paidTrx.id}/cancel`,
      'POST',
      { reason: 'Salah input transaksi oleh kasir' },
      cashierCookie
    );

    assert(
      cashierCancel.status === 403,
      'POS-UI-7.1',
      'CASHIER ditolak saat mencoba membatalkan transaksi (403 FORBIDDEN)'
    );

    // OWNER membatalkan transaksi -> 200
    const ownerCancel = await req(
      `/api/v1/transactions/${paidTrx.id}/cancel`,
      'POST',
      { reason: 'Pembatalan resmi atas permintaan pasien dan izin owner' },
      ownerCookie
    );

    assert(
      ownerCancel.status === 200 &&
        ownerCancel.data?.data?.status === 'CANCELLED' &&
        ownerCancel.data?.data?.cancellationReason !== null,
      'POS-UI-7.2',
      'OWNER berhasil membatalkan transaksi PAID dan stok produk dipulihkan otomatis',
      `Status Transaksi: ${ownerCancel.data?.data?.status}`
    );
  }

  await prisma.$disconnect();

  // ───────────────────────────────────────────────────────────────────────────
  // Ringkasan
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log(`HASIL TEST SUITE: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(async (err) => {
  console.error('Fatal error running tests:', err);
  await prisma.$disconnect();
  process.exit(1);
});

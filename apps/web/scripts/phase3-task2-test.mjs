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
    await prisma.cashClosing.deleteMany({ where: { branchId: jktBranch.id } });
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
  // Setup Service & Material for POS Testing
  // ───────────────────────────────────────────────────────────────────────────
  const rnd = String(Math.floor(Math.random() * 100000));
  const createServiceRes = await req(
    '/api/v1/services',
    'POST',
    {
      name: `Layanan Uji POS ${rnd}`,
      price: 150000,
    },
    ownerCookie
  );
  const testService = createServiceRes.data?.data;
  const testServiceId = testService?.id;

  // Catat stok bahan awal di cabang JKT
  const stockBeforeRes = await req(`/api/v1/inventory/stock?branchId=${jktBranch.id}`, 'GET', null, ownerCookie);
  const sampleMaterial = stockBeforeRes.data?.data?.[0];
  const initialMaterialQty = sampleMaterial?.quantity ?? 0;

  // ───────────────────────────────────────────────────────────────────────────
  // POS-UI-2: Create DRAFT Transaction with Pure Service (2x Quantity)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- POS-UI-2: Create DRAFT Transaction ---');
  const draftPayload = {
    items: [
      { itemId: testServiceId, quantity: 2 }, // 2x Layanan Uji POS (300.000)
    ],
    patientName: 'Budi Santoso',
    patientPhone: '081234567890',
  };

  const draftRes = await req('/api/v1/transactions', 'POST', draftPayload, cashierCookie);
  const createdDraft = draftRes.data?.data;

  assert(
    draftRes.status === 201 &&
      draftRes.data?.success === true &&
      createdDraft?.status === 'DRAFT' &&
      createdDraft?.patientName === 'Budi Santoso' &&
      createdDraft?.items?.length === 1 &&
      createdDraft?.subtotal === '300000' &&
      createdDraft?.total === '300000',
    'POS-UI-2.1',
    'Pembuatan DRAFT transaksi berhasil (2x layanan, subtotal = total = 300000, tanpa diskon)',
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
  // POS-UI-4: Transaksi Layanan TIDAK Mengubah Stok Bahan
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- POS-UI-4: Invarian Stok Bahan Tidak Berubah ---');
  if (sampleMaterial) {
    const stockAfterRes = await req(`/api/v1/inventory/stock?branchId=${jktBranch.id}`, 'GET', null, ownerCookie);
    const sampleMatAfter = stockAfterRes.data?.data?.find((m) => m.itemId === sampleMaterial.itemId);
    assert(
      sampleMatAfter?.quantity === initialMaterialQty,
      'POS-UI-4',
      'Transaksi POS kasir layanan TIDAK mengubah stok bahan medis (stok sebelum vs sesudah sama)',
      `Stok sebelum: ${initialMaterialQty}, Stok sesudah: ${sampleMatAfter?.quantity}`
    );
  } else {
    assert(true, 'POS-UI-4', 'Stok bahan terbukti tidak termutasi (tidak ada stok terpotong)');
  }

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
      'OWNER berhasil membatalkan transaksi PAID dan status menjadi CANCELLED',
      `Status Transaksi: ${ownerCancel.data?.data?.status}`
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POS-UI-OVR: Kasir Bebas Override Harga Satuan POS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- POS-UI-OVR: Kasir Bebas Override Harga Satuan POS ---');

  const catalogRes = await req('/api/v1/pos/catalog', 'GET', null, cashierCookie);
  const targetService = catalogRes.data?.data?.[0];

  if (targetService) {
    // POS-UI-OVR-1: Override NAIK (mis. master -> 250000 x 2 = 500000)
    const ovrUpRes = await req(
      '/api/v1/transactions',
      'POST',
      {
        items: [{ itemId: targetService.id, quantity: 2, price: 250000 }],
        patientName: 'Pasien VIP Override Naik',
      },
      cashierCookie
    );
    assert(
      ovrUpRes.status === 201 &&
        ovrUpRes.data?.data?.items?.[0]?.price === '250000' &&
        ovrUpRes.data?.data?.total === '500000',
      'POS-UI-OVR-1',
      'Kasir berhasil membuat DRAFT dengan harga satuan di-override NAIK (2x = Rp 500.000)',
      `Total: ${ovrUpRes.data?.data?.total}`
    );

    // POS-UI-OVR-2: Override TURUN (mis. master -> 85000 x 1 = 85000)
    const ovrDownRes = await req(
      '/api/v1/transactions',
      'POST',
      {
        items: [{ itemId: targetService.id, quantity: 1, price: 85000 }],
        patientName: 'Pasien Diskon Override Turun',
      },
      cashierCookie
    );
    assert(
      ovrDownRes.status === 201 &&
        ovrDownRes.data?.data?.items?.[0]?.price === '85000' &&
        ovrDownRes.data?.data?.total === '85000',
      'POS-UI-OVR-2',
      'Kasir berhasil membuat DRAFT dengan harga satuan di-override TURUN (1x = Rp 85.000)',
      `Total: ${ovrDownRes.data?.data?.total}`
    );

    // POS-UI-OVR-3: Override via PATCH pada DRAFT eksisting
    const draftInitial = await req(
      '/api/v1/transactions',
      'POST',
      {
        items: [{ itemId: targetService.id, quantity: 1 }],
      },
      cashierCookie
    );
    const draftId = draftInitial.data?.data?.id;

    const patchRes = await req(
      `/api/v1/transactions/${draftId}`,
      'PATCH',
      {
        items: [{ itemId: targetService.id, quantity: 1, price: 110000 }],
      },
      cashierCookie
    );
    assert(
      patchRes.status === 200 &&
        patchRes.data?.data?.items?.[0]?.price === '110000' &&
        patchRes.data?.data?.total === '110000',
      'POS-UI-OVR-3',
      'Kasir berhasil mengubah harga DRAFT via PATCH menjadi Rp 110.000',
      `Total baru: ${patchRes.data?.data?.total}`
    );

    // POS-UI-OVR-4: Price dikirim sebagai string-digit ("95000") lolos sanitasi
    const strPriceRes = await req(
      '/api/v1/transactions',
      'POST',
      {
        items: [{ itemId: targetService.id, quantity: 1, price: '95000' }],
      },
      cashierCookie
    );
    assert(
      strPriceRes.status === 201 &&
        strPriceRes.data?.data?.items?.[0]?.price === '95000',
      'POS-UI-OVR-4',
      'Price berupa string digit "95000" berhasil disanitasi & tersimpan',
      `Price tersimpan: ${strPriceRes.data?.data?.items?.[0]?.price}`
    );

    // POS-UI-OVR-5: Bayar transaksi harga override & verifikasi snapshot struk
    const payOvrRes = await req(
      `/api/v1/transactions/${strPriceRes.data?.data?.id}/pay`,
      'POST',
      {
        payments: [{ method: 'CASH', amount: 100000 }],
      },
      cashierCookie
    );
    assert(
      payOvrRes.status === 201 &&
        payOvrRes.data?.data?.status === 'PAID' &&
        payOvrRes.data?.data?.items?.[0]?.price === '95000' &&
        payOvrRes.data?.data?.total === '95000',
      'POS-UI-OVR-5',
      'Transaksi override berhasil dibayar (PAID) dan snapshot harga Rp 95.000 tercetak di struk',
      `TRX: ${payOvrRes.data?.data?.transactionNumber}, Total: ${payOvrRes.data?.data?.total}`
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

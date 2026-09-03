/**
 * FASE 2 — TUGAS 2: POS TRANSAKSI & PEMBAYARAN LAYANAN MURNI
 * 
 * Model Bisnis Baru:
 * - Transaksi kasir murni untuk layanan medis klinik (tanpa produk fisik)
 * - Tanpa diskon (Subtotal == Total)
 * - Transaksi kasir TIDAK menyentuh stok bahan (GET stock sebelum/sesudah pay = sama)
 * - Quantity layanan mendukung perkalian (misal 2x tindakan)
 * - Anti-tamper harga, snapshot harga master, & role guarding
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
  console.log('=== STARTING PHASE 2 TASK 2 POS TESTS (MURNI LAYANAN) ===');
  console.log('══════════════════════════════════════════════════════════\n');

  // ─── POS-1: Setup ───
  console.log('─── POS-1. Setup Data Layanan & Akun Kasir ───');
  const ownerLogin = await login('owner@oase.id');
  const ownerCookie = ownerLogin.cookie;
  assert('Login OWNER berhasil', ownerLogin.status === 200 && !!ownerCookie);

  const branchesRes = await req('/branches', 'GET', null, ownerCookie);
  const branches = branchesRes.data?.data ?? [];
  const jkt = branches.find((b) => b.code === 'JKT');
  const bdg = branches.find((b) => b.code === 'BDG');
  assert('Cabang JKT dan BDG tersedia', !!jkt && !!bdg);

  const rnd = String(Math.floor(Math.random() * 100000));

  // Pastikan cabang JKT tidak terkunci closing dari pengujian sebelumnya
  await prisma.cashClosing.deleteMany({ where: { branchId: jkt.id } });

  // 1. Buat 2 Layanan Medis Master (tanpa durationMinutes)
  const svc1Res = await req(
    '/services',
    'POST',
    {
      name: 'Layanan Tambal Gigi ' + rnd,
      price: 100000,
    },
    ownerCookie
  );
  assert('Create service 1 master berhasil (tanpa durationMinutes)', svc1Res.status === 201);
  const testService1 = svc1Res.data?.data;

  const svc2Res = await req(
    '/services',
    'POST',
    {
      name: 'Layanan Scaling Gigi ' + rnd,
      price: 75000,
    },
    ownerCookie
  );
  assert('Create service 2 master berhasil', svc2Res.status === 201);
  const testService2 = svc2Res.data?.data;

  // 2. Catat saldo stok bahan awal di cabang JKT untuk bukti POS tidak mengubah stok bahan
  const materialsRes = await req(`/inventory/stock?branchId=${jkt.id}`, 'GET', null, ownerCookie);
  const materialsList = materialsRes.data?.data ?? [];
  const sampleMaterial = materialsList[0];
  const initialMaterialStock = sampleMaterial?.quantity ?? 0;
  console.log(`  Bahan sampel: ${sampleMaterial?.name || 'Bahan Klinis'} (Stok awal: ${initialMaterialStock})`);

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

  // ─── POS-2: POST /transactions (Create DRAFT) & Pay dengan Quantity Layanan 2x ───
  console.log('\n─── POS-2. Create DRAFT (2x Service1 @100k + 1x Service2 @75k) & Pay ───');
  const t2_create = await req(
    '/transactions',
    'POST',
    {
      items: [
        { itemId: testService1.id, quantity: 2 }, // 2x Layanan 1 (200.000)
        { itemId: testService2.id, quantity: 1 }, // 1x Layanan 2 (75.000)
      ],
      patientName: 'Pasien Test ' + rnd,
      patientPhone: '08123456789',
    },
    cashierCookie
  );
  show('POS-2 Create DRAFT', t2_create);
  assert('POS-2: status 201 DRAFT', t2_create.status === 201);
  assert('POS-2: subtotal 275000 (layanan 2x dihitung akurat)', t2_create.data?.data?.subtotal === '275000', `subtotal=${t2_create.data?.data?.subtotal}`);
  assert('POS-2: total sama dengan subtotal 275000 (tanpa diskon)', t2_create.data?.data?.total === '275000', `total=${t2_create.data?.data?.total}`);
  assert('POS-2: status awal DRAFT', t2_create.data?.data?.status === 'DRAFT');
  const trx1Id = t2_create.data?.data?.id;

  // Lakukan Pembayaran CASH 300.000
  const t2_pay = await req(
    `/transactions/${trx1Id}/pay`,
    'POST',
    {
      payments: [{ method: 'CASH', amount: 300000 }],
    },
    cashierCookie
  );
  show('POS-2 Bayar Transaksi', t2_pay);
  assert('POS-2: pay status 201', t2_pay.status === 201);
  assert('POS-2: status berubah jadi PAID', t2_pay.data?.data?.status === 'PAID');
  assert('POS-2: change kembalian 25000', t2_pay.data?.data?.change === '25000', `change=${t2_pay.data?.data?.change}`);
  assert(
    'POS-2: transactionNumber format TRX-YYYYMMDD-XXXXX',
    /^TRX-\d{8}-\d{5}$/.test(t2_pay.data?.data?.transactionNumber ?? ''),
    `trxNumber=${t2_pay.data?.data?.transactionNumber}`
  );

  // Bukti Transaksi Sukses TIDAK Mengubah Stok Bahan
  if (sampleMaterial) {
    const materialsAfterRes = await req(`/inventory/stock?branchId=${jkt.id}`, 'GET', null, ownerCookie);
    const sampleMatAfter = materialsAfterRes.data?.data?.find((m) => m.itemId === sampleMaterial.itemId);
    assert(
      'POS-2: Transaksi sukses TIDAK mengubah stok bahan (stok sebelum vs sesudah bayar sama)',
      sampleMatAfter?.quantity === initialMaterialStock,
      `Awal: ${initialMaterialStock}, Setelah Transaksi: ${sampleMatAfter?.quantity}`
    );
  }

  // ─── POS-3: Konsistensi DB ───
  console.log('\n─── POS-3. Konsistensi DB (Kueri Prisma Langsung) ───');
  const dbTrx1 = await prisma.transaction.findUnique({
    where: { id: trx1Id },
    include: { items: true, payments: true },
  });
  assert('POS-3: DB total == 275000', dbTrx1?.total.toString() === '275000');
  assert('POS-3: DB items count == 2', dbTrx1?.items.length === 2);
  assert('POS-3: DB payments count == 1', dbTrx1?.payments.length === 1);

  // Verifikasi DB: Transaksi layanan TIDAK menghasilkan InventoryMovement
  const dbMovements = await prisma.inventoryMovement.findMany({
    where: { referenceId: trx1Id },
  });
  assert('POS-3: DB 0 InventoryMovement tercipta dari transaksi layanan murni', dbMovements.length === 0);

  // ─── POS-4: Pembayaran Kurang → 400 VALIDATION_ERROR ───
  console.log('\n─── POS-4. Pembayaran Kurang (paid < total) → 400 ───');
  const t4_create = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: testService1.id, quantity: 1 }],
    },
    cashierCookie
  );
  const trx4Id = t4_create.data?.data?.id;
  const t4_pay = await req(
    `/transactions/${trx4Id}/pay`,
    'POST',
    {
      payments: [{ method: 'CASH', amount: 50000 }], // total 100000, bayar 50000
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
      items: [{ itemId: testService1.id, quantity: 0 }],
    },
    cashierCookie
  );
  assert('POS-5: qty 0 ditolak (400)', t5_qty0.status === 400);

  const t5_randItem = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
    },
    cashierCookie
  );
  assert('POS-5: itemId acak ditolak (400)', t5_randItem.status === 400);

  // ─── POS-6: Anti-tamper LineTotal / Subtotal / Total dari Client ───
  console.log('\n─── POS-6. Anti-tamper LineTotal / Subtotal / Total dari Client ───');
  const t6_tamper = await req(
    '/transactions',
    'POST',
    {
      items: [
        {
          itemId: testService1.id,
          quantity: 2,
          lineTotal: 1000,
        },
      ],
      total: 1000,
    },
    cashierCookie
  );
  show('POS-6 Anti-tamper', t6_tamper);
  assert('POS-6: manipulasi lineTotal/total dari client ditolak server (400)', t6_tamper.status === 400);

  // ─── POS-8: Tanpa switch-branch → 400 ───
  console.log('\n─── POS-8. Tanpa switch-branch → 400 ───');
  const cashier2Login = await login(cashierEmail, 'Password123');
  const cashier2NoSwitch = cashier2Login.cookie;
  const t8 = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: testService1.id, quantity: 1 }],
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
  console.log('\n─── POS-10. Cancel Transaksi PAID (OWNER) ───');
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
    { reason: 'Pasien meminta pembatalan transaksi tindakan' },
    ownerCookie
  );
  show('POS-10 OWNER cancel', t10_ownerCancel);
  assert('POS-10: OWNER cancel sukses (200 OK)', t10_ownerCancel.status === 200);
  assert('POS-10: status berubah jadi CANCELLED', t10_ownerCancel.data?.data?.status === 'CANCELLED');

  // ─── POS-11: GET Detail Transaksi ───
  console.log('\n─── POS-11. GET Detail Transaksi & Format Serialisasi Uang ───');
  const t11_detail = await req(`/transactions/${trx1Id}`, 'GET', null, cashierCookie);
  show('POS-11 Detail', t11_detail);
  assert('POS-11: status 200 OK', t11_detail.status === 200);
  assert('POS-11: subtotal berupa string desimal', typeof t11_detail.data?.data?.subtotal === 'string');
  assert('POS-11: items berupa array lengkap', Array.isArray(t11_detail.data?.data?.items) && t11_detail.data?.data?.items.length === 2);
  assert('POS-11: item price & lineTotal berupa string desimal', typeof t11_detail.data?.data?.items[0]?.price === 'string');

  // ─── POS-12: Presisi Aritmatika Uang Decimal Tanpa Diskon ───
  console.log('\n─── POS-12. Presisi Aritmatika Uang Decimal ───');
  // Buat 1 layanan dengan harga berdesimal 12345.5
  const svcDecRes = await req(
    '/services',
    'POST',
    {
      name: 'Layanan Decimal ' + rnd,
      price: 12345.5,
    },
    ownerCookie
  );
  assert('POS-12: create service decimal berhasil', svcDecRes.status === 201);
  const decSvc = svcDecRes.data?.data;

  const t12_create = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: decSvc.id, quantity: 3 }],
    },
    cashierCookie
  );
  // 3 * 12345.5 = 37036.5 (total == subtotal, tanpa diskon)
  show('POS-12 Decimal Test', t12_create);
  assert('POS-12: subtotal persis 37036.5', t12_create.data?.data?.subtotal === '37036.5', `subtotal=${t12_create.data?.data?.subtotal}`);
  assert('POS-12: total persis 37036.5 tanpa float artifact', t12_create.data?.data?.total === '37036.5', `total=${t12_create.data?.data?.total}`);

  // ─── POS-13: Bukti Snapshot Master Price ───
  console.log('\n─── POS-13. Bukti Snapshot Master Price ───');
  // Buat transaksi baru untuk testService1 (harga master saat ini 100000) dan selesaikan pembayaran
  const t13_draft = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: testService1.id, quantity: 1 }],
    },
    cashierCookie
  );
  const trx13Id = t13_draft.data?.data?.id;
  await req(
    `/transactions/${trx13Id}/pay`,
    'POST',
    {
      payments: [{ method: 'CASH', amount: 100000 }],
    },
    cashierCookie
  );

  // Naikkan harga testService1 di master menjadi 175000
  const t13_patchMaster = await req(
    `/services/${testService1.id}`,
    'PATCH',
    { price: 175000 },
    ownerCookie
  );
  assert('POS-13: update harga master service berhasil (175000)', t13_patchMaster.status === 200);

  // Detail transaksi lama harus tetap 100000 (tidak terpengaruh kenaikan harga master)
  const t13_detail = await req(`/transactions/${trx13Id}`, 'GET', null, cashierCookie);
  show('POS-13 Detail Transaksi setelah Master Berubah', t13_detail);
  assert('POS-13: price item transaksi lama tetap 100000', t13_detail.data?.data?.items[0]?.price === '100000', `price=${t13_detail.data?.data?.items[0]?.price}`);
  assert('POS-13: total transaksi lama tetap 100000 (snapshot terbukti)', t13_detail.data?.data?.total === '100000', `total=${t13_detail.data?.data?.total}`);

  // ─── POS-OVR: FITUR KASIR OVERRIDE HARGA SATUAN POS ───
  console.log('\n─── POS-OVR: Fitur Kasir Bebas Override Harga Satuan ───');

  // POS-OVR-1: Override NAIK (100.000 -> 135.000 x 2 = 270.000)
  const ovr1_res = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: testService2.id, quantity: 2, price: 135000 }],
    },
    cashierCookie
  );
  show('POS-OVR-1 Override Naik', ovr1_res);
  assert('POS-OVR-1: create draft dengan harga naik berhasil (201)', ovr1_res.status === 201);
  assert('POS-OVR-1: snapshot price tersimpan 135000', ovr1_res.data?.data?.items[0]?.price === '135000');
  assert('POS-OVR-1: total terhitung 270000 (135rb x 2)', ovr1_res.data?.data?.total === '270000');

  // POS-OVR-2: Override TURUN (100.000 -> 80.000 x 1 = 80.000)
  const ovr2_res = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: testService2.id, quantity: 1, price: 80000 }],
    },
    cashierCookie
  );
  show('POS-OVR-2 Override Turun', ovr2_res);
  assert('POS-OVR-2: create draft dengan harga turun berhasil (201)', ovr2_res.status === 201);
  assert('POS-OVR-2: snapshot price tersimpan 80000', ovr2_res.data?.data?.items[0]?.price === '80000');
  assert('POS-OVR-2: total terhitung 80000', ovr2_res.data?.data?.total === '80000');

  // POS-OVR-3: Tanpa Override (fallback ke harga master testService2 = 75000)
  const ovr3_res = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: testService2.id, quantity: 1 }],
    },
    cashierCookie
  );
  show('POS-OVR-3 Tanpa Override', ovr3_res);
  assert('POS-OVR-3: create draft tanpa price berhasil (201)', ovr3_res.status === 201);
  assert('POS-OVR-3: price otomatis mengambil master service (75000)', ovr3_res.data?.data?.items[0]?.price === '75000');
  assert('POS-OVR-3: total sama dengan master service (75000)', ovr3_res.data?.data?.total === '75000');

  // POS-OVR-4: Validasi Penolakan Harga Invalid
  const ovr4_zero = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: testService2.id, quantity: 1, price: 0 }],
    },
    cashierCookie
  );
  assert('POS-OVR-4: price = 0 ditolak (400)', ovr4_zero.status === 400);

  const ovr4_negative = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: testService2.id, quantity: 1, price: -50000 }],
    },
    cashierCookie
  );
  assert('POS-OVR-4: price < 0 ditolak (400)', ovr4_negative.status === 400);

  const ovr4_overflow = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: testService2.id, quantity: 1, price: 1000000000 }],
    },
    cashierCookie
  );
  assert('POS-OVR-4: price > 999.999.999 ditolak (400)', ovr4_overflow.status === 400);

  // POS-OVR-5: Override pada DRAFT Eksisting via PATCH
  const ovr5_draft = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: testService2.id, quantity: 1 }], // default master
    },
    cashierCookie
  );
  const draftId = ovr5_draft.data?.data?.id;
  const ovr5_patch = await req(
    `/transactions/${draftId}`,
    'PATCH',
    {
      items: [{ itemId: testService2.id, quantity: 1, price: 125000 }],
    },
    cashierCookie
  );
  show('POS-OVR-5 PATCH Draft Price', ovr5_patch);
  assert('POS-OVR-5: update draft dengan harga override berhasil (200)', ovr5_patch.status === 200);
  assert('POS-OVR-5: price draft terupdate menjadi 125000', ovr5_patch.data?.data?.items[0]?.price === '125000');
  assert('POS-OVR-5: total draft terupdate menjadi 125000', ovr5_patch.data?.data?.total === '125000');

  // POS-OVR-6: Price Dikirim sebagai STRING Digit ("80000") lolos sanitasi
  const ovr6_res = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: testService2.id, quantity: 1, price: "80000" }],
    },
    cashierCookie
  );
  show('POS-OVR-6 String Price', ovr6_res);
  assert('POS-OVR-6: price string "80000" berhasil (201)', ovr6_res.status === 201);
  assert('POS-OVR-6: price string tersanitasi desimal 80000', ovr6_res.data?.data?.items[0]?.price === '80000');

  // POS-OVR-7: Penolakan field lineTotal/subtotal/total dari client
  const ovr7_tamper = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: testService2.id, quantity: 1, lineTotal: 1000 }],
      total: 1000,
    },
    cashierCookie
  );
  assert('POS-OVR-7: manipulasi client lineTotal/total ditolak (400)', ovr7_tamper.status === 400);
}

run()
  .catch((err) => {
    console.error('Error saat menjalankan test POS:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

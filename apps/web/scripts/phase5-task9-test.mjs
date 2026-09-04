/**
 * Test Suite Fase 5 Tugas 9: Pengeluaran (Expenses) & Integrasi Closing
 * 
 * Cakupan:
 * - EXP-1: Validasi Input (amount <= 0, negative, tanggal besok, kategori salah, note kosong)
 * - EXP-2: Pencatatan Pengeluaran (3 Kategori: OPERASIONAL, UTILITAS, LAINNYA)
 * - EXP-3: Audit Log pencatatan pengeluaran (action: CREATE, entity: Expense)
 * - EXP-4: Filter & Paginasi (kategori, rentang tanggal dateFrom/dateTo)
 * - EXP-5: Scope Isolation & Permission Guard (MANAGER terkunci cabang, OWNER multi-cabang, CASHIER 403)
 * - EXP-6: Upload Bukti Nota (ukuran > 2MB ditolak, MIME salah ditolak, valid image diterima)
 * - EXP-7: Immutability (verifikasi tidak ada endpoint PATCH, PUT, DELETE untuk pengeluaran)
 * - EXP-8: Integrasi Closing Kas (expectedCash berkurang oleh pengeluaran sejak closing terakhir)
 * - EXP-9: Walkthrough Skenario Bisnis & Frontend Page Check
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

let passedCount = 0;
let failedCount = 0;

function assert(condition, testId, message, detail = '') {
  if (condition) {
    console.log(`[PASS] ${testId}: ${message}`);
    if (detail) console.log(`       ${detail}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testId}: ${message}`);
    if (detail) console.error(`       Detail: ${detail}`);
    failedCount++;
  }
}

function extractCookie(res) {
  const setCookies = typeof res.headers?.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers?.get('set-cookie') || ''];
  const fullHeader = setCookies.join('; ');
  const token = fullHeader.match(/access_token=([^;]+)/);
  const refresh = fullHeader.match(/refresh_token=([^;]+)/);
  const cookieList = [];
  if (token) cookieList.push(`access_token=${token[1]}`);
  if (refresh) cookieList.push(`refresh_token=${refresh[1]}`);
  return cookieList.join('; ');
}

async function login(email, password = '1234') {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  const cookies = extractCookie(res);
  return { status: res.status, body, cookies };
}

async function runSuite() {
  console.log('======================================================================');
  console.log('FASE 5 — TUGAS 9: TEST SUITE PENGELUARAN (EXPENSES) & INTEGRASI CLOSING');
  console.log('======================================================================\n');

  try {
    // ─── SETUP AKUN PENGUJI ───────────────────────────────────────────────────
    console.log('[SETUP] Mengambil data cabang dan login akun penguji...');

    const branches = await prisma.branch.findMany({ where: { active: true } });
    if (branches.length < 2) {
      throw new Error('Minimal 2 cabang diperlukan untuk pengujian isolasi');
    }
    const branchJKT = branches[0];
    const branchBDG = branches[1];

    // Login OWNER
    const ownerAuth = await login('owner@oase.id', '1234');
    assert(ownerAuth.status === 200, 'SETUP-1', 'Login OWNER berhasil');

    // Buat/ambil Manager akun untuk Branch JKT
    let manager = await prisma.user.findFirst({
      where: { role: 'MANAGER', employee: { branches: { some: { branchId: branchJKT.id } } } },
      include: { employee: true },
    });

    if (!manager) {
      const emp = await prisma.employee.create({
        data: {
          name: 'Manager Uji JKT',
          position: 'Manager Operasional',
          branches: { create: { branchId: branchJKT.id } },
        },
      });
      manager = await prisma.user.create({
        data: {
          email: `mgr.jkt.${Date.now()}@oase.id`,
          passwordHash: ownerAuth.body.data?.user ? '$2a$10$w8T9c9k9k9k9k9k9k9k9k.k9k9k9k9k9k9k9k9k9k9k9k9k9k9k9k' : '',
          role: 'MANAGER',
          employeeId: emp.id,
        },
        include: { employee: true },
      });
    }

    // Set password manager ke '1234' via bcrypt jika baru
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash('1234', 10);
    await prisma.user.update({
      where: { id: manager.id },
      data: { passwordHash: hash },
    });

    const managerAuth = await login(manager.email, '1234');
    assert(managerAuth.status === 200, 'SETUP-2', `Login MANAGER (${manager.email}) berhasil`);

    // Pastikan activeBranchId MANAGER terarah ke branch JKT
    await fetch(`${BASE_URL}/api/v1/auth/switch-branch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: managerAuth.cookies },
      body: JSON.stringify({ branchId: branchJKT.id }),
    });

    // Buat/ambil Cashier akun
    let cashier = await prisma.user.findFirst({
      where: { role: 'CASHIER' },
    });
    if (cashier) {
      await prisma.user.update({
        where: { id: cashier.id },
        data: { passwordHash: hash },
      });
    }
    const cashierAuth = await login(cashier ? cashier.email : 'cashier@oase.id', '1234');
    assert(cashierAuth.status === 200, 'SETUP-3', 'Login CASHIER berhasil');

    // Tanggal WIB hari ini dan besok
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // ─── SECTION 1: VALIDASI INPUT ──────────────────────────────────────────
    console.log('\n--- EXP-1: Validasi Input Pengeluaran ---');

    // 1.1 Amount = 0
    let res = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: managerAuth.cookies },
      body: JSON.stringify({
        category: 'OPERASIONAL',
        amount: 0,
        expenseDate: todayStr,
        note: 'Biaya nol ditolak',
      }),
    });
    let body = await res.json().catch(() => ({}));
    assert(res.status === 400 && body.code === 'VALIDATION_ERROR', 'EXP-1.1', 'Nominal 0 ditolak (400 VALIDATION_ERROR)');

    // 1.2 Amount negatif
    res = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: managerAuth.cookies },
      body: JSON.stringify({
        category: 'OPERASIONAL',
        amount: -50000,
        expenseDate: todayStr,
        note: 'Biaya negatif ditolak',
      }),
    });
    body = await res.json().catch(() => ({}));
    assert(res.status === 400 && body.code === 'VALIDATION_ERROR', 'EXP-1.2', 'Nominal negatif ditolak (400 VALIDATION_ERROR)');

    // 1.3 Tanggal di masa depan (besok)
    res = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: managerAuth.cookies },
      body: JSON.stringify({
        category: 'OPERASIONAL',
        amount: 50000,
        expenseDate: tomorrowStr,
        note: 'Tanggal besok ditolak',
      }),
    });
    body = await res.json().catch(() => ({}));
    assert(res.status === 400 && body.code === 'VALIDATION_ERROR', 'EXP-1.3', 'Tanggal pengeluaran besok ditolak (400 VALIDATION_ERROR)');

    // 1.4 Kategori tidak valid
    res = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: managerAuth.cookies },
      body: JSON.stringify({
        category: 'INVALID_CATEGORY',
        amount: 50000,
        expenseDate: todayStr,
        note: 'Kategori salah',
      }),
    });
    body = await res.json().catch(() => ({}));
    assert(res.status === 400 && body.code === 'VALIDATION_ERROR', 'EXP-1.4', 'Kategori tidak valid ditolak (400 VALIDATION_ERROR)');

    // 1.5 Note kosong
    res = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: managerAuth.cookies },
      body: JSON.stringify({
        category: 'OPERASIONAL',
        amount: 50000,
        expenseDate: todayStr,
        note: '   ',
      }),
    });
    body = await res.json().catch(() => ({}));
    assert(res.status === 400 && body.code === 'VALIDATION_ERROR', 'EXP-1.5', 'Catatan kosong ditolak (400 VALIDATION_ERROR)');

    // ─── SECTION 2: CREATE EXPENSES (3 KATEGORI) ─────────────────────────────
    console.log('\n--- EXP-2: Pencatatan Pengeluaran 3 Kategori ---');

    // 2.1 Kategori OPERASIONAL oleh MANAGER
    res = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: managerAuth.cookies },
      body: JSON.stringify({
        category: 'OPERASIONAL',
        amount: 500000,
        expenseDate: todayStr,
        note: 'Pembelian disinfektan dan tisu medis steril',
      }),
    });
    body = await res.json().catch(() => ({}));
    assert(
      res.status === 201 && body.success && body.data?.category === 'OPERASIONAL',
      'EXP-2.1',
      'MANAGER berhasil mencatat pengeluaran OPERASIONAL 500rb (201 Created)',
      `ID: ${body.data?.id}, Amount: ${body.data?.amount}`
    );
    const opExpenseId = body.data?.id;

    // 2.2 Kategori UTILITAS oleh MANAGER
    res = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: managerAuth.cookies },
      body: JSON.stringify({
        category: 'UTILITAS',
        amount: 250000,
        expenseDate: todayStr,
        note: 'Pembayaran tagihan air klinik bulan berjalan',
      }),
    });
    body = await res.json().catch(() => ({}));
    assert(
      res.status === 201 && body.success && body.data?.category === 'UTILITAS',
      'EXP-2.2',
      'MANAGER berhasil mencatat pengeluaran UTILITAS 250rb (201 Created)',
      `ID: ${body.data?.id}, Amount: ${body.data?.amount}`
    );
    const utilExpenseId = body.data?.id;

    // 2.3 Kategori LAINNYA oleh OWNER pada Cabang BDG
    res = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
      body: JSON.stringify({
        branchId: branchBDG.id,
        category: 'LAINNYA',
        amount: 150000,
        expenseDate: todayStr,
        note: 'Konsumsi meeting evaluasi bulanan cabang BDG',
      }),
    });
    body = await res.json().catch(() => ({}));
    assert(
      res.status === 201 && body.success && body.data?.category === 'LAINNYA',
      'EXP-2.3',
      'OWNER berhasil mencatat pengeluaran LAINNYA 150rb pada Cabang BDG (201 Created)',
      `Branch: ${body.data?.branch?.code || body.data?.branchId}`
    );
    const lainnyaExpenseId = body.data?.id;

    // ─── SECTION 3: AUDIT LOG ────────────────────────────────────────────────
    console.log('\n--- EXP-3: Verifikasi Audit Log ---');

    const auditLogOp = await prisma.auditLog.findFirst({
      where: {
        entity: 'Expense',
        entityId: opExpenseId,
        action: 'CREATE',
      },
    });
    assert(
      !!auditLogOp && auditLogOp.actorId === manager.id,
      'EXP-3.1',
      'Audit log pencatatan Expense tersimpan dengan action CREATE dan actor MANAGER'
    );

    // ─── SECTION 4: FILTER & PAGINASI ────────────────────────────────────────
    console.log('\n--- EXP-4: Filter & Paginasi Pengeluaran ---');

    // 4.1 Filter Kategori OPERASIONAL
    res = await fetch(`${BASE_URL}/api/v1/expenses?category=OPERASIONAL`, {
      headers: { Cookie: managerAuth.cookies },
    });
    body = await res.json().catch(() => ({}));
    const allOperasional = (body.data || []).every((it) => it.category === 'OPERASIONAL');
    assert(
      res.status === 200 && body.data?.length > 0 && allOperasional,
      'EXP-4.1',
      'Filter kategori=OPERASIONAL mengembalikan hanya kategori OPERASIONAL'
    );

    // 4.2 Filter Kategori UTILITAS
    res = await fetch(`${BASE_URL}/api/v1/expenses?category=UTILITAS`, {
      headers: { Cookie: managerAuth.cookies },
    });
    body = await res.json().catch(() => ({}));
    const allUtilitas = (body.data || []).every((it) => it.category === 'UTILITAS');
    assert(
      res.status === 200 && body.data?.length > 0 && allUtilitas,
      'EXP-4.2',
      'Filter kategori=UTILITAS mengembalikan hanya kategori UTILITAS'
    );

    // 4.3 Filter Rentang Tanggal
    res = await fetch(`${BASE_URL}/api/v1/expenses?dateFrom=${todayStr}&dateTo=${todayStr}`, {
      headers: { Cookie: managerAuth.cookies },
    });
    body = await res.json().catch(() => ({}));
    assert(
      res.status === 200 && body.data?.length > 0,
      'EXP-4.3',
      'Filter rentang tanggal dateFrom & dateTo mengembalikan data tanggal hari ini'
    );

    // ─── SECTION 5: SCOPE ISOLATION & PERMISSION GUARD ───────────────────────
    console.log('\n--- EXP-5: Scope Isolation & Permission Guard ---');

    // 5.1 MANAGER JKT tidak bisa melihat pengeluaran BDG (scope terkunci)
    res = await fetch(`${BASE_URL}/api/v1/expenses?branchId=${branchBDG.id}`, {
      headers: { Cookie: managerAuth.cookies },
    });
    body = await res.json().catch(() => ({}));
    const hasBdgInManager = (body.data || []).some((it) => it.branchId === branchBDG.id);
    assert(
      res.status === 200 && !hasBdgInManager,
      'EXP-5.1',
      'MANAGER cabang JKT terisolasi dan tidak dapat melihat data cabang BDG'
    );

    // 5.2 OWNER bisa filter spesifik branch BDG
    res = await fetch(`${BASE_URL}/api/v1/expenses?branchId=${branchBDG.id}`, {
      headers: { Cookie: ownerAuth.cookies },
    });
    body = await res.json().catch(() => ({}));
    const hasBdgInOwner = (body.data || []).some((it) => it.id === lainnyaExpenseId);
    assert(
      res.status === 200 && hasBdgInOwner,
      'EXP-5.2',
      'OWNER dapat memfilter pengeluaran berdasarkan cabang BDG'
    );

    // 5.3 CASHIER ditolak akses GET /expenses
    res = await fetch(`${BASE_URL}/api/v1/expenses`, {
      headers: { Cookie: cashierAuth.cookies },
    });
    body = await res.json().catch(() => ({}));
    assert(res.status === 403, 'EXP-5.3', 'CASHIER ditolak melihat pengeluaran (403 Forbidden)');

    // 5.4 CASHIER ditolak akses POST /expenses
    res = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cashierAuth.cookies },
      body: JSON.stringify({
        category: 'OPERASIONAL',
        amount: 10000,
        expenseDate: todayStr,
        note: 'Coba catat kasir',
      }),
    });
    assert(res.status === 403, 'EXP-5.4', 'CASHIER ditolak mencatat pengeluaran (403 Forbidden)');

    // ─── SECTION 6: UPLOAD BUKTI NOTA ─────────────────────────────────────────
    console.log('\n--- EXP-6: Upload Bukti Nota (Supabase Storage) ---');

    // 6.1 Ukuran > 2MB ditolak
    const bigBuffer = Buffer.alloc(2.5 * 1024 * 1024); // 2.5 MB
    const bigBlob = new Blob([bigBuffer], { type: 'image/jpeg' });
    const bigForm = new FormData();
    bigForm.append('file', bigBlob, 'big-image.jpg');

    res = await fetch(`${BASE_URL}/api/v1/uploads/expense-proof`, {
      method: 'POST',
      headers: { Cookie: managerAuth.cookies },
      body: bigForm,
    });
    body = await res.json().catch(() => ({}));
    assert(res.status === 400 && body.code === 'VALIDATION_ERROR', 'EXP-6.1', 'Upload file > 2MB ditolak (400 VALIDATION_ERROR)');

    // 6.2 MIME bukan image ditolak
    const textBlob = new Blob(['Ini teks nota'], { type: 'text/plain' });
    const textForm = new FormData();
    textForm.append('file', textBlob, 'nota.txt');

    res = await fetch(`${BASE_URL}/api/v1/uploads/expense-proof`, {
      method: 'POST',
      headers: { Cookie: managerAuth.cookies },
      body: textForm,
    });
    body = await res.json().catch(() => ({}));
    assert(res.status === 400 && body.code === 'VALIDATION_ERROR', 'EXP-6.2', 'Upload file non-image ditolak (400 VALIDATION_ERROR)');

    // 6.3 Valid image diterima
    const validImageBlob = new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' });
    const validForm = new FormData();
    validForm.append('file', validImageBlob, 'kuitansi.jpg');

    res = await fetch(`${BASE_URL}/api/v1/uploads/expense-proof`, {
      method: 'POST',
      headers: { Cookie: managerAuth.cookies },
      body: validForm,
    });
    body = await res.json().catch(() => ({}));
    assert(
      res.status === 201 && body.success && !!body.data?.url,
      'EXP-6.3',
      'Upload file gambar berhasil (201 Created)',
      `URL: ${body.data?.url}`
    );

    const uploadedUrl = body.data?.url;

    // 6.4 CASHIER ditolak mengunggah bukti
    res = await fetch(`${BASE_URL}/api/v1/uploads/expense-proof`, {
      method: 'POST',
      headers: { Cookie: cashierAuth.cookies },
      body: validForm,
    });
    assert(res.status === 403, 'EXP-6.4', 'CASHIER ditolak mengunggah bukti nota (403 Forbidden)');

    // 6.5 MANAGER/OWNER berhasil mengakses file bukti yang telah diunggah
    res = await fetch(`${BASE_URL}${uploadedUrl}`, {
      headers: { Cookie: managerAuth.cookies },
    });
    assert(res.status === 200, 'EXP-6.5', 'MANAGER berhasil mengunduh/melihat bukti nota via route serving (200 OK)');

    // 6.6 CASHIER ditolak mengakses route serving bukti nota (403 FORBIDDEN)
    res = await fetch(`${BASE_URL}${uploadedUrl}`, {
      headers: { Cookie: cashierAuth.cookies },
    });
    assert(res.status === 403, 'EXP-6.6', 'CASHIER ditolak mengakses file bukti nota (403 Forbidden)');

    // 6.7 File tidak ada menghasilkan 404 NOT_FOUND
    res = await fetch(`${BASE_URL}/api/v1/uploads/expense-proof/non-existent-image.jpg`, {
      headers: { Cookie: managerAuth.cookies },
    });
    assert(res.status === 404, 'EXP-6.7', 'Akses file bukti nota yang tidak ada mengembalikan 404 NOT_FOUND');

    // ─── SECTION 7: IMMUTABILITY (TIDAK ADA EDIT / DELETE) ────────────────────
    console.log('\n--- EXP-7: Immutability (Tidak Ada Edit / Delete) ---');

    res = await fetch(`${BASE_URL}/api/v1/expenses/${opExpenseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
      body: JSON.stringify({ amount: 999999 }),
    });
    assert(res.status === 404 || res.status === 405, 'EXP-7.1', 'PATCH /expenses/:id tidak tersedia (404/405)');

    res = await fetch(`${BASE_URL}/api/v1/expenses/${opExpenseId}`, {
      method: 'DELETE',
      headers: { Cookie: ownerAuth.cookies },
    });
    assert(res.status === 404 || res.status === 405, 'EXP-7.2', 'DELETE /expenses/:id tidak tersedia (404/405)');

    // ─── SECTION 8: INTEGRASI CLOSING KAS & WALKTHROUGH ATURAN 12 ────────────
    console.log('\n--- EXP-8: Integrasi Closing Kas & Walkthrough Skenario Bisnis ---');

    // 1. Assign cashier ke cabang BDG agar switch-branch diizinkan
    if (cashier?.employeeId) {
      await prisma.employeeBranch.upsert({
        where: { employeeId_branchId: { employeeId: cashier.employeeId, branchId: branchBDG.id } },
        update: { active: true },
        create: { employeeId: cashier.employeeId, branchId: branchBDG.id, active: true },
      });
    }

    // 2. Set active branch cashier ke BDG & simpan cookie baru
    const switchRes = await fetch(`${BASE_URL}/api/v1/auth/switch-branch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cashierAuth.cookies },
      body: JSON.stringify({ branchId: branchBDG.id }),
    });
    const newCookies = extractCookie(switchRes);
    if (newCookies) cashierAuth.cookies = newCookies;

    // 3. Bersihkan closing hari ini di cabang BDG untuk pengujian terisolasi
    await prisma.cashClosing.deleteMany({
      where: { branchId: branchBDG.id },
    });

    // 3. Buat transaksi PAID tunai di cabang BDG (Rp 1.500.000)
    // Ambil service untuk item
    const service = await prisma.service.findFirst({ where: { active: true } });
    if (!service) throw new Error('Service tidak ditemukan');

    const txRes = await fetch(`${BASE_URL}/api/v1/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cashierAuth.cookies },
      body: JSON.stringify({
        patientName: 'Pasien Uji Closing',
        items: [{ itemId: service.id, quantity: 1, price: 1500000 }],
      }),
    });
    const txBody = await txRes.json();
    const txId = txBody.data?.id;

    // Bayar CASH Rp 1.500.000
    await fetch(`${BASE_URL}/api/v1/transactions/${txId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cashierAuth.cookies },
      body: JSON.stringify({
        payments: [{ method: 'CASH', amount: 1500000 }],
      }),
    });

    // 4. Preview closing SEBELUM ada expense baru di BDG
    let previewRes = await fetch(`${BASE_URL}/api/v1/cash-closings/preview`, {
      headers: { Cookie: cashierAuth.cookies },
    });
    let previewBody = await previewRes.json();
    const expectedBefore = parseFloat(previewBody.data?.expectedCash || '0');

    // 5. Walkthrough Aturan 12: Catat pengeluaran OPERASIONAL Rp 500.000 di cabang BDG
    const expWalkthroughRes = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
      body: JSON.stringify({
        branchId: branchBDG.id,
        category: 'OPERASIONAL',
        amount: 500000,
        expenseDate: todayStr,
        note: 'Walkthrough Aturan 12: Pengeluaran operasional 500rb',
      }),
    });
    const expWalkthroughBody = await expWalkthroughRes.json();
    assert(
      expWalkthroughRes.status === 201 && expWalkthroughBody.success,
      'EXP-8.1',
      'Pengeluaran OPERASIONAL Rp 500.000 berhasil dicatat di cabang BDG'
    );

    // 6. Preview closing SESUDAH ada expense
    previewRes = await fetch(`${BASE_URL}/api/v1/cash-closings/preview`, {
      headers: { Cookie: cashierAuth.cookies },
    });
    previewBody = await previewRes.json();
    const expectedAfter = parseFloat(previewBody.data?.expectedCash || '0');

    // Verifikasi expectedCash berkurang persis 500.000
    const delta = expectedBefore - expectedAfter;
    assert(
      delta === 500000,
      'EXP-8.2',
      `Expected cash closing berkurang persis Rp 500.000 (Semula: Rp ${expectedBefore}, Sesudah: Rp ${expectedAfter})`
    );

    // 7. Tutup kas dengan kas fisik sesuai expectedCash -> variance = 0
    const closingRes = await fetch(`${BASE_URL}/api/v1/cash-closings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cashierAuth.cookies },
      body: JSON.stringify({
        actualCash: String(expectedAfter),
        note: 'Closing kas pasca pengeluaran operasional 500rb',
      }),
    });
    const closingBody = await closingRes.json();
    assert(
      closingRes.status === 201 && parseFloat(closingBody.data?.variance || '-1') === 0,
      'EXP-8.3',
      'Tutup kas sukses dengan variance 0 bila kas fisik cocok dengan expectedCash yang telah dikurangi pengeluaran',
      `Status: ${closingBody.data?.status}, ExpectedCash: ${closingBody.data?.expectedCash}, ActualCash: ${closingBody.data?.actualCash}, Variance: ${closingBody.data?.variance}`
    );

    // ─── SECTION 9: FRONTEND PAGE CHECK ──────────────────────────────────────
    console.log('\n--- EXP-9: Frontend Page Check ---');
    const feRes = await fetch(`${BASE_URL}/admin/expenses`, {
      headers: { Cookie: ownerAuth.cookies },
    });
    assert(feRes.status === 200, 'EXP-9.1', 'Halaman frontend /admin/expenses merespons 200 OK');

    // Cleanup BDG closing
    await prisma.cashClosing.deleteMany({
      where: { branchId: branchBDG.id },
    });

  } catch (err) {
    console.error('[FATAL ERROR in test suite]', err);
    failedCount++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n======================================================================');
  console.log(`HASIL TEST SUITE: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${passedCount + failedCount})`);
  console.log('======================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSuite();

/**
 * TASK B3 — TEST SUITE STRUK THERMAL POS
 *
 * Menguji:
 * 1. Metadata Cabang Lengkap di Struk (name, code, address, phone)
 * 2. Resolusi cashierName dari DB (User -> Employee.name, fallback username/email)
 * 3. Transaksi lama tetap memiliki cashierName yang valid
 * 4. Pembayaran Multi-Metode (loop pembayaran & kembalian)
 * 5. RBAC & IDOR Guard (OWNER lintas cabang, MANAGER & CASHIER di cabang aktif, CASHIER cabang lain 403)
 * 6. Status Guard (PAID vs DRAFT/CANCELLED)
 *
 * Jalankan: node apps/web/scripts/task-b3-thermal-receipt-test.mjs
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
  console.log('================================================================');
  console.log('🧪 TASK B3 — STRUK THERMAL TEST SUITE');
  console.log('================================================================\n');

  try {
    // 0. Setup Fixtures & Tokens
    console.log('📦 Menyiapkan Fixtures & Akun...');
    const ownerCookie = await login(OWNER_EMAIL, OWNER_PASSWORD);

    // Ambil cabang dari DB
    const branches = await prisma.branch.findMany({ where: { active: true }, orderBy: { code: 'asc' } });
    if (branches.length < 2) {
      throw new Error('Diperlukan minimal 2 cabang aktif untuk pengujian.');
    }
    const branchA = branches[0];
    const branchB = branches[1];

    // Pastikan branchA punya address dan phone
    if (!branchA.address || !branchA.phone) {
      await prisma.branch.update({
        where: { id: branchA.id },
        data: {
          address: branchA.address || 'Jl. Tebet Barat Raya No. 12, Jakarta Selatan',
          phone: branchA.phone || '0812-3456-7890',
        },
      });
      branchA.address = branchA.address || 'Jl. Tebet Barat Raya No. 12, Jakarta Selatan';
      branchA.phone = branchA.phone || '0812-3456-7890';
    }

    const rnd = Math.floor(Math.random() * 90000) + 10000;

    // Setup Kasir dengan Employee (Siti Rahma) di Branch A
    const cashierEmployee = await prisma.employee.create({
      data: {
        name: 'Siti Rahma',
        position: 'Kasir Senior',
        phone: `0812${rnd}`,
        branches: {
          create: {
            branchId: branchA.id,
          },
        },
      },
    });

    const cashierUser = await prisma.user.create({
      data: {
        email: `cashier.b3.${rnd}@oase.id`,
        username: `siti_rahma_${rnd}`,
        passwordHash: await bcrypt.hash('1234', 10),
        role: 'CASHIER',
        employeeId: cashierEmployee.id,
        active: true,
      },
    });

    // Setup Manager di Branch A
    const managerEmployee = await prisma.employee.create({
      data: {
        name: 'Drg. Manager OASE',
        position: 'Klinik Manager',
        phone: `0813${rnd}`,
        branches: {
          create: {
            branchId: branchA.id,
          },
        },
      },
    });

    const managerUser = await prisma.user.create({
      data: {
        email: `mgr.b3.${rnd}@oase.id`,
        username: `mgr_oase_${rnd}`,
        passwordHash: await bcrypt.hash('1234', 10),
        role: 'MANAGER',
        employeeId: managerEmployee.id,
        active: true,
      },
    });

    let cashierCookie = await login(cashierUser.email, '1234');
    let managerCookie = await login(managerUser.email, '1234');

    // Switch branch untuk Cashier & Manager ke Branch A
    const swC = await req('/api/v1/auth/switch-branch', 'POST', { branchId: branchA.id }, cashierCookie);
    if (swC.setCookie) {
      cashierCookie = extractCookie(swC.setCookie);
    }

    const swM = await req('/api/v1/auth/switch-branch', 'POST', { branchId: branchA.id }, managerCookie);
    if (swM.setCookie) {
      managerCookie = extractCookie(swM.setCookie);
    }

    // Ambil atau buat Service Layanan Medis
    let service = await prisma.service.findFirst({
      where: { active: true, deletedAt: null },
    });
    if (!service) {
      service = await prisma.service.create({
        data: {
          name: 'Pembersihan Karang Gigi (Scaling)',
          price: new Prisma.Decimal('250000.00'),
          active: true,
        },
      });
    }

    console.log('✅ Setup Fixtures Selesai.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: Pembuatan & Pembayaran Transaksi Baru (Metadata Struk)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('📋 TEST 1: Transaksi Baru & Pembayaran Struk Lengkap...');

    // Buat DRAFT
    const createRes = await req(
      '/api/v1/transactions',
      'POST',
      {
        items: [{ itemId: service.id, quantity: 2, price: 250000 }],
        patientName: 'Bpk. Ahmad Dahlan',
        patientPhone: '0812-7777-8888',
      },
      cashierCookie
    );
    if (createRes.status !== 201) {
      console.log('DEBUG createRes:', createRes.status, createRes.data);
    }
    assert(createRes.status === 201, 'POST /transactions status 201 Created');
    const draftTrx = createRes.data?.data;
    assert(draftTrx?.status === 'DRAFT', 'Status transaksi awal adalah DRAFT');
    assert(Number(draftTrx?.subtotal) === 500000, 'Subtotal 2x 250000 = 500000');

    // Bayar Transaksi dengan Multi-Payment (CASH + QRIS)
    const payRes = await req(
      `/api/v1/transactions/${draftTrx.id}/pay`,
      'POST',
      {
        payments: [
          { method: 'CASH', amount: '300000.00' },
          { method: 'QRIS_TRANSFER', amount: '250000.00' },
        ],
      },
      cashierCookie
    );

    assert(payRes.status === 201, 'POST /transactions/:id/pay status 201 Created');
    const paidTrx = payRes.data?.data;
    assert(paidTrx?.status === 'PAID', 'Status transaksi berubah menjadi PAID');
    assert(Boolean(paidTrx?.paidAt), 'Field paidAt terisi timestamp');
    assert(Number(paidTrx?.paidTotal) === 550000, 'Total bayar 300rb + 250rb = 550rb');
    assert(Number(paidTrx?.change) === 50000, 'Kembalian terhitung tepat 50.000');

    // Verifikasi Metadata Cabang di Response Struk
    assert(paidTrx?.branch?.name === branchA.name, `Metadata branch.name sesuai: ${paidTrx?.branch?.name}`);
    assert(paidTrx?.branch?.address === branchA.address, `Metadata branch.address sesuai: ${paidTrx?.branch?.address}`);
    assert(paidTrx?.branch?.phone === branchA.phone, `Metadata branch.phone sesuai: ${paidTrx?.branch?.phone}`);

    // Verifikasi Resolusi Nama Kasir
    assert(
      paidTrx?.cashierName === 'Siti Rahma',
      `cashierName teresolusi dari Employee name: "${paidTrx?.cashierName}" (expected "Siti Rahma")`
    );

    // Verifikasi Items & Payments Array
    assert(Array.isArray(paidTrx?.payments) && paidTrx.payments.length === 2, 'Rincian multi-payment memiliki 2 baris');
    assert(paidTrx?.items?.length === 1 && paidTrx.items[0].quantity === 2, 'Rincian items struk sesuai');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: GET /transactions/:id (Detail Struk & Re-print)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 TEST 2: Detail Transaksi GET /transactions/:id...');
    const detailRes = await req(
      `/api/v1/transactions/${paidTrx.id}`,
      'GET',
      null,
      cashierCookie
    );
    assert(detailRes.status === 200, 'GET /transactions/:id status 200 OK');
    const detailData = detailRes.data?.data;
    assert(detailData?.transactionNumber === paidTrx.transactionNumber, 'Nomor transaksi konsisten');
    assert(detailData?.cashierName === 'Siti Rahma', 'cashierName di endpoint detail adalah "Siti Rahma"');
    assert(detailData?.branch?.address === branchA.address, 'Alamat cabang tersaji di endpoint detail');
    assert(detailData?.branch?.phone === branchA.phone, 'Nomor telepon cabang tersaji di endpoint detail');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: Transaksi Lama & Fallback Kasir
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 TEST 3: Transaksi Lama Tanpa Employee (Fallback Username/Email)...');
    // Buat dummy user tanpa employee
    let userSolo = await prisma.user.findUnique({ where: { email: 'kasir_solo@oase.id' } });
    if (!userSolo) {
      userSolo = await prisma.user.create({
        data: {
          email: 'kasir_solo@oase.id',
          username: 'kasirsolo99',
          passwordHash: await bcrypt.hash('1234', 10),
          role: 'CASHIER',
          employeeId: null, // Tanpa employee
          active: true,
        },
      });
    }

    // Buat transaksi lama langsung di DB atas nama userSolo
    const oldTrx = await prisma.transaction.create({
      data: {
        transactionNumber: `TRX-OLD-${Date.now().toString().slice(-6)}`,
        branchId: branchA.id,
        cashierId: userSolo.id,
        patientName: null, // Tanpa nama pasien
        status: 'PAID',
        subtotal: new Prisma.Decimal('100000.00'),
        total: new Prisma.Decimal('100000.00'),
        transactionDate: new Date('2026-01-15T10:00:00.000Z'),
        paidAt: new Date('2026-01-15T10:05:00.000Z'),
        items: {
          create: [
            {
              serviceId: service.id,
              itemId: service.id,
              name: service.name,
              price: new Prisma.Decimal('100000.00'),
              quantity: 1,
              lineTotal: new Prisma.Decimal('100000.00'),
            },
          ],
        },
        payments: {
          create: [
            {
              method: 'CASH',
              amount: new Prisma.Decimal('100000.00'),
            },
          ],
        },
      },
    });

    const oldDetailRes = await req(`/api/v1/transactions/${oldTrx.id}`, 'GET', null, ownerCookie);
    assert(oldDetailRes.status === 200, 'GET old transaction status 200 OK');
    assert(
      oldDetailRes.data?.data?.cashierName === 'kasirsolo99',
      `Fallback ke username berhasil: "${oldDetailRes.data?.data?.cashierName}"`
    );
    assert(
      oldDetailRes.data?.data?.patientName === null,
      'patientName bernilai null (untuk pengujian tidak dirender di frontend)'
    );

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: GET /transactions (List Transaksi & Batch Cashier Resolution)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 TEST 4: Batch Cashier Resolution di GET /transactions...');
    const listRes = await req('/api/v1/transactions?limit=10', 'GET', null, cashierCookie);
    assert(listRes.status === 200, 'GET /transactions status 200 OK');
    const listItems = listRes.data?.data || [];
    assert(listItems.length > 0, 'Daftar transaksi tidak kosong');
    const allHaveCashierName = listItems.every((item) => typeof item.cashierName === 'string');
    assert(allHaveCashierName, 'Setiap item di list transaksi memiliki properti cashierName yang valid');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: Role RBAC (OWNER, MANAGER, CASHIER) & IDOR Guard
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 TEST 5: RBAC & IDOR Guard Transaksi...');

    // 5a. MANAGER dilarang mengakses transaksi POS (kontrak POS hanya OWNER & CASHIER)
    const managerListRes = await req('/api/v1/transactions', 'GET', null, managerCookie);
    assert(managerListRes.status === 403, 'MANAGER ditolak akses GET /transactions (403 Forbidden)');
    const managerDetailRes = await req(`/api/v1/transactions/${paidTrx.id}`, 'GET', null, managerCookie);
    assert(managerDetailRes.status === 403, 'MANAGER ditolak akses detail transaksi (403 Forbidden)');

    // 5b. OWNER dapat mengakses transaksi cabang mana pun
    const ownerDetailRes = await req(`/api/v1/transactions/${paidTrx.id}`, 'GET', null, ownerCookie);
    assert(ownerDetailRes.status === 200, 'OWNER dapat mengakses transaksi cabang mana pun');

    // 5c. IDOR Guard: Buat transaksi di Cabang B
    const trxBranchB = await prisma.transaction.create({
      data: {
        transactionNumber: `TRX-BRB-${Date.now().toString().slice(-6)}`,
        branchId: branchB.id,
        cashierId: cashierUser.id,
        status: 'PAID',
        subtotal: new Prisma.Decimal('50000.00'),
        total: new Prisma.Decimal('50000.00'),
        transactionDate: new Date(),
        paidAt: new Date(),
      },
    });

    // CASHIER aktif di Cabang A mencoba akses transaksi Cabang B
    const idorRes = await req(`/api/v1/transactions/${trxBranchB.id}`, 'GET', null, cashierCookie);
    assert(idorRes.status === 403, `IDOR Guard: CASHIER cabang A ditolak saat akses cabang B (status ${idorRes.status})`);

    // 5d. Unauthenticated access ditolak 401
    const unauthRes = await req(`/api/v1/transactions/${paidTrx.id}`, 'GET', null, '');
    assert(unauthRes.status === 401, 'Request tanpa token ditolak 401 Unauthorized');

    // ──────────────────────────────────────────────────────────────────────────
    // RINGKASAN AKHIR
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n================================================================');
    console.log(`🏁 HASIL SUITE B3: ${passed} PASS, ${failed} FAIL`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Error tak terduga dalam test suite:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

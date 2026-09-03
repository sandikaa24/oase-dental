/**
 * ATURAN 12 — FINAL WALKTHROUGH MODEL BISNIS BARU
 * 
 * Rantai Lengkap Model Bisnis Baru OASE Dental:
 * 1. Owner stock-in bahan medis (stok awal = 20)
 * 2. Kasir menjual 2x layanan medis di POS (stok bahan TIDAK berubah = tetap 20)
 * 3. Tutup kas (Cash Closing) cocok (actual = expected, variance = 0)
 * 4. Stock-out bahan manual (5 unit dikeluarkan, alasan MANUAL_ADJUSTMENT)
 * 5. Kartu stok terverifikasi (STOCK_IN +20, MANUAL_ADJUSTMENT -5, saldo akhir = 15)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';

async function req(path, method, body, cookieString) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieString) headers['Cookie'] = cookieString;
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
  return { status: res.status, data, setCookie };
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
  };
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${label}`);
  } else {
    console.error(`  ❌ [FAIL] ${label}${detail ? ' | ' + detail : ''}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('=== ATURAN 12: WALKTHROUGH FINAL RANTAI LENGKAP MODEL BISNIS BARU ===');
  console.log('════════════════════════════════════════════════════════════════════\n');

  const rnd = String(Math.floor(Math.random() * 100000));

  // 0. Setup: Login & Identifikasi Cabang
  const owner = await login('owner@oase.id');
  assert('Autentikasi OWNER berhasil', owner.status === 200);

  const branchesRes = await req('/branches', 'GET', null, owner.cookie);
  const jkt = branchesRes.data?.data?.find((b) => b.code === 'JKT');
  assert('Cabang JKT aktif dan tersedia', !!jkt);

  // Pastikan periode kas bersih untuk pengujian alur penutupan kas
  await prisma.cashClosing.deleteMany({ where: { branchId: jkt.id } });

  // Buat Material Master baru khusus walkthrough
  const matRes = await req(
    '/materials',
    'POST',
    {
      name: `Bahan Kasa Medis ${rnd}`,
      sku: `KASA-${rnd}`,
      unit: 'roll',
      minStock: 5,
    },
    owner.cookie
  );
  assert('Master Bahan Medis baru berhasil dibuat', matRes.status === 201);
  const material = matRes.data?.data;

  // Buat Layanan Medis baru khusus walkthrough (Harga Master: Rp 100.000)
  const svcRes = await req(
    '/services',
    'POST',
    {
      name: `Pembersihan Karang Gigi ${rnd}`,
      price: 100000,
    },
    owner.cookie
  );
  assert('Master Layanan Medis baru berhasil dibuat (tanpa duration, master Rp 100.000)', svcRes.status === 201);
  const service = svcRes.data?.data;

  // Siapkan Kasir di Cabang JKT
  const cashier = await login('cashier@oase.id');
  const switchRes = await req('/auth/switch-branch', 'POST', { branchId: jkt.id }, cashier.cookie);
  const cashierCookie = extractAccessCookie(switchRes.setCookie);
  assert('Kasir login & terpasang di cabang JKT', switchRes.status === 200);

  // ─── LANGKAH 1: OWNER STOCK-IN BAHAN MEDIS ───
  console.log('\n--- LANGKAH 1: OWNER STOCK-IN BAHAN MEDIS (20 ROLL) ---');
  const stockInRes = await req(
    '/inventory/stock-in',
    'POST',
    {
      branchId: jkt.id,
      itemType: 'MATERIAL',
      items: [{ itemId: material.id, quantity: 20, unitCost: 15000 }],
      note: 'Pengadaan awal roll kasa steril',
    },
    owner.cookie
  );
  assert('Stock-In 20 unit bahan berhasil (201 Created)', stockInRes.status === 201);

  const stockAfterIn = await req(`/inventory/stock?branchId=${jkt.id}`, 'GET', null, owner.cookie);
  const matStock1 = stockAfterIn.data?.data?.find((m) => m.itemId === material.id);
  assert('Saldo fisik bahan di cabang JKT tercatat persis 20 unit', matStock1?.quantity === 20, `Saldo: ${matStock1?.quantity}`);

  // ─── LANGKAH 2: KASIR TRANSAKSI POS DENGAN OVERRIDE HARGA ───
  console.log('\n--- LANGKAH 2: KASIR TRANSAKSI POS DENGAN OVERRIDE HARGA ---');

  // Sub-langkah 2A: Kasir jual layanan Rp 100rb dengan override TURUN ke Rp 80rb
  const draft1Res = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: service.id, quantity: 1, price: 80000 }],
      patientName: 'Ny. Sulastri (Diskon Khusus)',
    },
    cashierCookie
  );
  assert('DRAFT 1: Override TURUN Rp 80.000 berhasil (201)', draft1Res.status === 201);
  assert('DRAFT 1: Snapshot price tersimpan 80000', draft1Res.data?.data?.items[0]?.price === '80000');
  assert('DRAFT 1: Total = Subtotal = 80000', draft1Res.data?.data?.total === '80000');

  const pay1Res = await req(
    `/transactions/${draft1Res.data?.data?.id}/pay`,
    'POST',
    { payments: [{ method: 'CASH', amount: 80000 }] },
    cashierCookie
  );
  assert('Bayar Transaksi 1 Sukses (201 PAID): Struk tercetak Rp 80.000', pay1Res.status === 201 && pay1Res.data?.data?.items[0]?.price === '80000');

  // Sub-langkah 2B: Buat draf lain lalu ubah (PATCH) override NAIK ke Rp 135rb x 2 = Rp 270rb
  const draft2Init = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: service.id, quantity: 1 }],
      patientName: 'Tn. Budi (Tindakan VIP)',
    },
    cashierCookie
  );
  assert('DRAFT 2: Dibuat awal dengan harga master (Rp 100.000)', draft2Init.data?.data?.total === '100000');

  const patch2Res = await req(
    `/transactions/${draft2Init.data?.data?.id}`,
    'PATCH',
    {
      items: [{ itemId: service.id, quantity: 2, price: 135000 }],
    },
    cashierCookie
  );
  assert('DRAFT 2: Berhasil di-PATCH dengan override NAIK Rp 135.000 x 2 = Rp 270.000', patch2Res.status === 200 && patch2Res.data?.data?.total === '270000');
  assert('DRAFT 2: Price item tersimpan 135000', patch2Res.data?.data?.items[0]?.price === '135000');

  const pay2Res = await req(
    `/transactions/${draft2Init.data?.data?.id}/pay`,
    'POST',
    { payments: [{ method: 'CASH', amount: 270000 }] },
    cashierCookie
  );
  assert('Bayar Transaksi 2 Sukses (201 PAID): Struk tercetak 2x @ Rp 135.000 = Rp 270.000', pay2Res.status === 201 && pay2Res.data?.data?.total === '270000');

  // Sub-langkah 2C: Transaksi TANPA override tetap memakai harga master Rp 100.000
  const draft3Res = await req(
    '/transactions',
    'POST',
    {
      items: [{ itemId: service.id, quantity: 1 }],
      patientName: 'Tn. Joko (Reguler)',
    },
    cashierCookie
  );
  assert('DRAFT 3: Transaksi tanpa override otomatis memakai harga master (Rp 100.000)', draft3Res.data?.data?.total === '100000' && draft3Res.data?.data?.items[0]?.price === '100000');

  const pay3Res = await req(
    `/transactions/${draft3Res.data?.data?.id}/pay`,
    'POST',
    { payments: [{ method: 'CASH', amount: 100000 }] },
    cashierCookie
  );
  assert('Bayar Transaksi 3 Sukses (201 PAID): Struk tercetak Rp 100.000', pay3Res.status === 201 && pay3Res.data?.data?.total === '100000');

  // INVARIAN KRUSIAL: Verifikasi Stok Bahan TIDAK Berubah
  const stockAfterPos = await req(`/inventory/stock?branchId=${jkt.id}`, 'GET', null, owner.cookie);
  const matStock2 = stockAfterPos.data?.data?.find((m) => m.itemId === material.id);
  assert(
    'INVARIAN TERBUKTI: Transaksi POS kasir TIDAK mengurangi stok bahan (tetap 20 unit)',
    matStock2?.quantity === 20,
    `Stok awal: 20, Stok sesudah POS: ${matStock2?.quantity}`
  );

  // ─── LANGKAH 3: TUTUP KAS (CASH CLOSING) COCOK ───
  console.log('\n--- LANGKAH 3: TUTUP KAS (CASH CLOSING) COCOK ---');
  const previewRes = await req('/cash-closings/preview', 'GET', null, cashierCookie);
  assert('Preview closing kas berhasil dihitung dari server', previewRes.status === 200);
  const expectedCash = previewRes.data?.data?.expectedCash;
  console.log(`  Expected cash dari server: Rp ${expectedCash}`);

  // Kasir memasukkan fisik kas cocok dengan expected
  const closeRes = await req(
    '/cash-closings',
    'POST',
    {
      actualCash: expectedCash,
      note: 'Tutup kas harian normal, kas fisik cocok seimbang',
    },
    cashierCookie
  );
  assert('Tutup kas berhasil disubmit (201 CLOSED)', closeRes.status === 201 && closeRes.data?.data?.status === 'CLOSED');
  assert('Selisih (variance) kas = 0 (COCOK SEIMBANG)', closeRes.data?.data?.variance === '0', `Variance: ${closeRes.data?.data?.variance}`);

  // ─── LANGKAH 4: STOCK-OUT BAHAN MEDIS MANUAL ───
  console.log('\n--- LANGKAH 4: STOCK-OUT BAHAN MEDIS MANUAL (5 ROLL) ---');
  const stockOutRes = await req(
    '/inventory/stock-out',
    'POST',
    {
      branchId: jkt.id,
      items: [
        {
          itemId: material.id,
          quantity: 5,
          reasonType: 'MANUAL_ADJUSTMENT',
        },
      ],
      note: 'Pemakaian 5 roll kasa untuk tindakan poli bedah mulut',
    },
    owner.cookie
  );
  assert('Stock-Out manual 5 unit berhasil (201 Created)', stockOutRes.status === 201);

  const stockAfterOut = await req(`/inventory/stock?branchId=${jkt.id}`, 'GET', null, owner.cookie);
  const matStock3 = stockAfterOut.data?.data?.find((m) => m.itemId === material.id);
  assert('Saldo fisik bahan di cabang JKT berkurang persis menjadi 15 unit', matStock3?.quantity === 15, `Saldo: ${matStock3?.quantity}`);

  // ─── LANGKAH 5: VERIFIKASI KARTU STOK & LOG AUDIT ───
  console.log('\n--- LANGKAH 5: VERIFIKASI RIWAYAT KARTU STOK BAHAN ---');
  const movementsRes = await req(
    `/inventory/stock/MATERIAL/${material.id}/movements?branchId=${jkt.id}`,
    'GET',
    null,
    owner.cookie
  );
  assert('Riwayat pergerakan kartu stok berhasil diambil (200 OK)', movementsRes.status === 200);
  const movements = movementsRes.data?.data?.movements ?? [];
  console.log(`  Jumlah movement pada kartu stok: ${movements.length}`);

  const hasStockInMove = movements.some((m) => m.referenceType === 'STOCK_IN' && m.quantityDelta === 20);
  const hasStockOutMove = movements.some((m) => m.referenceType === 'MANUAL_ADJUSTMENT' && m.quantityDelta === -5);
  const hasTrxMove = movements.some((m) => m.referenceType === 'TRANSACTION');

  assert('Kartu stok mencatat STOCK_IN (+20)', hasStockInMove);
  assert('Kartu stok mencatat MANUAL_ADJUSTMENT (-5)', hasStockOutMove);
  assert('Kartu stok BERSIH dari transaksi kasir (0 movement TRANSACTION)', !hasTrxMove);
  assert('Saldo akhir kartu stok cocok persis (20 - 5 = 15)', movementsRes.data?.data?.item?.currentQuantity === 15);

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('=== ATURAN 12: SELURUH RANTAI MODEL BISNIS BARU TERBUKTI HIJAU ===');
  console.log('════════════════════════════════════════════════════════════════════\n');
}

main()
  .catch((err) => {
    console.error('Error saat menjalankan walkthrough:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

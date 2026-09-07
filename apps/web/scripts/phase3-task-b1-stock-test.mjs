/**
 * TUGAS B1 — TEST SUITE: Manajemen Stok Berbasis Master Bahan Klinis (Single Source of Truth)
 *
 * Menguji:
 * 1. Autentikasi & Setup Role (OWNER, CASHIER, cabang)
 * 2. Guard Satu Pintu: POST /api/v1/products DITOLAK (403)
 * 3. Master Bahan Klinis — CRUD & Validasi Zod (category & costPrice)
 * 4. RBAC Master Bahan & Stok (CASHIER 403 untuk stok, 200 untuk katalog & POS)
 * 5. Query Stok per Cabang (Indikator Expired & Stok Rendah)
 * 6. Validasi Zod Mutasi Stok (qty <= 0, tipe mutasi tidak valid, format tanggal)
 * 7. Mutasi Stok IN, OUT (valid & over-limit 409 dengan available), ADJUSTMENT
 * 8. KEPUTUSAN KEDALUWARSA OWNER (Batch-level expiry):
 *    - Batch lewat kedaluwarsa terdeteksi 'EXPIRED'
 *    - Batch mendekati kedaluwarsa terdeteksi 'EXPIRING_SOON'
 *    - Item tanpa batch tidak menyebabkan error (status 'NORMAL')
 * 9. Anti-IDOR & Scoping Cabang Lintas Cabang (403)
 * 10. Riwayat Mutasi Stok (Audit & Filter)
 */

import fs from 'fs';

// Guard: Proteksi Lingkungan Database (AGENTS.md Aturan 16)
function getActiveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const file of ['apps/web/.env', '.env']) {
    if (fs.existsSync(file)) {
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) continue;
        const m = trimmed.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
        if (m) return m[1];
      }
    }
  }
  return '';
}
const activeDbUrl = getActiveDatabaseUrl();
if (/supabase|pooler\.|staging/i.test(activeDbUrl)) {
  console.error('\n❌ FATAL: Test suite DITOLAK! DATABASE_URL terdeteksi mengarah ke Supabase/Staging/Remote DB.');
  process.exit(1);
}

const BASE_URL = process.env.API_BASE ?? 'http://localhost:3000';
let passed = 0;
let failed = 0;

function check(desc, condition) {
  if (condition) {
    console.log(` ✅ PASS: ${desc}`);
    passed++;
  } else {
    console.error(` ❌ FAIL: ${desc}`);
    failed++;
  }
}

async function req(path, method = 'GET', body = null, cookie = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    let data = null;
    try {
      data = await res.json();
    } catch {
      // not json
    }
    return { status: res.status, data, setCookie };
  } catch (err) {
    return { status: 0, error: err.message };
  }
}

function extractCookies(setCookieHeader) {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(/,(?=\s*[^;]+=)/).map(c => c.split(';')[0].trim()).join('; ');
}

async function main() {
  console.log('======================================================================');
  console.log('SUITE TUGAS B1 — MANAJEMEN STOK SATU PINTU BAHAN KLINIS (BATCH EXPIRY)');
  console.log('======================================================================\n');

  // ─── 1. Autentikasi ──────────────────────────────────────────────────────────
  console.log('--- 1. Autentikasi & Inisialisasi Sesi ---');
  const rLoginOwner = await req('/api/v1/auth/login', 'POST', {
    identifier: 'owner',
    password: '1234',
  });
  check('1a. Login OWNER -> 200', rLoginOwner.status === 200 && rLoginOwner.data?.success);
  const ownerCookie = extractCookies(rLoginOwner.setCookie);

  const rLoginCashier = await req('/api/v1/auth/login', 'POST', {
    identifier: 'kasir.jkt@oase.id',
    password: '1234',
  });
  check('1b. Login CASHIER -> 200', rLoginCashier.status === 200 && rLoginCashier.data?.success);
  const cashierCookie = extractCookies(rLoginCashier.setCookie);

  // Ambil data cabang aktif
  const rBranches = await req('/api/v1/branches', 'GET', null, ownerCookie);
  const branches = rBranches.data?.data || rBranches.data || [];
  const branchJkt = branches.find(b => b.code === 'JKT') || branches[0];
  const branchBdg = branches.find(b => b.code === 'BDG') || branches[1] || branchJkt;
  check('1c. Minimal 1 cabang tersedia untuk pengujian', !!branchJkt && !!branchJkt.id);

  // ─── 2. Guard Satu Pintu & Master Bahan Klinis ────────────────────────────────
  console.log('\n--- 2. Guard Satu Pintu & Master Bahan Klinis ---');
  const uniqueSuffix = Date.now().toString().slice(-5);
  const matName1 = `Bahan Klinis Uji B1-${uniqueSuffix}`;
  const matSku1 = `MAT-B1-${uniqueSuffix}`;

  // 2a. Guard Satu Pintu: POST /api/v1/products DITOLAK
  const rGuardOldProduct = await req('/api/v1/products', 'POST', {
    name: matName1,
    unit: 'pcs',
    category: 'BHP',
  }, ownerCookie);
  check(
    '2a. Guard Satu Pintu: POST /api/v1/products DITOLAK -> 403 Forbidden',
    rGuardOldProduct.status === 403 && String(rGuardOldProduct.data?.message).includes('Master Data Bahan Klinis')
  );

  // 2b. Validasi Zod: Name kosong di /api/v1/materials ditolak
  const rValName = await req('/api/v1/materials', 'POST', {
    name: '',
    sku: matSku1,
    unit: 'pcs',
  }, ownerCookie);
  check('2b. Nama bahan kosong ditolak -> 400', rValName.status === 400 && rValName.data?.code === 'VALIDATION_ERROR');

  // 2c. Validasi Zod: CostPrice negatif di /api/v1/materials ditolak
  const rValCost = await req('/api/v1/materials', 'POST', {
    name: matName1,
    sku: matSku1,
    unit: 'pcs',
    costPrice: -10000,
  }, ownerCookie);
  check('2c. CostPrice negatif ditolak -> 400', rValCost.status === 400 && rValCost.data?.code === 'VALIDATION_ERROR');

  // 2d. Create Bahan Klinis Valid di Master Data
  const rCreate = await req('/api/v1/materials', 'POST', {
    name: matName1,
    sku: matSku1,
    unit: 'botol',
    category: 'Bahan Tindakan',
    costPrice: 25000,
    minStock: 10,
  }, ownerCookie);
  check('2d. Pembuatan bahan klinis di Master Data -> 201', rCreate.status === 201 && rCreate.data?.success);
  const createdMaterial = rCreate.data?.data;
  const materialId = createdMaterial?.id;

  // 2e. Duplikasi SKU bahan klinis ditolak -> 409
  const rDupSku = await req('/api/v1/materials', 'POST', {
    name: `${matName1} Dup`,
    sku: matSku1,
    unit: 'botol',
  }, ownerCookie);
  check('2e. Duplikasi SKU bahan klinis ditolak -> 409 DUPLICATE', rDupSku.status === 409);

  // 2f. List Bahan Klinis Master Data
  const rList = await req('/api/v1/materials?limit=10', 'GET', null, ownerCookie);
  check('2f. List bahan klinis berhasil -> 200 dengan pagination', rList.status === 200 && Array.isArray(rList.data?.data));

  // 2g. Get Detail Bahan Klinis
  const rDetail = await req(`/api/v1/materials/${materialId}`, 'GET', null, ownerCookie);
  check('2g. Detail bahan klinis by ID -> 200', rDetail.status === 200 && rDetail.data?.data?.id === materialId);

  // 2h. Update Bahan Klinis
  const rUpdate = await req(`/api/v1/materials/${materialId}`, 'PATCH', {
    unit: 'pack',
    costPrice: 27500,
  }, ownerCookie);
  check('2h. Update bahan klinis -> 200', rUpdate.status === 200 && rUpdate.data?.data?.unit === 'pack');

  // ─── 3. RBAC Master Bahan & Stok ─────────────────────────────────────────────
  console.log('\n--- 3. RBAC Master Bahan & Stok ---');
  // CASHIER dilarang membuat bahan klinis
  const rCashierCreate = await req('/api/v1/materials', 'POST', {
    name: `Cashier Item ${uniqueSuffix}`,
    sku: `CASH-${uniqueSuffix}`,
    unit: 'pcs',
  }, cashierCookie);
  check('3a. CASHIER tambah bahan klinis ditolak -> 403', rCashierCreate.status === 403);

  // CASHIER dilarang update bahan klinis
  const rCashierUpdate = await req(`/api/v1/materials/${materialId}`, 'PATCH', {
    unit: 'box',
  }, cashierCookie);
  check('3b. CASHIER update bahan klinis ditolak -> 403', rCashierUpdate.status === 403);

  // CASHIER dilarang melihat modul stok cabang
  const rCashierStock = await req('/api/v1/stock', 'GET', null, cashierCookie);
  check('3c. CASHIER akses modul stok cabang ditolak -> 403 Forbidden', rCashierStock.status === 403);

  // CASHIER dilarang melihat master bahan klinis (403 Forbidden)
  const rCashierMaterials = await req('/api/v1/materials', 'GET', null, cashierCookie);
  check('3d. CASHIER melihat master bahan ditolak -> 403 Forbidden', rCashierMaterials.status === 403);

  // Regresi POS: CASHIER tetap dapat melihat katalog penjualan via /api/v1/pos/catalog
  const rCashierPos = await req('/api/v1/pos/catalog', 'GET', null, cashierCookie);
  check('3e. Regresi POS: CASHIER tetap dapat mengakses /api/v1/pos/catalog -> 200', rCashierPos.status === 200 && Array.isArray(rCashierPos.data?.data));

  // ─── 4. Query Stok Cabang & Filter Indikator ──────────────────────────────────
  console.log('\n--- 4. Query Stok Cabang & Filter Indikator ---');
  // OWNER query stok cabang JKT
  const rStockJkt = await req(`/api/v1/stock?branchId=${branchJkt.id}`, 'GET', null, ownerCookie);
  check('4a. OWNER query stok cabang JKT -> 200', rStockJkt.status === 200 && Array.isArray(rStockJkt.data?.data?.stocks || rStockJkt.data?.data?.items));

  // Filter lowStock
  const rStockLow = await req(`/api/v1/stock?branchId=${branchJkt.id}&lowStock=true`, 'GET', null, ownerCookie);
  check('4b. Filter lowStock query -> 200', rStockLow.status === 200);

  // Filter expiredStatus
  const rStockExp = await req(`/api/v1/stock?branchId=${branchJkt.id}&expiredStatus=expSoon`, 'GET', null, ownerCookie);
  check('4c. Filter expiredStatus expSoon query -> 200', rStockExp.status === 200);

  // ─── 5. Validasi Zod Mutasi Stok ─────────────────────────────────────────────
  console.log('\n--- 5. Validasi Zod Mutasi Stok ---');
  // Qty = 0 ditolak
  const rMutZero = await req('/api/v1/stock/mutation', 'POST', {
    materialId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: 0,
  }, ownerCookie);
  check('5a. Mutasi qty = 0 ditolak -> 400', rMutZero.status === 400 && rMutZero.data?.code === 'VALIDATION_ERROR');

  // Qty negatif ditolak
  const rMutNeg = await req('/api/v1/stock/mutation', 'POST', {
    materialId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: -10,
  }, ownerCookie);
  check('5b. Mutasi qty negatif ditolak -> 400', rMutNeg.status === 400 && rMutNeg.data?.code === 'VALIDATION_ERROR');

  // Tipe mutasi salah ditolak
  const rMutType = await req('/api/v1/stock/mutation', 'POST', {
    materialId,
    branchId: branchJkt.id,
    type: 'TRANSFER',
    qty: 10,
  }, ownerCookie);
  check('5c. Tipe mutasi tidak valid ditolak -> 400', rMutType.status === 400 && rMutType.data?.code === 'VALIDATION_ERROR');

  // Format expiredDate salah ditolak
  const rMutExp = await req('/api/v1/stock/mutation', 'POST', {
    materialId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: 10,
    expiredDate: '12-05-2026',
  }, ownerCookie);
  check('5d. Format expiredDate bukan YYYY-MM-DD ditolak -> 400', rMutExp.status === 400 && rMutExp.data?.code === 'VALIDATION_ERROR');

  // ─── 6. Logika Mutasi Stok (IN, OUT, ADJUSTMENT) ─────────────────────────────
  console.log('\n--- 6. Logika Mutasi Stok & Pencatatan Batch ---');
  // 6a. Mutasi IN dengan batch kedaluwarsa
  const rMutIn = await req('/api/v1/stock/mutation', 'POST', {
    materialId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: 50,
    note: 'Pengadaan awal barang uji',
    batchNumber: `LOT-A-${uniqueSuffix}`,
    minStock: 10,
    expiredDate: '2027-06-30',
  }, ownerCookie);
  check('6a. Mutasi IN dengan batch -> 201 (qty bertambah ke 50)', rMutIn.status === 201 && rMutIn.data?.data?.stock?.quantity === 50);

  // 6b. Mutasi OUT Valid
  const rMutOutValid = await req('/api/v1/stock/mutation', 'POST', {
    materialId,
    branchId: branchJkt.id,
    type: 'OUT',
    qty: 15,
    note: 'Pemakaian di ruang tindakan',
  }, ownerCookie);
  check('6b. Mutasi OUT valid -> 201 (qty menjadi 35)', rMutOutValid.status === 201 && rMutOutValid.data?.data?.stock?.quantity === 35);

  // 6c. Mutasi OUT Melebihi Stok (Harus 409 dengan properti available)
  const rMutOutOver = await req('/api/v1/stock/mutation', 'POST', {
    materialId,
    branchId: branchJkt.id,
    type: 'OUT',
    qty: 100, // stok saat ini 35
    note: 'Mencoba ambil melebihi stok',
  }, ownerCookie);
  const is409 = rMutOutOver.status === 409;
  const hasAvailable = rMutOutOver.data?.available === 35;
  check('6c. Mutasi OUT melebihi stok ditolak -> 409 dengan body { available: 35 }', is409 && hasAvailable);

  // 6d. Mutasi ADJUSTMENT
  const rMutAdj = await req('/api/v1/stock/mutation', 'POST', {
    materialId,
    branchId: branchJkt.id,
    type: 'ADJUSTMENT',
    qty: 40,
    note: 'Hasil stock opname fisik',
  }, ownerCookie);
  const adjSuccess = rMutAdj.status === 201 && rMutAdj.data?.data?.stock?.quantity === 40;
  const movementRecorded = rMutAdj.data?.data?.movement?.qtyBefore === 35 && rMutAdj.data?.data?.movement?.qtyAfter === 40;
  check('6d. Mutasi ADJUSTMENT -> 201 (qtyAfter = 40, delta tercatat)', adjSuccess && movementRecorded);

  // ─── 7. Keputusan Kedaluwarsa Owner (Batch-Level Expiry) ──────────────────────
  console.log('\n--- 7. Keputusan Kedaluwarsa Owner (Batch-Level Expiry) ---');
  // Buat 3 item terpisah untuk membuktikan:
  // 1. Item dengan batch lewat -> muncul di kartu warning 'EXPIRED'
  // 2. Item dengan batch hampir lewat (< 30 hari) -> muncul di kartu warning 'EXPIRING_SOON'
  // 3. Item tanpa batch -> status 'NORMAL', tidak menyebabkan error apapun

  // 7a. Item dengan batch lewat kedaluwarsa
  const rMatExpired = await req('/api/v1/materials', 'POST', {
    name: `Item Batch Lewat ${uniqueSuffix}`,
    sku: `EXP-PAST-${uniqueSuffix}`,
    unit: 'vial',
    category: 'Bahan Tindakan',
  }, ownerCookie);
  const expPastId = rMatExpired.data?.data?.id;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 2);
  const pastDateStr = yesterday.toISOString().split('T')[0];

  await req('/api/v1/stock/mutation', 'POST', {
    materialId: expPastId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: 10,
    expiredDate: pastDateStr,
    batchNumber: 'LOT-EXPIRED',
  }, ownerCookie);

  // 7b. Item dengan batch mendekati kedaluwarsa (< 30 hari)
  const rMatExpSoon = await req('/api/v1/materials', 'POST', {
    name: `Item Batch Exp Soon ${uniqueSuffix}`,
    sku: `EXP-SOON-${uniqueSuffix}`,
    unit: 'ampul',
    category: 'Bahan Tindakan',
  }, ownerCookie);
  const expSoonId = rMatExpSoon.data?.data?.id;

  const soonDate = new Date();
  soonDate.setDate(soonDate.getDate() + 10);
  const soonDateStr = soonDate.toISOString().split('T')[0];

  await req('/api/v1/stock/mutation', 'POST', {
    materialId: expSoonId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: 20,
    expiredDate: soonDateStr,
    batchNumber: 'LOT-SOON',
  }, ownerCookie);

  // 7c. Item tanpa batch (barang tidak memiliki kedaluwarsa)
  const rMatNoBatch = await req('/api/v1/materials', 'POST', {
    name: `Item Tanpa Batch ${uniqueSuffix}`,
    sku: `NO-BATCH-${uniqueSuffix}`,
    unit: 'pcs',
    category: 'Alat Operasional',
  }, ownerCookie);
  const noBatchId = rMatNoBatch.data?.data?.id;

  await req('/api/v1/stock/mutation', 'POST', {
    materialId: noBatchId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: 5,
    // tanpa expiredDate
  }, ownerCookie);

  // Verifikasi query stok per cabang
  const rQueryStock = await req(`/api/v1/stock?branchId=${branchJkt.id}&limit=100`, 'GET', null, ownerCookie);
  const stockItems = rQueryStock.data?.data?.stocks || rQueryStock.data?.data?.items || [];

  const foundPast = stockItems.find(s => s.materialId === expPastId || s.productId === expPastId);
  const foundSoon = stockItems.find(s => s.materialId === expSoonId || s.productId === expSoonId);
  const foundNoBatch = stockItems.find(s => s.materialId === noBatchId || s.productId === noBatchId);

  check('7a. Item dengan batch lewat kedaluwarsa terdeteksi warning EXPIRED', foundPast?.expiredWarning === 'EXPIRED');
  check('7b. Item dengan batch < 30 hari terdeteksi warning EXPIRING_SOON', foundSoon?.expiredWarning === 'EXPIRING_SOON');
  check('7c. Item tanpa batch tidak error dan memiliki warning NORMAL', foundNoBatch?.expiredWarning === 'NORMAL' && foundNoBatch?.expiredDate === null);

  // ─── 8. Anti-IDOR & Hak Akses Mutasi Cabang ──────────────────────────────────
  console.log('\n--- 8. Anti-IDOR & Hak Akses Cabang ---');
  // CASHIER dilarang mutasi
  const rCashierMut = await req('/api/v1/stock/mutation', 'POST', {
    materialId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: 5,
  }, cashierCookie);
  check('8a. CASHIER melakukan mutasi ditolak -> 403 Forbidden', rCashierMut.status === 403);

  // Anti-IDOR lintas cabang
  if (branchBdg && branchBdg.id !== branchJkt.id) {
    const rIdorMut = await req('/api/v1/stock/mutation', 'POST', {
      materialId,
      branchId: branchBdg.id,
      type: 'IN',
      qty: 5,
    }, cashierCookie);
    check('8b. Mutasi lintas cabang selain assigned branch ditolak -> 403', rIdorMut.status === 403);
  } else {
    check('8b. (Skipped IDOR: Hanya 1 cabang)', true);
  }

  // ─── 9. Riwayat Mutasi Stok ──────────────────────────────────────────────────
  console.log('\n--- 9. Riwayat Mutasi Stok ---');
  const rMovements = await req(`/api/v1/stock/movements?materialId=${materialId}`, 'GET', null, ownerCookie);
  const movements = rMovements.data?.data?.movements || rMovements.data?.data || [];
  check('9a. Riwayat mutasi bahan klinis berhasil diambil -> 200', rMovements.status === 200 && movements.length >= 3);

  const rMovIn = await req(`/api/v1/stock/movements?materialId=${materialId}&type=IN`, 'GET', null, ownerCookie);
  const inMovements = rMovIn.data?.data?.movements || rMovIn.data?.data || [];
  check('9b. Filter riwayat type=IN -> 200 (semua tipe IN)', rMovIn.status === 200 && inMovements.every(m => m.type === 'IN'));

  const rCashierMov = await req(`/api/v1/stock/movements?materialId=${materialId}`, 'GET', null, cashierCookie);
  check('9c. CASHIER melihat riwayat mutasi ditolak -> 403 Forbidden', rCashierMov.status === 403);

  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log(`HASIL TEST SUITE TUGAS B1: ${passed} PASS, ${failed} FAIL (Total ${passed + failed})`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

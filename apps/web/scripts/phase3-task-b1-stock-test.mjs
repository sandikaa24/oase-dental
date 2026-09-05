/**
 * TUGAS B1 — TEST SUITE: Manajemen Stok Independen (Mutasi Manual)
 *
 * Menguji:
 * 1. Autentikasi & Setup Role (OWNER, CASHIER, cabang)
 * 2. CRUD Master Produk & Validasi Zod (termasuk costPrice)
 * 3. Keunikan Nama & Soft-Delete Produk
 * 4. RBAC Master Produk (CASHIER read-only, OWNER/MANAGER write)
 * 5. Query Stok per Cabang (Indikator Expired & Stok Rendah)
 * 6. Validasi Zod Mutasi Stok (qty <= 0, tipe mutasi tidak valid)
 * 7. Mutasi Stok IN, OUT (valid & over-limit 409 dengan properti available), ADJUSTMENT
 * 8. Anti-IDOR & Scoping Cabang Lintas Cabang (403)
 * 9. Riwayat Mutasi Stok (Audit & Filter)
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
  console.log('SUITE TUGAS B1 — MANAJEMEN STOK INDEPENDEN & MUTASI MANUAL');
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

  // ─── 2. Master Produk — CRUD & Validasi Zod ──────────────────────────────────
  console.log('\n--- 2. Master Produk — CRUD & Validasi Zod ---');
  const uniqueSuffix = Date.now().toString().slice(-5);
  const prodName1 = `Item Uji B1-${uniqueSuffix}`;
  const prodSku1 = `SKU-B1-${uniqueSuffix}`;

  // 2a. Validasi Zod: Name kosong ditolak
  const rVal1 = await req('/api/v1/products', 'POST', {
    name: '',
    unit: 'pcs',
    category: 'Umum',
  }, ownerCookie);
  check('2a. Nama produk kosong ditolak -> 400', rVal1.status === 400 && rVal1.data?.code === 'VALIDATION_ERROR');

  // 2b. Validasi Zod: CostPrice negatif ditolak
  const rVal2 = await req('/api/v1/products', 'POST', {
    name: prodName1,
    unit: 'pcs',
    category: 'Umum',
    costPrice: -5000,
  }, ownerCookie);
  check('2b. CostPrice negatif ditolak -> 400', rVal2.status === 400 && rVal2.data?.code === 'VALIDATION_ERROR');

  // 2c. Create Produk Valid
  const rCreate = await req('/api/v1/products', 'POST', {
    name: prodName1,
    sku: prodSku1,
    unit: 'botol',
    category: 'Bahan Medis',
    costPrice: 25000,
  }, ownerCookie);
  check('2c. Pembuatan produk dengan costPrice valid -> 201', rCreate.status === 201 && rCreate.data?.success);
  const createdProduct = rCreate.data?.data;
  const productId = createdProduct?.id;

  // 2d. Duplicate Product Name aktif ditolak
  const rDup = await req('/api/v1/products', 'POST', {
    name: prodName1,
    unit: 'botol',
    category: 'Bahan Medis',
  }, ownerCookie);
  check('2d. Duplikasi nama produk aktif ditolak -> 409', rDup.status === 409 && rDup.data?.code === 'DUPLICATE_PRODUCT_NAME');

  // 2e. List Products
  const rList = await req('/api/v1/products?limit=10', 'GET', null, ownerCookie);
  check('2e. List produk berhasil -> 200 dengan meta pagination', rList.status === 200 && Array.isArray(rList.data?.data) && !!rList.data?.meta);

  // 2f. Get Product Detail
  const rDetail = await req(`/api/v1/products/${productId}`, 'GET', null, ownerCookie);
  check('2f. Detail produk by ID -> 200', rDetail.status === 200 && rDetail.data?.data?.id === productId);

  // 2g. Update Product
  const rUpdate = await req(`/api/v1/products/${productId}`, 'PUT', {
    name: `${prodName1} Updated`,
    unit: 'pack',
    costPrice: 27500,
  }, ownerCookie);
  check('2g. Update produk -> 200', rUpdate.status === 200 && rUpdate.data?.data?.unit === 'pack');

  // 2h. Soft Delete Product
  const rDelete = await req(`/api/v1/products/${productId}`, 'DELETE', null, ownerCookie);
  check('2h. Soft delete produk -> 200 (isActive: false)', rDelete.status === 200 && rDelete.data?.data?.isActive === false);

  // Aktifkan kembali produk untuk pengujian mutasi stok berikutnya
  await req(`/api/v1/products/${productId}`, 'PUT', { isActive: true }, ownerCookie);

  // ─── 3. RBAC Master Produk ───────────────────────────────────────────────────
  console.log('\n--- 3. RBAC Master Produk ---');
  // CASHIER dilarang membuat produk
  const rCashierCreate = await req('/api/v1/products', 'POST', {
    name: `Cashier Item ${uniqueSuffix}`,
    unit: 'pcs',
    category: 'Umum',
  }, cashierCookie);
  check('3a. CASHIER tambah produk ditolak -> 403', rCashierCreate.status === 403);

  // CASHIER dilarang update produk
  const rCashierUpdate = await req(`/api/v1/products/${productId}`, 'PUT', {
    unit: 'box',
  }, cashierCookie);
  check('3b. CASHIER update produk ditolak -> 403', rCashierUpdate.status === 403);

  // CASHIER dilarang delete produk
  const rCashierDelete = await req(`/api/v1/products/${productId}`, 'DELETE', null, cashierCookie);
  check('3c. CASHIER delete produk ditolak -> 403', rCashierDelete.status === 403);

  // CASHIER boleh melihat produk (read-only)
  const rCashierList = await req('/api/v1/products', 'GET', null, cashierCookie);
  check('3d. CASHIER melihat list produk diizinkan -> 200', rCashierList.status === 200);

  // ─── 4. Query Stok Cabang & Indikator Expired / Stok Rendah ───────────────────
  console.log('\n--- 4. Query Stok Cabang & Indikator ---');
  // OWNER query stok cabang JKT
  const rStockJkt = await req(`/api/v1/stock?branchId=${branchJkt.id}`, 'GET', null, ownerCookie);
  check('4a. OWNER query stok cabang JKT -> 200', rStockJkt.status === 200 && Array.isArray(rStockJkt.data?.data?.items));

  // CASHIER query stok cabang
  const rCashierStock = await req('/api/v1/stock', 'GET', null, cashierCookie);
  check('4b. CASHIER query stok cabang -> 200', rCashierStock.status === 200);

  // Filter lowStock
  const rStockLow = await req(`/api/v1/stock?branchId=${branchJkt.id}&lowStock=true`, 'GET', null, ownerCookie);
  check('4c. Filter lowStock query -> 200', rStockLow.status === 200);

  // Filter expiredStatus
  const rStockExp = await req(`/api/v1/stock?branchId=${branchJkt.id}&expiredStatus=expSoon`, 'GET', null, ownerCookie);
  check('4d. Filter expiredStatus expSoon query -> 200', rStockExp.status === 200);

  // ─── 5. Validasi Zod Mutasi Stok ─────────────────────────────────────────────
  console.log('\n--- 5. Validasi Zod Mutasi Stok ---');
  // Qty = 0 ditolak
  const rMutZero = await req('/api/v1/stock/mutation', 'POST', {
    productId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: 0,
  }, ownerCookie);
  check('5a. Mutasi qty = 0 ditolak -> 400', rMutZero.status === 400 && rMutZero.data?.code === 'VALIDATION_ERROR');

  // Qty negatif ditolak
  const rMutNeg = await req('/api/v1/stock/mutation', 'POST', {
    productId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: -10,
  }, ownerCookie);
  check('5b. Mutasi qty negatif ditolak -> 400', rMutNeg.status === 400 && rMutNeg.data?.code === 'VALIDATION_ERROR');

  // Tipe mutasi salah ditolak
  const rMutType = await req('/api/v1/stock/mutation', 'POST', {
    productId,
    branchId: branchJkt.id,
    type: 'TRANSFER',
    qty: 10,
  }, ownerCookie);
  check('5c. Tipe mutasi tidak valid ditolak -> 400', rMutType.status === 400 && rMutType.data?.code === 'VALIDATION_ERROR');

  // Format expiredDate salah ditolak
  const rMutExp = await req('/api/v1/stock/mutation', 'POST', {
    productId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: 10,
    expiredDate: '12-05-2026',
  }, ownerCookie);
  check('5d. Format expiredDate bukan YYYY-MM-DD ditolak -> 400', rMutExp.status === 400 && rMutExp.data?.code === 'VALIDATION_ERROR');

  // ─── 6. Logika Mutasi Stok (IN, OUT, ADJUSTMENT) ─────────────────────────────
  console.log('\n--- 6. Logika Mutasi Stok (IN, OUT, ADJUSTMENT) ---');
  // 6a. Mutasi IN
  const rMutIn = await req('/api/v1/stock/mutation', 'POST', {
    productId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: 50,
    note: 'Pengadaan awal barang uji',
    minStock: 10,
    expiredDate: '2027-06-30',
  }, ownerCookie);
  check('6a. Mutasi IN -> 201 (qty bertambah ke 50)', rMutIn.status === 201 && rMutIn.data?.data?.stock?.quantity === 50);

  // 6b. Mutasi OUT Valid
  const rMutOutValid = await req('/api/v1/stock/mutation', 'POST', {
    productId,
    branchId: branchJkt.id,
    type: 'OUT',
    qty: 15,
    note: 'Pemakaian di ruang tindakan',
  }, ownerCookie);
  check('6b. Mutasi OUT valid -> 201 (qty menjadi 35)', rMutOutValid.status === 201 && rMutOutValid.data?.data?.stock?.quantity === 35);

  // 6c. Mutasi OUT Melebihi Stok (Harus 409 dengan response body berisi properti available)
  const rMutOutOver = await req('/api/v1/stock/mutation', 'POST', {
    productId,
    branchId: branchJkt.id,
    type: 'OUT',
    qty: 100, // stok saat ini 35
    note: 'Mencoba ambil melebihi stok',
  }, ownerCookie);
  const is409 = rMutOutOver.status === 409;
  const hasAvailable = rMutOutOver.data?.available === 35;
  check('6c. Mutasi OUT melebihi stok ditolak -> 409 dengan body { available: 35 }', is409 && hasAvailable);

  // 6d. Mutasi ADJUSTMENT (Menetapkan kuantitas akhir)
  const rMutAdj = await req('/api/v1/stock/mutation', 'POST', {
    productId,
    branchId: branchJkt.id,
    type: 'ADJUSTMENT',
    qty: 40, // Target final di-set ke 40
    note: 'Hasil stock opname fisik',
  }, ownerCookie);
  const adjSuccess = rMutAdj.status === 201 && rMutAdj.data?.data?.stock?.quantity === 40;
  const movementRecorded = rMutAdj.data?.data?.movement?.qtyBefore === 35 && rMutAdj.data?.data?.movement?.qtyAfter === 40;
  check('6d. Mutasi ADJUSTMENT -> 201 (qtyAfter = 40, delta tercatat)', adjSuccess && movementRecorded);

  // ─── 7. Anti-IDOR & Hak Akses Role pada Mutasi Stok ──────────────────────────
  console.log('\n--- 7. Anti-IDOR & Hak Akses Role ---');
  // 7a. CASHIER dilarang mutasi stok
  const rCashierMut = await req('/api/v1/stock/mutation', 'POST', {
    productId,
    branchId: branchJkt.id,
    type: 'IN',
    qty: 5,
  }, cashierCookie);
  check('7a. CASHIER melakukan mutasi ditolak -> 403 Forbidden', rCashierMut.status === 403);

  // 7b. Anti-IDOR: Mutasi cabang lain oleh role selain OWNER ditolak
  if (branchBdg && branchBdg.id !== branchJkt.id) {
    const rIdorMut = await req('/api/v1/stock/mutation', 'POST', {
      productId,
      branchId: branchBdg.id, // CASHIER JKT coba mutasi di BDG
      type: 'IN',
      qty: 5,
    }, cashierCookie);
    check('7b. Mutasi lintas cabang selain assigned branch ditolak -> 403', rIdorMut.status === 403);

    // CASHIER JKT coba query stok cabang BDG
    const rIdorQuery = await req(`/api/v1/stock?branchId=${branchBdg.id}`, 'GET', null, cashierCookie);
    check('7c. Query stok lintas cabang selain assigned branch ditolak -> 403', rIdorQuery.status === 403);
  } else {
    check('7b. (Skipped IDOR: Hanya 1 cabang tersedia)', true);
    check('7c. (Skipped IDOR query: Hanya 1 cabang tersedia)', true);
  }

  // ─── 8. Riwayat Mutasi Stok ──────────────────────────────────────────────────
  console.log('\n--- 8. Riwayat Mutasi Stok ---');
  // 8a. List riwayat mutasi
  const rMovements = await req(`/api/v1/stock/movements?productId=${productId}`, 'GET', null, ownerCookie);
  const movements = rMovements.data?.data || [];
  check('8a. Riwayat mutasi produk berhasil diambil -> 200', rMovements.status === 200 && movements.length >= 3);

  // 8b. Filter by type
  const rMovIn = await req(`/api/v1/stock/movements?productId=${productId}&type=IN`, 'GET', null, ownerCookie);
  const inMovements = rMovIn.data?.data || [];
  check('8b. Filter riwayat type=IN -> 200 (semua tipe IN)', rMovIn.status === 200 && inMovements.every(m => m.type === 'IN'));

  // 8c. CASHIER boleh melihat riwayat mutasi
  const rCashierMov = await req(`/api/v1/stock/movements?productId=${productId}`, 'GET', null, cashierCookie);
  check('8c. CASHIER dapat melihat riwayat mutasi -> 200', rCashierMov.status === 200);

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

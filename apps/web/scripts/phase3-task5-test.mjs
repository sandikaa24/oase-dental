/**
 * Test Suite Fase 3 Tugas 5: Frontend Master Data (Layanan, Produk, Bahan, Kategori)
 */

const BASE_URL = 'http://localhost:3000';

let passedCount = 0;
let failedCount = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    console.log(`[PASS] ${message}`);
    if (detail) console.log(`       ${detail}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${message}`);
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
  const body = await res.json();
  const cookies = extractCookie(res);
  return { status: res.status, body, cookies };
}

async function runSuite() {
  console.log('======================================================================');
  console.log('FASE 3 — TUGAS 5: TEST SUITE MASTER DATA (SERVICES, PRODUCTS, MATERIALS, CATEGORIES)');
  console.log('======================================================================\n');

  // 1. SETUP LOGIN & DYNAMIC USERS
  console.log('[SETUP] Login OWNER & setup akun dinamis (Manager & Cashier)...');
  const ownerAuth = await login('owner@oase.id', '1234');
  assert(ownerAuth.status === 200, 'Login OWNER berhasil');

  // Ambil daftar cabang
  const branchesRes = await fetch(`${BASE_URL}/api/v1/branches`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  const branchesBody = await branchesRes.json();
  const targetBranch = branchesBody.data?.[0];
  const branchId = targetBranch?.id;
  console.log(`  Target Cabang: ${targetBranch?.name} (${targetBranch?.code}) - ID: ${branchId}`);

  const rnd = Math.floor(Math.random() * 1000000);

  // Buat Manager dinamis dengan 1 branch
  const mgrEmpRes = await fetch(`${BASE_URL}/api/v1/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: `Manager MD ${rnd}`,
      position: 'Manager Cabang',
      phone: `0817${rnd}`,
      branchIds: [branchId],
    }),
  });
  const mgrEmpBody = await mgrEmpRes.json();
  const mgrEmpId = mgrEmpBody.data?.id;

  const mgrEmail = `mgr.md.${rnd}@oase.id`;
  await fetch(`${BASE_URL}/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      email: mgrEmail,
      password: 'Password123',
      role: 'MANAGER',
      employeeId: mgrEmpId,
    }),
  });

  const managerAuth = await login(mgrEmail, 'Password123');
  assert(managerAuth.status === 200, 'Login MANAGER berhasil', `Email: ${mgrEmail}`);

  // Buat Cashier dinamis dengan 1 branch
  const cashierEmpRes = await fetch(`${BASE_URL}/api/v1/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: `Kasir MD ${rnd}`,
      position: 'Kasir Cabang',
      phone: `0818${rnd}`,
      branchIds: [branchId],
    }),
  });
  const cashierEmpBody = await cashierEmpRes.json();
  const cashierEmpId = cashierEmpBody.data?.id;

  const cashierEmail = `kasir.md.${rnd}@oase.id`;
  await fetch(`${BASE_URL}/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      email: cashierEmail,
      password: 'Password123',
      role: 'CASHIER',
      employeeId: cashierEmpId,
    }),
  });

  const cashierAuth = await login(cashierEmail, 'Password123');
  assert(cashierAuth.status === 200, 'Login CASHIER berhasil', `Email: ${cashierEmail}`);

  // --- SECTION 1: MASTER KATEGORI ---
  console.log('\n--- MD-1: Master Kategori (CRUD & Unique Guard) ---');
  const catName = `Kategori Uji ${rnd}`;
  
  // 1. Create Kategori (OWNER)
  let res = await fetch(`${BASE_URL}/api/v1/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({ name: catName }),
  });
  let body = await res.json();
  assert(res.status === 201 && body.success, 'MD-1.1: OWNER berhasil membuat Kategori baru (201 Created)', `ID: ${body.data?.id}`);
  const catId = body.data?.id;

  // 2. Duplicate Category Name Guard (409 Conflict)
  res = await fetch(`${BASE_URL}/api/v1/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({ name: catName }),
  });
  body = await res.json();
  assert(res.status === 409 && body.code === 'DUPLICATE', 'MD-1.2: Pembuatan kategori dengan nama duplikat ditolak (409 DUPLICATE)');

  // 3. Update Kategori & Toggle Active
  res = await fetch(`${BASE_URL}/api/v1/categories/${catId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({ name: `${catName} Rev`, active: false }),
  });
  body = await res.json();
  assert(res.status === 200 && body.data?.active === false, 'MD-1.3: OWNER berhasil memperbarui nama & menonaktifkan kategori (200 OK)');

  // 4. MANAGER Permission Guard on Categories (Read-Only)
  res = await fetch(`${BASE_URL}/api/v1/categories`, {
    headers: { Cookie: managerAuth.cookies },
  });
  assert(res.status === 200, 'MD-1.4: MANAGER berhasil membaca daftar kategori (MASTER_DATA_READ - 200 OK)');

  res = await fetch(`${BASE_URL}/api/v1/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: managerAuth.cookies },
    body: JSON.stringify({ name: `Mgr Cat ${rnd}` }),
  });
  assert(res.status === 403, 'MD-1.5: MANAGER ditolak saat membuat kategori (403 FORBIDDEN)');

  // 5. CASHIER Permission Guard (No Write)
  res = await fetch(`${BASE_URL}/api/v1/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cashierAuth.cookies },
    body: JSON.stringify({ name: `Kasir Cat ${rnd}` }),
  });
  assert(res.status === 403, 'MD-1.6: CASHIER ditolak saat membuat kategori (403 FORBIDDEN)');

  // --- SECTION 2: MASTER LAYANAN (SERVICES) ---
  console.log('\n--- MD-2: Master Layanan (CRUD, Edit Match, & Soft/Hard Delete) ---');
  const serviceName = `Pembersihan Karang ${rnd}`;
  
  // 1. Create Unused Service (untuk uji hard delete)
  res = await fetch(`${BASE_URL}/api/v1/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: serviceName,
      nameEn: `Scaling Tooth ${rnd}`,
      categoryId: catId,
      price: 250000,
      description: 'Pembersihan karang gigi ultrasonik',
      showOnPortal: true,
      active: true,
    }),
  });
  body = await res.json();
  assert(res.status === 201 && body.success, 'MD-2.1: OWNER berhasil membuat Layanan Medis baru (201 Created)');
  const unusedServiceId = body.data?.id;

  // 2. Edit Layanan & Verify Match on GET
  const updatedPrice = 300000;
  res = await fetch(`${BASE_URL}/api/v1/services/${unusedServiceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      price: updatedPrice,
    }),
  });
  body = await res.json();
  assert(res.status === 200, 'MD-2.2: PATCH layanan berhasil disimpan (200 OK)');

  // GET ulang untuk verifikasi konsistensi data
  res = await fetch(`${BASE_URL}/api/v1/services/${unusedServiceId}`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  body = await res.json();
  const fetchedPrice = typeof body.data?.price === 'string' ? Math.round(Number(body.data.price)) : body.data?.price;
  assert(
    res.status === 200 && fetchedPrice === updatedPrice,
    'MD-2.3: Data hasil GET ulang persis cocok dengan field hasil PATCH',
    `Price: ${fetchedPrice}`
  );

  // PATCH tanpa perubahan -> 200 OK
  res = await fetch(`${BASE_URL}/api/v1/services/${unusedServiceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({}),
  });
  assert(res.status === 200, 'MD-2.4: PATCH layanan tanpa perubahan berhasil (200 OK)');

  // 3. Hard Delete pada Unused Service
  res = await fetch(`${BASE_URL}/api/v1/services/${unusedServiceId}`, {
    method: 'DELETE',
    headers: { Cookie: ownerAuth.cookies },
  });
  body = await res.json();
  assert(res.status === 200 && body.data?.mode === 'hard', 'MD-2.5: DELETE layanan yang belum dipakai menghasilkan mode: "hard" (Hard Delete)');

  // Verifikasi sudah tidak ada di GET
  res = await fetch(`${BASE_URL}/api/v1/services/${unusedServiceId}`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  assert(res.status === 404, 'MD-2.6: GET layanan yang telah di-hard delete mengembalikan 404 Not Found');

  // 4. Soft Delete pada Used Service (Layanan yang dipakai transaksi)
  const usedServiceName = `Layanan Ditransaksikan ${rnd}`;
  res = await fetch(`${BASE_URL}/api/v1/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: usedServiceName,
      price: 150000,
      active: true,
    }),
  });
  body = await res.json();
  const usedServiceId = body.data?.id;

  // Lakukan transaksi POS menggunakan layanan ini
  const txRes = await fetch(`${BASE_URL}/api/v1/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cashierAuth.cookies },
    body: JSON.stringify({
      items: [{ itemType: 'SERVICE', itemId: usedServiceId, quantity: 1 }],
    }),
  });
  const txBody = await txRes.json();
  const txId = txBody.data?.id;
  if (txId) {
    await fetch(`${BASE_URL}/api/v1/transactions/${txId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cashierAuth.cookies },
      body: JSON.stringify({
        payments: [{ method: 'CASH', amount: 150000 }],
      }),
    });
  }

  // Sekarang DELETE used service -> Harus Soft Delete
  res = await fetch(`${BASE_URL}/api/v1/services/${usedServiceId}`, {
    method: 'DELETE',
    headers: { Cookie: ownerAuth.cookies },
  });
  body = await res.json();
  assert(res.status === 200 && body.data?.mode === 'soft', 'MD-2.7: DELETE layanan yang pernah dipakai transaksi menghasilkan mode: "soft" (Soft Delete)');

  // 5. MANAGER & CASHIER Guard on Services
  res = await fetch(`${BASE_URL}/api/v1/services`, {
    headers: { Cookie: managerAuth.cookies },
  });
  assert(res.status === 200, 'MD-2.8: MANAGER berhasil membaca daftar layanan (MASTER_DATA_READ - 200 OK)');

  res = await fetch(`${BASE_URL}/api/v1/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: managerAuth.cookies },
    body: JSON.stringify({ name: `Mgr Svc ${rnd}`, price: 1000 }),
  });
  assert(res.status === 403, 'MD-2.9: MANAGER ditolak saat membuat layanan (403 FORBIDDEN)');

  res = await fetch(`${BASE_URL}/api/v1/services/${usedServiceId}`, {
    method: 'DELETE',
    headers: { Cookie: cashierAuth.cookies },
  });
  assert(res.status === 403, 'MD-2.10: CASHIER ditolak saat menghapus layanan (403 FORBIDDEN)');

  // --- SECTION 4: MASTER BAHAN KLINIS (MATERIALS) ---
  console.log('\n--- MD-4: Master Bahan Klinis (CRUD, SKU Unique, & Soft/Hard Delete) ---');
  const matSku = `SKU-MAT-${rnd}`;
  const matName = `Anestesi Lokal Lidocain ${rnd}`;

  // 1. Create Material
  res = await fetch(`${BASE_URL}/api/v1/materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: matName,
      sku: matSku,
      unit: 'ampul',
      minStock: 20,
      isStockTracked: true,
      active: true,
    }),
  });
  body = await res.json();
  assert(res.status === 201 && body.success, 'MD-4.1: OWNER berhasil membuat Bahan Klinis baru (201 Created)');
  const matId = body.data?.id;

  // 2. Duplicate SKU Guard (409 Conflict)
  res = await fetch(`${BASE_URL}/api/v1/materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: `Bahan Duplikat ${rnd}`,
      sku: matSku,
      unit: 'ampul',
    }),
  });
  body = await res.json();
  assert(res.status === 409 && body.code === 'DUPLICATE', 'MD-4.2: Pembuatan bahan dengan SKU duplikat ditolak (409 DUPLICATE)');

  // 3. Update Material & Verify Match on GET
  res = await fetch(`${BASE_URL}/api/v1/materials/${matId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      minStock: 25,
      isStockTracked: false,
    }),
  });
  assert(res.status === 200, 'MD-4.3: PATCH bahan klinis berhasil disimpan (200 OK)');

  res = await fetch(`${BASE_URL}/api/v1/materials/${matId}`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  body = await res.json();
  assert(
    res.status === 200 && body.data?.minStock === 25 && body.data?.isStockTracked === false,
    'MD-4.4: Data hasil GET ulang bahan persis cocok dengan field hasil PATCH'
  );

  // 4. Hard Delete pada Unused Material
  res = await fetch(`${BASE_URL}/api/v1/materials/${matId}`, {
    method: 'DELETE',
    headers: { Cookie: ownerAuth.cookies },
  });
  body = await res.json();
  assert(res.status === 200 && body.data?.mode === 'hard', 'MD-4.5: DELETE bahan klinis yang belum dipakai menghasilkan mode: "hard"');

  // 5. Soft Delete pada Used Material (Stock In)
  const usedMatSku = `SKU-USED-MAT-${rnd}`;
  res = await fetch(`${BASE_URL}/api/v1/materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: `Bahan Dipakai ${rnd}`,
      sku: usedMatSku,
      unit: 'box',
      minStock: 5,
    }),
  });
  body = await res.json();
  const usedMatId = body.data?.id;

  // Lakukan Stock-In bahan
  await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: managerAuth.cookies },
    body: JSON.stringify({
      itemType: 'MATERIAL',
      items: [{ itemId: usedMatId, quantity: 5, unitCost: 50000 }],
      note: 'Stock in bahan pengujian',
    }),
  });

  // Hapus used material -> mode: soft
  res = await fetch(`${BASE_URL}/api/v1/materials/${usedMatId}`, {
    method: 'DELETE',
    headers: { Cookie: ownerAuth.cookies },
  });
  body = await res.json();
  assert(res.status === 200 && body.data?.mode === 'soft', 'MD-4.6: DELETE bahan yang memiliki riwayat inventaris menghasilkan mode: "soft" (Soft Delete)');

  // 6. CASHIER Guard on Materials
  res = await fetch(`${BASE_URL}/api/v1/materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cashierAuth.cookies },
    body: JSON.stringify({ name: `Kasir Mat ${rnd}`, sku: `KSR-M-${rnd}`, unit: 'box' }),
  });
  assert(res.status === 403, 'MD-4.7: CASHIER ditolak saat membuat bahan (403 FORBIDDEN)');

  // --- SECTION 5: FRONTEND PAGE RESPONSES ---
  console.log('\n--- MD-5: Frontend Page Status Responses ---');
  res = await fetch(`${BASE_URL}/admin/master-data`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  assert(res.status === 200, 'MD-5.1: Halaman /admin/master-data merespons HTTP 200 untuk OWNER');

  res = await fetch(`${BASE_URL}/admin/master-data`, {
    headers: { Cookie: managerAuth.cookies },
  });
  assert(res.status === 200, 'MD-5.2: Halaman /admin/master-data merespons HTTP 200 untuk MANAGER (Read-Only)');

  // Unauthenticated access
  res = await fetch(`${BASE_URL}/admin/master-data`, {
    redirect: 'manual',
  });
  assert(res.status === 307 || res.status === 302, 'MD-5.3: Akses tanpa login diarahkan ke /login via redirect (307)');

  console.log('\n======================================================================');
  console.log(`HASIL TEST SUITE: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${passedCount + failedCount})`);
  console.log('======================================================================');
}

runSuite().catch((err) => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});

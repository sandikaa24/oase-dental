/**
 * Test Suite Fase 3 Tugas 4: Inventaris Frontend, Kartu Stok, Stock Opname, & Negative Stock Guard
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
  console.log('FASE 3 — TUGAS 4: TEST SUITE INVENTARIS, KARTU STOK & STOCK OPNAME');
  console.log('======================================================================\n');

  // 1. SETUP LOGIN
  console.log('[SETUP] Login akun penguji & setup akun operasional cabang...');
  const ownerAuth = await login('owner@oase.id', '1234');
  const baseCashierAuth = await login('cashier@oase.id', '1234');

  assert(ownerAuth.status === 200, 'Login OWNER berhasil');
  assert(baseCashierAuth.status === 200, 'Login CASHIER berhasil');

  // Ambil daftar cabang
  const branchesRes = await fetch(`${BASE_URL}/api/v1/branches`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  const branchesBody = await branchesRes.json();
  const targetBranch = branchesBody.data?.[0];
  const branchId = targetBranch?.id;
  console.log(`  Target Branch: ${targetBranch?.name} (${targetBranch?.code}) - ID: ${branchId}`);

  // Buat Manager & Cashier dinamis dengan 1 branch assignment untuk isolasi token otomatis
  const rnd = Math.floor(Math.random() * 1000000);
  const mgrEmpRes = await fetch(`${BASE_URL}/api/v1/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: `Manager Inv ${rnd}`,
      position: 'Manager Cabang',
      phone: `0815${rnd}`,
      branchIds: [branchId],
    }),
  });
  const mgrEmpBody = await mgrEmpRes.json();
  const mgrEmpId = mgrEmpBody.data?.id;

  const mgrEmail = `mgr.inv.${rnd}@oase.id`;
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

  const cashierEmpRes = await fetch(`${BASE_URL}/api/v1/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: `Kasir Inv ${rnd}`,
      position: 'Kasir Cabang',
      phone: `0816${rnd}`,
      branchIds: [branchId],
    }),
  });
  const cashierEmpBody = await cashierEmpRes.json();
  const cashierEmpId = cashierEmpBody.data?.id;

  const cashierEmail = `kasir.inv.${rnd}@oase.id`;
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

  const mgrLogin = await login(mgrEmail, 'Password123');
  assert(mgrLogin.status === 200, `Login MANAGER dynamic berhasil (${mgrEmail})`);
  const mgrCookies = mgrLogin.cookies;

  const cashierLogin = await login(cashierEmail, 'Password123');
  assert(cashierLogin.status === 200, `Login CASHIER dynamic berhasil (${cashierEmail})`);
  const cashierCookies = cashierLogin.cookies;

  // --- SECTION 1: INVENTORY STOCK LIST ---
  console.log('\n--- INV-1: Inventory Stock Listing & Filters ---');
  let res = await fetch(`${BASE_URL}/api/v1/inventory/stock?branchId=${branchId}`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  let body = await res.json();

  assert(res.status === 200 && body.success, 'INV-1.1: OWNER berhasil mengambil daftar stok (200 OK)', `Total item: ${body.meta?.total}`);
  const allStockItems = body.data || [];
  const testProduct = allStockItems.find((it) => it.itemType === 'PRODUCT');
  const testMaterial = allStockItems.find((it) => it.itemType === 'MATERIAL');

  // Filter itemType = PRODUCT
  res = await fetch(`${BASE_URL}/api/v1/inventory/stock?branchId=${branchId}&itemType=PRODUCT`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  body = await res.json();
  const allAreProducts = body.data?.every((it) => it.itemType === 'PRODUCT');
  assert(res.status === 200 && allAreProducts, 'INV-1.2: Filter itemType=PRODUCT hanya mengembalikan item produk');

  // MANAGER access stock list
  res = await fetch(`${BASE_URL}/api/v1/inventory/stock`, {
    headers: { Cookie: mgrCookies },
  });
  assert(res.status === 200, 'INV-1.3: MANAGER berhasil mengakses GET /inventory/stock pada cabang aktifnya');

  // CASHIER guard
  res = await fetch(`${BASE_URL}/api/v1/inventory/stock`, {
    headers: { Cookie: cashierCookies },
  });
  assert(res.status === 403, 'INV-1.4: CASHIER ditolak saat mengakses GET /inventory/stock (403 FORBIDDEN)');

  // --- SECTION 2: STOCK MOVEMENT DRAWER / KARTU STOK ---
  console.log('\n--- INV-2: Kartu Stok (Stock Movements) ---');
  if (testProduct) {
    res = await fetch(
      `${BASE_URL}/api/v1/inventory/stock/${testProduct.itemType.toLowerCase()}/${testProduct.itemId}/movements?branchId=${branchId}`,
      { headers: { Cookie: ownerAuth.cookies } }
    );
    body = await res.json();
    assert(res.status === 200 && body.success, 'INV-2.1: OWNER berhasil mengakses kartu stok per item', `Item: ${body.data?.item?.name}, Saldo: ${body.data?.item?.currentQuantity}`);
    assert(Array.isArray(body.data?.movements), 'INV-2.2: Response kartu stok memuat array pergerakan');
  }

  // CASHIER guard on movements
  if (testProduct) {
    res = await fetch(
      `${BASE_URL}/api/v1/inventory/stock/${testProduct.itemType.toLowerCase()}/${testProduct.itemId}/movements?branchId=${branchId}`,
      { headers: { Cookie: cashierCookies } }
    );
    assert(res.status === 403, 'INV-2.3: CASHIER ditolak saat mengakses kartu stok (403 FORBIDDEN)');
  }

  // --- SECTION 3: STOCK IN (BARANG MASUK) ---
  console.log('\n--- INV-3: Penerimaan Barang (Stock In) ---');
  if (testMaterial) {
    const stockInPayload = {
      itemType: 'MATERIAL',
      items: [{ itemId: testMaterial.itemId, quantity: 15, unitCost: 35000 }],
      note: 'Uji Penerimaan Supplier Test Suite',
    };

    res = await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: mgrCookies,
      },
      body: JSON.stringify(stockInPayload),
    });
    body = await res.json();
    assert(res.status === 201 && body.success, 'INV-3.1: MANAGER berhasil melakukan Stock In multi-item (201 Created)');

    // CASHIER guard on stock-in
    res = await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cashierCookies,
      },
      body: JSON.stringify(stockInPayload),
    });
    assert(res.status === 403, 'INV-3.2: CASHIER ditolak saat melakukan Stock In (403 FORBIDDEN)');
  }

  // --- SECTION 4: STOCK OPNAME LIFECYCLE ---
  console.log('\n--- INV-4: Stock Opname Lifecycle (Create -> Edit -> Submit) ---');
  const testDate = new Date(Date.now() + 86400000 * (1000 + Math.floor(Math.random() * 5000))).toISOString().split('T')[0];

  // 1. Create DRAFT
  res = await fetch(`${BASE_URL}/api/v1/stock-opnames`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: mgrCookies,
    },
    body: JSON.stringify({
      opnameDate: testDate,
      itemType: 'PRODUCT',
      note: 'Sesi Opname Uji Otomatis',
    }),
  });
  body = await res.json();
  assert(res.status === 201 && body.success, 'INV-4.1: MANAGER berhasil membuat DRAFT Stock Opname (201 Created)', `Opname ID: ${body.data?.id}, Status: ${body.data?.status}`);
  const opnameId = body.data?.id;

  // 2. Duplicate Opname Guard
  res = await fetch(`${BASE_URL}/api/v1/stock-opnames`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: mgrCookies,
    },
    body: JSON.stringify({
      opnameDate: testDate,
      itemType: 'PRODUCT',
    }),
  });
  assert(res.status === 409, 'INV-4.2: Pembuatan opname duplikat di tanggal dan cabang sama ditolak (409 Conflict)');

  // 3. Detail Opname
  res = await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameId}`, {
    headers: { Cookie: mgrCookies },
  });
  body = await res.json();
  assert(res.status === 200 && body.data?.status === 'DRAFT', 'INV-4.3: Detail Stock Opname memuat data items snapshot dengan status DRAFT');
  const opnameItems = body.data?.items || [];

  // 4. Edit DRAFT Opname (PATCH)
  if (opnameItems.length > 0) {
    const updatedPhysicalQty = (opnameItems[0].systemQty || 0) + 5;
    res = await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: mgrCookies,
      },
      body: JSON.stringify({
        items: [{ itemId: opnameItems[0].itemId, physicalQty: updatedPhysicalQty, note: 'Selisih surplus 5' }],
      }),
    });
    body = await res.json();
    const updatedItem = body.data?.items?.find((i) => i.itemId === opnameItems[0].itemId);
    assert(res.status === 200 && updatedItem?.physicalQty === updatedPhysicalQty, 'INV-4.4: PATCH Stock Opname berhasil memperbarui physicalQty & menghitung difference');
  }

  // 5. Submit Opname
  res = await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameId}/submit`, {
    method: 'POST',
    headers: { Cookie: mgrCookies },
  });
  body = await res.json();
  assert(res.status === 200 && body.data?.status === 'SUBMITTED', 'INV-4.5: Finalisasi Stock Opname berhasil (status menjadi SUBMITTED)');

  // 6. Immutable Guard after SUBMITTED
  if (opnameItems.length > 0) {
    res = await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: mgrCookies,
      },
      body: JSON.stringify({
        items: [{ itemId: opnameItems[0].itemId, physicalQty: 99 }],
      }),
    });
    assert(res.status === 409, 'INV-4.6: Edit dilarang pada Stock Opname berstatus SUBMITTED (409 Conflict)');
  }

  // 7. CASHIER Guard on Stock Opname
  res = await fetch(`${BASE_URL}/api/v1/stock-opnames`, {
    headers: { Cookie: cashierCookies },
  });
  assert(res.status === 403, 'INV-4.7: CASHIER ditolak saat mengakses GET /stock-opnames (403 FORBIDDEN)');

  // --- SECTION 5: OWNER MULTI-BRANCH OPERATIONS & IDOR PENJAGA ---
  console.log('\n--- INV-5: OWNER Multi-Branch Operations & Manager IDOR Guard ---');
  const secondBranch = branchesBody.data?.[1] || branchesBody.data?.[0];
  const secondBranchId = secondBranch?.id;

  // 1. OWNER stock list with explicit ?branchId
  res = await fetch(`${BASE_URL}/api/v1/inventory/stock?branchId=${secondBranchId}`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  body = await res.json();
  assert(res.status === 200 && body.success, 'INV-5.1: OWNER berhasil mengakses GET /inventory/stock dengan ?branchId eksplisit');

  // 2. OWNER stock-in with branchId in body
  if (testProduct) {
    res = await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
      body: JSON.stringify({
        branchId: branchId,
        itemType: 'PRODUCT',
        items: [{ itemId: testProduct.itemId, quantity: 5 }],
        note: 'Stock-in oleh OWNER dengan branchId eksplisit',
      }),
    });
    body = await res.json();
    assert(res.status === 201 && body.data?.branchId === branchId, 'INV-5.2: OWNER berhasil melakukan Stock In dengan menyertakan branchId di body (201 Created)');
  }

  // 3. OWNER movements with ?branchId
  if (testProduct) {
    res = await fetch(
      `${BASE_URL}/api/v1/inventory/stock/${testProduct.itemType.toLowerCase()}/${testProduct.itemId}/movements?branchId=${branchId}`,
      { headers: { Cookie: ownerAuth.cookies } }
    );
    body = await res.json();
    assert(res.status === 200 && body.success, 'INV-5.3: OWNER berhasil mengakses kartu stok pergerakan dengan ?branchId eksplisit (200 OK)');
  }

  // 4. OWNER create stock opname with branchId in body
  const ownerOpnameDate = new Date(Date.now() + 86400000 * (30000 + Math.floor(Math.random() * 5000))).toISOString().split('T')[0];
  res = await fetch(`${BASE_URL}/api/v1/stock-opnames`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      branchId: branchId,
      opnameDate: ownerOpnameDate,
      itemType: 'PRODUCT',
      note: 'DRAFT Opname oleh OWNER',
    }),
  });
  body = await res.json();
  assert(res.status === 201 && body.data?.branchId === branchId, 'INV-5.4: OWNER berhasil membuat DRAFT Stock Opname dengan menyertakan branchId di body (201 Created)');

  // 5. TEST PENJAGA IDOR: MANAGER cabang A mengirim branchId cabang B di body
  if (testMaterial && secondBranchId && secondBranchId !== branchId) {
    // MANAGER (assigned to branchId) mengirim secondBranchId di body stock-in
    res = await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        branchId: secondBranchId, // Upaya manipulasi IDOR cabang lain
        itemType: 'MATERIAL',
        items: [{ itemId: testMaterial.itemId, quantity: 2 }],
        note: 'Uji Penjaga IDOR Manager',
      }),
    });
    body = await res.json();
    // Server WAJIB mengabaikan input.branchId dan mencatat ke cabang JWT Manager (branchId)
    assert(
      res.status === 201 && body.data?.branchId === branchId,
      'INV-5.5: IDOR GUARD: Input branchId dari non-OWNER (MANAGER) diabaikan server dan tetap dipetakan ke branch JWT',
      `Target tersimpan: ${body.data?.branchId} (Cabang Manager), Input diabaikan: ${secondBranchId}`
    );
  }

  // --- SECTION 6: NEGATIVE STOCK SUBMIT REJECTION GUARD ---
  console.log('\n--- INV-6: Negative Stock Submit Rejection Guard ---');
  if (testProduct) {
    // 1. Setup stok awal 10 pcs
    await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        itemType: 'PRODUCT',
        items: [{ itemId: testProduct.itemId, quantity: 10 }],
        note: 'Setup Stock In untuk Uji Stok Negatif',
      }),
    });

    // Ambil saldo stok saat ini
    let stockCheck = await fetch(`${BASE_URL}/api/v1/inventory/stock?branchId=${branchId}&search=${encodeURIComponent(testProduct.name)}`, {
      headers: { Cookie: mgrCookies },
    });
    let stockJson = await stockCheck.json();
    let currentProd = stockJson.data?.find((i) => i.itemId === testProduct.itemId);
    const initialQty = currentProd?.quantity ?? 10;

    // 2. Buat DRAFT Opname A (snapshot mencatat systemQty = initialQty)
    const dateOpnameA = new Date(Date.now() + 86400000 * (10000 + Math.floor(Math.random() * 5000))).toISOString().split('T')[0];
    res = await fetch(`${BASE_URL}/api/v1/stock-opnames`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        opnameDate: dateOpnameA,
        itemType: 'PRODUCT',
        note: 'Sesi Opname A (Target Negatif)',
      }),
    });
    body = await res.json();
    const opnameAId = body.data?.id;
    assert(res.status === 201 && !!opnameAId, 'INV-6.1: Sesi DRAFT Opname A berhasil dibuat');

    // 3. Uji Validasi Schema: Nilai physicalQty negatif langsung ditolak 400 VALIDATION_ERROR
    res = await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        items: [{ itemId: testProduct.itemId, physicalQty: -5 }],
      }),
    });
    body = await res.json();
    assert(res.status === 400 && body.code === 'VALIDATION_ERROR', 'INV-6.2: PATCH dengan physicalQty negatif (-5) ditolak schema Zod (400 VALIDATION_ERROR)');

    // 4. Set Opname A physicalQty = (initialQty - 6) sehingga delta = -6
    res = await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        items: [{ itemId: testProduct.itemId, physicalQty: initialQty - 6, note: 'Defisit delta -6' }],
      }),
    });
    assert(res.status === 200, 'INV-6.3: PATCH Opname A dengan physicalQty valid berhasil disimpan');

    // 5. Buat & Submit Opname B pada tanggal lain yang mengurangi stok aktual DB menjadi 2
    const dateOpnameB = new Date(Date.now() + 86400000 * (20000 + Math.floor(Math.random() * 5000))).toISOString().split('T')[0];
    const opnameBRes = await fetch(`${BASE_URL}/api/v1/stock-opnames`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        opnameDate: dateOpnameB,
        itemType: 'PRODUCT',
        note: 'Sesi Opname B (Penurunan Saldo)',
      }),
    });
    const opnameBBody = await opnameBRes.json();
    const opnameBId = opnameBBody.data?.id;

    await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameBId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        items: [{ itemId: testProduct.itemId, physicalQty: 2 }],
      }),
    });

    await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameBId}/submit`, {
      method: 'POST',
      headers: { Cookie: mgrCookies },
    });

    // Verifikasi saldo aktual DB kini adalah 2
    stockCheck = await fetch(`${BASE_URL}/api/v1/inventory/stock?branchId=${branchId}&search=${encodeURIComponent(testProduct.name)}`, {
      headers: { Cookie: mgrCookies },
    });
    stockJson = await stockCheck.json();
    currentProd = stockJson.data?.find((i) => i.itemId === testProduct.itemId);
    assert(currentProd?.quantity === 2, 'INV-6.4: Saldo aktual di master terbukti telah berubah menjadi 2 unit');

    // 6. Sekarang submit Opname A: targetQty = currentStock (2) + delta (-6) = -4 < 0
    // WAJIB DITOLAK 409 INSUFFICIENT_STOCK
    res = await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameAId}/submit`, {
      method: 'POST',
      headers: { Cookie: mgrCookies },
    });
    body = await res.json();
    assert(
      res.status === 409 && body.code === 'INSUFFICIENT_STOCK',
      'INV-6.5: Finalisasi Opname A yang menghasilkan stok negatif DITOLAK server (409 INSUFFICIENT_STOCK)',
      `Response Code: ${body.code}, Pesan: "${body.message}"`
    );

    // 7. Verifikasi stok fisik TIDAK BERUBAH dan Opname A tetap DRAFT
    stockCheck = await fetch(`${BASE_URL}/api/v1/inventory/stock?branchId=${branchId}&search=${encodeURIComponent(testProduct.name)}`, {
      headers: { Cookie: mgrCookies },
    });
    stockJson = await stockCheck.json();
    currentProd = stockJson.data?.find((i) => i.itemId === testProduct.itemId);
    assert(
      currentProd?.quantity === 2,
      'INV-6.6: Saldo stok fisik produk di master/cabang terbukti tidak berubah (tetap 2 unit)',
      `Stok aktual: ${currentProd?.quantity}`
    );

    const opnameCheck = await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameAId}`, {
      headers: { Cookie: mgrCookies },
    });
    const opnameDetail = await opnameCheck.json();
    assert(opnameDetail.data?.status === 'DRAFT', 'INV-6.7: Sesi Stock Opname A tetap berstatus DRAFT (tidak terfinalisasi)');
  }

  // --- SECTION 6: FRONTEND PAGE RESPONSES ---
  console.log('\n--- INV-7: Frontend Page Status Responses ---');
  res = await fetch(`${BASE_URL}/admin/inventory`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  assert(res.status === 200, 'INV-7.1: Halaman /admin/inventory merespons HTTP 200');

  res = await fetch(`${BASE_URL}/admin/inventory/opname`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  assert(res.status === 200, 'INV-7.2: Halaman /admin/inventory/opname merespons HTTP 200');

  if (opnameId) {
    res = await fetch(`${BASE_URL}/admin/inventory/opname/${opnameId}`, {
      headers: { Cookie: ownerAuth.cookies },
    });
    assert(res.status === 200, 'INV-7.3: Halaman /admin/inventory/opname/:id merespons HTTP 200');
  }

  console.log('\n======================================================================');
  console.log(`HASIL TEST SUITE: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${passedCount + failedCount})`);
  console.log('======================================================================');
}

runSuite().catch((err) => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});

/**
 * TEST SUITE FASE 3 TUGAS 4: MANAJEMEN INVENTARIS & STOK BAHAN
 * 
 * Cakupan:
 * 1. GET /inventory/stock (List stok bahan, pencarian, filter lowStock, role guard)
 * 2. GET /inventory/stock/:itemType/:itemId/movements (Kartu stok riwayat mutasi)
 * 3. POST /inventory/stock-in (Penerimaan bahan multi-item, batch insert movements, audit log)
 * 4. POST /inventory/stock-out (Pengeluaran bahan 3 alasan, stok berkurang persis, 409 insufficient, IDOR guard, 403 cashier)
 * 5. POST /stock-opnames (Siklus opname: Draft -> Edit -> Submit)
 * 6. Negative Stock Submit Rejection Guard (Prinsip Stok Tidak Boleh Negatif)
 * 7. Frontend Pages HTTP 200 checks (/admin/inventory, /admin/inventory/opname)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

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
  console.log('FASE 3 — TUGAS 4: TEST SUITE INVENTARIS & STOK BAHAN MEDIS');
  console.log('======================================================================\n');

  // [SETUP]
  console.log('[SETUP] Autentikasi Pengguna...');
  const ownerAuth = await login('owner@oase.id', '1234');
  assert(ownerAuth.status === 200, 'Login OWNER berhasil');

  // Ambil cabang untuk pengujian
  const branchesRes = await fetch(`${BASE_URL}/api/v1/branches`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  const branchesBody = await branchesRes.json();
  const branchId = branchesBody.data?.[0]?.id;
  assert(!!branchId, 'Cabang pengujian tersedia', `Branch ID: ${branchId}`);

  // Setup user MANAGER & CASHIER dinamis untuk pengujian IDOR dan role guard
  const rnd = Math.floor(Math.random() * 900000) + 100000;
  const mgrEmpRes = await fetch(`${BASE_URL}/api/v1/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: `Manager Inv ${rnd}`,
      position: 'Manager Cabang',
      phone: `0817${rnd}`,
      branchIds: [branchId],
    }),
  });
  const mgrEmp = await mgrEmpRes.json();
  const mgrEmail = `mgr.inv.${rnd}@oase.id`;
  await fetch(`${BASE_URL}/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      email: mgrEmail,
      password: 'PasswordManager123',
      role: 'MANAGER',
      employeeId: mgrEmp.data?.id,
    }),
  });
  const mgrAuth = await login(mgrEmail, 'PasswordManager123');
  assert(mgrAuth.status === 200, 'Login MANAGER berhasil');
  const mgrCookies = mgrAuth.cookies;

  const cashierEmpRes = await fetch(`${BASE_URL}/api/v1/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: `Kasir Inv ${rnd}`,
      position: 'Kasir Cabang',
      phone: `0818${rnd}`,
      branchIds: [branchId],
    }),
  });
  const cashierEmp = await cashierEmpRes.json();
  const cashierEmail = `kasir.inv.${rnd}@oase.id`;
  await fetch(`${BASE_URL}/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      email: cashierEmail,
      password: 'PasswordKasir123',
      role: 'CASHIER',
      employeeId: cashierEmp.data?.id,
    }),
  });
  const cashierAuth = await login(cashierEmail, 'PasswordKasir123');
  assert(cashierAuth.status === 200, 'Login CASHIER berhasil');
  const cashierCookies = cashierAuth.cookies;

  // Setup / Ambil Master Bahan Medis
  const matListRes = await fetch(`${BASE_URL}/api/v1/materials`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  const matListJson = await matListRes.json();
  let testMaterialId = matListJson.data?.[0]?.id;

  if (!testMaterialId) {
    const createMatRes = await fetch(`${BASE_URL}/api/v1/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
      body: JSON.stringify({
        name: `Bahan Medis Uji ${rnd}`,
        sku: `SKU-MAT-${rnd}`,
        unit: 'box',
        minStock: 10,
        isStockTracked: true,
      }),
    });
    const createMatJson = await createMatRes.json();
    testMaterialId = createMatJson.data?.id;
  }

  // --- SECTION 1: DAFTAR STOK & FILTER ---
  console.log('\n--- INV-1: Daftar Saldo Stok Bahan ---');
  let res = await fetch(`${BASE_URL}/api/v1/inventory/stock?branchId=${branchId}`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  let body = await res.json();

  assert(res.status === 200 && body.success, 'INV-1.1: OWNER berhasil mengambil daftar stok bahan (200 OK)', `Total item: ${body.meta?.total}`);
  const allStockItems = body.data || [];
  const testMaterial = allStockItems.find((it) => it.itemId === testMaterialId) || allStockItems[0];

  // MANAGER access stock list
  res = await fetch(`${BASE_URL}/api/v1/inventory/stock`, {
    headers: { Cookie: mgrCookies },
  });
  assert(res.status === 200, 'INV-1.2: MANAGER berhasil mengakses GET /inventory/stock pada cabang aktifnya');

  // CASHIER guard
  res = await fetch(`${BASE_URL}/api/v1/inventory/stock`, {
    headers: { Cookie: cashierCookies },
  });
  assert(res.status === 403, 'INV-1.3: CASHIER ditolak saat mengakses GET /inventory/stock (403 FORBIDDEN)');

  // --- SECTION 2: STOCK MOVEMENT DRAWER / KARTU STOK ---
  console.log('\n--- INV-2: Kartu Stok (Stock Movements) ---');
  if (testMaterial) {
    res = await fetch(
      `${BASE_URL}/api/v1/inventory/stock/MATERIAL/${testMaterial.itemId}/movements?branchId=${branchId}`,
      { headers: { Cookie: ownerAuth.cookies } }
    );
    body = await res.json();
    assert(res.status === 200 && body.success, 'INV-2.1: OWNER berhasil mengakses kartu stok per item bahan', `Item: ${body.data?.item?.name}, Saldo: ${body.data?.item?.currentQuantity}`);
    assert(Array.isArray(body.data?.movements), 'INV-2.2: Response kartu stok memuat array pergerakan');

    // CASHIER guard on movements
    res = await fetch(
      `${BASE_URL}/api/v1/inventory/stock/MATERIAL/${testMaterial.itemId}/movements?branchId=${branchId}`,
      { headers: { Cookie: cashierCookies } }
    );
    assert(res.status === 403, 'INV-2.3: CASHIER ditolak saat mengakses kartu stok (403 FORBIDDEN)');
  }

  // --- SECTION 3: STOCK IN (BARANG MASUK) ---
  console.log('\n--- INV-3: Penerimaan Barang (Stock In) ---');
  if (testMaterial) {
    const stockInPayload = {
      itemType: 'MATERIAL',
      items: [{ itemId: testMaterial.itemId, quantity: 50, unitCost: 35000 }],
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
    assert(res.status === 201 && body.success, 'INV-3.1: MANAGER berhasil melakukan Stock In bahan medis (201 Created)');

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

  // --- SECTION 4: STOCK OUT (PENGELUARAN BARANG MANUAL) ---
  console.log('\n--- INV-SO: Pengeluaran Bahan Manual (Stock Out) ---');
  if (testMaterial) {
    // Ambil saldo sebelum Stock Out
    let stockBeforeRes = await fetch(`${BASE_URL}/api/v1/inventory/stock?branchId=${branchId}&search=${encodeURIComponent(testMaterial.name)}`, {
      headers: { Cookie: mgrCookies },
    });
    let stockBeforeJson = await stockBeforeRes.json();
    let matBefore = stockBeforeJson.data?.find((i) => i.itemId === testMaterial.itemId);
    const qtyBefore = matBefore?.quantity || 0;

    // 1. Stock Out dengan reasonType: MANUAL_ADJUSTMENT (Pemakaian)
    res = await fetch(`${BASE_URL}/api/v1/inventory/stock-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        items: [{ itemId: testMaterial.itemId, quantity: 5, reasonType: 'MANUAL_ADJUSTMENT' }],
        note: 'Pemakaian tindakan bedah mulut',
      }),
    });
    body = await res.json();
    assert(res.status === 201 && body.success, 'INV-SO.1: Stock Out MANUAL_ADJUSTMENT berhasil (201 Created)');

    // 2. Stock Out dengan reasonType: DAMAGE (Barang Rusak)
    res = await fetch(`${BASE_URL}/api/v1/inventory/stock-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        items: [{ itemId: testMaterial.itemId, quantity: 2, reasonType: 'DAMAGE' }],
        note: 'Ampul pecah saat penataan',
      }),
    });
    body = await res.json();
    assert(res.status === 201 && body.success, 'INV-SO.2: Stock Out DAMAGE berhasil (201 Created)');

    // 3. Stock Out dengan reasonType: EXPIRED (Kadaluwarsa)
    res = await fetch(`${BASE_URL}/api/v1/inventory/stock-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        items: [{ itemId: testMaterial.itemId, quantity: 3, reasonType: 'EXPIRED' }],
        note: 'Bahan melewati batas ED',
      }),
    });
    body = await res.json();
    assert(res.status === 201 && body.success, 'INV-SO.3: Stock Out EXPIRED berhasil (201 Created)');

    // 4. Verifikasi saldo berkurang persis: (5 + 2 + 3 = 10)
    let stockAfterRes = await fetch(`${BASE_URL}/api/v1/inventory/stock?branchId=${branchId}&search=${encodeURIComponent(testMaterial.name)}`, {
      headers: { Cookie: mgrCookies },
    });
    let stockAfterJson = await stockAfterRes.json();
    let matAfter = stockAfterJson.data?.find((i) => i.itemId === testMaterial.itemId);
    const qtyAfter = matAfter?.quantity || 0;
    assert(
      qtyAfter === qtyBefore - 10,
      'INV-SO.4: Saldo stok fisik bahan berkurang persis 10 unit',
      `Sebelum: ${qtyBefore}, Sesudah: ${qtyAfter}`
    );

    // 5. Verifikasi riwayat movement mencatat delta minus & referenceType benar
    res = await fetch(
      `${BASE_URL}/api/v1/inventory/stock/MATERIAL/${testMaterial.itemId}/movements?branchId=${branchId}&limit=5`,
      { headers: { Cookie: ownerAuth.cookies } }
    );
    body = await res.json();
    const latestMovements = body.data?.movements || [];
    const hasExpiredMovement = latestMovements.some(
      (m) => m.referenceType === 'EXPIRED' && m.quantityDelta === -3
    );
    const hasDamageMovement = latestMovements.some(
      (m) => m.referenceType === 'DAMAGE' && m.quantityDelta === -2
    );
    const hasAdjustmentMovement = latestMovements.some(
      (m) => m.referenceType === 'MANUAL_ADJUSTMENT' && m.quantityDelta === -5
    );
    assert(
      hasExpiredMovement && hasDamageMovement && hasAdjustmentMovement,
      'INV-SO.5: Movement tercatat dengan quantityDelta minus dan referenceType sesuai alasan stock-out'
    );

    // 6. Penolakan 409 INSUFFICIENT_STOCK bila kuantitas melebihi stok
    res = await fetch(`${BASE_URL}/api/v1/inventory/stock-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        items: [{ itemId: testMaterial.itemId, quantity: qtyAfter + 9999, reasonType: 'DAMAGE' }],
      }),
    });
    body = await res.json();
    assert(
      res.status === 409 && body.code === 'INSUFFICIENT_STOCK',
      'INV-SO.6: Stock Out melebihi ketersediaan fisik ditolak server (409 INSUFFICIENT_STOCK)'
    );

    // 7. IDOR Guard pada Stock Out
    const secondBranch = branchesBody.data?.[1] || branchesBody.data?.[0];
    const secondBranchId = secondBranch?.id;
    if (secondBranchId && secondBranchId !== branchId) {
      // MANAGER mengirim branchId cabang lain -> diabaikan, dipaksa ke cabang JWT
      res = await fetch(`${BASE_URL}/api/v1/inventory/stock-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
        body: JSON.stringify({
          branchId: secondBranchId,
          items: [{ itemId: testMaterial.itemId, quantity: 1, reasonType: 'MANUAL_ADJUSTMENT' }],
        }),
      });
      body = await res.json();
      assert(
        res.status === 201 && body.data?.branchId === branchId,
        'INV-SO.7: IDOR GUARD: input branchId dari MANAGER diabaikan dan terkunci ke cabang aktif JWT',
        `Tersimpan di: ${body.data?.branchId}, Request: ${secondBranchId}`
      );

      // OWNER mengirim branchId eksplisit -> sukses di branch target
      res = await fetch(`${BASE_URL}/api/v1/inventory/stock-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
        body: JSON.stringify({
          branchId: branchId,
          items: [{ itemId: testMaterial.itemId, quantity: 1, reasonType: 'MANUAL_ADJUSTMENT' }],
        }),
      });
      body = await res.json();
      assert(
        res.status === 201 && body.data?.branchId === branchId,
        'INV-SO.8: OWNER berhasil melakukan Stock Out dengan branchId eksplisit'
      );
    }

    // 8. CASHIER Guard on Stock Out
    res = await fetch(`${BASE_URL}/api/v1/inventory/stock-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cashierCookies },
      body: JSON.stringify({
        items: [{ itemId: testMaterial.itemId, quantity: 1, reasonType: 'MANUAL_ADJUSTMENT' }],
      }),
    });
    assert(res.status === 403, 'INV-SO.9: CASHIER ditolak saat mengakses POST /inventory/stock-out (403 FORBIDDEN)');
  }

  // --- SECTION 5: STOCK OPNAME LIFECYCLE ---
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
      itemType: 'MATERIAL',
      note: 'Sesi Opname Bahan Medis Uji Otomatis',
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
      itemType: 'MATERIAL',
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

  // --- SECTION 6: NEGATIVE STOCK SUBMIT REJECTION GUARD ---
  console.log('\n--- INV-6: Negative Stock Submit Rejection Guard ---');
  if (testMaterial) {
    // 1. Setup stok awal 10
    await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        itemType: 'MATERIAL',
        items: [{ itemId: testMaterial.itemId, quantity: 10 }],
        note: 'Setup Stock In untuk Uji Stok Negatif',
      }),
    });

    let stockCheck = await fetch(`${BASE_URL}/api/v1/inventory/stock?branchId=${branchId}&search=${encodeURIComponent(testMaterial.name)}`, {
      headers: { Cookie: mgrCookies },
    });
    let stockJson = await stockCheck.json();
    let currentMat = stockJson.data?.find((i) => i.itemId === testMaterial.itemId);
    const initialQty = currentMat?.quantity ?? 10;

    // 2. Buat DRAFT Opname A (snapshot mencatat systemQty = initialQty)
    const dateOpnameA = new Date(Date.now() + 86400000 * (10000 + Math.floor(Math.random() * 5000))).toISOString().split('T')[0];
    res = await fetch(`${BASE_URL}/api/v1/stock-opnames`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        opnameDate: dateOpnameA,
        itemType: 'MATERIAL',
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
        items: [{ itemId: testMaterial.itemId, physicalQty: -5 }],
      }),
    });
    body = await res.json();
    assert(res.status === 400 && body.code === 'VALIDATION_ERROR', 'INV-6.2: PATCH dengan physicalQty negatif (-5) ditolak schema Zod (400 VALIDATION_ERROR)');

    // 4. Set Opname A physicalQty = (initialQty - 6) sehingga delta = -6
    res = await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        items: [{ itemId: testMaterial.itemId, physicalQty: initialQty - 6, note: 'Defisit delta -6' }],
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
        itemType: 'MATERIAL',
        note: 'Sesi Opname B (Penurunan Saldo)',
      }),
    });
    const opnameBBody = await opnameBRes.json();
    const opnameBId = opnameBBody.data?.id;

    await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameBId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookies },
      body: JSON.stringify({
        items: [{ itemId: testMaterial.itemId, physicalQty: 2 }],
      }),
    });

    await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameBId}/submit`, {
      method: 'POST',
      headers: { Cookie: mgrCookies },
    });

    // Verifikasi saldo aktual DB kini adalah 2
    stockCheck = await fetch(`${BASE_URL}/api/v1/inventory/stock?branchId=${branchId}&search=${encodeURIComponent(testMaterial.name)}`, {
      headers: { Cookie: mgrCookies },
    });
    stockJson = await stockCheck.json();
    currentMat = stockJson.data?.find((i) => i.itemId === testMaterial.itemId);
    assert(currentMat?.quantity === 2, 'INV-6.4: Saldo aktual di master terbukti telah berubah menjadi 2 unit');

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
    stockCheck = await fetch(`${BASE_URL}/api/v1/inventory/stock?branchId=${branchId}&search=${encodeURIComponent(testMaterial.name)}`, {
      headers: { Cookie: mgrCookies },
    });
    stockJson = await stockCheck.json();
    currentMat = stockJson.data?.find((i) => i.itemId === testMaterial.itemId);
    assert(
      currentMat?.quantity === 2,
      'INV-6.6: Saldo stok fisik bahan di cabang terbukti tidak berubah (tetap 2 unit)',
      `Stok aktual: ${currentMat?.quantity}`
    );

    const opnameCheck = await fetch(`${BASE_URL}/api/v1/stock-opnames/${opnameAId}`, {
      headers: { Cookie: mgrCookies },
    });
    const opnameDetail = await opnameCheck.json();
    assert(opnameDetail.data?.status === 'DRAFT', 'INV-6.7: Sesi Stock Opname A tetap berstatus DRAFT (tidak terfinalisasi)');
  }

  // --- SECTION 7: FRONTEND PAGE RESPONSES ---
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

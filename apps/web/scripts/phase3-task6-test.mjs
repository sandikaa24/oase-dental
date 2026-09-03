/**
 * Test Suite Fase 3 Tugas 6: Manajemen Cabang + Pengguna & Karyawan
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
  console.log('FASE 3 — TUGAS 6: TEST SUITE BRANCHES, USERS & EMPLOYEES');
  console.log('======================================================================\n');

  // 1. SETUP LOGIN
  console.log('[SETUP] Login akun penguji (OWNER)...');
  const ownerAuth = await login('owner@oase.id', '1234');
  assert(ownerAuth.status === 200, 'Login OWNER berhasil');
  const ownerUserId = ownerAuth.body.data?.user?.id;

  const rnd = Math.floor(Math.random() * 1000000);

  // --- SECTION 1: MANAJEMEN CABANG (BRANCHES) ---
  console.log('\n--- BR-1: Manajemen Cabang (CRUD, Working Hours & Unique Code) ---');
  const branchCode = `CB${rnd.toString().slice(-4)}`;
  const branchName = `OASE Klinik Gigi — Cabang Uji ${rnd}`;

  // 1. Create Branch (OWNER)
  let res = await fetch(`${BASE_URL}/api/v1/branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      code: branchCode,
      name: branchName,
      address: 'Jl. Pemuda No. 123, Surabaya',
      phone: '08123456789',
    }),
  });
  let body = await res.json();
  assert(res.status === 201 && body.success, 'BR-1.1: OWNER berhasil membuat Cabang baru (201 Created)', `ID: ${body.data?.id}`);
  const branchId = body.data?.id;

  // 2. Duplicate Code Guard (409 Conflict)
  res = await fetch(`${BASE_URL}/api/v1/branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      code: branchCode,
      name: `${branchName} Duplikat`,
      address: 'Alamat lain',
    }),
  });
  body = await res.json();
  assert(res.status === 409 && body.code === 'DUPLICATE', 'BR-1.2: Pembuatan cabang dengan kode duplikat ditolak (409 DUPLICATE)');

  // 3. Update Branch Profil
  res = await fetch(`${BASE_URL}/api/v1/branches/${branchId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: `${branchName} (Updated)`,
      phone: '081999888777',
    }),
  });
  body = await res.json();
  assert(res.status === 200 && body.data?.phone === '081999888777', 'BR-1.3: OWNER berhasil memperbarui data cabang (200 OK)');

  // 4. Upsert Working Hours
  res = await fetch(`${BASE_URL}/api/v1/branches/${branchId}/working-hours`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      openTime: '08:30',
      closeTime: '21:30',
      lateAfter: '08:45',
    }),
  });
  body = await res.json();
  assert(
    res.status === 200 && body.data?.openTime === '08:30' && body.data?.lateAfter === '08:45',
    'BR-1.4: OWNER berhasil mengatur jam operasional cabang & toleransi terlambat (200 OK)'
  );

  // 5. Toggle Status Cabang
  res = await fetch(`${BASE_URL}/api/v1/branches/${branchId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({ active: false }),
  });
  body = await res.json();
  assert(res.status === 200 && body.data?.active === false, 'BR-1.5: OWNER berhasil menonaktifkan status cabang (200 OK)');

  // Aktifkan kembali untuk pengujian berikutnya
  await fetch(`${BASE_URL}/api/v1/branches/${branchId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({ active: true }),
  });

  // --- SECTION 2: MANAJEMEN KARYAWAN (EMPLOYEES) ---
  console.log('\n--- EMP-1: Manajemen Karyawan (CRUD & Multi-Branch Assignment) ---');
  const empName = `drg. Sarah Wijaya ${rnd}`;

  // 1. Create Employee (Multi-Branch)
  res = await fetch(`${BASE_URL}/api/v1/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: empName,
      position: 'Dokter Gigi Spesialis',
      phone: '081122334455',
      branchIds: [branchId],
    }),
  });
  body = await res.json();
  assert(res.status === 201 && body.success, 'EMP-1.1: OWNER berhasil membuat data Karyawan baru (201 Created)', `ID: ${body.data?.id}`);
  const employeeId = body.data?.id;

  // 2. Update Employee & Replace Branch Assignment
  res = await fetch(`${BASE_URL}/api/v1/employees/${employeeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      position: 'Kepala Dokter Gigi',
      phone: '081122339999',
    }),
  });
  body = await res.json();
  assert(res.status === 200 && body.data?.position === 'Kepala Dokter Gigi', 'EMP-1.2: OWNER berhasil mengupdate data karyawan (200 OK)');

  // 3. Toggle Status Karyawan
  res = await fetch(`${BASE_URL}/api/v1/employees/${employeeId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({ active: true }),
  });
  assert(res.status === 200, 'EMP-1.3: OWNER berhasil mengatur status aktif karyawan (200 OK)');

  // --- SECTION 3: MANAJEMEN PENGGUNA (USERS) & BUSINESS GUARDS ---
  console.log('\n--- USR-1: Manajemen User & Business Guards ---');
  const userEmail = `sarah.wijaya.${rnd}@oase.id`;
  const initialPassword = 'PasswordAwal123';

  // 1. Create User non-OWNER tanpa employeeId -> 400 VALIDATION_ERROR
  res = await fetch(`${BASE_URL}/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      email: `invalid.${rnd}@oase.id`,
      password: initialPassword,
      role: 'EMPLOYEE',
    }),
  });
  assert(res.status === 400, 'USR-1.1: Pembuatan user non-OWNER tanpa employeeId ditolak (400 VALIDATION_ERROR)');

  // 2. Create User valid dengan employeeId
  res = await fetch(`${BASE_URL}/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      email: userEmail,
      password: initialPassword,
      role: 'EMPLOYEE',
      employeeId,
    }),
  });
  body = await res.json();
  assert(res.status === 201 && body.success, 'USR-1.2: OWNER berhasil membuat akun Pengguna baru (201 Created)', `User ID: ${body.data?.id}`);
  const createdUserId = body.data?.id;

  // 3. Duplicate Email Guard -> 409 Conflict
  res = await fetch(`${BASE_URL}/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      email: userEmail,
      password: initialPassword,
      role: 'OWNER',
    }),
  });
  body = await res.json();
  assert(res.status === 409 && body.code === 'DUPLICATE', 'USR-1.3: Pembuatan akun dengan email duplikat ditolak (409 DUPLICATE)');

  // 4. Duplicate Employee Account Guard -> 409 Conflict (Karyawan sudah punya akun)
  res = await fetch(`${BASE_URL}/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      email: `another.${rnd}@oase.id`,
      password: initialPassword,
      role: 'EMPLOYEE',
      employeeId,
    }),
  });
  body = await res.json();
  assert(res.status === 409 && body.code === 'DUPLICATE', 'USR-1.4: Pembuatan akun untuk karyawan yang sudah berakun ditolak (409 DUPLICATE)');

  // 5. Guard Perubahan Role ke/dari OWNER -> 400 VALIDATION_ERROR
  res = await fetch(`${BASE_URL}/api/v1/users/${createdUserId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({ role: 'OWNER' }),
  });
  assert(res.status === 400, 'USR-1.5: Perubahan role menjadi OWNER ditolak (400 VALIDATION_ERROR)');

  // 6. Guard OWNER Self-Deactivation -> 400 VALIDATION_ERROR
  res = await fetch(`${BASE_URL}/api/v1/users/${ownerUserId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({ active: false }),
  });
  assert(res.status === 400, 'USR-1.6: OWNER mencoba menonaktifkan akun sendiri ditolak (400 VALIDATION_ERROR)');

  // --- SECTION 4: KEAMANAN & RESET PASSWORD ---
  console.log('\n--- SEC-1: Keamanan & Reset Password ---');
  
  // 1. Login user dengan password awal -> 200 OK
  let userAuth = await login(userEmail, initialPassword);
  assert(userAuth.status === 200, 'SEC-1.1: User baru berhasil login dengan password awal');

  // 2. OWNER Reset Password
  const newSecretPassword = 'PasswordBaru999!';
  res = await fetch(`${BASE_URL}/api/v1/users/${createdUserId}/reset-password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({ newPassword: newSecretPassword }),
  });
  body = await res.json();
  assert(res.status === 200 && body.success, 'SEC-1.2: OWNER berhasil mereset password akun user (200 OK)');
  assert(!('passwordHash' in body.data), 'SEC-1.3: Response reset password TIDAK mengekspos field passwordHash (Aman)');

  // 3. Login dengan password LAMA -> 401 UNAUTHORIZED
  const oldLoginRes = await login(userEmail, initialPassword);
  assert(oldLoginRes.status === 401, 'SEC-1.4: Login dengan password lama ditolak (401 UNAUTHORIZED)');

  // 4. Login dengan password BARU -> 200 OK
  const newLoginRes = await login(userEmail, newSecretPassword);
  assert(newLoginRes.status === 200, 'SEC-1.5: Login dengan password baru berhasil (200 OK)');

  // --- SECTION 5: E2E CABANG BARU DARI NOL ---
  console.log('\n--- E2E-1: Alur Lengkap Cabang Baru dari Nol (Penajaman #3) ---');
  const e2eCode = `E2E${rnd.toString().slice(-4)}`;
  const e2eName = `OASE Klinik Gigi — E2E Cabang ${rnd}`;

  // 1. Buat Cabang Baru
  res = await fetch(`${BASE_URL}/api/v1/branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      code: e2eCode,
      name: e2eName,
      address: 'Jl. Uji Komprehensif No. 88, Denpasar',
      phone: '081333444555',
    }),
  });
  body = await res.json();
  assert(res.status === 201, 'E2E-1.1: Pembuatan Cabang Baru berhasil (201 Created)');
  const e2eBranchId = body.data?.id;

  // 2. Setting Jam Kerja Cabang Baru
  res = await fetch(`${BASE_URL}/api/v1/branches/${e2eBranchId}/working-hours`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      openTime: '08:00',
      closeTime: '20:00',
      lateAfter: '08:15',
    }),
  });
  assert(res.status === 200, 'E2E-1.2: Pengaturan Jam Kerja Cabang Baru berhasil (200 OK)');

  // 3. Buat Karyawan Ditugaskan di Cabang Baru
  const e2eEmpRes = await fetch(`${BASE_URL}/api/v1/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      name: `Budi Kasir E2E ${rnd}`,
      position: 'Kasir Cabang',
      branchIds: [e2eBranchId],
    }),
  });
  const e2eEmpBody = await e2eEmpRes.json();
  const e2eEmpId = e2eEmpBody.data?.id;
  assert(e2eEmpRes.status === 201, 'E2E-1.3: Pembuatan Karyawan di Cabang Baru berhasil');

  // 4. Buat Akun User CASHIER untuk Karyawan Tersebut
  const e2eCashierEmail = `kasir.e2e.${rnd}@oase.id`;
  res = await fetch(`${BASE_URL}/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
    body: JSON.stringify({
      email: e2eCashierEmail,
      password: 'PasswordKasir123',
      role: 'CASHIER',
      employeeId: e2eEmpId,
    }),
  });
  assert(res.status === 201, 'E2E-1.4: Pembuatan Akun User CASHIER berhasil');

  // 5. Login Kasir Baru -> activeBranchId otomatis = e2eBranchId
  const e2eCashierAuth = await login(e2eCashierEmail, 'PasswordKasir123');
  assert(
    e2eCashierAuth.status === 200 && e2eCashierAuth.body.data?.user?.activeBranchId === e2eBranchId,
    'E2E-1.5: Login Kasir baru berhasil dan activeBranchId otomatis terpasang ke cabang baru',
    `ActiveBranchId: ${e2eCashierAuth.body.data?.user?.activeBranchId}`
  );

  // 6. OWNER Melakukan Stock-In Bahan di Cabang Baru via branchId eksplisit
  const matRes = await fetch(`${BASE_URL}/api/v1/materials`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  const matBody = await matRes.json();
  const targetMatId = matBody.data?.[0]?.id;

  if (targetMatId) {
    res = await fetch(`${BASE_URL}/api/v1/inventory/stock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerAuth.cookies },
      body: JSON.stringify({
        branchId: e2eBranchId,
        itemType: 'MATERIAL',
        items: [{ itemId: targetMatId, quantity: 20, unitCost: 15000 }],
        note: 'Stok awal bahan di cabang baru',
      }),
    });
    body = await res.json();
    assert(res.status === 201 && body.success, 'E2E-1.6: OWNER berhasil melakukan Stock-In bahan di cabang baru (201 Created)');
  }

  // --- SECTION 6: ROLE GUARDING & PAGE RESPONSES ---
  console.log('\n--- GUARD-1: Role Guarding & Page Responses ---');
  
  // 1. CASHIER ditolak akses GET & POST /branches
  res = await fetch(`${BASE_URL}/api/v1/branches`, {
    headers: { Cookie: e2eCashierAuth.cookies },
  });
  assert(res.status === 403, 'GUARD-1.1: CASHIER ditolak saat mengakses GET /branches (403 FORBIDDEN)');

  res = await fetch(`${BASE_URL}/api/v1/branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: e2eCashierAuth.cookies },
    body: JSON.stringify({ code: 'HACK', name: 'Hack Branch', address: 'Hack' }),
  });
  assert(res.status === 403, 'GUARD-1.2: CASHIER ditolak saat POST /branches (403 FORBIDDEN)');

  // 2. CASHIER ditolak akses GET & POST /users
  res = await fetch(`${BASE_URL}/api/v1/users`, {
    headers: { Cookie: e2eCashierAuth.cookies },
  });
  assert(res.status === 403, 'GUARD-1.3: CASHIER ditolak saat mengakses GET /users (403 FORBIDDEN)');

  res = await fetch(`${BASE_URL}/api/v1/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: e2eCashierAuth.cookies },
    body: JSON.stringify({ email: 'hack@oase.id', password: 'password', role: 'OWNER' }),
  });
  assert(res.status === 403, 'GUARD-1.4: CASHIER ditolak saat POST /users (403 FORBIDDEN)');

  // 3. Page Responses
  res = await fetch(`${BASE_URL}/admin/branches`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  assert(res.status === 200, 'GUARD-1.5: Halaman /admin/branches merespons HTTP 200 untuk OWNER');

  res = await fetch(`${BASE_URL}/admin/branches`, {
    headers: { Cookie: e2eCashierAuth.cookies },
  });
  assert(res.status === 200, 'GUARD-1.6: Halaman /admin/branches merespons HTTP 200 untuk CASHIER (tampilan Akses Ditolak)');

  res = await fetch(`${BASE_URL}/admin/users`, {
    headers: { Cookie: ownerAuth.cookies },
  });
  assert(res.status === 200, 'GUARD-1.7: Halaman /admin/users merespons HTTP 200 untuk OWNER');

  res = await fetch(`${BASE_URL}/admin/users`, {
    headers: { Cookie: e2eCashierAuth.cookies },
  });
  assert(res.status === 200, 'GUARD-1.8: Halaman /admin/users merespons HTTP 200 untuk CASHIER (tampilan Akses Ditolak)');

  console.log('\n======================================================================');
  console.log(`HASIL TEST SUITE: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${passedCount + failedCount})`);
  console.log('======================================================================');
}

runSuite().catch((err) => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});

/**
 * TUGAS 13.2 — TEST SUITE: Login Username/Email + Password Policy Role-Based
 *
 * Menguji:
 * 1. Login via username ("owner") & email ("owner@oase.id") case-insensitive
 * 2. Akun existing tanpa username tetap bisa login via email
 * 3. Normalisasi lowercase & duplicate username rejection (409 Conflict: "budi" vs "BUDI")
 * 4. Password policy role-based saat Create User:
 *    - CASHIER / EMPLOYEE: min 6 char (6 pass, 5 fail)
 *    - MANAGER: min 8 char (8 pass, 7 fail)
 *    - OWNER: min 12 char (12 pass, 11 fail)
 * 5. Password policy role-based saat Reset Password:
 *    - Target CASHIER: min 6 (6 pass, 5 fail)
 *    - Target MANAGER: min 8 (8 pass, 7 fail)
 *    - Target OWNER: min 12 (12 pass, 11 fail)
 * 6. Login kasir baru via username -> sukses masuk
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
  console.log('SUITE TUGAS 13.2 — LOGIN USERNAME/EMAIL + ROLE-BASED PASSWORD POLICY');
  console.log('======================================================================\n');

  // ─── 1. Login via Username vs Email (Case-Insensitive) ────────────────────────
  console.log('--- 1. Pengujian Autentikasi Login (Username vs Email) ---');

  // 1a. Login OWNER via username lowercase
  const rOwnerUser = await req('/api/v1/auth/login', 'POST', {
    identifier: 'owner',
    password: '1234',
  });
  check('1a. Login OWNER via username "owner" -> 200', rOwnerUser.status === 200 && rOwnerUser.data?.success);
  const ownerCookie = extractCookies(rOwnerUser.setCookie);

  // 1b. Login OWNER via username uppercase
  const rOwnerUpper = await req('/api/v1/auth/login', 'POST', {
    identifier: 'OWNER',
    password: '1234',
  });
  check('1b. Login OWNER via username uppercase "OWNER" -> 200', rOwnerUpper.status === 200 && rOwnerUpper.data?.success);

  // 1c. Login OWNER via email lowercase
  const rOwnerEmail = await req('/api/v1/auth/login', 'POST', {
    email: 'owner@oase.id',
    password: '1234',
  });
  check('1c. Login OWNER via email "owner@oase.id" -> 200', rOwnerEmail.status === 200 && rOwnerEmail.data?.success);

  // 1d. Login OWNER via email uppercase
  const rOwnerEmailUpper = await req('/api/v1/auth/login', 'POST', {
    identifier: 'OWNER@OASE.ID',
    password: '1234',
  });
  check('1d. Login OWNER via email uppercase "OWNER@OASE.ID" -> 200', rOwnerEmailUpper.status === 200 && rOwnerEmailUpper.data?.success);

  // ─── 2. Akun Existing Tanpa Username Tetap Bisa Login via Email ──────────────
  console.log('\n--- 2. Pengujian Akun Existing Tanpa Username ---');
  // cashier@oase.id dari seed awalnya tidak memiliki username
  const rCashierSeed = await req('/api/v1/auth/login', 'POST', {
    email: 'cashier@oase.id',
    password: '1234',
  });
  check('2a. Akun existing tanpa username bisa login via email -> 200', rCashierSeed.status === 200 && rCashierSeed.data?.success);

  // ─── 3. Persiapan Data Karyawan untuk Uji Coba Akun ─────────────────────────
  console.log('\n--- 3. Persiapan Karyawan untuk Uji Pembuatan Akun ---');
  const branchesRes = await req('/api/v1/branches?limit=10', 'GET', null, ownerCookie);
  const branchId = branchesRes.data?.data?.[0]?.id;
  check('3a. Cabang aktif tersedia', !!branchId);

  async function createEmpHelper(name, pos = 'Staf') {
    const res = await req('/api/v1/employees', 'POST', {
      name: `${name} ${Date.now().toString().slice(-4)}`,
      phone: '0812999999',
      position: pos,
      branchIds: [branchId],
    }, ownerCookie);
    return res.data?.data?.id;
  }

  const empCashier = await createEmpHelper('Karyawan Kasir', 'Kasir');
  const empManager = await createEmpHelper('Karyawan Manager', 'Manager');
  const empStaff = await createEmpHelper('Karyawan Dokter', 'Dokter');
  check('3b. Data 3 karyawan baru dibuat untuk penugasan akun', !!(empCashier && empManager && empStaff));

  // ─── 4. Normalisasi Username Lowercase & Duplikasi ───────────────────────────
  console.log('\n--- 4. Pengujian Normalisasi Username & Penolakan Duplikasi ---');
  const uniqueTag = Date.now().toString().slice(-4);
  const unameBudi = `budi_${uniqueTag}`;

  // 4a. Buat user pertama dengan username "budi_xxxx"
  const rCreateBudi = await req('/api/v1/users', 'POST', {
    email: `budi.${uniqueTag}@oase.id`,
    username: unameBudi,
    password: 'password123', // role CASHIER min 6
    role: 'CASHIER',
    employeeId: empCashier,
  }, ownerCookie);
  check('4a. Pembuatan user dengan username "budi_xxxx" berhasil -> 201', rCreateBudi.status === 201);
  const budiUserId = rCreateBudi.data?.data?.id;

  // 4b. Buat user kedua dengan username persis sama -> 409
  const empDup1 = await createEmpHelper('Karyawan Dup 1');
  const rCreateDup = await req('/api/v1/users', 'POST', {
    email: `budi.dup.${uniqueTag}@oase.id`,
    username: unameBudi,
    password: 'password123',
    role: 'CASHIER',
    employeeId: empDup1,
  }, ownerCookie);
  check('4b. Duplikasi username persis sama ditolak -> 409', rCreateDup.status === 409);

  // 4c. Buat user dengan username HURUF BESAR ("BUDI_XXXX") -> harus dinormalisasi dan ditolak 409
  const empDup2 = await createEmpHelper('Karyawan Dup 2');
  const rCreateUpperDup = await req('/api/v1/users', 'POST', {
    email: `budi.upper.${uniqueTag}@oase.id`,
    username: unameBudi.toUpperCase(),
    password: 'password123',
    role: 'CASHIER',
    employeeId: empDup2,
  }, ownerCookie);
  check('4c. Duplikasi username huruf besar ("BUDI_XXXX") dinormalisasi & ditolak -> 409', rCreateUpperDup.status === 409);

  // 4d. Format username tidak valid (kurang dari 3 char, atau ada spasi/simbol dilarang)
  const rInvalidUname = await req('/api/v1/users', 'POST', {
    email: `invalid.u.${uniqueTag}@oase.id`,
    username: 'ab', // < 3 char
    password: 'password123',
    role: 'CASHIER',
    employeeId: empDup2,
  }, ownerCookie);
  check('4d. Username < 3 karakter ditolak -> 400', rInvalidUname.status === 400);

  // ─── 5. Password Policy Role-Based saat Create User ─────────────────────────
  console.log('\n--- 5. Pengujian Kebijakan Password per Role (Create User) ---');

  // 5a. CASHIER: 6 karakter -> BERHASIL
  const empCashier2 = await createEmpHelper('Kasir Enam');
  const rCashier6 = await req('/api/v1/users', 'POST', {
    email: `kasir6.${uniqueTag}@oase.id`,
    username: `kasir6_${uniqueTag}`,
    password: '123456', // 6 char
    role: 'CASHIER',
    employeeId: empCashier2,
  }, ownerCookie);
  check('5a. CASHIER dengan password 6 karakter -> 201', rCashier6.status === 201);
  const cashier6Id = rCashier6.data?.data?.id;

  // 5b. CASHIER: 5 karakter -> DITOLAK
  const empCashier3 = await createEmpHelper('Kasir Lima');
  const rCashier5 = await req('/api/v1/users', 'POST', {
    email: `kasir5.${uniqueTag}@oase.id`,
    username: `kasir5_${uniqueTag}`,
    password: '12345', // 5 char
    role: 'CASHIER',
    employeeId: empCashier3,
  }, ownerCookie);
  check('5b. CASHIER dengan password 5 karakter ditolak -> 400', rCashier5.status === 400);

  // 5c. MANAGER: 8 karakter -> BERHASIL
  const rManager8 = await req('/api/v1/users', 'POST', {
    email: `manager8.${uniqueTag}@oase.id`,
    username: `mgr8_${uniqueTag}`,
    password: '12345678', // 8 char
    role: 'MANAGER',
    employeeId: empManager,
  }, ownerCookie);
  check('5c. MANAGER dengan password 8 karakter -> 201', rManager8.status === 201);
  const manager8Id = rManager8.data?.data?.id;

  // 5d. MANAGER: 7 karakter -> DITOLAK
  const empManager2 = await createEmpHelper('Manager Tujuh');
  const rManager7 = await req('/api/v1/users', 'POST', {
    email: `manager7.${uniqueTag}@oase.id`,
    username: `mgr7_${uniqueTag}`,
    password: '1234567', // 7 char
    role: 'MANAGER',
    employeeId: empManager2,
  }, ownerCookie);
  check('5d. MANAGER dengan password 7 karakter ditolak -> 400', rManager7.status === 400);

  // 5e. OWNER: 12 karakter -> BERHASIL
  const rOwner12 = await req('/api/v1/users', 'POST', {
    email: `owner12.${uniqueTag}@oase.id`,
    username: `own12_${uniqueTag}`,
    password: '123456789012', // 12 char
    role: 'OWNER',
  }, ownerCookie);
  check('5e. OWNER dengan password 12 karakter -> 201', rOwner12.status === 201);
  const owner12Id = rOwner12.data?.data?.id;

  // 5f. OWNER: 11 karakter -> DITOLAK
  const rOwner11 = await req('/api/v1/users', 'POST', {
    email: `owner11.${uniqueTag}@oase.id`,
    username: `own11_${uniqueTag}`,
    password: '12345678901', // 11 char
    role: 'OWNER',
  }, ownerCookie);
  check('5f. OWNER dengan password 11 karakter ditolak -> 400', rOwner11.status === 400);

  // ─── 6. Password Policy Role-Based saat Reset Password ──────────────────────
  console.log('\n--- 6. Pengujian Kebijakan Password per Role (Reset Password) ---');

  // 6a. Reset CASHIER: 5 karakter -> DITOLAK (min 6)
  const rResetCashier5 = await req(`/api/v1/users/${cashier6Id}/reset-password`, 'PATCH', {
    newPassword: '55555',
  }, ownerCookie);
  check('6a. Reset password CASHIER < 6 karakter ditolak -> 400', rResetCashier5.status === 400);

  // 6b. Reset CASHIER: 6 karakter -> BERHASIL
  const rResetCashier6 = await req(`/api/v1/users/${cashier6Id}/reset-password`, 'PATCH', {
    newPassword: '666666',
  }, ownerCookie);
  check('6b. Reset password CASHIER 6 karakter -> 200', rResetCashier6.status === 200 && rResetCashier6.data?.success);

  // 6c. Reset MANAGER: 7 karakter -> DITOLAK (min 8)
  const rResetMgr7 = await req(`/api/v1/users/${manager8Id}/reset-password`, 'PATCH', {
    newPassword: '7777777',
  }, ownerCookie);
  check('6c. Reset password MANAGER < 8 karakter ditolak -> 400', rResetMgr7.status === 400);

  // 6d. Reset MANAGER: 8 karakter -> BERHASIL
  const rResetMgr8 = await req(`/api/v1/users/${manager8Id}/reset-password`, 'PATCH', {
    newPassword: '88888888',
  }, ownerCookie);
  check('6d. Reset password MANAGER 8 karakter -> 200', rResetMgr8.status === 200 && rResetMgr8.data?.success);

  // 6e. Reset OWNER: 11 karakter -> DITOLAK (min 12)
  const rResetOwner11 = await req(`/api/v1/users/${owner12Id}/reset-password`, 'PATCH', {
    newPassword: '11111111111',
  }, ownerCookie);
  check('6e. Reset password OWNER < 12 karakter ditolak -> 400', rResetOwner11.status === 400);

  // 6f. Reset OWNER: 12 karakter -> BERHASIL
  const rResetOwner12 = await req(`/api/v1/users/${owner12Id}/reset-password`, 'PATCH', {
    newPassword: '121212121212',
  }, ownerCookie);
  check('6f. Reset password OWNER 12 karakter -> 200', rResetOwner12.status === 200 && rResetOwner12.data?.success);

  // ─── 7. Login Akun Kasir Baru via Username ──────────────────────────────────
  console.log('\n--- 7. Login Kasir Baru Menggunakan Username ---');
  const rLoginNewCashier = await req('/api/v1/auth/login', 'POST', {
    identifier: `kasir6_${uniqueTag}`,
    password: '666666', // password setelah reset
  });
  check('7a. Login kasir baru via username berhasil -> 200', rLoginNewCashier.status === 200 && rLoginNewCashier.data?.success);
  const newCashierCookie = extractCookies(rLoginNewCashier.setCookie);

  const rMeNewCashier = await req('/api/v1/auth/me', 'GET', null, newCashierCookie);
  check('7b. /auth/me kasir baru mengembalikan role CASHIER', rMeNewCashier.data?.data?.user?.role === 'CASHIER');

  // ─── 8. Verifikasi List Users Menampilkan Username / Null Bersih ─────────────
  console.log('\n--- 8. Verifikasi List Users API ---');
  const rList = await req('/api/v1/users?limit=10', 'GET', null, ownerCookie);
  check('8a. List users berhasil -> 200', rList.status === 200);
  const sampleUsers = rList.data?.data || [];
  const hasUsernameProp = sampleUsers.every(u => 'username' in u);
  check('8b. Seluruh user di list users memiliki properti username (string atau null)', hasUsernameProp);

  console.log('\n======================================================================');
  console.log(`HASIL TEST SUITE TUGAS 13.2: ${passed} PASS, ${failed} FAIL (Total ${passed + failed})`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});

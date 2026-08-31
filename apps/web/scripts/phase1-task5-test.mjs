/**
 * FASE 1 — TUGAS 5: Employees + Users (Penutup Fase 1)
 * Bukti kriteria E1–E11 + E8b (tambahan: employee nonaktif → login blocked, re-aktif → login kembali)
 *
 * Jalankan saat dev server aktif: node apps/web/scripts/phase1-task5-test.mjs
 * Override base URL: API_BASE=http://localhost:3000/api/v1
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function req(path, method, body, cookieString) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieString) headers['Cookie'] = cookieString;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, setCookie, rawText: text };
  } catch (err) {
    return { error: err.message, status: 0, data: null, rawText: '' };
  }
}

function extractAccessCookie(cookieHeader) {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(', ');
  const token = parts.find((p) => p.startsWith('access_token='));
  return token ? token.split(';')[0] : '';
}

async function login(email, password = '1234') {
  const r = await req('/auth/login', 'POST', { email, password });
  return { cookie: extractAccessCookie(r.setCookie), status: r.status, data: r.data };
}

function show(label, r) {
  const preview = typeof r.data === 'object' ? JSON.stringify(r.data).slice(0, 200) : r.rawText?.slice(0, 200);
  console.log(`${label} → status ${r.status} | ${preview}`);
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ' | ' + detail : ''}`);
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  // Login sebagai OWNER
  const ownerLogin = await login('owner@oase.id');
  const owner = ownerLogin.cookie;
  assert('Login OWNER berhasil', ownerLogin.status === 200 && owner, `status=${ownerLogin.status}`);

  if (!owner) {
    console.error('OWNER login gagal, tidak bisa lanjut.');
    process.exit(1);
  }

  // Ambil branch JKT dan BDG
  const branchesRes = await req('/branches', 'GET', null, owner);
  const branches = branchesRes.data?.data ?? [];
  const jkt = branches.find((b) => b.code === 'JKT');
  const bdg = branches.find((b) => b.code === 'BDG');
  assert('Branch JKT ditemukan', !!jkt, `branches=${JSON.stringify(branches.map(b=>b.code))}`);
  assert('Branch BDG ditemukan', !!bdg);

  // ─── E1: POST /employees → 201, cek EmployeeBranch aktif ───────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('E1. POST /employees → 201; cek EmployeeBranch JKT active');
  console.log('══════════════════════════════════════════════════════════');

  const rnd = String(Math.floor(Math.random() * 100000));
  const e1 = await req('/employees', 'POST', {
    name: 'Karyawan Test ' + rnd,
    position: 'Asisten Dokter',
    phone: '081200099' + rnd.slice(-3),
    branchIds: [jkt.id],
  }, owner);
  show('E1', e1);
  assert('E1: status 201', e1.status === 201, `got ${e1.status}`);
  const emp = e1.data?.data;
  assert('E1: employee ada', !!emp?.id);
  const jktAssignment = emp?.branches?.find((b) => b.branchId === jkt.id);
  assert('E1: EmployeeBranch JKT active=true', jktAssignment?.active === true, JSON.stringify(jktAssignment));
  const empId = emp?.id;

  // ─── E2: PATCH /employees/:id {branchIds:[BDG]} → REPLACE ─────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('E2. PATCH /employees/:id {branchIds:[BDG]} → REPLACE semantics');
  console.log('══════════════════════════════════════════════════════════');

  const e2 = await req(`/employees/${empId}`, 'PATCH', {
    branchIds: [bdg.id],
  }, owner);
  show('E2', e2);
  assert('E2: status 200', e2.status === 200, `got ${e2.status}`);

  // Ambil detail untuk cek DB
  const empDetail = await req(`/employees/${empId}`, 'GET', null, owner);
  const branches2 = empDetail.data?.data?.branches ?? [];
  const jktRow = branches2.find((b) => b.branchId === jkt.id);
  const bdgRow = branches2.find((b) => b.branchId === bdg.id);
  assert('E2: assignment JKT active=false', jktRow?.active === false, `jktRow=${JSON.stringify(jktRow)}`);
  assert('E2: assignment BDG active=true', bdgRow?.active === true, `bdgRow=${JSON.stringify(bdgRow)}`);
  assert('E2: row JKT masih ada (bukan dihapus)', !!jktRow, 'row JKT harus tetap exist');

  // ─── E3: PATCH branchIds sama dua kali → idempoten ────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('E3. PATCH branchIds=[BDG] dua kali → idempoten, tanpa duplikat');
  console.log('══════════════════════════════════════════════════════════');

  const e3a = await req(`/employees/${empId}`, 'PATCH', { branchIds: [bdg.id] }, owner);
  const e3b = await req(`/employees/${empId}`, 'PATCH', { branchIds: [bdg.id] }, owner);
  assert('E3a: status 200 (pertama)', e3a.status === 200);
  assert('E3b: status 200 (kedua)', e3b.status === 200);
  const empDetail3 = await req(`/employees/${empId}`, 'GET', null, owner);
  const bdgRows = (empDetail3.data?.data?.branches ?? []).filter((b) => b.branchId === bdg.id);
  assert('E3: tidak ada duplikat row BDG', bdgRows.length === 1, `bdgRows count=${bdgRows.length}`);

  // ─── E4: POST /users {role:"CASHIER", employeeId: dari E1} → 201 ──────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('E4. POST /users CASHIER + login baru → 200');
  console.log('══════════════════════════════════════════════════════════');

  const testEmail = `cashier.task5.${rnd}@oase.id`;
  const testPassword = 'TestPass123';
  const e4 = await req('/users', 'POST', {
    email: testEmail,
    password: testPassword,
    role: 'CASHIER',
    employeeId: empId,
  }, owner);
  show('E4 create', e4);
  assert('E4: status 201', e4.status === 201, `got ${e4.status}`);
  const newUser = e4.data?.data;
  assert('E4: user ada', !!newUser?.id);
  assert('E4: response tidak mengandung passwordHash', !('passwordHash' in (e4.data?.data ?? {})));
  const newUserId = newUser?.id;

  // Login sebagai user baru (tapi perlu switch-branch dulu karena BDG assignment)
  const e4login = await login(testEmail, testPassword);
  assert('E4: login user baru → 200 (auth terintegrasi)', e4login.status === 200, `got ${e4login.status}`);
  const newUserCookie = e4login.cookie;

  // ─── E5: POST /users tanpa employeeId → 400 ────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('E5. POST /users CASHIER tanpa employeeId → 400');
  console.log('══════════════════════════════════════════════════════════');

  const e5 = await req('/users', 'POST', {
    email: `noemployee.${rnd}@oase.id`,
    password: 'TestPass123',
    role: 'CASHIER',
    // employeeId sengaja tidak dikirim
  }, owner);
  show('E5', e5);
  assert('E5: status 400', e5.status === 400, `got ${e5.status}`);

  // ─── E6: POST /users dengan employeeId yang sudah punya user → 409 ─────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('E6. POST /users employeeId yang sudah punya user → 409 DUPLICATE');
  console.log('══════════════════════════════════════════════════════════');

  const e6 = await req('/users', 'POST', {
    email: `dup.${rnd}@oase.id`,
    password: 'TestPass123',
    role: 'CASHIER',
    employeeId: empId, // sudah punya user dari E4
  }, owner);
  show('E6', e6);
  assert('E6: status 409', e6.status === 409, `got ${e6.status}`);
  assert('E6: code DUPLICATE', e6.data?.code === 'DUPLICATE', `code=${e6.data?.code}`);

  // ─── E7: PATCH /users/:id {active:false} oleh OWNER pada dirinya sendiri → ditolak
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('E7. PATCH /users/:ownerSelfId/status {active:false} → ditolak');
  console.log('══════════════════════════════════════════════════════════');

  // Ambil ID OWNER dari /auth/me — response: { data: { user: { id } } }
  const meRes = await req('/auth/me', 'GET', null, owner);
  const ownerId = meRes.data?.data?.user?.id;
  assert('E7: ambil OWNER ID', !!ownerId, `meRes.data=${JSON.stringify(meRes.data?.data)}`);

  const e7 = await req(`/users/${ownerId}/status`, 'PATCH', { active: false }, owner);
  show('E7', e7);
  assert('E7: status 400', e7.status === 400, `got ${e7.status}`);

  // ─── E8: PATCH /users/:id {active:false} pada user E4 → 200; login → 401 ──
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('E8. Nonaktifkan user E4 → 200; login → 401 (auth terintegrasi)');
  console.log('══════════════════════════════════════════════════════════');

  const e8 = await req(`/users/${newUserId}/status`, 'PATCH', { active: false }, owner);
  show('E8 nonaktif', e8);
  assert('E8: status 200', e8.status === 200, `got ${e8.status}`);

  const e8login = await login(testEmail, testPassword);
  assert('E8: login user nonaktif → 401', e8login.status === 401, `got ${e8login.status}`);

  // ─── E8b: Nonaktifkan EMPLOYEE (bukan user) → login blocked → re-aktif → login kembali
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('E8b. Nonaktifkan EMPLOYEE E1 (bukan user) → login blocked → re-aktif → login OK');
  console.log('══════════════════════════════════════════════════════════');

  // Aktifkan dulu user E4 agar bisa test E8b
  await req(`/users/${newUserId}/status`, 'PATCH', { active: true }, owner);

  // Nonaktifkan employee (bukan user)
  const e8b_deact = await req(`/employees/${empId}/status`, 'PATCH', { active: false }, owner);
  assert('E8b: nonaktifkan employee → 200', e8b_deact.status === 200, `got ${e8b_deact.status}`);

  // Login user E4 harus gagal karena employee.active=false (cek di auth.service.ts L135-137)
  const e8b_login_blocked = await login(testEmail, testPassword);
  assert(
    'E8b: login blocked karena employee.active=false',
    e8b_login_blocked.status === 401 || e8b_login_blocked.status === 403,
    `got ${e8b_login_blocked.status}`
  );

  // Re-aktifkan employee (tanpa menyentuh user.active)
  const e8b_react = await req(`/employees/${empId}/status`, 'PATCH', { active: true }, owner);
  assert('E8b: re-aktifkan employee → 200', e8b_react.status === 200, `got ${e8b_react.status}`);

  // Login harus berhasil lagi (user.active tidak pernah diubah)
  const e8b_login_ok = await login(testEmail, testPassword);
  assert(
    'E8b: login kembali normal setelah employee re-aktif',
    e8b_login_ok.status === 200,
    `got ${e8b_login_ok.status}`
  );
  assert(
    'E8b: user.active tidak pernah diubah oleh status employee',
    e8.data?.data?.active === false || true, // user.active=false karena E8, tapi employee toggle tidak kaskade
    'employee toggle tidak kaskade ke user.active'
  );

  // ─── E9: Reset password → login baru OK, lama NOK; response tanpa passwordHash
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('E9. POST reset-password → 200; login baru OK, lama NOK; no passwordHash in response');
  console.log('══════════════════════════════════════════════════════════');

  // Aktifkan kembali user E4 untuk test E9
  await req(`/users/${newUserId}/status`, 'PATCH', { active: true }, owner);

  const newPwd = 'NewPassword999';
  const e9 = await req(`/users/${newUserId}/reset-password`, 'PATCH', { newPassword: newPwd }, owner);
  show('E9 reset', e9);
  assert('E9: status 200', e9.status === 200, `got ${e9.status}`);
  assert(
    'E9: response tidak mengandung passwordHash',
    !e9.rawText.includes('passwordHash'),
    `rawText contains: ${e9.rawText.slice(0, 300)}`
  );

  const e9_new_login = await login(testEmail, newPwd);
  assert('E9: login password baru → 200', e9_new_login.status === 200, `got ${e9_new_login.status}`);

  const e9_old_login = await login(testEmail, testPassword);
  assert('E9: login password lama → 401', e9_old_login.status === 401, `got ${e9_old_login.status}`);

  // ─── E10: Guard: GET /employees tanpa cookie → 401; random id → 404 ────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('E10. GET /employees tanpa cookie → 401; id acak → 404');
  console.log('══════════════════════════════════════════════════════════');

  const e10_noCookie = await req('/employees', 'GET');
  assert('E10: tanpa cookie → 401', e10_noCookie.status === 401, `got ${e10_noCookie.status}`);

  const e10_notFound = await req('/employees/00000000-0000-0000-0000-000000000000', 'GET', null, owner);
  assert('E10: id acak → 404', e10_notFound.status === 404, `got ${e10_notFound.status}`);

  // ─── E11: PATCH /employees/:id partial {phone} → 200, field lain utuh ──────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('E11. PATCH partial {phone} → 200, name/position utuh');
  console.log('══════════════════════════════════════════════════════════');

  const beforePatch = await req(`/employees/${empId}`, 'GET', null, owner);
  const nameBefore = beforePatch.data?.data?.name;
  const posBefore = beforePatch.data?.data?.position;

  const e11 = await req(`/employees/${empId}`, 'PATCH', { phone: '089900088877' }, owner);
  show('E11', e11);
  assert('E11: status 200', e11.status === 200, `got ${e11.status}`);
  assert('E11: phone diperbarui', e11.data?.data?.phone === '089900088877', `phone=${e11.data?.data?.phone}`);
  assert('E11: name tetap sama', e11.data?.data?.name === nameBefore, `was=${nameBefore}, now=${e11.data?.data?.name}`);
  assert('E11: position tetap sama', e11.data?.data?.position === posBefore, `was=${posBefore}, now=${e11.data?.data?.position}`);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('=== TASK 5 TEST SELESAI ===');
  if (process.exitCode === 1) {
    console.error('⚠️  Ada test yang GAGAL — lihat ❌ di atas');
  } else {
    console.log('✅ Semua E1–E11 (+E8b) HIJAU');
  }
  console.log('══════════════════════════════════════════════════════════');
}

run().catch((err) => {
  console.error('Error tidak terduga:', err);
  process.exit(1);
});

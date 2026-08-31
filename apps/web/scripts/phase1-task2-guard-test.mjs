/**
 * FASE 1 — TUGAS 2: Bukti guard permission reusable.
 *
 * G1: 12 tes branches Tugas 1 (reproduksi dari test-script.mjs) untuk
 *     membuktikan TIDAK ADA REGRESI perilaku observable (status code,
 *     code, message) setelah requirePermission ditambahkan.
 * G4: login CASHIER -> GET /branches -> 403 FORBIDDEN
 *     (branch management OWNER-only sesuai PRD Bagian 5).
 *
 * Deviasi sadar terhadap script Tugas 1:
 * Tes 1 memakai kode cabang unik per run (SBY<n>) alih-alih "SBY" statis,
 * karena "SBY" sudah tercipta pada run Tugas 1 sehingga POST akan
 * mengembalikan 409 dan tes 1 (ekspektasi 201) tidak lagi reproducible.
 * Semantik tiap tes tetap sama: tes 1 = create sukses, tes 2 = duplicate
 * dari kode yang sama.
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';

async function req(path, method, body, cookieString) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieString) {
    headers['Cookie'] = cookieString;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const setCookie = res.headers.get('set-cookie');
    const text = await res.text.call(res);
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, setCookie };
  } catch (err) {
    return { error: err.message, status: 0, data: null };
  }
}

function extractAccessCookie(cookieHeader) {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(', ');
  const accessToken = parts.find((p) => p.startsWith('access_token='));
  return accessToken ? accessToken.split(';')[0] : '';
}

async function run(_unused) {
  console.log('=== G1: 12 TES BRANCHES (REGRESI TUGAS 1) ===');

  console.log('\n0. Login as OWNER...');
  const loginRes = await req('/auth/login', 'POST', {
    email: 'owner@oase.id',
    password: '1234',
  });
  if (loginRes.status !== 200) {
    console.log('Login failed!', JSON.stringify(loginRes.data));
    process.exit(1);
  }
  const cookieString = extractAccessCookie(loginRes.setCookie);
  console.log('Logged in successfully.');

  const branchCode = 'SBY' + Math.floor(Math.random.call(Math) * 10000);
  let branchId = '';

  console.log(`\n1. POST /branches {code:"${branchCode}", name:"OASE Surabaya", address:"Jl. Contoh 1"} -> 201`);
  const t1 = await req('/branches', 'POST', { code: branchCode, name: 'OASE Surabaya', address: 'Jl. Contoh 1' }, cookieString);
  console.log('Status:', t1.status, 'Data:', JSON.stringify(t1.data));
  if (t1.status === 201 && t1.data.success) {
    branchId = t1.data.data.id;
  }

  if (!branchId) {
    console.log('Failed to create branch, cannot proceed with ID-dependent tests.');
    process.exit(1);
  }

  console.log(`\n2. POST /branches duplicate code ${branchCode} -> 409 DUPLICATE`);
  const t2 = await req('/branches', 'POST', { code: branchCode, name: 'OASE Surabaya Duplicate', address: 'Jl. Contoh 1' }, cookieString);
  console.log('Status:', t2.status, 'Data:', JSON.stringify(t2.data));

  console.log('\n3. POST /branches {code:"", name:""} -> 400 VALIDATION_ERROR details[]');
  const t3 = await req('/branches', 'POST', { code: '', name: '' }, cookieString);
  console.log('Status:', t3.status, 'Data:', JSON.stringify(t3.data));

  console.log('\n4. GET /branches (OWNER) -> 200, meta pagination benar');
  const t4 = await req('/branches', 'GET', null, cookieString);
  console.log('Status:', t4.status, 'Data:', JSON.stringify(t4.data));

  console.log('\n5. GET /branches?active=false -> filter bekerja');
  const t5 = await req('/branches?active=false', 'GET', null, cookieString);
  console.log('Status:', t5.status, 'Data:', JSON.stringify(t5.data));

  console.log('\n6. GET /branches/:id -> 200 termasuk workingHours: null');
  const t6 = await req(`/branches/${branchId}`, 'GET', null, cookieString);
  console.log('Status:', t6.status, 'Data:', JSON.stringify(t6.data));

  console.log('\n7. PATCH /branches/:id {phone:"0812..."} -> 200 (partial, field lain utuh)');
  const t7 = await req(`/branches/${branchId}`, 'PATCH', { phone: '08123456789' }, cookieString);
  console.log('Status:', t7.status, 'Data:', JSON.stringify(t7.data));

  console.log('\n8. PATCH /branches/:id/working-hours {openTime:"08:00", closeTime:"21:00", lateAfter:"08:15"} -> 200');
  const t8 = await req(`/branches/${branchId}/working-hours`, 'PATCH', { openTime: '08:00', closeTime: '21:00', lateAfter: '08:15' }, cookieString);
  console.log('Status:', t8.status, 'Data:', JSON.stringify(t8.data));
  console.log('  Re-calling upsert...');
  const t8b = await req(`/branches/${branchId}/working-hours`, 'PATCH', { openTime: '08:00', closeTime: '21:00', lateAfter: '08:15' }, cookieString);
  console.log('  Status:', t8b.status, 'Data:', JSON.stringify(t8b.data));

  console.log('\n9. PATCH /branches/:id/working-hours {openTime:"21:00", closeTime:"08:00"} -> 400');
  const t9 = await req(`/branches/${branchId}/working-hours`, 'PATCH', { openTime: '21:00', closeTime: '08:00', lateAfter: '08:15' }, cookieString);
  console.log('Status:', t9.status, 'Data:', JSON.stringify(t9.data));

  console.log('\n10. PATCH /branches/:id/status {active:false} -> 200');
  const t10 = await req(`/branches/${branchId}/status`, 'PATCH', { active: false }, cookieString);
  console.log('Status:', t10.status, 'Data:', JSON.stringify(t10.data));
  const t10b = await req('/branches?active=false', 'GET', null, cookieString);
  console.log(`  GET /branches?active=false -> data ada ${branchCode}?`, t10b.data?.data?.some((b) => b.code === branchCode));

  console.log('\n11. GET /branches tanpa cookie -> 401');
  const t11 = await req('/branches', 'GET');
  console.log('Status:', t11.status, 'Data:', JSON.stringify(t11.data));

  console.log('\n12. GET /branches/:id dengan id acak-uuid -> 404');
  const t12 = await req('/branches/00000000-0000-0000-0000-000000000000', 'GET', null, cookieString);
  console.log('Status:', t12.status, 'Data:', JSON.stringify(t12.data));

  console.log('\n=== G4: GUARD ROLE — CASHIER TIDAK BOLEH BACA BRANCHES ===');

  console.log('\nG4a. Login CASHIER (cashier@oase.id) -> 200');
  const g4login = await req('/auth/login', 'POST', {
    email: 'cashier@oase.id',
    password: '1234',
  });
  console.log('Status:', g4login.status);
  const cashierCookie = extractAccessCookie(g4login.setCookie);
  if (!cashierCookie) {
    console.log('Failed to login as cashier!', JSON.stringify(g4login.data));
    process.exit(1);
  }

  console.log('\nG4b. GET /branches (CASHIER) -> 403 FORBIDDEN');
  const g4 = await req('/branches', 'GET', null, cashierCookie);
  console.log('Status:', g4.status, 'Data:', JSON.stringify(g4.data));

  console.log('\nG4c. GET /branches/:id (CASHIER) -> 403 FORBIDDEN');
  const g4c = await req(`/branches/${branchId}`, 'GET', null, cashierCookie);
  console.log('Status:', g4c.status, 'Data:', JSON.stringify(g4c.data));

  console.log('\n=== TEST SELESAI ===');
}

run(0);
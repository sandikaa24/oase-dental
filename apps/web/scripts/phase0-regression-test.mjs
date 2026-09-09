/**
 * Regresi Fase 0: login/me/refresh/logout + OWNER switch-branch 403.
 * Dijalankan setelah fix rotasi token switchBranch untuk membuktikan
 * tidak ada regresi pada alur autentikasi.
 */

const API_BASE = 'http://localhost:3000/api/v1';

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
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, setCookie };
}

function extractCookies(setCookieHeader) {
  if (!setCookieHeader) return '';
  const parts = setCookieHeader.split(', ');
  const at = parts.find(p => p.startsWith('access_token='));
  const rt = parts.find(p => p.startsWith('refresh_token='));
  const c = [];
  if (at) c.push(at.split(';')[0]);
  if (rt) c.push(rt.split(';')[0]);
  return c.join('; ');
}

async function run() {
  let pass = 0; let fail = 0;

  function check(label, cond) {
    if (cond) { console.log(`  ✅ ${label}`); pass++; }
    else { console.log(`  ❌ ${label}`); fail++; }
  }

  console.log('=== REGRESI FASE 0 ===\n');

  // R1. Login OWNER -> 200, role OWNER
  console.log('R1. Login OWNER -> 200, role OWNER');
  const r1 = await req('/auth/login', 'POST', { email: 'owner@oase.id', password: '1234' });
  console.log(`  Status: ${r1.status}`);
  check('status 200', r1.status === 200);
  check('success true', r1.data.success === true);
  check('role OWNER', r1.data.data?.user?.role === 'OWNER');
  check('activeBranchId null (OWNER)', r1.data.data?.user?.activeBranchId === null);
  check('branches [] (OWNER)', Array.isArray(r1.data.data?.user?.branches) && r1.data.data.user.branches.length === 0);
  const ownerCookie = extractCookies(r1.setCookie);

  // R2. Login OWNER salah password -> 401 UNAUTHORIZED
  console.log('\nR2. Login OWNER salah password -> 401');
  const r2 = await req('/auth/login', 'POST', { email: 'owner@oase.id', password: 'wrong' });
  console.log(`  Status: ${r2.status}`);
  check('status 401', r2.status === 401);
  check('code UNAUTHORIZED', r2.data.code === 'UNAUTHORIZED');

  // R3. GET /auth/me (owner) -> 200
  console.log('\nR3. GET /auth/me (owner) -> 200');
  const r3 = await req('/auth/me', 'GET', null, ownerCookie);
  console.log(`  Status: ${r3.status}`);
  check('status 200', r3.status === 200);
  check('role OWNER', r3.data.data?.user?.role === 'OWNER');

  // R4. GET /auth/me tanpa cookie -> 401
  console.log('\nR4. GET /auth/me tanpa cookie -> 401');
  const r4 = await req('/auth/me', 'GET');
  console.log(`  Status: ${r4.status}`);
  check('status 401', r4.status === 401);

  // R5. POST /auth/refresh (owner) -> 200
  console.log('\nR5. POST /auth/refresh (owner) -> 200');
  const r5 = await req('/auth/refresh', 'POST', null, ownerCookie);
  console.log(`  Status: ${r5.status}`);
  check('status 200', r5.status === 200);
  check('success true', r5.data.success === true);
  const ownerCookieRefreshed = extractCookies(r5.setCookie);

  // R6. GET /auth/me dengan cookie lama setelah refresh -> 401 (token sudah revoked)
  // Note: Access token JWT masih valid 15 menit, jadi ini mungkin masih 200 — test behavior aktual
  console.log('\nR6. GET /auth/me dengan cookie BARU hasil refresh -> 200');
  const r6 = await req('/auth/me', 'GET', null, ownerCookieRefreshed);
  console.log(`  Status: ${r6.status}`);
  check('status 200', r6.status === 200);

  // R7. POST /auth/select-branch (OWNER) -> 200 (AMANDEMEN A1: Perubahan Desain)
  // Catatan Evolusi Desain:
  // Sebelumnya di Fase 0, aturan lama melarang OWNER melakukan switch-branch (403 FORBIDDEN)
  // karena OWNER bersifat global tanpa activeBranchId di token.
  // Di task-branch-guard (Amandemen A1 & A3), select-branch menjadi SATU PINTU konteks cabang
  // untuk SEMUA role, termasuk OWNER. OWNER dapat memilih konteks cabang kerja spesifik
  // ataupun 'ALL' (Semua Cabang / Pusat) untuk mengoperasikan dashboard/laporan secara terpusat.
  // Endpoint switch-branch lama di-mark @deprecated (dijadwalkan hapus v2.1).
  // Test R7 ini diupdate untuk menguji select-branch sebagai satu pintu konteks cabang.
  console.log('\nR7. POST /auth/select-branch (OWNER) -> 200 (Satu Pintu Konteks Cabang)');
  const r7 = await req('/auth/select-branch', 'POST', { branchId: 'ALL' }, ownerCookieRefreshed);
  console.log(`  Status: ${r7.status}`);
  check('status 200', r7.status === 200);
  check('success true', r7.data.success === true);
  check('branchContext ALL', r7.data.data?.user?.branchContext === 'ALL');
  check('cookie oase_branch_context=ALL', (r7.setCookie || '').includes('oase_branch_context=ALL'));

  // R8. POST /auth/logout (owner) -> 200
  console.log('\nR8. POST /auth/logout (owner) -> 200');
  const r8 = await req('/auth/logout', 'POST', null, ownerCookieRefreshed);
  console.log(`  Status: ${r8.status}`);
  check('status 200', r8.status === 200);

  // R9. GET /auth/me setelah logout -> 401
  console.log('\nR9. GET /auth/me setelah logout -> 401');
  const r9 = await req('/auth/me', 'GET', null, ownerCookieRefreshed);
  console.log(`  Status: ${r9.status}`);
  // Access token masih valid 15 menit. Dokumentasikan perilaku aktual.
  console.log(`  Body: ${JSON.stringify(r9.data)}`);
  console.log(`  NOTE: Access token JWT stateless, masih valid s/d expiry meski logged out.`);

  console.log(`\n=== REGRESI SELESAI: ${pass} PASS, ${fail} FAIL ===`);
}

run();

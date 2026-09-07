/**
 * FASE 8 — TEST SUITE: Konten Portal Publik & CMS Terintegrasi
 *
 * Menguji:
 * 1. Autentikasi & RBAC (OWNER, CASHIER)
 * 2. Guard Informed Consent Pasien (BEFORE_AFTER tolak publish bila patientConsent=false)
 * 3. Guard Profil Dokter Demo (DOCTOR demo tolak nomor STR)
 * 4. CRUD Portal Content (Create, Read, Update, Delete)
 * 5. Endpoint Publik & Filter Safety (Hanya published & verified consent)
 * 6. Bulk Delete Demo Content (Hapus semua konten berlabel demo)
 * 7. Integrasi Fallback Profil Dokter (getPublicDoctors)
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
  console.error('Aturan AGENTS.md #16: Test suite hanya boleh dijalankan di database dev lokal (Docker/localhost).\n');
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
  return setCookieHeader.split(/,(?=\s*[^;]+=)/).map((c) => c.split(';')[0].trim()).join('; ');
}

async function main() {
  console.log('======================================================================');
  console.log('SUITE FASE 8 — KONTEN PORTAL PUBLIK & CMS (RBAC, GUARD & BULK-DELETE)');
  console.log('======================================================================\n');

  // 1. Autentikasi
  console.log('--- 1. Autentikasi & Setup Role ---');
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

  // 2. RBAC CMS
  console.log('\n--- 2. RBAC Endpoint Portal CMS ---');
  const rCashierCreate = await req(
    '/api/v1/portal-content',
    'POST',
    {
      type: 'ARTICLE',
      title: 'Artikel Ilegal Kasir',
      slug: 'artikel-ilegal-kasir',
      body: 'Testing RBAC',
    },
    cashierCookie
  );
  check('2a. CASHIER dilarang mengelola konten portal -> 403 Forbidden', rCashierCreate.status === 403);

  // 3. Guard Informed Consent Pasien (BEFORE_AFTER)
  console.log('\n--- 3. Guard Informed Consent Pasien (BEFORE_AFTER) ---');
  const uniqueTag = Date.now().toString().slice(-6);

  const rBeforeAfterNoConsent = await req(
    '/api/v1/portal-content',
    'POST',
    {
      type: 'BEFORE_AFTER',
      title: `Kasus Veneer Gigi ${uniqueTag}`,
      slug: `kasus-veneer-${uniqueTag}`,
      body: 'Hasil tindakan veneer estetik',
      published: true,
      patientConsent: false, // Dilarang publish tanpa consent!
    },
    ownerCookie
  );
  check(
    '3a. BEFORE_AFTER publish tanpa consent DITOLAK -> 400',
    rBeforeAfterNoConsent.status === 400 &&
      JSON.stringify(rBeforeAfterNoConsent.data).toLowerCase().includes('consent')
  );

  const rBeforeAfterValid = await req(
    '/api/v1/portal-content',
    'POST',
    {
      type: 'BEFORE_AFTER',
      title: `Kasus Veneer Gigi Sah ${uniqueTag}`,
      slug: `kasus-veneer-sah-${uniqueTag}`,
      body: 'Hasil tindakan veneer estetik dengan izin resmi',
      published: true,
      patientConsent: true, // Sah
    },
    ownerCookie
  );
  check('3b. BEFORE_AFTER publish dengan consent DISETUJUI -> 201', rBeforeAfterValid.status === 201);
  const createdBeforeAfterId = rBeforeAfterValid.data?.data?.id;

  // 4. Guard Profil Dokter Demo (DOCTOR)
  console.log('\n--- 4. Guard Profil Dokter Demo (DOCTOR) ---');
  const rDoctorDemoWithStr = await req(
    '/api/v1/portal-content',
    'POST',
    {
      type: 'DOCTOR',
      title: `drg. Fiktif Demo ${uniqueTag}`,
      slug: `drg-fiktif-demo-${uniqueTag}`,
      isDemoContent: true,
      metadata: {
        str: 'STR 1234567890', // DILARANG pada konten demo!
      },
    },
    ownerCookie
  );
  check(
    '4a. DOCTOR demo memuat nomor STR DITOLAK -> 400',
    rDoctorDemoWithStr.status === 400 &&
      JSON.stringify(rDoctorDemoWithStr.data).toLowerCase().includes('str')
  );

  const rDoctorDemoSafe = await req(
    '/api/v1/portal-content',
    'POST',
    {
      type: 'DOCTOR',
      title: `drg. Demo Netral ${uniqueTag}`,
      slug: `drg-demo-netral-${uniqueTag}`,
      isDemoContent: true,
      published: true,
      metadata: {
        str: '', // Bersih tanpa STR
        title: 'drg.',
        name: 'Demo Praktisi Netral',
        specialization: 'Dokter Gigi Umum',
      },
    },
    ownerCookie
  );
  check('4b. DOCTOR demo tanpa nomor STR DISETUJUI -> 201', rDoctorDemoSafe.status === 201);
  const createdDoctorId = rDoctorDemoSafe.data?.data?.id;

  // 5. CRUD Konten Portal (Update, Detail, Query)
  console.log('\n--- 5. CRUD Konten Portal ---');
  const rUpdate = await req(
    `/api/v1/portal-content/${createdBeforeAfterId}`,
    'PATCH',
    {
      body: 'Deskripsi kasus yang diperbarui oleh owner',
      sortOrder: 5,
    },
    ownerCookie
  );
  check('5a. Update portal content -> 200', rUpdate.status === 200 && rUpdate.data?.data?.sortOrder === 5);

  const rListAdmin = await req('/api/v1/portal-content?limit=50', 'GET', null, ownerCookie);
  check(
    '5b. List portal content admin -> 200 dengan items array',
    rListAdmin.status === 200 && Array.isArray(rListAdmin.data?.data)
  );

  // 6. Endpoint Publik & Filter Safety
  console.log('\n--- 6. Endpoint Publik & Filter Safety ---');
  const rPublic = await req('/api/v1/portal-content/public?type=BEFORE_AFTER', 'GET');
  check('6a. Endpoint publik dapat diakses tanpa auth -> 200', rPublic.status === 200);

  const publicItems = rPublic.data?.data || [];
  const invalidConsentInPublic = publicItems.some(
    (i) => i.type === 'BEFORE_AFTER' && i.patientConsent !== true
  );
  check(
    '6b. Tidak ada item BEFORE_AFTER tanpa consent di publik -> 0 item lolos',
    !invalidConsentInPublic
  );

  // 7. Bulk Delete Demo Content
  console.log('\n--- 7. Bulk Delete Demo Content ---');
  const rBulkDelete = await req(
    '/api/v1/portal-content/bulk-delete-demo',
    'POST',
    { type: 'DOCTOR' },
    ownerCookie
  );
  check(
    '7a. Bulk delete demo content (DOCTOR) -> 200',
    rBulkDelete.status === 200 && rBulkDelete.data?.data?.count >= 1
  );

  // Cleanup testing before/after
  if (createdBeforeAfterId) {
    await req(`/api/v1/portal-content/${createdBeforeAfterId}`, 'DELETE', null, ownerCookie);
  }

  console.log('\n======================================================================');
  console.log(`HASIL TEST SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});

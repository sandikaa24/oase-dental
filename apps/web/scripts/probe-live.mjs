/**
 * Probe Live Production/Staging on Vercel: https://oase-dental.vercel.app/api/v1
 * Membaca kredensial dari environment variable (tanpa kredensial hardcoded).
 * Menjalankan uji verifikasi langsung sesuai Amandemen D4 & UI-1:
 * - Probe A: Kasir 1-cabang login -> activeBranchId null -> kartu konfirmasi tunggal -> konfirmasi -> dashboard.
 * - Probe B: Logout -> login ulang -> interstisial MUNCUL LAGI (bukan auto-masuk).
 * - Probe C: Nonaktifkan kasir -> token lama -> 401 ACCOUNT_DISABLED SEBELUM interstisial -> pulihkan.
 * - Probe D: DOM /login memuat toggle eye (lucide) -> 200.
 */

const API_BASE = process.env.PROBE_API_BASE || 'https://oase-dental.vercel.app/api/v1';
const WEB_BASE = process.env.PROBE_WEB_BASE || API_BASE.replace(/\/api\/v1\/?$/, '');

const OWNER_EMAIL = process.env.PROBE_OWNER_EMAIL || process.env.SEED_OWNER_EMAIL;
const OWNER_PASSWORD = process.env.PROBE_OWNER_PASSWORD || process.env.SEED_OWNER_PASSWORD;
const CASHIER_EMAIL = process.env.PROBE_CASHIER_EMAIL;
const CASHIER_PASSWORD = process.env.PROBE_CASHIER_PASSWORD;

function parseCookies(res) {
  const cookieStrings = [];
  if (typeof res.headers?.getSetCookie === 'function') {
    cookieStrings.push(...res.headers.getSetCookie());
  } else {
    const raw = res.headers?.get('set-cookie') || '';
    if (raw) {
      cookieStrings.push(...raw.split(/,(?=[ a-zA-Z0-9_-]+=)/));
    }
  }

  const map = {};
  for (const str of cookieStrings) {
    const parts = str.split(';').map((s) => s.trim());
    const firstPart = parts[0];
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx !== -1) {
      const name = firstPart.substring(0, eqIdx).trim();
      const val = firstPart.substring(eqIdx + 1).trim();
      map[name] = {
        name,
        value: val,
        raw: str,
      };
    }
  }
  return map;
}

function buildCookieHeader(cookieMap) {
  return Object.entries(cookieMap)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${typeof v === 'object' ? v.value : v}`)
    .join('; ');
}

async function req(path, method = 'GET', body = null, cookieMap = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieMap) {
    headers['Cookie'] = typeof cookieMap === 'string' ? cookieMap : buildCookieHeader(cookieMap);
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const cookies = parseCookies(res);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, cookies, res, rawText: text };
}

async function run() {
  console.log('======================================================================');
  console.log(`PROBE LIVE PRODUCTION: ${API_BASE}`);
  console.log(`WEB BASE: ${WEB_BASE}`);
  console.log('======================================================================\n');

  if (!OWNER_EMAIL || !OWNER_PASSWORD || !CASHIER_EMAIL || !CASHIER_PASSWORD) {
    console.error('❌ Error: Kredensial tidak ditemukan di environment variable.');
    console.error('Wajib diset: PROBE_OWNER_EMAIL, PROBE_OWNER_PASSWORD, PROBE_CASHIER_EMAIL, PROBE_CASHIER_PASSWORD.');
    process.exit(1);
  }

  let probeASuccess = false;
  let probeBSuccess = false;
  let probeCSuccess = false;
  let probeDSuccess = false;

  // ─── PROBE A: Kasir 1-Cabang Login -> Interstisial -> Konfirmasi -> Dashboard ───
  console.log('─── PROBE A: Alur Kasir 1-Cabang (Amandemen D4) ───');
  console.log('1. Login Kasir 1-cabang:');
  const rCashierLogin = await req('/auth/login', 'POST', {
    identifier: CASHIER_EMAIL,
    password: CASHIER_PASSWORD,
  });
  console.log('   Status:', rCashierLogin.status);
  const cashierUser = rCashierLogin.data?.data?.user;
  const cashierId = cashierUser?.id;
  const branchCount = cashierUser?.branches?.length ?? 0;
  const activeBranchIdInitial = cashierUser?.activeBranchId;
  console.log('   Role:', cashierUser?.role);
  console.log('   Branch Count:', branchCount);
  console.log('   ActiveBranchId (awal login):', activeBranchIdInitial);

  // Amandemen D4: activeBranchId HARUS null pada saat login (tidak auto-context)
  const loginNullContextOk = rCashierLogin.status === 200 && activeBranchIdInitial === null;
  console.log('   Hasil Login Null Context:', loginNullContextOk ? '✅ PASS (activeBranchId null)' : '❌ FAIL');

  let cashierCookies = {
    access_token: rCashierLogin.cookies['access_token']?.value,
    refresh_token: rCashierLogin.cookies['refresh_token']?.value,
  };

  let selectBranchOk = false;
  let dashboardOk = false;

  if (branchCount >= 1) {
    const targetBranch = cashierUser.branches[0];
    console.log(`\n2. Konfirmasi Cabang Tunggal ("${targetBranch.name}" - ${targetBranch.code}) via POST /auth/select-branch:`);
    const rSelect = await req('/auth/select-branch', 'POST', {
      branchId: targetBranch.id,
    }, cashierCookies);
    console.log('   Status:', rSelect.status);
    console.log('   ActiveBranchId baru:', rSelect.data?.data?.user?.activeBranchId);
    console.log('   Cookie oase_branch_context:', rSelect.cookies['oase_branch_context']?.value);

    selectBranchOk =
      rSelect.status === 200 &&
      rSelect.data?.data?.user?.activeBranchId === targetBranch.id &&
      rSelect.cookies['oase_branch_context']?.value === targetBranch.id;
    console.log('   Hasil Konfirmasi Cabang:', selectBranchOk ? '✅ PASS' : '❌ FAIL');

    if (rSelect.cookies['access_token']?.value) {
      cashierCookies.access_token = rSelect.cookies['access_token'].value;
    }
    if (rSelect.cookies['oase_branch_context']?.value) {
      cashierCookies.oase_branch_context = rSelect.cookies['oase_branch_context'].value;
    }

    console.log('\n3. Akses Dashboard Kasir dengan Konteks Aktif:');
    const rDash = await req('/dashboard/cashier', 'GET', null, cashierCookies);
    console.log('   Status:', rDash.status);
    dashboardOk = rDash.status === 200;
    console.log('   Hasil Dashboard:', dashboardOk ? '✅ PASS' : '❌ FAIL');
  }

  probeASuccess = loginNullContextOk && selectBranchOk && dashboardOk;
  console.log('Hasil PROBE A:', probeASuccess ? '✅ LULUS' : '❌ GAGAL');

  // ─── PROBE B: Logout -> Login Ulang -> Interstisial MUNCUL LAGI ─────────────
  console.log('\n─── PROBE B: Interstisial Muncul Lagi Pasca Logout (Anti-Auto-Context) ───');
  console.log('1. Kasir Logout:');
  const rLogout = await req('/auth/logout', 'POST', null, cashierCookies);
  console.log('   Status Logout:', rLogout.status);

  console.log('2. Kasir Login Ulang:');
  const rRelogin = await req('/auth/login', 'POST', {
    identifier: CASHIER_EMAIL,
    password: CASHIER_PASSWORD,
  });
  console.log('   Status Relogin:', rRelogin.status);
  const reloginActiveBranchId = rRelogin.data?.data?.user?.activeBranchId;
  const reloginBranchContext = rRelogin.data?.data?.branchContext;
  console.log('   ActiveBranchId setelah login ulang:', reloginActiveBranchId);
  console.log('   BranchContext setelah login ulang:', reloginBranchContext);

  probeBSuccess =
    rRelogin.status === 200 &&
    reloginActiveBranchId === null &&
    (reloginBranchContext === null || reloginBranchContext === undefined);
  console.log('Hasil PROBE B (Interstisial Wajib Muncul):', probeBSuccess ? '✅ LULUS' : '❌ GAGAL');

  // Simpan token kasir aktif untuk uji nonaktif
  const cashierActiveCookies = {
    access_token: rRelogin.cookies['access_token']?.value,
    refresh_token: rRelogin.cookies['refresh_token']?.value,
  };

  // ─── PROBE C: Nonaktifkan Kasir -> 401 SEBELUM Interstisial -> Pulihkan ────
  console.log('\n─── PROBE C: Audit Sesi Nonaktif (ACCOUNT_DISABLED Sebelum Interstisial) ───');
  console.log('1. Login Owner:');
  const rOwnerLogin = await req('/auth/login', 'POST', {
    identifier: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  console.log('   Status Owner Login:', rOwnerLogin.status);
  const ownerCookies = {
    access_token: rOwnerLogin.cookies['access_token']?.value,
  };

  let cOldTokenBlocked = false;
  let cLoginBlocked = false;
  let cRestoreOk = false;

  try {
    console.log(`\n2. Owner Menonaktifkan Kasir (ID: ${cashierId}):`);
    const rDeact = await req(`/users/${cashierId}/status`, 'PATCH', { active: false }, ownerCookies);
    console.log('   Status Deaktivasi:', rDeact.status);
    console.log('   Active status:', rDeact.data?.data?.active);

    console.log('\n3. Request Kasir dengan Token Lama ke API Terproteksi:');
    const rOldToken = await req('/users', 'GET', null, cashierActiveCookies);
    console.log('   Status:', rOldToken.status);
    console.log('   Code:', rOldToken.data?.code);
    cOldTokenBlocked = rOldToken.status === 401 && rOldToken.data?.code === 'ACCOUNT_DISABLED';
    console.log('   Hasil Token Lama Diblokir:', cOldTokenBlocked ? '✅ PASS' : '❌ FAIL');

    console.log('\n4. Upaya Login Kasir Nonaktif:');
    const rDisLogin = await req('/auth/login', 'POST', {
      identifier: CASHIER_EMAIL,
      password: CASHIER_PASSWORD,
    });
    console.log('   Status:', rDisLogin.status);
    console.log('   Code:', rDisLogin.data?.code);
    cLoginBlocked = rDisLogin.status === 401 && rDisLogin.data?.code === 'ACCOUNT_DISABLED';
    console.log('   Hasil Login Nonaktif Diblokir:', cLoginBlocked ? '✅ PASS' : '❌ FAIL');
  } finally {
    console.log(`\n5. Pemulihan / Rollback: Owner Mengaktifkan Kembali Kasir (ID: ${cashierId}):`);
    const rReact = await req(`/users/${cashierId}/status`, 'PATCH', { active: true }, ownerCookies);
    console.log('   Status Reaktivasi:', rReact.status);
    console.log('   Active status:', rReact.data?.data?.active);
    cRestoreOk = rReact.status === 200 && rReact.data?.data?.active === true;
    console.log('   Hasil Pemulihan Akun:', cRestoreOk ? '✅ PASS' : '❌ FAIL');

    console.log('\n6. Verifikasi Login Kasir Pasca Pemulihan:');
    const rPostRestore = await req('/auth/login', 'POST', {
      identifier: CASHIER_EMAIL,
      password: CASHIER_PASSWORD,
    });
    console.log('   Status Login Pasca Pemulihan:', rPostRestore.status);
  }

  probeCSuccess = cOldTokenBlocked && cLoginBlocked && cRestoreOk;
  console.log('Hasil PROBE C:', probeCSuccess ? '✅ LULUS' : '❌ GAGAL');

  // ─── PROBE D: DOM /login Memuat Toggle Eye (lucide) ─────────────────────────
  console.log('\n─── PROBE D: Pemeriksaan DOM /login (UI-1 Password Toggle Eye) ───');
  const loginUrl = `${WEB_BASE}/login`;
  console.log(`1. Fetching SSR DOM dari ${loginUrl}...`);
  const rLoginHtml = await fetch(loginUrl, { method: 'GET' });
  console.log('   HTTP Status:', rLoginHtml.status);
  const htmlBody = await rLoginHtml.text();

  // Memeriksa keberadaan tombol toggle atau ikon mata di DOM login
  const hasEyeToggle =
    htmlBody.includes('Lihat kata sandi') ||
    htmlBody.includes('Sembunyikan kata sandi') ||
    htmlBody.includes('aria-label="Lihat kata sandi"') ||
    htmlBody.includes('lucide-eye');

  console.log('   Deteksi Tombol / Ikon Toggle Mata di DOM:', hasEyeToggle ? '✅ Ditemukan' : '❌ Tidak Ditemukan');
  probeDSuccess = rLoginHtml.status === 200 && hasEyeToggle;
  console.log('Hasil PROBE D:', probeDSuccess ? '✅ LULUS' : '❌ GAGAL');

  // ─── RINGKASAN AKHIR ───────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log('RINGKASAN HASIL PROBE LIVE PRODUKSI:');
  console.log(`- Probe A (Kasir 1-Cabang: Login Null -> Konfirmasi -> Dashboard): ${probeASuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- Probe B (Interstisial Muncul Lagi Pasca Logout): ${probeBSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- Probe C (Sesi Nonaktif Terblokir 401 Sebelum Interstisial + Restore): ${probeCSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- Probe D (DOM /login Memuat Toggle Eye UI-1): ${probeDSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log('======================================================================');

  if (!probeASuccess || !probeBSuccess || !probeCSuccess || !probeDSuccess) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error saat probe live:', err);
  process.exit(1);
});

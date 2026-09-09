/**
 * Probe Live Production/Staging on Vercel: https://oase-dental.vercel.app/api/v1
 * Membaca kredensial dari environment variable (tanpa kredensial hardcoded).
 */

const API_BASE = process.env.PROBE_API_BASE || 'https://oase-dental.vercel.app/api/v1';

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

  const res = await fetch(`${API_BASE}${path}`, {
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
  return { status: res.status, data, cookies, res };
}

async function run() {
  console.log('======================================================================');
  console.log(`PROBE LIVE: ${API_BASE}`);
  console.log('======================================================================\n');

  if (!OWNER_EMAIL || !OWNER_PASSWORD || !CASHIER_EMAIL || !CASHIER_PASSWORD) {
    console.error('❌ Error: Kredensial tidak ditemukan di environment variable.');
    console.error('Wajib diset: PROBE_OWNER_EMAIL, PROBE_OWNER_PASSWORD, PROBE_CASHIER_EMAIL, PROBE_CASHIER_PASSWORD.');
    process.exit(1);
  }

  // ─── 1. Login Kasir Aktif ──────────────────────────────────────────────────
  console.log('1. Probe Login Kasir Aktif:');
  const rCashierLogin = await req('/auth/login', 'POST', {
    identifier: CASHIER_EMAIL,
    password: CASHIER_PASSWORD,
  });
  console.log('   Status:', rCashierLogin.status);
  console.log('   Role:', rCashierLogin.data?.data?.user?.role);
  const cashierId = rCashierLogin.data?.data?.user?.id;
  console.log('   Cashier ID:', cashierId);
  const p1Success = rCashierLogin.status === 200 && rCashierLogin.data?.data?.user?.role === 'CASHIER';
  console.log('   Result:', p1Success ? '✅ PASS' : '❌ FAIL');

  const cashierOldCookies = {
    access_token: rCashierLogin.cookies['access_token']?.value,
    refresh_token: rCashierLogin.cookies['refresh_token']?.value,
  };

  // ─── 2. Login Owner untuk Administrasi ─────────────────────────────────────
  console.log('\n2. Login Owner untuk Operasi Administrasi:');
  const rOwnerLogin = await req('/auth/login', 'POST', {
    identifier: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  console.log('   Status:', rOwnerLogin.status);
  const ownerCookies = {
    access_token: rOwnerLogin.cookies['access_token']?.value,
  };

  let p2Success = false;
  let p3Success = false;
  let p4Success = false;

  try {
    // ─── 3. Nonaktifkan Kasir via Owner ──────────────────────────────────────
    console.log('\n3. Owner Menonaktifkan Kasir:');
    const rDeactivate = await req(`/users/${cashierId}/status`, 'PATCH', {
      active: false,
    }, ownerCookies);
    console.log('   Status:', rDeactivate.status);
    console.log('   active:', rDeactivate.data?.data?.active);
    const deactivatedOk = rDeactivate.status === 200 && rDeactivate.data?.data?.active === false;
    console.log('   Result:', deactivatedOk ? '✅ Berhasil Dinonaktifkan' : '❌ Gagal Dinonaktifkan');

    // ─── 4. Request Berikutnya dengan Token Lama (GET /users) ─────────────────
    console.log('\n4. Request Berikutnya dengan Token Lama Kasir (GET /users):');
    const rOldTokenReq = await req('/users', 'GET', null, cashierOldCookies);
    console.log('   Status:', rOldTokenReq.status);
    console.log('   Code:', rOldTokenReq.data?.code);
    console.log('   Message:', rOldTokenReq.data?.message);
    p2Success = rOldTokenReq.status === 401 && rOldTokenReq.data?.code === 'ACCOUNT_DISABLED';
    console.log('   Result:', p2Success ? '✅ PASS' : '❌ FAIL');

    // ─── 5. Login Ulang Kasir Nonaktif (Kredensial Benar) ─────────────────────
    console.log('\n5. Login Ulang Kasir Nonaktif (Kredensial Benar):');
    const rLoginDisabled = await req('/auth/login', 'POST', {
      identifier: CASHIER_EMAIL,
      password: CASHIER_PASSWORD,
    }, {
      oase_remembered_branch: 'some-branch',
    });
    console.log('   Status:', rLoginDisabled.status);
    console.log('   Code:', rLoginDisabled.data?.code);
    console.log('   Message:', rLoginDisabled.data?.message);
    console.log('   Cleared remembered_branch:', rLoginDisabled.cookies['oase_remembered_branch']?.value === '');
    p3Success =
      rLoginDisabled.status === 401 &&
      rLoginDisabled.data?.code === 'ACCOUNT_DISABLED' &&
      rLoginDisabled.cookies['oase_remembered_branch']?.value === '';
    console.log('   Result:', p3Success ? '✅ PASS' : '❌ FAIL');

  } finally {
    // ─── 6. Aktifkan Kembali Kasir (PASTIKAN SELALU JALAN) ───────────────────
    console.log('\n6. Owner Mengaktifkan Kembali Kasir (Rollback / Restore):');
    const rReactivate = await req(`/users/${cashierId}/status`, 'PATCH', {
      active: true,
    }, ownerCookies);
    console.log('   Status:', rReactivate.status);
    console.log('   active:', rReactivate.data?.data?.active);
    const reactivatedOk = rReactivate.status === 200 && rReactivate.data?.data?.active === true;
    console.log('   Result:', reactivatedOk ? '✅ Berhasil Diaktifkan Kembali' : '❌ Gagal Mengaktifkan Kembali');

    // ─── 7. Login Normal Kasir Setelah Diaktifkan Kembali ─────────────────────
    console.log('\n7. Login Normal Kasir Setelah Diaktifkan Kembali:');
    const rLoginRestored = await req('/auth/login', 'POST', {
      identifier: CASHIER_EMAIL,
      password: CASHIER_PASSWORD,
    });
    console.log('   Status:', rLoginRestored.status);
    console.log('   Role:', rLoginRestored.data?.data?.user?.role);
    p4Success = rLoginRestored.status === 200 && rLoginRestored.data?.data?.user?.role === 'CASHIER';
    console.log('   Result:', p4Success ? '✅ PASS' : '❌ FAIL');
  }

  console.log('\n======================================================================');
  console.log('SUMMARY PROBE LIVE AUDIT SESI NONAKTIF:');
  console.log(`- Probe 1 (Login Kasir Aktif -> 200): ${p1Success ? 'PASSED' : 'FAILED'}`);
  console.log(`- Probe 2 (Token Lama Kasir Nonaktif -> 401 ACCOUNT_DISABLED): ${p2Success ? 'PASSED' : 'FAILED'}`);
  console.log(`- Probe 3 (Login Kasir Nonaktif -> 401 ACCOUNT_DISABLED + Clear Cookie): ${p3Success ? 'PASSED' : 'FAILED'}`);
  console.log(`- Probe 4 (Kasir Diaktifkan Kembali -> Login 200 Normal): ${p4Success ? 'PASSED' : 'FAILED'}`);
  console.log('======================================================================');

  if (!p1Success || !p2Success || !p3Success || !p4Success) {
    process.exit(1);
  }
}

run();

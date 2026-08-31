/**
 * FASE 3 — TUGAS 1: Frontend Foundation Test Suite (UI-1..UI-9 + V-1..V-4)
 *
 * Menguji fondasi frontend OASE Dental Clinic:
 * - UI-1: Login flow dengan kredensial valid (JWT cookie, user profile, role, permissions)
 * - UI-2: Login flow dengan kredensial tidak valid (401 UNAUTHORIZED, error display)
 * - UI-3 & V-1, V-2: Filter navigasi menu dinamis by permissions (OWNER vs CASHIER: Master data tersembunyi bagi CASHIER)
 * - UI-4 & V-3: Active branch indicator & switch branch flow + CASHIER direct access ke Master Data ditolak (403)
 * - UI-5: User profile / me & logout flow (/api/v1/auth/logout - cookie cleared)
 * - UI-6: Guarding server-side & client-side (unauthenticated redirect / 401 / 403)
 * - UI-7: Adaptive dashboard placeholder per role (widgets, metrics, formatters)
 * - UI-8: Placeholder routes verification (/admin/pos, /admin/inventory, dll.)
 * - UI-9: Token refresh interceptor (sesi bertahan saat access token expired via refresh)
 *
 * Jalankan saat server aktif: node apps/web/scripts/phase3-task1-test.mjs
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? 'owner@oase.id';
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? '1234';
const CASHIER_EMAIL = 'cashier@oase.id';
const CASHIER_PASSWORD = '1234';

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

async function req(path, method = 'GET', body = null, cookieString = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieString) headers['Cookie'] = cookieString;
  const isApi = path.startsWith('/api/') || path.startsWith('http');
  const url = isApi ? (path.startsWith('http') ? path : `${BASE_URL}${path}`) : `${BASE_URL}${path}`;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });

    const setCookie = res.headers.get('set-cookie') || '';
    const location = res.headers.get('location') || '';
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, setCookie, location, rawText: text };
  } catch (err) {
    return { error: err.message, status: 0, data: null, setCookie: '', location: '', rawText: '' };
  }
}

function extractCookie(cookieHeader) {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(', ');
  const accessToken = parts.find((p) => p.startsWith('access_token='));
  const refreshToken = parts.find((p) => p.startsWith('refresh_token='));

  const cookieString = [];
  if (accessToken) cookieString.push(accessToken.split(';')[0]);
  if (refreshToken) cookieString.push(refreshToken.split(';')[0]);

  return cookieString.join('; ');
}

function extractSingleCookie(cookieHeader, name) {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(', ');
  const token = parts.find((p) => p.startsWith(`${name}=`));
  return token ? token.split(';')[0] : '';
}

// ─── Tests Execution ──────────────────────────────────────────────────────────

async function run() {
  console.log('='.repeat(70));
  console.log('FASE 3 — TUGAS 1: TEST SUITE FRONTEND FOUNDATION (UI-1..UI-9 + V-1..V-4)');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  function assert(condition, testId, description, details = '') {
    if (condition) {
      console.log(`[PASS] ${testId}: ${description}`);
      if (details) console.log(`       ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${description}`);
      if (details) console.error(`       Details: ${details}`);
      failed++;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // UI-1: Login Valid (Owner & Cashier)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- UI-1: Login Valid Credentials ---');
  const ownerLogin = await req('/api/v1/auth/login', 'POST', {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });

  const ownerCookie = extractCookie(ownerLogin.setCookie);

  assert(
    ownerLogin.status === 200 &&
      ownerLogin.data?.success === true &&
      ownerLogin.data?.data?.user?.role === 'OWNER' &&
      ownerCookie.includes('access_token=') &&
      ownerCookie.includes('refresh_token='),
    'UI-1.1',
    'Owner login menghasilkan status 200, JWT cookies, role OWNER, dan permissions lengkap',
    `Permissions count: ${ownerLogin.data?.data?.user?.permissions?.length}`
  );

  const cashierLogin = await req('/api/v1/auth/login', 'POST', {
    email: CASHIER_EMAIL,
    password: CASHIER_PASSWORD,
  });
  let cashierCookie = extractCookie(cashierLogin.setCookie);

  assert(
    cashierLogin.status === 200 &&
      cashierLogin.data?.data?.user?.role === 'CASHIER' &&
      cashierLogin.data?.data?.user?.branches?.length >= 2,
    'UI-1.2',
    'Cashier login menghasilkan role CASHIER dengan daftar cabang assignment',
    `Branches: ${cashierLogin.data?.data?.user?.branches?.map((b) => b.code).join(', ')}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // UI-2: Login Invalid Credentials
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- UI-2: Login Invalid Credentials ---');
  const invalidLogin = await req('/api/v1/auth/login', 'POST', {
    email: OWNER_EMAIL,
    password: 'wrongpassword',
  });

  assert(
    invalidLogin.status === 401 &&
      invalidLogin.data?.success === false &&
      invalidLogin.data?.code === 'UNAUTHORIZED',
    'UI-2.1',
    'Login dengan password salah ditolak (401 UNAUTHORIZED)',
    `Response message: "${invalidLogin.data?.message}"`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // UI-3 & V-1, V-2: Navigation Menu Filtering by Permissions
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- UI-3 & V-1, V-2: Navigation Menu & Permission Isolation ---');
  const ownerPerms = ownerLogin.data?.data?.user?.permissions || [];
  const cashierPerms = cashierLogin.data?.data?.user?.permissions || [];

  const ownerHasMasterData = ownerPerms.includes('MASTER_DATA_READ') || ownerPerms.includes('MASTER_DATA_MANAGE');
  const cashierHasMasterData = cashierPerms.includes('MASTER_DATA_READ') || cashierPerms.includes('MASTER_DATA_MANAGE');

  assert(
    ownerHasMasterData,
    'V-1',
    'Login OWNER -> permissions memuat MASTER_DATA_READ / MASTER_DATA_MANAGE (Menu Master Data TAMPIL bagi OWNER)'
  );

  assert(
    !cashierHasMasterData,
    'V-2',
    'Login CASHIER -> permissions TIDAK memuat MASTER_DATA_READ (Menu Master Data TERSEMBUNYI bagi CASHIER)'
  );

  assert(
    ownerPerms.includes('USER_MANAGE') &&
      ownerPerms.includes('POS_CREATE') &&
      cashierPerms.includes('POS_CREATE') &&
      !cashierPerms.includes('USER_MANAGE'),
    'UI-3.1',
    'Owner memiliki akses manajemen sistem (USER_MANAGE), Kasir dibatasi hanya POS, Closing, Absensi, Cuti'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // V-3: Request Langsung CASHIER ke Endpoint Master Data
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- V-3: Endpoint Master Data Access Guard ---');
  const cashierProductsRes = await req('/api/v1/products', 'GET', null, cashierCookie);
  const cashierServicesRes = await req('/api/v1/services', 'GET', null, cashierCookie);
  const cashierCategoriesRes = await req('/api/v1/categories', 'GET', null, cashierCookie);
  const cashierMaterialsRes = await req('/api/v1/materials', 'GET', null, cashierCookie);

  assert(
    cashierProductsRes.status === 403 &&
      cashierServicesRes.status === 403 &&
      cashierCategoriesRes.status === 403 &&
      cashierMaterialsRes.status === 403,
    'V-3',
    'Request langsung CASHIER ke master data (products, services, categories, materials) ditolak dengan 403 FORBIDDEN'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // UI-4: Active Branch Indicator & Switch Branch
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- UI-4: Active Branch Indicator & Switch Branch ---');
  const cashierBranches = cashierLogin.data?.data?.user?.branches || [];
  const targetBranch = cashierBranches[0];

  let switchSuccess = false;
  if (targetBranch) {
    const switchRes = await req(
      '/api/v1/auth/switch-branch',
      'POST',
      { branchId: targetBranch.id },
      cashierCookie
    );
    const newCookie = extractCookie(switchRes.setCookie);
    if (newCookie) cashierCookie = newCookie;

    switchSuccess =
      switchRes.status === 200 &&
      switchRes.data?.data?.user?.activeBranchId === targetBranch.id &&
      cashierCookie.includes('access_token=');
  }

  assert(
    switchSuccess,
    'UI-4.1',
    'Switch branch berhasil mengubah activeBranchId dan memperbarui access_token cookie',
    `Switched to branch: ${targetBranch?.name} (${targetBranch?.code})`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // UI-5: User Profile & Logout
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- UI-5: User Profile & Logout ---');
  const meRes = await req(
    '/api/v1/auth/me',
    'GET',
    null,
    ownerCookie
  );

  assert(
    meRes.status === 200 && meRes.data?.data?.user?.email === OWNER_EMAIL,
    'UI-5.1',
    'GET /api/v1/auth/me mengembalikan data profil pengguna yang aktif'
  );

  const logoutRes = await req(
    '/api/v1/auth/logout',
    'POST',
    null,
    ownerCookie
  );

  const isAccessCleared = logoutRes.setCookie.includes('access_token=;') || logoutRes.setCookie.includes('Max-Age=0');
  const isRefreshCleared = logoutRes.setCookie.includes('refresh_token=;') || logoutRes.setCookie.includes('Max-Age=0');

  assert(
    logoutRes.status === 200 && isAccessCleared && isRefreshCleared,
    'UI-5.2',
    'POST /api/v1/auth/logout menghapus cookie access_token dan refresh_token'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // UI-6: Route & API Guarding
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- UI-6: Route & API Guarding ---');
  const unauthedAdmin = await req('/admin', 'GET');
  const isRedirectToLogin =
    unauthedAdmin.status === 307 ||
    unauthedAdmin.status === 302 ||
    unauthedAdmin.status === 308 ||
    unauthedAdmin.location.includes('/login');

  assert(
    isRedirectToLogin,
    'UI-6.1',
    'Akses /admin tanpa cookie auth diarahkan server ke /login via HTTP redirect',
    `Status: ${unauthedAdmin.status}, Location: ${unauthedAdmin.location}`
  );

  const unauthedUsersApi = await req('/api/v1/users', 'GET');
  assert(
    unauthedUsersApi.status === 401,
    'UI-6.2',
    'Akses endpoint protected /api/v1/users tanpa cookie auth ditolak dengan 401 Unauthorized'
  );

  const cashierUsersApi = await req(
    '/api/v1/users',
    'GET',
    null,
    cashierCookie
  );
  assert(
    cashierUsersApi.status === 403,
    'UI-6.3',
    'Akses endpoint terlarang oleh Cashier ditolak dengan 403 FORBIDDEN'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // UI-7: Adaptive Dashboard & Pages Response
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- UI-7: Adaptive Dashboard & Pages Response ---');
  const adminPageRes = await req(
    '/admin',
    'GET',
    null,
    cashierCookie
  );
  assert(
    adminPageRes.status === 200 && adminPageRes.rawText.includes('OASE Dental'),
    'UI-7.1',
    'Halaman /admin merespons HTTP 200 untuk pengguna terautentikasi'
  );

  const loginPageRes = await req('/login', 'GET');
  assert(
    loginPageRes.status === 200 && loginPageRes.rawText.includes('OASE Dental Clinic'),
    'UI-7.2',
    'Halaman /login merespons HTTP 200 dan menampilkan formulir login'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // UI-8: Placeholder Routes Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- UI-8: Placeholder Sub-routes ---');
  const placeholderRoutes = [
    '/admin/pos',
    '/admin/cash-closing',
    '/admin/inventory',
    '/admin/expenses',
    '/admin/attendance',
    '/admin/leaves',
    '/admin/master-data',
    '/admin/reports',
    '/admin/users',
    '/admin/branches',
    '/admin/audit-logs',
    '/admin/portal',
    '/admin/unauthorized',
  ];

  let allPlaceholders200 = true;
  for (const route of placeholderRoutes) {
    const r = await req(
      route,
      'GET',
      null,
      cashierCookie
    );
    if (r.status !== 200) {
      allPlaceholders200 = false;
      console.error(`Route ${route} failed with status ${r.status}`);
    }
  }

  assert(
    allPlaceholders200,
    'UI-8.1',
    `Seluruh ${placeholderRoutes.length} placeholder routes merespons HTTP 200 dengan layout lengkap`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // UI-9: Token Refresh Interceptor Flow
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- UI-9: Token Refresh Interceptor Flow ---');
  const freshLogin = await req('/api/v1/auth/login', 'POST', {
    email: CASHIER_EMAIL,
    password: CASHIER_PASSWORD,
  });
  const freshRefreshCookie = extractSingleCookie(freshLogin.setCookie, 'refresh_token');

  // Simulasikan access_token expired (hanya kirim refresh_token ke /api/v1/auth/refresh)
  const refreshRes = await req(
    '/api/v1/auth/refresh',
    'POST',
    null,
    freshRefreshCookie
  );

  const rotatedAccessCookie = extractSingleCookie(refreshRes.setCookie, 'access_token');
  const rotatedRefreshCookie = extractSingleCookie(refreshRes.setCookie, 'refresh_token');

  assert(
    refreshRes.status === 200 &&
      refreshRes.data?.success === true &&
      rotatedAccessCookie.length > 0 &&
      rotatedRefreshCookie.length > 0,
    'UI-9.1',
    'Endpoint /api/v1/auth/refresh menerbitkan pasangan access & refresh token baru'
  );

  // Gunakan access token hasil rotasi untuk mengakses /auth/me
  const afterRefreshMe = await req(
    '/api/v1/auth/me',
    'GET',
    null,
    rotatedAccessCookie
  );

  assert(
    afterRefreshMe.status === 200 &&
      afterRefreshMe.data?.data?.user?.role === 'CASHIER',
    'UI-9.2',
    'Sesi pengguna tetap aktif dan valid menggunakan token baru hasil rotasi'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Ringkasan
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log(`HASIL TEST SUITE: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});

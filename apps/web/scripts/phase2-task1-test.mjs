/**
 * FASE 2 — TUGAS 1: Attendance (Check-in, Check-out, Riwayat me, List tim, Koreksi manual)
 * Bukti kriteria T1–T10 + D1–D4.
 *
 * Jalankan saat dev server aktif: node apps/web/scripts/phase2-task1-test.mjs
 * Override base URL: API_BASE=http://localhost:3000/api/v1
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

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
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
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
  return {
    cookie: extractAccessCookie(r.setCookie),
    status: r.status,
    data: r.data,
    setCookie: r.setCookie,
  };
}

function show(label, r) {
  const preview =
    typeof r.data === 'object'
      ? JSON.stringify(r.data).slice(0, 200)
      : r.rawText?.slice(0, 200);
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
  console.log('══════════════════════════════════════════════════════════');
  console.log('=== STARTING PHASE 2 TASK 1 ATTENDANCE TESTS ===');
  console.log('══════════════════════════════════════════════════════════\n');

  // 1. Persiapan Akun & Role
  const ownerLogin = await login('owner@oase.id');
  const ownerCookie = ownerLogin.cookie;
  assert('Login OWNER berhasil', ownerLogin.status === 200 && !!ownerCookie);

  // Ambil list cabang untuk switch-branch
  const branchesRes = await req('/branches', 'GET', null, ownerCookie);
  const branches = branchesRes.data?.data ?? [];
  const jkt = branches.find((b) => b.code === 'JKT');
  const bdg = branches.find((b) => b.code === 'BDG');
  assert('Cabang JKT dan BDG tersedia', !!jkt && !!bdg);

  // Buat 1 employee baru + 1 user CASHIER baru khusus test ini agar fresh
  const rnd = String(Math.floor(Math.random() * 100000));
  const empRes = await req(
    '/employees',
    'POST',
    {
      name: 'Kasir Absensi ' + rnd,
      position: 'Kasir',
      phone: '0812' + rnd,
      branchIds: [jkt.id, bdg.id],
    },
    ownerCookie
  );
  assert('Create employee untuk tes berhasil', empRes.status === 201);
  const testEmpId = empRes.data?.data?.id;

  const testEmail = `kasir.absen.${rnd}@oase.id`;
  const userRes = await req(
    '/users',
    'POST',
    {
      email: testEmail,
      password: 'Password123',
      role: 'CASHIER',
      employeeId: testEmpId,
    },
    ownerCookie
  );
  assert('Create user CASHIER baru berhasil', userRes.status === 201);

  // Buat 1 user MANAGER untuk tes guard list
  const empMgrRes = await req(
    '/employees',
    'POST',
    {
      name: 'Manager Absensi ' + rnd,
      position: 'Manager Klinik',
      phone: '0813' + rnd,
      branchIds: [jkt.id],
    },
    ownerCookie
  );
  const mgrEmpId = empMgrRes.data?.data?.id;
  const mgrEmail = `manager.absen.${rnd}@oase.id`;
  await req(
    '/users',
    'POST',
    {
      email: mgrEmail,
      password: 'Password123',
      role: 'MANAGER',
      employeeId: mgrEmpId,
    },
    ownerCookie
  );

  // ─── T4: Check-in TANPA switch-branch → 400 (karena punya 2 cabang, activeBranchId = null)
  console.log('\n─── T4. Check-in TANPA switch-branch ───');
  const cashierLogin = await login(testEmail, 'Password123');
  let cashierCookie = cashierLogin.cookie;
  assert('Login Cashier (2 cabang) activeBranchId null', cashierLogin.data?.data?.user?.activeBranchId === null);

  const t4 = await req('/attendance/check-in', 'POST', null, cashierCookie);
  show('T4 Check-in tanpa branch aktif', t4);
  assert('T4: tolak check-in tanpa switch-branch (400)', t4.status === 400);

  // ─── T4b (D1): Check-in oleh OWNER (tanpa employeeId) → 400
  console.log('\n─── T4b. Check-in oleh OWNER tanpa employeeId ───');
  const t4b = await req('/attendance/check-in', 'POST', null, ownerCookie);
  show('T4b Check-in OWNER tanpa employeeId', t4b);
  assert('T4b: tolak check-in akun tanpa employeeId (400)', t4b.status === 400);

  // ─── T1: Switch-branch ke JKT lalu POST check-in → 201
  console.log('\n─── T1. Switch-branch lalu Check-in ───');
  const switchRes = await req(
    '/auth/switch-branch',
    'POST',
    { branchId: jkt.id },
    cashierCookie
  );
  assert('Switch-branch ke JKT berhasil', switchRes.status === 200);
  cashierCookie = extractAccessCookie(switchRes.setCookie);

  const t1 = await req('/attendance/check-in', 'POST', null, cashierCookie);
  show('T1 Check-in', t1);
  assert('T1: status 201 CREATED', t1.status === 201);
  assert('T1: status PRESENT atau LATE terisi', t1.data?.data?.status === 'PRESENT' || t1.data?.data?.status === 'LATE');
  assert('T1: checkIn timestamp terisi', !!t1.data?.data?.checkIn);
  assert('T1: workDate terisi', !!t1.data?.data?.workDate);
  const attendanceId = t1.data?.data?.id;

  // ─── T2: Double check-in di hari yang sama → 400 (ALREADY_CHECKED_IN)
  console.log('\n─── T2. Double Check-in di hari sama ───');
  const t2 = await req('/attendance/check-in', 'POST', null, cashierCookie);
  show('T2 Double check-in', t2);
  assert('T2: tolak check-in ganda (400)', t2.status === 400);
  assert('T2: error code ALREADY_CHECKED_IN', t2.data?.code === 'ALREADY_CHECKED_IN', `code=${t2.data?.code}`);

  // ─── T5: Guard SELF & Role Guard
  console.log('\n─── T5. Guard SELF & Role Guard ───');
  // CASHIER mencoba akses GET /attendance (bukan me) -> 403 (karena CASHIER tidak punya ATTENDANCE_VIEW_ALL)
  const t5_viewAll = await req('/attendance', 'GET', null, cashierCookie);
  show('T5 CASHIER panggil /attendance (view all)', t5_viewAll);
  assert('T5: CASHIER ditolak GET /attendance (403 FORBIDDEN)', t5_viewAll.status === 403);

  // ─── T6: GET /attendance/me (Riwayat sendiri) → 200
  console.log('\n─── T6. GET /attendance/me ───');
  const t6 = await req('/attendance/me', 'GET', null, cashierCookie);
  show('T6 Riwayat absensi sendiri', t6);
  assert('T6: status 200', t6.status === 200);
  assert('T6: berisi record absensi hari ini', Array.isArray(t6.data?.data) && t6.data.data.some((a) => a.id === attendanceId));
  // Pastikan data hanya milik employee test ini
  const allOwn = t6.data?.data?.every((a) => a.employeeId === testEmpId);
  assert('T6: semua data hanya milik employee terkait', allOwn);

  // ─── T3: POST check-out → 200, durasi / checkOut terisi
  console.log('\n─── T3. POST check-out ───');
  const t3 = await req('/attendance/check-out', 'POST', null, cashierCookie);
  show('T3 Check-out', t3);
  assert('T3: status 200 OK', t3.status === 200);
  assert('T3: checkOut terisi', !!t3.data?.data?.checkOut);

  // ─── T10: Check-out kedua kali di hari sama → 409 INVALID_TRANSACTION_STATE
  console.log('\n─── T10. Check-out kedua kali ───');
  const t10 = await req('/attendance/check-out', 'POST', null, cashierCookie);
  show('T10 Double check-out', t10);
  assert('T10: status 409 Conflict', t10.status === 409);
  assert('T10: code INVALID_TRANSACTION_STATE', t10.data?.code === 'INVALID_TRANSACTION_STATE');

  // ─── T7: GET /attendance (OWNER & MANAGER)
  console.log('\n─── T7. GET /attendance list tim (OWNER & MANAGER) ───');
  const t7_owner = await req('/attendance', 'GET', null, ownerCookie);
  show('T7 List tim oleh OWNER', t7_owner);
  assert('T7: OWNER GET /attendance status 200', t7_owner.status === 200);
  assert('T7: OWNER menerima pagination meta', !!t7_owner.data?.meta);

  // Login Manager
  const mgrLogin = await login(mgrEmail, 'Password123');
  let mgrCookie = mgrLogin.cookie;
  // MANAGER auto/switch-branch
  const mgrSwitch = await req('/auth/switch-branch', 'POST', { branchId: jkt.id }, mgrCookie);
  if (mgrSwitch.status === 200) {
    mgrCookie = extractAccessCookie(mgrSwitch.setCookie);
  }
  const t7_mgr = await req('/attendance', 'GET', null, mgrCookie);
  show('T7 List tim oleh MANAGER', t7_mgr);
  assert('T7: MANAGER GET /attendance status 200', t7_mgr.status === 200);

  // ─── T8: Auth & Not Found Guard
  console.log('\n─── T8. Tanpa cookie → 401; id acak koreksi → 404 ───');
  const t8_noCookie = await req('/attendance/me', 'GET');
  assert('T8: tanpa cookie → 401', t8_noCookie.status === 401);

  const t8_rand = await req(
    '/attendance/00000000-0000-0000-0000-000000000000/correct',
    'POST',
    { note: 'Koreksi test' },
    ownerCookie
  );
  show('T8 Koreksi ID acak', t8_rand);
  assert('T8: koreksi ID acak → 404 NOT_FOUND', t8_rand.status === 404);

  // ─── T9: Koreksi manual (OWNER) & Status LATE
  console.log('\n─── T9. Koreksi manual OWNER (POST /attendance/:id/correct) ───');
  const correctIso = '2026-08-31T09:30:00.000Z'; // Jam 09:30 UTC = 16:30 WIB (> lateAfter 08:15)
  const t9 = await req(
    `/attendance/${attendanceId}/correct`,
    'POST',
    {
      checkIn: correctIso,
      note: 'Koreksi terlambat karena dinas luar',
    },
    ownerCookie
  );
  show('T9 Koreksi status ke LATE', t9);
  assert('T9: koreksi sukses status 200', t9.status === 200);
  assert('T9: status berubah jadi LATE', t9.data?.data?.status === 'LATE');
  assert('T9: flag corrected = true', t9.data?.data?.corrected === true);
  assert('T9: correctionNote tersimpan', t9.data?.data?.correctionNote === 'Koreksi terlambat karena dinas luar');

  // ─── T11 (WAJIB): Bukti Scope MANAGER (Tembok Scope Antarcabang) ───
  console.log('\n─── T11. Bukti Scope MANAGER (Tembok Scope Antarcabang) ───');
  // Buat employee & kasir di cabang BDG untuk check-in di BDG
  const empBdgRes = await req(
    '/employees',
    'POST',
    {
      name: 'Kasir Bandung ' + rnd,
      position: 'Kasir',
      phone: '0814' + rnd,
      branchIds: [bdg.id],
    },
    ownerCookie
  );
  const bdgEmpId = empBdgRes.data?.data?.id;
  const bdgEmail = `kasir.bdg.${rnd}@oase.id`;
  await req(
    '/users',
    'POST',
    {
      email: bdgEmail,
      password: 'Password123',
      role: 'CASHIER',
      employeeId: bdgEmpId,
    },
    ownerCookie
  );

  const bdgCashierLogin = await login(bdgEmail, 'Password123');
  const bdgCashierCookie = bdgCashierLogin.cookie;
  const bdgCheckInRes = await req('/attendance/check-in', 'POST', null, bdgCashierCookie);
  assert('Check-in di cabang BDG berhasil', bdgCheckInRes.status === 201);
  const bdgAttendanceId = bdgCheckInRes.data?.data?.id;

  // MANAGER (aktif di JKT) panggil GET /attendance
  const t11_mgrList = await req('/attendance', 'GET', null, mgrCookie);
  show('T11 List tim oleh MANAGER (aktif di JKT)', t11_mgrList);
  assert('T11: MANAGER status 200', t11_mgrList.status === 200);
  const containsBdg = t11_mgrList.data?.data?.some((a) => a.id === bdgAttendanceId || a.branchId === bdg.id);
  assert('T11: Record cabang BDG TIDAK MUNCUL di list MANAGER cabang JKT (tembok scope terbukti)', !containsBdg);
  const allJkt = t11_mgrList.data?.data?.every((a) => a.branchId === jkt.id);
  assert('T11: Semua data yang diterima MANAGER adalah cabang JKT', allJkt);

  // ─── T12: OWNER Koreksi Record ke Status PRESENT ───
  console.log('\n─── T12. OWNER Koreksi Record ke Status PRESENT ───');
  const correctPresentIso = '2026-08-31T00:30:00.000Z'; // 00:30 UTC = 07:30 WIB (<= lateAfter 08:15)
  const t12 = await req(
    `/attendance/${attendanceId}/correct`,
    'POST',
    {
      checkIn: correctPresentIso,
      note: 'Koreksi datang tepat waktu sebelum batas 08:15',
    },
    ownerCookie
  );
  show('T12 Koreksi status ke PRESENT', t12);
  assert('T12: koreksi sukses status 200', t12.status === 200);
  assert('T12: status berubah jadi PRESENT', t12.data?.data?.status === 'PRESENT');
  assert('T12: flag corrected = true', t12.data?.data?.corrected === true);
  assert('T12: correctionNote tersimpan', t12.data?.data?.correctionNote === 'Koreksi datang tepat waktu sebelum batas 08:15');

  // ─── T13: MANAGER Coba Koreksi Manual → 403 FORBIDDEN ───
  console.log('\n─── T13. MANAGER Coba Koreksi Manual → 403 ───');
  const t13 = await req(
    `/attendance/${attendanceId}/correct`,
    'POST',
    {
      note: 'Manager mencoba koreksi',
    },
    mgrCookie
  );
  show('T13 MANAGER coba koreksi', t13);
  assert('T13: MANAGER ditolak koreksi (403 FORBIDDEN)', t13.status === 403);

  // ─── Cheap Tests: Query Validations pada /me ───
  console.log('\n─── Cheap Tests: Validasi Query /attendance/me ───');
  const cheap_invalid = await req('/attendance/me?month=abracadabra', 'GET', null, cashierCookie);
  show('Cheap test month=abracadabra', cheap_invalid);
  assert('Cheap: ?month invalid format → 400 VALIDATION_ERROR', cheap_invalid.status === 400);

  const cheap_pastMonth = await req('/attendance/me?month=2026-01', 'GET', null, cashierCookie);
  show('Cheap test month=2026-01', cheap_pastMonth);
  assert('Cheap: ?month bulan lalu → 200 array', cheap_pastMonth.status === 200 && Array.isArray(cheap_pastMonth.data?.data));

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('=== PHASE 2 TASK 1 ATTENDANCE TEST SELESAI ===');
  if (process.exitCode === 1) {
    console.error('⚠️  Ada pengujian yang GAGAL');
  } else {
    console.log('✅ Semua T1–T13 (+ T4b & Cheap Tests) HIJAU');
  }
  console.log('══════════════════════════════════════════════════════════');
}

run().catch((err) => {
  console.error('Error saat menjalankan test:', err);
  process.exit(1);
});

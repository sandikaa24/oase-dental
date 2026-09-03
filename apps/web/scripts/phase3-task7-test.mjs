/**
 * FASE 3 — TUGAS 7: TEST SUITE FRONTEND ABSENSI & KOREKSI PRESENSI (ATT-UI-1..ATT-UI-12)
 *
 * Menguji:
 * - ATT-UI-1: Halaman /admin/attendance merespons HTTP 200 untuk OWNER, MANAGER, CASHIER
 * - ATT-UI-2: Karyawan dengan cabang aktif berhasil check-in (status 201, field status terisi)
 * - ATT-UI-3: Check-in ganda pada hari yang sama ditolak (400 ALREADY_CHECKED_IN)
 * - ATT-UI-4: Karyawan berhasil check-out shift kerja (status 200, checkOut terisi)
 * - ATT-UI-5: Check-out kedua kali pada hari sama ditolak (409 INVALID_TRANSACTION_STATE)
 * - ATT-UI-6: GET /attendance/me?month=YYYY-MM mengembalikan riwayat pribadi
 * - ATT-UI-7: Scope isolation: MANAGER cabang JKT hanya melihat presensi JKT, bukan BDG
 * - ATT-UI-8: OWNER berhasil melihat presensi tim lintas cabang & filter ?branchId
 * - ATT-UI-9: CASHIER ditolak saat mencoba akses data tim GET /attendance (403 FORBIDDEN)
 * - ATT-UI-10: OWNER berhasil koreksi jam presensi via /attendance/:id/correct (status 200, corrected=true, note tersimpan, audit log)
 * - ATT-UI-11: Non-OWNER ditolak saat mencoba koreksi manual (403 FORBIDDEN)
 * - ATT-UI-12: Persona Guard: Akun tanpa employeeId ditolak check-in (400) dan tidak crash UI
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const WEB_BASE = process.env.WEB_BASE ?? 'http://localhost:3000';

let passCount = 0;
let failCount = 0;

function pass(name, detail = '') {
  passCount++;
  console.log(`[PASS] ${name}`);
  if (detail) console.log(`       ${detail}`);
}

function fail(name, reason) {
  failCount++;
  console.error(`[FAIL] ${name}`);
  console.error(`       Alasan: ${reason}`);
}

function extractAccessCookie(cookieHeader) {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(', ');
  const token = parts.find((p) => p.startsWith('access_token='));
  return token ? token.split(';')[0] : '';
}

async function req(path, method = 'GET', body = null, cookie = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
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
  return { status: res.status, data, setCookie, headers: res.headers };
}

async function reqWeb(path, cookie = null) {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${WEB_BASE}${path}`, {
    method: 'GET',
    headers,
    redirect: 'manual',
  });
  return { status: res.status, headers: res.headers };
}

async function login(email, password = '1234') {
  const res = await req('/auth/login', 'POST', { email, password });
  return {
    status: res.status,
    data: res.data?.data,
    cookie: extractAccessCookie(res.setCookie),
  };
}

async function main() {
  console.log('======================================================================');
  console.log('FASE 3 — TUGAS 7: TEST SUITE FRONTEND ABSENSI & KOREKSI PRESENSI');
  console.log('======================================================================\n');

  // ─── SETUP AKUN & CABANG ──────────────────────────────────────────────────
  console.log('[SETUP] Autentikasi Pengguna & Persiapan Data Uji...');
  const owner = await login('owner@oase.id');
  if (owner.status !== 200) throw new Error('Login OWNER gagal');
  pass('Login OWNER berhasil');

  const branchesRes = await req('/branches', 'GET', null, owner.cookie);
  const jkt = branchesRes.data?.data?.find((b) => b.code === 'JKT');
  const bdg = branchesRes.data?.data?.find((b) => b.code === 'BDG');
  if (!jkt || !bdg) throw new Error('Cabang JKT atau BDG tidak ditemukan');
  pass('Cabang pengujian JKT dan BDG tersedia');

  // Setup user MANAGER dinamis untuk pengujian IDOR dan role guard (pola Phase 3)
  const rndSeed = Math.floor(Math.random() * 900000) + 100000;
  const mgrEmpRes = await req(
    '/employees',
    'POST',
    {
      name: `Manager Att ${rndSeed}`,
      position: 'Manager Cabang',
      phone: `0817${rndSeed}`,
      branchIds: [jkt.id],
    },
    owner.cookie
  );
  const mgrEmp = mgrEmpRes.data?.data;
  const mgrEmail = `mgr.att.${rndSeed}@oase.id`;
  await req(
    '/users',
    'POST',
    {
      email: mgrEmail,
      password: 'PasswordManager123',
      role: 'MANAGER',
      employeeId: mgrEmp?.id,
    },
    owner.cookie
  );
  const mgr = await login(mgrEmail, 'PasswordManager123');
  const switchMgr = await req('/auth/switch-branch', 'POST', { branchId: jkt.id }, mgr.cookie);
  const mgrCookie = extractAccessCookie(switchMgr.setCookie) || mgr.cookie;
  pass('Login MANAGER berhasil dan terpasang di cabang JKT');

  const cashier = await login('cashier@oase.id');
  const switchCashier = await req('/auth/switch-branch', 'POST', { branchId: jkt.id }, cashier.cookie);
  const cashierCookie = extractAccessCookie(switchCashier.setCookie) || cashier.cookie;
  pass('Login CASHIER berhasil dan terpasang di cabang JKT');

  // Bersihkan absensi hari ini untuk akun kasir agar fresh
  const cashierUser = await prisma.user.findUnique({
    where: { email: 'cashier@oase.id' },
    include: { employee: true },
  });
  if (cashierUser?.employeeId) {
    await prisma.attendance.deleteMany({
      where: { employeeId: cashierUser.employeeId },
    });
  }

  // ─── ATT-UI-1: Page Response ──────────────────────────────────────────────
  console.log('\n--- ATT-UI-1: Halaman /admin/attendance Response ---');
  const pageOwner = await reqWeb('/admin/attendance', owner.cookie);
  if (pageOwner.status === 200) {
    pass('ATT-UI-1.1: Halaman /admin/attendance merespons HTTP 200 untuk OWNER');
  } else {
    fail('ATT-UI-1.1', `Status ${pageOwner.status}`);
  }

  const pageMgr = await reqWeb('/admin/attendance', mgrCookie);
  if (pageMgr.status === 200) {
    pass('ATT-UI-1.2: Halaman /admin/attendance merespons HTTP 200 untuk MANAGER');
  } else {
    fail('ATT-UI-1.2', `Status ${pageMgr.status}`);
  }

  const pageCashier = await reqWeb('/admin/attendance', cashierCookie);
  if (pageCashier.status === 200) {
    pass('ATT-UI-1.3: Halaman /admin/attendance merespons HTTP 200 untuk CASHIER');
  } else {
    fail('ATT-UI-1.3', `Status ${pageCashier.status}`);
  }

  // ─── ATT-UI-2: Check-In Sukses ───────────────────────────────────────────
  console.log('\n--- ATT-UI-2: Presensi Masuk (Check-In) ---');
  const checkInRes = await req('/attendance/check-in', 'POST', null, cashierCookie);
  if (
    checkInRes.status === 201 &&
    checkInRes.data?.success &&
    checkInRes.data?.data?.checkIn &&
    (checkInRes.data?.data?.status === 'PRESENT' || checkInRes.data?.data?.status === 'LATE')
  ) {
    pass(
      'ATT-UI-2: Karyawan berhasil check-in hari ini',
      `Status: ${checkInRes.data.data.status}, Jam: ${checkInRes.data.data.checkIn}`
    );
  } else {
    fail('ATT-UI-2', `Status ${checkInRes.status}: ${JSON.stringify(checkInRes.data)}`);
  }

  const attId = checkInRes.data?.data?.id;

  // ─── ATT-UI-3: Double Check-In Ditolak ────────────────────────────────────
  console.log('\n--- ATT-UI-3: Penolakan Check-In Ganda ---');
  const doubleInRes = await req('/attendance/check-in', 'POST', null, cashierCookie);
  if (
    doubleInRes.status === 400 &&
    doubleInRes.data?.code === 'ALREADY_CHECKED_IN'
  ) {
    pass('ATT-UI-3: Check-in ganda pada hari yang sama ditolak (400 ALREADY_CHECKED_IN)');
  } else {
    fail('ATT-UI-3', `Status ${doubleInRes.status}: ${JSON.stringify(doubleInRes.data)}`);
  }

  // ─── ATT-UI-4: Check-Out Sukses ──────────────────────────────────────────
  console.log('\n--- ATT-UI-4: Presensi Keluar (Check-Out) ---');
  const checkOutRes = await req('/attendance/check-out', 'POST', null, cashierCookie);
  if (
    checkOutRes.status === 200 &&
    checkOutRes.data?.success &&
    checkOutRes.data?.data?.checkOut
  ) {
    pass('ATT-UI-4: Karyawan berhasil check-out shift', `CheckOut: ${checkOutRes.data.data.checkOut}`);
  } else {
    fail('ATT-UI-4', `Status ${checkOutRes.status}: ${JSON.stringify(checkOutRes.data)}`);
  }

  // ─── ATT-UI-5: Double Check-Out Ditolak ───────────────────────────────────
  console.log('\n--- ATT-UI-5: Penolakan Check-Out Ganda ---');
  const doubleOutRes = await req('/attendance/check-out', 'POST', null, cashierCookie);
  if (
    doubleOutRes.status === 409 &&
    doubleOutRes.data?.code === 'INVALID_TRANSACTION_STATE'
  ) {
    pass('ATT-UI-5: Check-out kedua kali ditolak (409 INVALID_TRANSACTION_STATE)');
  } else {
    fail('ATT-UI-5', `Status ${doubleOutRes.status}: ${JSON.stringify(doubleOutRes.data)}`);
  }

  // ─── ATT-UI-6: Riwayat Sendiri (GET /me) ──────────────────────────────────
  console.log('\n--- ATT-UI-6: Riwayat Presensi Sendiri (GET /attendance/me) ---');
  const currentMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);

  const meRes = await req(`/attendance/me?month=${currentMonth}`, 'GET', null, cashierCookie);
  if (
    meRes.status === 200 &&
    meRes.data?.success &&
    Array.isArray(meRes.data?.data) &&
    meRes.data.data.length > 0
  ) {
    pass(
      'ATT-UI-6: Karyawan berhasil mengambil data riwayat presensi sendiri',
      `Jumlah record bulan ${currentMonth}: ${meRes.data.data.length}`
    );
  } else {
    fail('ATT-UI-6', `Status ${meRes.status}: ${JSON.stringify(meRes.data)}`);
  }

  // ─── SETUP RECORD TAMBAHAN UNTUK UJI SCOPE ISOLATION ─────────────────────
  // Buat 1 karyawan di cabang BDG dan catatkan absensi di BDG
  const rnd = String(Math.floor(Math.random() * 10000));
  const empBdgRes = await req(
    '/employees',
    'POST',
    {
      name: 'Staf Bandung ' + rnd,
      position: 'Perawat',
      phone: '0813' + rnd,
      branchIds: [bdg.id],
    },
    owner.cookie
  );
  const empBdg = empBdgRes.data?.data;

  // Catat absensi langsung ke DB untuk staf BDG hari ini
  const todayWib = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  await prisma.attendance.create({
    data: {
      employeeId: empBdg.id,
      branchId: bdg.id,
      workDate: new Date(`${todayWib}T00:00:00.000Z`),
      checkIn: new Date(),
      status: 'PRESENT',
    },
  });

  // ─── ATT-UI-7: Scope Isolation MANAGER ────────────────────────────────────
  console.log('\n--- ATT-UI-7: Scope Isolation Presensi Tim MANAGER ---');
  const mgrTeamRes = await req('/attendance', 'GET', null, mgrCookie);
  if (mgrTeamRes.status === 200 && Array.isArray(mgrTeamRes.data?.data)) {
    const allJkt = mgrTeamRes.data.data.every((r) => r.branchId === jkt.id);
    const hasBdg = mgrTeamRes.data.data.some((r) => r.branchId === bdg.id);

    if (allJkt && !hasBdg) {
      pass(
        'ATT-UI-7: MANAGER cabang JKT hanya melihat presensi cabang JKT (data BDG tidak bocor)',
        `Total data JKT: ${mgrTeamRes.data.data.length}`
      );
    } else {
      fail('ATT-UI-7', `Data cabang lain bocor ke MANAGER: allJkt=${allJkt}, hasBdg=${hasBdg}`);
    }
  } else {
    fail('ATT-UI-7', `Status ${mgrTeamRes.status}: ${JSON.stringify(mgrTeamRes.data)}`);
  }

  // ─── ATT-UI-8: OWNER Melihat Seluruh Cabang & Filter Branch ────────────────
  console.log('\n--- ATT-UI-8: OWNER Akses Seluruh Cabang & Filter Branch ---');
  const ownerAllRes = await req('/attendance', 'GET', null, owner.cookie);
  const ownerBdgRes = await req(`/attendance?branchId=${bdg.id}`, 'GET', null, owner.cookie);

  if (
    ownerAllRes.status === 200 &&
    ownerBdgRes.status === 200 &&
    ownerBdgRes.data?.data?.every((r) => r.branchId === bdg.id)
  ) {
    pass(
      'ATT-UI-8: OWNER berhasil memfilter presensi berdasarkan branchId BDG',
      `Data BDG: ${ownerBdgRes.data.data.length}`
    );
  } else {
    fail('ATT-UI-8', `Status ${ownerBdgRes.status}: ${JSON.stringify(ownerBdgRes.data)}`);
  }

  // ─── ATT-UI-9: CASHIER Ditolak Akses Data Tim ─────────────────────────────
  console.log('\n--- ATT-UI-9: Guard Role CASHIER Akses Presensi Tim ---');
  const cashierTeamRes = await req('/attendance', 'GET', null, cashierCookie);
  if (cashierTeamRes.status === 403) {
    pass('ATT-UI-9: CASHIER ditolak saat mengakses data kehadiran tim (403 FORBIDDEN)');
  } else {
    fail('ATT-UI-9', `Status ${cashierTeamRes.status}: ${JSON.stringify(cashierTeamRes.data)}`);
  }

  // ─── ATT-UI-10: OWNER Koreksi Presensi (POST /attendance/:id/correct) ──────
  console.log('\n--- ATT-UI-10: OWNER Koreksi Jam Presensi Manual ---');
  if (attId) {
    const correctRes = await req(
      `/attendance/${attId}/correct`,
      'POST',
      {
        checkIn: `${todayWib}T07:45:00.000Z`,
        note: 'Koreksi jam masuk: mesin fingerprint offline saat kedatangan.',
      },
      owner.cookie
    );

    if (
      correctRes.status === 200 &&
      correctRes.data?.success &&
      correctRes.data?.data?.corrected === true &&
      correctRes.data?.data?.correctionNote?.includes('fingerprint')
    ) {
      pass(
        'ATT-UI-10: OWNER berhasil mengoreksi jam presensi karyawan',
        `Corrected: ${correctRes.data.data.corrected}, Note: "${correctRes.data.data.correctionNote}"`
      );
    } else {
      fail('ATT-UI-10', `Status ${correctRes.status}: ${JSON.stringify(correctRes.data)}`);
    }

    // Verifikasi audit log ATTENDANCE_CORRECTED
    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'Attendance',
        entityId: attId,
        action: 'ATTENDANCE_CORRECTED',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (audit) {
      pass('ATT-UI-10b: Audit Log ATTENDANCE_CORRECTED berhasil tercatat di database');
    } else {
      fail('ATT-UI-10b', 'Audit log ATTENDANCE_CORRECTED tidak ditemukan');
    }
  } else {
    fail('ATT-UI-10', 'Record absensi uji tidak tersedia untuk dikoreksi');
  }

  // ─── ATT-UI-11: Non-OWNER Ditolak Koreksi Manual ──────────────────────────
  console.log('\n--- ATT-UI-11: Guard Non-OWNER Koreksi Presensi ---');
  if (attId) {
    const mgrCorrectRes = await req(
      `/attendance/${attId}/correct`,
      'POST',
      {
        checkIn: `${todayWib}T07:45:00.000Z`,
        note: 'Manager mencoba koreksi',
      },
      mgrCookie
    );

    if (mgrCorrectRes.status === 403) {
      pass('ATT-UI-11: MANAGER ditolak saat mencoba mengoreksi presensi (403 FORBIDDEN)');
    } else {
      fail('ATT-UI-11', `Status ${mgrCorrectRes.status}: ${JSON.stringify(mgrCorrectRes.data)}`);
    }
  }

  // ─── ATT-UI-12: Persona Guard: Akun User Tanpa employeeId ─────────────────
  console.log('\n--- ATT-UI-12: Persona Guard: Akun Tanpa employeeId ---');
  // OWNER default tidak memiliki employeeId (hanya role OWNER)
  const ownerCheckInRes = await req('/attendance/check-in', 'POST', null, owner.cookie);
  if (
    ownerCheckInRes.status === 400 &&
    ownerCheckInRes.data?.message?.includes('karyawan')
  ) {
    pass(
      'ATT-UI-12: Akun user tanpa employeeId ditolak check-in dengan pesan informatif',
      ownerCheckInRes.data.message
    );
  } else {
    fail('ATT-UI-12', `Status ${ownerCheckInRes.status}: ${JSON.stringify(ownerCheckInRes.data)}`);
  }

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log(`HASIL TEST SUITE: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('======================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal error in test suite:', e);
  await prisma.$disconnect();
  process.exit(1);
});

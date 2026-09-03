/**
 * FASE 3 — TUGAS 8: TEST SUITE CUTI / IZIN / SAKIT (LEAVE REQUESTS)
 * (LEV-1 s.d. LEV-10)
 *
 * Menguji:
 * - LEV-1: Ajukan IZIN besok -> 201 CREATED (status PENDING)
 * - LEV-2: Validasi input gagal (reason < 10, endDate < startDate, backdate > 1 hari) -> 400 VALIDATION_ERROR
 * - LEV-3: Backdate 1 hari (H-1 WIB) diizinkan -> 201 CREATED
 * - LEV-4: Schedule Overlap Protection: bentrok tanggal dengan PENDING -> 409 SCHEDULE_OVERLAP
 * - LEV-5: Cancel Flow: pengaju hard-delete PENDING -> 200 OK (record hilang & slot tanggal bebas lagi)
 * - LEV-6: Non-pengaju coba cancel -> 403 FORBIDDEN
 * - LEV-7: Manager Decision Flow: MANAGER approve pengajuan tim -> 200 OK (status APPROVED, audit LEAVE_APPROVED)
 * - LEV-8: Immutability: coba cancel & decide ulang pengajuan APPROVED -> 409 INVALID_TRANSACTION_STATE
 * - LEV-9: Overlap dengan APPROVED ditolak -> 409 SCHEDULE_OVERLAP
 * - LEV-10: Manager Reject Flow: MANAGER reject pengajuan tim -> 200 OK (status REJECTED, audit LEAVE_REJECTED)
 * - LEV-11: Self-Decision Guard: MANAGER tolak putuskan cuti dirinya sendiri -> 403 FORBIDDEN
 * - LEV-12: Role Guard & Scope Isolation: CASHIER decide -> 403; MANAGER BDG putuskan JKT -> 403; OWNER bebas akses lintas cabang
 * - LEV-13: UI Admin Route: GET /admin/leaves merespons HTTP 200 untuk OWNER, MANAGER, CASHIER
 *
 * Menggunakan counter eksplisit bawaan (mikro asersi [PASS] standar Tugas 7)
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
  return { status: res.status, data, setCookie };
}

async function reqWeb(path, cookie = null) {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${WEB_BASE}${path}`, {
    method: 'GET',
    headers,
    redirect: 'manual',
  });
  return { status: res.status, location: res.headers.get('location') };
}

async function login(email, password = '1234') {
  const r = await req('/auth/login', 'POST', { email, password });
  return {
    cookie: extractAccessCookie(r.setCookie),
    status: r.status,
    data: r.data,
  };
}

async function main() {
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('FASE 3 — TUGAS 8: TEST SUITE CUTI / IZIN / SAKIT (LEAVE REQUESTS)');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  // Ambil tanggal waktu WIB
  const now = new Date();
  const getWibDate = (d) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };

  const todayStr = getWibDate(now);

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = getWibDate(tomorrow);

  const dayAfterTomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const dayAfterTomorrowStr = getWibDate(dayAfterTomorrow);

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getWibDate(yesterday);

  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const threeDaysAgoStr = getWibDate(threeDaysAgo);

  const futureWeek1 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const futureWeek1Str = getWibDate(futureWeek1);
  const futureWeek2 = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
  const futureWeek2Str = getWibDate(futureWeek2);

  // 1. SETUP AKUN & PERSONA
  const ownerAuth = await login('owner@oase.id', '1234');
  if (ownerAuth.status !== 200) {
    fail('Setup OWNER', `Status ${ownerAuth.status}`);
    process.exit(1);
  }
  const ownerCookie = ownerAuth.cookie;

  // Dapatkan cabang JKT & BDG
  const branchJkt = await prisma.branch.findUnique({ where: { code: 'JKT' } });
  const branchBdg = await prisma.branch.findUnique({ where: { code: 'BDG' } });

  // Setup CASHIER JKT (hanya cabang JKT, tidak multi cabang)
  const rnd = Math.floor(Math.random() * 90000) + 10000;
  const cashierJktEmp = await prisma.employee.create({
    data: {
      name: `Kasir JKT ${rnd}`,
      position: 'Kasir',
      phone: `0811${rnd}`,
      branches: {
        create: {
          branchId: branchJkt.id,
        },
      },
    },
  });

  const cashierJktEmail = `cashier.jkt.${rnd}@oase.id`;
  await req(
    '/users',
    'POST',
    {
      email: cashierJktEmail,
      password: 'Password123',
      role: 'CASHIER',
      employeeId: cashierJktEmp.id,
    },
    ownerCookie
  );

  const cashierAuth = await login(cashierJktEmail, 'Password123');
  const cashierSwitch = await req(
    '/auth/switch-branch',
    'POST',
    { branchId: branchJkt.id },
    cashierAuth.cookie
  );
  const cashierCookie = extractAccessCookie(cashierSwitch.setCookie) || cashierAuth.cookie;

  // Setup MANAGER JKT ber-employee khusus untuk tes
  const rndMgr = Math.floor(Math.random() * 90000) + 10000;
  const mgrEmp = await prisma.employee.create({
    data: {
      name: `Manager Cuti ${rndMgr}`,
      position: 'Branch Manager',
      phone: `0812${rndMgr}`,
      branches: {
        create: {
          branchId: branchJkt.id,
        },
      },
    },
  });

  const mgrEmail = `mgr.leave.${rndMgr}@oase.id`;
  await req(
    '/users',
    'POST',
    {
      email: mgrEmail,
      password: 'Password123',
      role: 'MANAGER',
      employeeId: mgrEmp.id,
    },
    ownerCookie
  );

  const mgrAuth = await login(mgrEmail, 'Password123');
  const mgrSwitch = await req(
    '/auth/switch-branch',
    'POST',
    { branchId: branchJkt.id },
    mgrAuth.cookie
  );
  const mgrJktCookie = extractAccessCookie(mgrSwitch.setCookie);

  // Setup MANAGER BDG (untuk isolasi cabang)
  const mgrBdgEmp = await prisma.employee.create({
    data: {
      name: `Manager BDG ${rnd}`,
      position: 'Branch Manager BDG',
      phone: `0813${rnd}`,
      branches: {
        create: {
          branchId: branchBdg.id,
        },
      },
    },
  });

  const mgrBdgEmail = `mgr.bdg.${rnd}@oase.id`;
  await req(
    '/users',
    'POST',
    {
      email: mgrBdgEmail,
      password: 'Password123',
      role: 'MANAGER',
      employeeId: mgrBdgEmp.id,
    },
    ownerCookie
  );

  const mgrBdgAuth = await login(mgrBdgEmail, 'Password123');
  const mgrBdgSwitch = await req(
    '/auth/switch-branch',
    'POST',
    { branchId: branchBdg.id },
    mgrBdgAuth.cookie
  );
  const mgrBdgCookie = extractAccessCookie(mgrBdgSwitch.setCookie);

  // Bersihkan leave requests sisa uji lama milik karyawan kasir agar deterministik
  const cashierEmployeeId = cashierAuth.data?.data?.user?.employeeId;
  if (cashierEmployeeId) {
    await prisma.leaveRequest.deleteMany({
      where: { employeeId: cashierEmployeeId },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-1: Ajukan IZIN besok -> 201 CREATED (status PENDING)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-1: Ajukan IZIN besok (CASHIER) ──');
  const lev1Res = await req(
    '/leave-requests',
    'POST',
    {
      type: 'IZIN',
      startDate: tomorrowStr,
      endDate: tomorrowStr,
      reason: 'Ada keperluan keluarga mendesak besok',
    },
    cashierCookie
  );

  if (
    lev1Res.status === 201 &&
    lev1Res.data?.data?.status === 'PENDING' &&
    lev1Res.data?.data?.type === 'IZIN'
  ) {
    pass('LEV-1: Ajukan IZIN besok berhasil (201 CREATED, PENDING)');
  } else {
    fail('LEV-1: Ajukan IZIN besok', `Status ${lev1Res.status}, data: ${JSON.stringify(lev1Res.data)}`);
  }

  const lev1Id = lev1Res.data?.data?.id;

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-2: Validasi input gagal -> 400 VALIDATION_ERROR
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-2: Validasi input (reason pendek, end < start, backdate > 1 hari) ──');

  // 2a. Reason < 10 karakter
  const lev2a = await req(
    '/leave-requests',
    'POST',
    {
      type: 'IZIN',
      startDate: tomorrowStr,
      endDate: tomorrowStr,
      reason: 'Pendek',
    },
    cashierCookie
  );
  if (lev2a.status === 400 && lev2a.data?.code === 'VALIDATION_ERROR') {
    pass('LEV-2a: Reason < 10 karakter ditolak (400 VALIDATION_ERROR)');
  } else {
    fail('LEV-2a: Reason pendek', `Status ${lev2a.status}`);
  }

  // 2b. endDate < startDate
  const lev2b = await req(
    '/leave-requests',
    'POST',
    {
      type: 'CUTI',
      startDate: dayAfterTomorrowStr,
      endDate: tomorrowStr,
      reason: 'Keperluan liburan bersama keluarga',
    },
    cashierCookie
  );
  if (lev2b.status === 400 && lev2b.data?.code === 'VALIDATION_ERROR') {
    pass('LEV-2b: endDate < startDate ditolak (400 VALIDATION_ERROR)');
  } else {
    fail('LEV-2b: endDate < startDate', `Status ${lev2b.status}`);
  }

  // 2c. Backdate > 1 hari lampau (H-3)
  const lev2c = await req(
    '/leave-requests',
    'POST',
    {
      type: 'SAKIT',
      startDate: threeDaysAgoStr,
      endDate: threeDaysAgoStr,
      reason: 'Demam tinggi tiga hari yang lalu',
    },
    cashierCookie
  );
  if (lev2c.status === 400 && lev2c.data?.code === 'VALIDATION_ERROR') {
    pass('LEV-2c: Backdate > 1 hari ditolak (400 VALIDATION_ERROR)');
  } else {
    fail('LEV-2c: Backdate > 1 hari', `Status ${lev2c.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-3: Backdate 1 hari (H-1) diizinkan -> 201 CREATED
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-3: Backdate 1 hari (H-1 WIB) diizinkan ──');
  const lev3Res = await req(
    '/leave-requests',
    'POST',
    {
      type: 'SAKIT',
      startDate: yesterdayStr,
      endDate: yesterdayStr,
      reason: 'Kemarin sakit flu tidak sempat mengabari kantor',
    },
    cashierCookie
  );
  if (lev3Res.status === 201 && lev3Res.data?.data?.status === 'PENDING') {
    pass('LEV-3: Backdate 1 hari (H-1) berhasil diajukan (201 CREATED)');
  } else {
    fail('LEV-3: Backdate 1 hari', `Status ${lev3Res.status}, data: ${JSON.stringify(lev3Res.data)}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-4: Schedule Overlap Protection dengan PENDING -> 409 SCHEDULE_OVERLAP
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-4: Schedule Overlap dengan PENDING ──');
  const lev4Res = await req(
    '/leave-requests',
    'POST',
    {
      type: 'CUTI',
      startDate: tomorrowStr,
      endDate: tomorrowStr,
      reason: 'Mencoba ajukan tanggal yang sama persis',
    },
    cashierCookie
  );
  if (lev4Res.status === 409 && lev4Res.data?.code === 'SCHEDULE_OVERLAP') {
    pass('LEV-4: Bentrok tanggal dengan PENDING ditolak (409 SCHEDULE_OVERLAP)');
  } else {
    fail('LEV-4: Bentrok tanggal PENDING', `Status ${lev4Res.status}, data: ${JSON.stringify(lev4Res.data)}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-5: Cancel Flow (Hard-delete PENDING oleh pengaju)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-5: Cancel Flow oleh Pengaju Sendiri ──');
  // Batalkan pengajuan sakit H-1 dari LEV-3
  const lev3Id = lev3Res.data?.data?.id;
  const lev5Cancel = await req(`/leave-requests/${lev3Id}/cancel`, 'POST', null, cashierCookie);

  if (lev5Cancel.status === 200 && lev5Cancel.data?.data?.cancelled === true) {
    // Buktikan record benar-benar hard-deleted dari database
    const checkDb = await prisma.leaveRequest.findUnique({ where: { id: lev3Id } });
    if (!checkDb) {
      pass('LEV-5a: Cancel PENDING berhasil dan record ter-hard delete');
    } else {
      fail('LEV-5a: Cancel PENDING', 'Record masih ditemukan di DB');
    }
  } else {
    fail('LEV-5a: Cancel PENDING', `Status ${lev5Cancel.status}`);
  }

  // Buktikan slot tanggal yesterday sekarang bisa diajukan kembali tanpa 409
  const lev5Recreate = await req(
    '/leave-requests',
    'POST',
    {
      type: 'IZIN',
      startDate: yesterdayStr,
      endDate: yesterdayStr,
      reason: 'Mengajukan kembali tanggal kemarin setelah dibatalkan',
    },
    cashierCookie
  );
  if (lev5Recreate.status === 201) {
    pass('LEV-5b: Re-create tanggal yang sama berhasil setelah dibatalkan (201 CREATED)');
  } else {
    fail('LEV-5b: Re-create tanggal batal', `Status ${lev5Recreate.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-6: Non-pengaju coba cancel -> 403 FORBIDDEN
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-6: Non-pengaju coba cancel ──');
  const lev6Res = await req(`/leave-requests/${lev1Id}/cancel`, 'POST', null, mgrJktCookie);
  if (lev6Res.status === 403 && lev6Res.data?.code === 'FORBIDDEN') {
    pass('LEV-6: Non-pengaju ditolak membatalkan pengajuan (403 FORBIDDEN)');
  } else {
    fail('LEV-6: Non-pengaju cancel', `Status ${lev6Res.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-7: Manager Decision Flow (Approve pengajuan tim)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-7: Manager Approve Pengajuan Tim ──');
  const lev7Res = await req(
    `/leave-requests/${lev1Id}/decide`,
    'POST',
    {
      decision: 'APPROVED',
      note: 'Disetujui oleh Branch Manager JKT',
    },
    mgrJktCookie
  );

  if (
    lev7Res.status === 200 &&
    lev7Res.data?.data?.status === 'APPROVED' &&
    lev7Res.data?.data?.decisionNote === 'Disetujui oleh Branch Manager JKT'
  ) {
    // Verifikasi Audit Log LEAVE_APPROVED
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entity: 'LeaveRequest',
        entityId: lev1Id,
        action: 'LEAVE_APPROVED',
      },
    });

    if (auditLog) {
      pass('LEV-7: Manager approve pengajuan tim sukses & audit log LEAVE_APPROVED tercatat');
    } else {
      fail('LEV-7: Manager approve', 'Audit log LEAVE_APPROVED tidak ditemukan');
    }
  } else {
    fail('LEV-7: Manager approve', `Status ${lev7Res.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-8: Immutability (Tolak cancel & decide ulang setelah APPROVED)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-8: Immutability setelah APPROVED ──');
  const lev8Cancel = await req(`/leave-requests/${lev1Id}/cancel`, 'POST', null, cashierCookie);
  if (lev8Cancel.status === 409 && lev8Cancel.data?.code === 'INVALID_TRANSACTION_STATE') {
    pass('LEV-8a: Cancel pengajuan APPROVED ditolak (409 INVALID_TRANSACTION_STATE)');
  } else {
    fail('LEV-8a: Cancel APPROVED', `Status ${lev8Cancel.status}`);
  }

  const lev8Decide = await req(
    `/leave-requests/${lev1Id}/decide`,
    'POST',
    { decision: 'REJECTED' },
    mgrJktCookie
  );
  if (lev8Decide.status === 409 && lev8Decide.data?.code === 'INVALID_TRANSACTION_STATE') {
    pass('LEV-8b: Re-decide pengajuan APPROVED ditolak (409 INVALID_TRANSACTION_STATE)');
  } else {
    fail('LEV-8b: Re-decide APPROVED', `Status ${lev8Decide.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-9: Overlap dengan APPROVED ditolak 409 SCHEDULE_OVERLAP
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-9: Overlap dengan APPROVED ditolak ──');
  const lev9Res = await req(
    '/leave-requests',
    'POST',
    {
      type: 'CUTI',
      startDate: tomorrowStr,
      endDate: tomorrowStr,
      reason: 'Mengajukan tanggal yang sudah APPROVED sebelumnya',
    },
    cashierCookie
  );
  if (lev9Res.status === 409 && lev9Res.data?.code === 'SCHEDULE_OVERLAP') {
    pass('LEV-9: Ajukan tanggal yang sudah APPROVED ditolak (409 SCHEDULE_OVERLAP)');
  } else {
    fail('LEV-9: Overlap APPROVED', `Status ${lev9Res.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-10: Manager Reject Flow
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-10: Manager Reject Flow ──');
  // Ajukan permohonan baru untuk minggu depan
  const lev10New = await req(
    '/leave-requests',
    'POST',
    {
      type: 'CUTI',
      startDate: futureWeek1Str,
      endDate: futureWeek2Str,
      reason: 'Rencana cuti tahunan minggu depan',
    },
    cashierCookie
  );
  const lev10Id = lev10New.data?.data?.id;

  const lev10Reject = await req(
    `/leave-requests/${lev10Id}/decide`,
    'POST',
    {
      decision: 'REJECTED',
      note: 'Jadwal shift klinik sedang padat minggu depan',
    },
    mgrJktCookie
  );

  if (
    lev10Reject.status === 200 &&
    lev10Reject.data?.data?.status === 'REJECTED' &&
    lev10Reject.data?.data?.decisionNote?.includes('padat')
  ) {
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entity: 'LeaveRequest',
        entityId: lev10Id,
        action: 'LEAVE_REJECTED',
      },
    });
    if (auditLog) {
      pass('LEV-10: Manager reject pengajuan tim sukses & audit log LEAVE_REJECTED tercatat');
    } else {
      fail('LEV-10: Manager reject', 'Audit log LEAVE_REJECTED tidak ditemukan');
    }
  } else {
    fail('LEV-10: Manager reject', `Status ${lev10Reject.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-11: Self-Decision Guard (Manager putuskan cuti dirinya sendiri -> 403)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-11: Self-Decision Guard (MANAGER) ──');
  // Manager ajukan cuti sendiri
  const mgrLeave = await req(
    '/leave-requests',
    'POST',
    {
      type: 'CUTI',
      startDate: futureWeek1Str,
      endDate: futureWeek1Str,
      reason: 'Cuti keperluan keluarga untuk manager',
    },
    mgrJktCookie
  );
  const mgrLeaveId = mgrLeave.data?.data?.id;

  // Manager coba decide cutinya sendiri
  const selfDecide = await req(
    `/leave-requests/${mgrLeaveId}/decide`,
    'POST',
    { decision: 'APPROVED', note: 'Approve sendiri' },
    mgrJktCookie
  );

  if (selfDecide.status === 403 && selfDecide.data?.code === 'FORBIDDEN') {
    pass('LEV-11: Self-decision oleh Manager ditolak (403 FORBIDDEN)');
  } else {
    fail('LEV-11: Self-decision Manager', `Status ${selfDecide.status}`);
  }

  // Namun OWNER boleh memutuskan cuti manager tersebut
  const ownerDecideMgr = await req(
    `/leave-requests/${mgrLeaveId}/decide`,
    'POST',
    { decision: 'APPROVED', note: 'Disetujui langsung oleh Owner' },
    ownerCookie
  );
  if (ownerDecideMgr.status === 200 && ownerDecideMgr.data?.data?.status === 'APPROVED') {
    pass('LEV-11b: OWNER berhasil memutuskan cuti Manager (200 OK)');
  } else {
    fail('LEV-11b: OWNER decide cuti manager', `Status ${ownerDecideMgr.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-12: Role Guard & Scope Isolation
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-12: Role Guard & Scope Isolation ──');
  // 12a. CASHIER tidak punya LEAVE_DECIDE -> 403
  const cashierDecide = await req(
    `/leave-requests/${lev1Id}/decide`,
    'POST',
    { decision: 'APPROVED' },
    cashierCookie
  );
  if (cashierDecide.status === 403 && cashierDecide.data?.code === 'FORBIDDEN') {
    pass('LEV-12a: CASHIER ditolak saat mencoba memutuskan pengajuan (403 FORBIDDEN)');
  } else {
    fail('LEV-12a: CASHIER decide', `Status ${cashierDecide.status}`);
  }

  // 12b. MANAGER BDG tidak boleh putuskan pengajuan karyawan JKT (isolasi cabang)
  // Buat pengajuan baru karyawan JKT
  const jktLeave = await req(
    '/leave-requests',
    'POST',
    {
      type: 'IZIN',
      startDate: futureWeek2Str,
      endDate: futureWeek2Str,
      reason: 'Izin kontrol dokter di cabang JKT',
    },
    cashierCookie
  );
  const jktLeaveId = jktLeave.data?.data?.id;

  const mgrBdgDecide = await req(
    `/leave-requests/${jktLeaveId}/decide`,
    'POST',
    { decision: 'APPROVED' },
    mgrBdgCookie
  );
  if (mgrBdgDecide.status === 403 && mgrBdgDecide.data?.code === 'FORBIDDEN') {
    pass('LEV-12b: MANAGER cabang lain ditolak memutuskan permohonan cabang JKT (403 FORBIDDEN)');
  } else {
    fail('LEV-12b: Scope manager beda cabang', `Status ${mgrBdgDecide.status}`);
  }

  // 12c. OWNER bebas melihat & memutuskan pengajuan cabang JKT
  const ownerDecide = await req(
    `/leave-requests/${jktLeaveId}/decide`,
    'POST',
    { decision: 'APPROVED', note: 'Disetujui oleh Owner' },
    ownerCookie
  );
  if (ownerDecide.status === 200 && ownerDecide.data?.data?.status === 'APPROVED') {
    pass('LEV-12c: OWNER berhasil memutuskan pengajuan dari cabang mana pun (200 OK)');
  } else {
    fail('LEV-12c: OWNER decide', `Status ${ownerDecide.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEV-13: UI Admin Route: GET /admin/leaves -> 200 OK
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── LEV-13: Akses UI Frontend /admin/leaves ──');
  const webOwner = await reqWeb('/admin/leaves', ownerCookie);
  if (webOwner.status === 200) {
    pass('LEV-13a: Halaman /admin/leaves merespons 200 untuk OWNER');
  } else {
    fail('LEV-13a: UI leaves OWNER', `Status ${webOwner.status}`);
  }

  const webMgr = await reqWeb('/admin/leaves', mgrJktCookie);
  if (webMgr.status === 200) {
    pass('LEV-13b: Halaman /admin/leaves merespons 200 untuk MANAGER');
  } else {
    fail('LEV-13b: UI leaves MANAGER', `Status ${webMgr.status}`);
  }

  const webCashier = await reqWeb('/admin/leaves', cashierCookie);
  if (webCashier.status === 200) {
    pass('LEV-13c: Halaman /admin/leaves merespons 200 untuk CASHIER');
  } else {
    fail('LEV-13c: UI leaves CASHIER', `Status ${webCashier.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ringkasan
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log(`HASIL TEST SUITE: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('='.repeat(70));

  await prisma.$disconnect();

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error('Fatal error in test suite:', e);
  await prisma.$disconnect();
  process.exit(1);
});

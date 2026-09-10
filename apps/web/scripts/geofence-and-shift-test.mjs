/**
 * TEST SUITE: FITUR A + B (GEOFENCE 100M & SHIFT FLEKSIBEL)
 * Menguji:
 * 1. Geofence 100M:
 *    - Cabang ber-koordinat tanpa GPS -> 403 GPS_REQUIRED
 *    - Cabang ber-koordinat GPS di luar radius -> 403 OUT_OF_RANGE
 *    - Cabang ber-koordinat GPS di dalam radius 100M -> 201 CREATED
 *    - Cabang tanpa koordinat (masa transisi) -> 201 CREATED + flag GEO_NOT_CONFIGURED
 * 2. Shift Fleksibel:
 *    - Penugasan shift harian staf
 *    - Validasi anti-bentrok penugasan
 *    - Multi-shift lintas cabang pada hari yang sama
 * 3. Alur Tukar Shift (Swap):
 *    - Pengajuan requester -> PENDING_PEER
 *    - Respon rekan kerja -> PEER_APPROVED
 *    - Keputusan Owner -> APPROVED + swap assignment otomatis
 * 4. Lazy Auto-Checkout
 */

import { PrismaClient } from '@prisma/client';

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();

let passCount = 0;
let failCount = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    passCount++;
    console.log(`  ✅ [PASS] ${label}`);
  } else {
    failCount++;
    console.error(`  ❌ [FAIL] ${label}${detail ? ' | ' + detail : ''}`);
    process.exitCode = 1;
  }
}

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
  };
}

async function run() {
  console.log('══════════════════════════════════════════════════════════');
  console.log('=== STARTING GEOFENCE & SHIFT INTEGRATION TESTS ===');
  console.log('══════════════════════════════════════════════════════════\n');

  try {
    // 1. Login OWNER
    const ownerLogin = await login('owner@oase.id');
    const ownerCookie = ownerLogin.cookie;
    assert('Login OWNER berhasil', ownerLogin.status === 200 && !!ownerCookie);

    // 2. Setup Cabang Uji
    // Cabang A: Koordinat Monas Jakarta (-6.175392, 106.827153), Radius 100m
    const rnd = Math.floor(Math.random() * 10000);
    const branchWithGeoRes = await req(
      '/branches',
      'POST',
      {
        name: `Cabang Monas Geo ${rnd}`,
        code: `MNS${rnd}`.slice(0, 8),
        address: 'Jl. Medan Merdeka Barat No. 1, Jakarta Pusat',
        phone: '021112233',
        latitude: -6.175392,
        longitude: 106.827153,
        geofenceRadius: 100,
      },
      ownerCookie
    );
    assert('Buat cabang dengan koordinat Monas (radius 100m)', branchWithGeoRes.status === 201);
    const branchWithGeo = branchWithGeoRes.data?.data;

    // Cabang B: Tanpa koordinat (masa transisi)
    const branchNoGeoRes = await req(
      '/branches',
      'POST',
      {
        name: `Cabang Transisi NoGeo ${rnd}`,
        code: `TRN${rnd}`.slice(0, 8),
        address: 'Jl. Transisi Tanpa Pin No. 2, Bandung',
        phone: '022334455',
      },
      ownerCookie
    );
    assert('Buat cabang transisi tanpa koordinat GPS', branchNoGeoRes.status === 201);
    const branchNoGeo = branchNoGeoRes.data?.data;

    // 3. Setup Karyawan & Akun Kasir Uji
    const emp1Res = await req(
      '/employees',
      'POST',
      {
        name: `Staf Geo 1 ${rnd}`,
        position: 'Kasir',
        phone: `0811${rnd}`,
        branchIds: [branchWithGeo.id, branchNoGeo.id],
      },
      ownerCookie
    );
    const emp1 = emp1Res.data?.data;

    const emp2Res = await req(
      '/employees',
      'POST',
      {
        name: `Staf Geo 2 ${rnd}`,
        position: 'Kasir',
        phone: `0812${rnd}`,
        branchIds: [branchWithGeo.id, branchNoGeo.id],
      },
      ownerCookie
    );
    const emp2 = emp2Res.data?.data;

    // Buat User untuk Kasir 1 & Kasir 2 (Password minimal 6 karakter untuk CASHIER, tanpa property 'name')
    const email1 = `kasir.geo1.${rnd}@oase.id`;
    const email2 = `kasir.geo2.${rnd}@oase.id`;
    const createU1 = await req(
      '/users',
      'POST',
      {
        email: email1,
        password: 'password123',
        role: 'CASHIER',
        employeeId: emp1.id,
      },
      ownerCookie
    );
    assert('User Kasir 1 berhasil dibuat', createU1.status === 201, JSON.stringify(createU1.data));

    const createU2 = await req(
      '/users',
      'POST',
      {
        email: email2,
        password: 'password123',
        role: 'CASHIER',
        employeeId: emp2.id,
      },
      ownerCookie
    );
    assert('User Kasir 2 berhasil dibuat', createU2.status === 201, JSON.stringify(createU2.data));

    const kasir1Login = await login(email1, 'password123');
    const kasir1Cookie = kasir1Login.cookie;
    assert('Login Kasir 1 berhasil', kasir1Login.status === 200 && !!kasir1Cookie);

    const kasir2Login = await login(email2, 'password123');
    const kasir2Cookie = kasir2Login.cookie;
    assert('Login Kasir 2 berhasil', kasir2Login.status === 200 && !!kasir2Cookie);

    // Set active branch untuk Kasir 1 ke cabang berkoordinat
    const sw1 = await req(
      '/auth/switch-branch',
      'POST',
      { branchId: branchWithGeo.id },
      kasir1Cookie
    );
    const kasir1ActiveCookie = extractAccessCookie(sw1.setCookie) || kasir1Cookie;

    console.log('\n--- PENGUJIAN FITUR A: GEOFENCE 100M ANTI-BYPASS ---');

    // Skenario A1: Request check-in TANPA koordinat ke cabang berkoordinat -> WAJIB 403 GPS_REQUIRED
    const noCoordRes = await req('/attendance/check-in', 'POST', {}, kasir1ActiveCookie);
    assert(
      'Cabang ber-koordinat: Request tanpa GPS ditolak dengan 403 GPS_REQUIRED',
      noCoordRes.status === 403 && noCoordRes.data?.code === 'GPS_REQUIRED',
      JSON.stringify(noCoordRes.data)
    );

    // Skenario A2: Request check-in dengan koordinat di LUAR RADIUS (> 100m) -> WAJIB 403 OUT_OF_RANGE
    // Jarak ~500m dari Monas: -6.180000, 106.827153
    const outRangeRes = await req(
      '/attendance/check-in',
      'POST',
      {
        latitude: -6.180000,
        longitude: 106.827153,
        accuracy: 10,
      },
      kasir1ActiveCookie
    );
    assert(
      'Cabang ber-koordinat: Lokasi di luar radius (>100m) ditolak dengan 403 OUT_OF_RANGE',
      outRangeRes.status === 403 && outRangeRes.data?.code === 'OUT_OF_RANGE',
      JSON.stringify(outRangeRes.data)
    );

    // Skenario A3: Request check-in dengan koordinat di DALAM RADIUS (<= 100m) -> 201 CREATED
    // Jarak ~20m dari Monas: -6.175500, 106.827153
    const inRangeRes = await req(
      '/attendance/check-in',
      'POST',
      {
        latitude: -6.175500,
        longitude: 106.827153,
        accuracy: 8,
      },
      kasir1ActiveCookie
    );
    assert(
      'Cabang ber-koordinat: Lokasi dalam radius 100m berhasil check-in (201 CREATED)',
      inRangeRes.status === 201 && inRangeRes.data?.success === true,
      JSON.stringify(inRangeRes.data)
    );
    assert(
      'Catatan geofence (distanceMeters) tersimpan',
      typeof inRangeRes.data?.data?.distanceMeters === 'number' &&
        inRangeRes.data?.data?.distanceMeters <= 100
    );

    // Check-out Kasir 1 agar presensi selesai
    const checkoutRes = await req('/attendance/check-out', 'POST', {}, kasir1ActiveCookie);
    assert('Kasir 1 check-out berhasil', checkoutRes.status === 200, JSON.stringify(checkoutRes.data));

    // Skenario A4: Cabang tanpa koordinat (masa transisi) -> Lolos tanpa GPS + audit GEO_NOT_CONFIGURED
    // Switch kasir 2 ke cabang tanpa koordinat
    const switchRes = await req(
      '/auth/switch-branch',
      'POST',
      { branchId: branchNoGeo.id },
      kasir2Cookie
    );
    const kasir2CookieBranch2 = extractAccessCookie(switchRes.setCookie) || kasir2Cookie;

    const noPinRes = await req('/attendance/check-in', 'POST', {}, kasir2CookieBranch2);
    assert(
      'Cabang transisi tanpa pin: Lolos check-in tanpa geofence (201 CREATED)',
      noPinRes.status === 201 && noPinRes.data?.success === true,
      JSON.stringify(noPinRes.data)
    );

    // Periksa audit log apakah terdapat flag GEO_NOT_CONFIGURED
    const geoAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'CREATE',
        entity: 'Attendance',
        entityId: noPinRes.data?.data?.id,
      },
    });
    assert(
      'Audit log mencatat flag GEO_NOT_CONFIGURED untuk cabang belum ber-pin',
      geoAudit?.note?.includes('GEO_NOT_CONFIGURED') === true
    );

    console.log('\n--- PENGUJIAN FITUR B: SHIFT FLEKSIBEL & LINTAS CABANG ---');

    const testDate = '2026-09-15';

    // B1: Buat shift assignment pagi untuk Staf 1 di Cabang A
    const assign1Res = await req(
      '/shifts/assignments',
      'POST',
      {
        employeeId: emp1.id,
        branchId: branchWithGeo.id,
        date: testDate,
        shift: 'MORNING',
      },
      ownerCookie
    );
    assert('Owner buat shift assignment pagi untuk Kasir 1 (201)', assign1Res.status === 201);
    const assign1Id = assign1Res.data?.data?.id;

    // B2: Bentrok shift assignment (staf sama, hari sama, shift sama) -> 409 SCHEDULE_OVERLAP
    const bentrokRes = await req(
      '/shifts/assignments',
      'POST',
      {
        employeeId: emp1.id,
        branchId: branchWithGeo.id,
        date: testDate,
        shift: 'MORNING',
      },
      ownerCookie
    );
    assert(
      'Bentrok shift assignment (staf+hari+shift sama) ditolak (409)',
      bentrokRes.status === 409
    );

    // B3: Lintas cabang diperbolehkan (Staf 1 sore di Cabang B pada hari yang sama)
    const assignCrossRes = await req(
      '/shifts/assignments',
      'POST',
      {
        employeeId: emp1.id,
        branchId: branchNoGeo.id,
        date: testDate,
        shift: 'EVENING',
      },
      ownerCookie
    );
    assert(
      'Lintas cabang diizinkan: Staf 1 ditugaskan sore di Cabang B pada hari yang sama (201)',
      assignCrossRes.status === 201
    );

    console.log('\n--- PENGUJIAN FITUR B: ALUR TUKAR SHIFT (SWAP) ---');

    const swapDate = '2026-09-16';

    // Buat assignment Kasir 1 pagi & Kasir 2 sore pada tanggal swapDate
    await req(
      '/shifts/assignments',
      'POST',
      {
        employeeId: emp1.id,
        branchId: branchWithGeo.id,
        date: swapDate,
        shift: 'MORNING',
      },
      ownerCookie
    );

    const assign2Res = await req(
      '/shifts/assignments',
      'POST',
      {
        employeeId: emp2.id,
        branchId: branchWithGeo.id,
        date: swapDate,
        shift: 'EVENING',
      },
      ownerCookie
    );
    assert('Owner buat shift assignment sore untuk Kasir 2 di tanggal swap (201)', assign2Res.status === 201);

    // 1. Kasir 1 ajukan swap dengan Kasir 2
    const swapReqRes = await req(
      '/shifts/swaps',
      'POST',
      {
        targetEmployeeId: emp2.id,
        date: swapDate,
        requesterShift: 'MORNING',
        targetShift: 'EVENING',
        note: 'Keperluan mendesak keluarga',
      },
      kasir1Cookie
    );
    assert(
      'Kasir 1 mengajukan tukar shift ke Kasir 2 (201)',
      swapReqRes.status === 201 && swapReqRes.data?.data?.status === 'PENDING_PEER',
      JSON.stringify(swapReqRes.data)
    );
    const swapId = swapReqRes.data?.data?.id;

    // 2. Kasir 2 merespon APPROVE
    const peerApproveRes = await req(
      `/shifts/swaps/${swapId}/respond`,
      'POST',
      { approved: true, note: 'Siap bertukar shift' },
      kasir2Cookie
    );
    assert(
      'Kasir 2 merespon APPROVE -> Status menjadi PENDING_OWNER (200)',
      peerApproveRes.status === 200 && peerApproveRes.data?.data?.status === 'PENDING_OWNER',
      JSON.stringify(peerApproveRes.data)
    );

    // 3. Owner memutuskan APPROVE -> Swap atomik berjalan
    const ownerDecideRes = await req(
      `/shifts/swaps/${swapId}/decide`,
      'POST',
      { approved: true, note: 'Disetujui oleh Owner' },
      ownerCookie
    );
    assert(
      'Owner menyetujui swap -> Status menjadi APPROVED (200)',
      ownerDecideRes.status === 200 && ownerDecideRes.data?.data?.status === 'APPROVED',
      JSON.stringify(ownerDecideRes.data)
    );

    // 4. Verifikasi: Assignment kedua staf telah bertukar
    const emp1AssRes = await req(
      `/shifts/assignments?employeeId=${emp1.id}&date=${swapDate}`,
      'GET',
      null,
      ownerCookie
    );
    const emp2AssRes = await req(
      `/shifts/assignments?employeeId=${emp2.id}&date=${swapDate}`,
      'GET',
      null,
      ownerCookie
    );

    const emp1Assignments = emp1AssRes.data?.data || [];
    const emp2Assignments = emp2AssRes.data?.data || [];

    const emp1HasEvening = emp1Assignments.some((a) => a.shift === 'EVENING' && a.source === 'SWAP');
    const emp2HasMorning = emp2Assignments.some((a) => a.shift === 'MORNING' && a.source === 'SWAP');

    assert('Kasir 1 kini memegang shift EVENING dengan source SWAP', emp1HasEvening, JSON.stringify(emp1Assignments));
    assert('Kasir 2 kini memegang shift MORNING dengan source SWAP', emp2HasMorning, JSON.stringify(emp2Assignments));

    console.log('\n--- PENGUJIAN FITUR B: LAZY AUTO-CHECKOUT ---');

    // Buat presensi menggantung kemarin (melewati batas shift)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateStr = yesterday.toISOString().slice(0, 10);

    const hangingAttendance = await prisma.attendance.create({
      data: {
        employeeId: emp1.id,
        branchId: branchWithGeo.id,
        workDate: new Date(yesterdayDateStr),
        shift: 'MORNING',
        checkIn: new Date(yesterday.getTime() - 24 * 3600 * 1000),
        status: 'PRESENT',
      },
    });

    // Panggil check-out kasir 2 atau endpoint me untuk mentrigger lazy auto-checkout
    await req('/attendance/me', 'GET', null, kasir1Cookie);

    const updatedHanging = await prisma.attendance.findUnique({
      where: { id: hangingAttendance.id },
    });

    assert(
      'Presensi menggantung kemarin otomatis ditutup oleh lazy auto-checkout',
      updatedHanging?.checkOut !== null && updatedHanging?.autoCheckout === true
    );

    console.log('\n--- PENGUJIAN FITUR B: MULTI-SHIFT PER CABANG & AUTO-SYNC TURUNAN ---');

    // 1. Simpan multi-shift lengkap
    const multiShiftPayload = {
      morningOpen: '09:00',
      morningClose: '13:00',
      morningLateAfter: '09:15',
      eveningOpen: '16:00',
      eveningClose: '21:00',
      eveningLateAfter: '16:15',
      saturdayEveningClosed: true,
      sundayClosed: true,
    };

    const multiShiftRes = await req(
      `/branches/${branchWithGeo.id}/working-hours`,
      'PATCH',
      multiShiftPayload,
      ownerCookie
    );

    assert(
      'PATCH /branches/:id/working-hours dengan multi-shift berhasil (200)',
      multiShiftRes.status === 200,
      JSON.stringify(multiShiftRes.data)
    );

    const whData = multiShiftRes.data?.data;
    assert(
      'Multi-shift tersimpan dengan kolom shift baru',
      whData?.morningOpen === '09:00' &&
        whData?.morningClose === '13:00' &&
        whData?.morningLateAfter === '09:15' &&
        whData?.eveningOpen === '16:00' &&
        whData?.eveningClose === '21:00' &&
        whData?.eveningLateAfter === '16:15' &&
        whData?.saturdayEveningClosed === true &&
        whData?.sundayClosed === true
    );

    assert(
      'Kolom turunan ter-auto-sync saat simpan (openTime=morningOpen, closeTime=eveningClose, lateAfter=morningLateAfter)',
      whData?.openTime === '09:00' &&
        whData?.closeTime === '21:00' &&
        whData?.lateAfter === '09:15',
      `openTime=${whData?.openTime}, closeTime=${whData?.closeTime}, lateAfter=${whData?.lateAfter}`
    );

    // 2. Validasi penolakan: eveningOpen < morningClose (tumpang tindih shift)
    const invalidOverlapRes = await req(
      `/branches/${branchWithGeo.id}/working-hours`,
      'PATCH',
      {
        morningOpen: '09:00',
        morningClose: '15:00',
        eveningOpen: '14:00', // < morningClose
        eveningClose: '21:00',
      },
      ownerCookie
    );
    assert(
      'Shift sore dimulai sebelum shift pagi selesai ditolak (400)',
      invalidOverlapRes.status === 400
    );

    // 3. Validasi penolakan: lateAfter di luar rentang shift
    const invalidLateRes = await req(
      `/branches/${branchWithGeo.id}/working-hours`,
      'PATCH',
      {
        morningOpen: '09:00',
        morningClose: '13:00',
        morningLateAfter: '13:30', // > morningClose
      },
      ownerCookie
    );
    assert(
      'Batas terlambat di luar batas shift ditolak (400)',
      invalidLateRes.status === 400
    );

    // 4. Backward compatibility: kirim hanya openTime, closeTime, lateAfter
    const legacyPayloadRes = await req(
      `/branches/${branchWithGeo.id}/working-hours`,
      'PATCH',
      {
        openTime: '08:30',
        closeTime: '20:30',
        lateAfter: '08:45',
      },
      ownerCookie
    );
    assert(
      'Payload legacy {openTime, closeTime, lateAfter} tetap didukung dan auto-sync (200)',
      legacyPayloadRes.status === 200 &&
        legacyPayloadRes.data?.data?.morningOpen === '08:30' &&
        legacyPayloadRes.data?.data?.morningLateAfter === '08:45' &&
        legacyPayloadRes.data?.data?.openTime === '08:30'
    );
  } catch (err) {
    console.error('Unhandled Exception in Test Suite:', err);
    failCount++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`HASIL TEST SUITE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('══════════════════════════════════════════════════════════\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

run();

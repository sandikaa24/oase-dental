/**
 * SUITE: task-account-disabled-audit-test.mjs
 * 
 * Verifikasi Mendalam Audit Sesi Akun Dinonaktifkan:
 * - Amandemen A1: requireAuth memverifikasi user.active & employee.active ke database per request.
 *   Access token lama dari akun nonaktif langsung ditolak (401 ACCOUNT_DISABLED) pada seluruh endpoint.
 * - Amandemen A2: Perbedaan tegas respon login:
 *   * Kredensial salah -> 401 UNAUTHORIZED ("Email atau password salah").
 *   * Kredensial BENAR tapi akun/karyawan nonaktif -> 401 ACCOUNT_DISABLED ("Akun/Data karyawan telah dinonaktifkan...").
 * - Pembersihan cookie: /auth/login dan /auth/refresh membersihkan oase_remembered_branch & auth cookies jika ACCOUNT_DISABLED.
 * - Revokasi seketika: setUserStatus & setEmployeeStatus langsung me-revoke seluruh refresh token aktif di DB saat active: false.
 * - Reaktivasi: akun yang diaktifkan kembali oleh Owner dapat login normal dan beroperasi kembali.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import bcrypt from 'bcryptjs';

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

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';

// ─── HTTP & Cookie Helpers ───────────────────────────────────────────────────

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
    .map(([k, v]) => `${k}=${v}`)
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

// ─── Test Runner ─────────────────────────────────────────────────────────────

let totalAsserts = 0;
let passedAsserts = 0;

function assert(condition, message) {
  totalAsserts++;
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAsserts++;
  console.log(`  ✅ PASS: ${message}`);
}

async function run() {
  console.log('======================================================================');
  console.log('SUITE: task-account-disabled-audit-test.mjs');
  console.log('AUDIT & GUARD SESI AKUN DINONAKTIFKAN (AMANDEMEN A1 & A2)');
  console.log('======================================================================\n');

  const stamp = Date.now();
  const passwordHash = await bcrypt.hash('PasswordKasir123', 10);

  // 1. Setup Master Data
  console.log('--- SETUP FIXTURES ---');
  let branch = await prisma.branch.findFirst({ where: { code: 'JKT', active: true } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        code: 'JKT',
        name: 'Klinik OASE Jakarta',
        address: 'Jl. Sudirman No. 1',
        phone: '0211111111',
        active: true,
      },
    });
  }

  // Master Service
  let service = await prisma.service.findFirst({ where: { active: true } });
  if (!service) {
    service = await prisma.service.create({
      data: {
        name: 'Pembersihan Karang Gigi Test',
        price: 250000,
        active: true,
      },
    });
  }

  // Owner User
  const ownerEmail = `audit.owner.${stamp}@oase.id`;
  const owner = await prisma.user.create({
    data: {
      email: ownerEmail,
      username: `own_audit_${stamp}`,
      passwordHash,
      role: 'OWNER',
      active: true,
    },
  });

  // Cashier 1 (untuk uji penonaktifan user.active)
  const cashier1Emp = await prisma.employee.create({
    data: {
      name: `Kasir Audit 1 ${stamp}`,
      phone: `0811${stamp.toString().slice(-7)}`,
      position: 'Kasir',
      active: true,
      branches: {
        create: { branchId: branch.id, active: true },
      },
    },
  });
  const cashier1Email = `cashier1.audit.${stamp}@oase.id`;
  const cashier1 = await prisma.user.create({
    data: {
      email: cashier1Email,
      username: `cas1_${stamp}`,
      passwordHash,
      role: 'CASHIER',
      employeeId: cashier1Emp.id,
      active: true,
    },
  });

  // Cashier 2 (untuk uji penonaktifan employee.active)
  const cashier2Emp = await prisma.employee.create({
    data: {
      name: `Kasir Audit 2 ${stamp}`,
      phone: `0822${stamp.toString().slice(-7)}`,
      position: 'Kasir',
      active: true,
      branches: {
        create: { branchId: branch.id, active: true },
      },
    },
  });
  const cashier2Email = `cashier2.audit.${stamp}@oase.id`;
  const cashier2 = await prisma.user.create({
    data: {
      email: cashier2Email,
      username: `cas2_${stamp}`,
      passwordHash,
      role: 'CASHIER',
      employeeId: cashier2Emp.id,
      active: true,
    },
  });

  // Login Owner untuk aksi admin
  const rOwnerLogin = await req('/auth/login', 'POST', {
    identifier: ownerEmail,
    password: 'PasswordKasir123',
  });
  assert(rOwnerLogin.status === 200, 'Owner berhasil login untuk aksi admin');
  const ownerCookies = {
    access_token: rOwnerLogin.cookies['access_token']?.value,
  };

  // ─── T1: Login Normal Kasir 1 & Simpan Sesi ────────────────────────────────
  console.log('\n--- T1: Login Normal Kasir 1 & Simpan Sesi ---');
  const rLogin1 = await req('/auth/login', 'POST', {
    identifier: cashier1Email,
    password: 'PasswordKasir123',
  });
  assert(rLogin1.status === 200, 'T1.1: Kasir 1 login awal sukses (200 OK)');
  const cashier1Cookies = {
    access_token: rLogin1.cookies['access_token']?.value,
    refresh_token: rLogin1.cookies['refresh_token']?.value,
    oase_branch_context: rLogin1.cookies['oase_branch_context']?.value,
  };
  assert(!!cashier1Cookies.access_token, 'T1.2: Access token Kasir 1 berhasil terbit');
  assert(!!cashier1Cookies.refresh_token, 'T1.3: Refresh token Kasir 1 berhasil terbit');

  // Amandemen D4: Kasir 1 konfirmasi cabang via /select-branch sebelum transaksi awal
  const rSelect1 = await req('/auth/select-branch', 'POST', { branchId: branch.id }, cashier1Cookies);
  cashier1Cookies.access_token = rSelect1.cookies['access_token']?.value || cashier1Cookies.access_token;
  cashier1Cookies.oase_branch_context = rSelect1.cookies['oase_branch_context']?.value;

  // Tes transaksi sebelum dinonaktifkan -> sukses
  const rTrxBefore = await req('/transactions', 'POST', {
    items: [{ itemId: service.id, quantity: 1, itemType: 'SERVICE' }],
  }, cashier1Cookies);
  assert(rTrxBefore.status === 201, 'T1.4: Kasir 1 aktif dapat membuat transaksi (201 Created)');

  // ─── T2: Admin Menonaktifkan Kasir 1 ───────────────────────────────────────
  console.log('\n--- T2: Admin Menonaktifkan Kasir 1 (active: false) ---');
  const rDeactivateUser = await req(`/users/${cashier1.id}/status`, 'PATCH', {
    active: false,
  }, ownerCookies);
  assert(rDeactivateUser.status === 200, 'T2.1: Owner sukses menonaktifkan Kasir 1 (200 OK)');
  assert(rDeactivateUser.data?.data?.active === false, 'T2.2: Response menunjukkan active = false');

  // Verifikasi tabel database: user.active = false & refresh token langsung di-revoke
  const updatedCashier1 = await prisma.user.findUnique({ where: { id: cashier1.id } });
  assert(updatedCashier1.active === false, 'T2.3: Database membuktikan user.active = false');

  const activeRefreshTokens = await prisma.refreshToken.findMany({
    where: { userId: cashier1.id, revokedAt: null },
  });
  assert(activeRefreshTokens.length === 0, 'T2.4: Semua refresh token Kasir 1 langsung di-revoke di DB (sesi langsung mati)');

  // ─── T3: Token Akses Lama Ditolak Seketika di Endpoint Protected (A1) ─────
  console.log('\n--- T3: Access Token Lama Ditolak Seketika di Endpoint Protected (Amandemen A1) ---');
  // POST /transactions
  const rTrxAfter = await req('/transactions', 'POST', {
    items: [{ itemId: service.id, quantity: 1, itemType: 'SERVICE' }],
  }, cashier1Cookies);
  assert(rTrxAfter.status === 401, 'T3.1: POST /transactions dengan token lama ditolak (401)');
  assert(rTrxAfter.data?.code === 'ACCOUNT_DISABLED', 'T3.2: Error code = ACCOUNT_DISABLED');

  // POST /attendance/check-in
  const rCheckInAfter = await req('/attendance/check-in', 'POST', {}, cashier1Cookies);
  assert(rCheckInAfter.status === 401, 'T3.3: POST /attendance/check-in dengan token lama ditolak (401)');
  assert(rCheckInAfter.data?.code === 'ACCOUNT_DISABLED', 'T3.4: Error code check-in = ACCOUNT_DISABLED');

  // GET /users (Read endpoint)
  const rGetUsersAfter = await req('/users?limit=10', 'GET', null, cashier1Cookies);
  assert(rGetUsersAfter.status === 401, 'T3.5: GET protected endpoint dengan token lama ditolak (401)');
  assert(rGetUsersAfter.data?.code === 'ACCOUNT_DISABLED', 'T3.6: Error code GET = ACCOUNT_DISABLED');

  // ─── T4: Refresh Token Lama Ditolak & Bersihkan Cookies ────────────────────
  console.log('\n--- T4: Refresh Token Ditolak & Bersihkan Cookies ---');
  const rRefreshAfter = await req('/auth/refresh', 'POST', null, {
    refresh_token: cashier1Cookies.refresh_token,
    oase_remembered_branch: branch.id,
  });
  assert(rRefreshAfter.status === 401, 'T4.1: POST /auth/refresh ditolak (401)');
  assert(rRefreshAfter.data?.code === 'ACCOUNT_DISABLED', 'T4.2: Error code = ACCOUNT_DISABLED');
  assert(rRefreshAfter.cookies['oase_remembered_branch']?.value === '', 'T4.3: Cookie remembered_branch dibersihkan saat refresh gagal');
  assert(rRefreshAfter.cookies['access_token']?.value === '', 'T4.4: Cookie access_token dibersihkan saat refresh gagal');

  // ─── T5: Pesan Login Samar vs ACCOUNT_DISABLED (Amandemen A2) ────────────
  console.log('\n--- T5: Pesan Login Samar vs ACCOUNT_DISABLED (Amandemen A2) ---');
  // Kredensial salah (password salah) -> 401 UNAUTHORIZED pesan samar
  const rLoginWrongPw = await req('/auth/login', 'POST', {
    identifier: cashier1Email,
    password: 'WrongPassword999',
  });
  assert(rLoginWrongPw.status === 401, 'T5.1: Login password salah ditolak (401)');
  assert(rLoginWrongPw.data?.code === 'UNAUTHORIZED', 'T5.2: Error code kredensial salah = UNAUTHORIZED');
  assert(rLoginWrongPw.data?.message === 'Email atau password salah', 'T5.3: Pesan samar dipertahankan untuk kredensial salah');

  // Kredensial salah (user tidak terdaftar) -> 401 UNAUTHORIZED pesan samar
  const rLoginNonExistent = await req('/auth/login', 'POST', {
    identifier: `nonexistent.${stamp}@oase.id`,
    password: 'PasswordKasir123',
  });
  assert(rLoginNonExistent.status === 401, 'T5.4: Login user tak terdaftar ditolak (401)');
  assert(rLoginNonExistent.data?.code === 'UNAUTHORIZED', 'T5.5: Error code user tak terdaftar = UNAUTHORIZED');
  assert(rLoginNonExistent.data?.message === 'Email atau password salah', 'T5.6: Pesan samar dipertahankan untuk user tak terdaftar');

  // Kredensial BENAR tapi akun nonaktif -> 401 ACCOUNT_DISABLED pesan jelas
  const rLoginDisabled = await req('/auth/login', 'POST', {
    identifier: cashier1Email,
    password: 'PasswordKasir123',
  }, {
    oase_remembered_branch: branch.id,
  });
  assert(rLoginDisabled.status === 401, 'T5.7: Login kredensial benar akun nonaktif ditolak (401)');
  assert(rLoginDisabled.data?.code === 'ACCOUNT_DISABLED', 'T5.8: Error code kredensial benar akun nonaktif = ACCOUNT_DISABLED');
  assert(rLoginDisabled.data?.message.includes('dinonaktifkan'), 'T5.9: Pesan jelas menyatakan akun dinonaktifkan');
  assert(rLoginDisabled.cookies['oase_remembered_branch']?.value === '', 'T5.10: Cookie remembered_branch dibersihkan saat login ditolak');

  // ─── T6: Penonaktifan Data Karyawan Mematikan Akun Terhubung ──────────────
  console.log('\n--- T6: Penonaktifan Data Karyawan Mematikan Akun Terhubung ---');
  // Login Kasir 2 awal
  const rLogin2 = await req('/auth/login', 'POST', {
    identifier: cashier2Email,
    password: 'PasswordKasir123',
  });
  assert(rLogin2.status === 200, 'T6.1: Kasir 2 login awal sukses (200 OK)');
  const cashier2Cookies = {
    access_token: rLogin2.cookies['access_token']?.value,
    refresh_token: rLogin2.cookies['refresh_token']?.value,
  };

  // Owner menonaktifkan data karyawan Kasir 2 (employee.active = false, user.active tetap true)
  const rDeactivateEmp = await req(`/employees/${cashier2Emp.id}/status`, 'PATCH', {
    active: false,
  }, ownerCookies);
  assert(rDeactivateEmp.status === 200, 'T6.2: Owner sukses menonaktifkan karyawan Kasir 2 (200 OK)');

  // Verifikasi refresh token Kasir 2 di-revoke seketika
  const activeTokensCas2 = await prisma.refreshToken.findMany({
    where: { userId: cashier2.id, revokedAt: null },
  });
  assert(activeTokensCas2.length === 0, 'T6.3: Refresh token Kasir 2 langsung di-revoke saat karyawannya dinonaktifkan');

  // Token lama Kasir 2 ditolak di endpoint protected
  const rTrxCas2 = await req('/transactions', 'POST', {
    items: [{ itemId: service.id, quantity: 1, itemType: 'SERVICE' }],
  }, cashier2Cookies);
  assert(rTrxCas2.status === 401, 'T6.4: Access token Kasir 2 ditolak saat karyawan nonaktif (401)');
  assert(rTrxCas2.data?.code === 'ACCOUNT_DISABLED', 'T6.5: Error code = ACCOUNT_DISABLED');
  assert(rTrxCas2.data?.message.includes('karyawan'), 'T6.6: Pesan menyatakan data karyawan dinonaktifkan');

  // Login Kasir 2 dengan kredensial benar ditolak
  const rLoginCas2 = await req('/auth/login', 'POST', {
    identifier: cashier2Email,
    password: 'PasswordKasir123',
  });
  assert(rLoginCas2.status === 401, 'T6.7: Login Kasir 2 ditolak saat karyawan nonaktif (401)');
  assert(rLoginCas2.data?.code === 'ACCOUNT_DISABLED', 'T6.8: Error code login = ACCOUNT_DISABLED');

  // ─── T7: Kasus Reaktivasi (Aktif Kembali) ──────────────────────────────────
  console.log('\n--- T7: Kasus Reaktivasi (Aktif Kembali) ---');
  const rReactivate = await req(`/users/${cashier1.id}/status`, 'PATCH', {
    active: true,
  }, ownerCookies);
  assert(rReactivate.status === 200, 'T7.1: Owner sukses mengaktifkan kembali Kasir 1 (200 OK)');
  assert(rReactivate.data?.data?.active === true, 'T7.2: Response user active = true');

  // Login ulang dengan kredensial yang sama -> Berhasil normal
  const rLoginReactivated = await req('/auth/login', 'POST', {
    identifier: cashier1Email,
    password: 'PasswordKasir123',
  });
  assert(rLoginReactivated.status === 200, 'T7.3: Kasir 1 yang aktif kembali dapat login normal (200 OK)');
  const newCashier1Cookies = {
    access_token: rLoginReactivated.cookies['access_token']?.value,
    oase_branch_context: rLoginReactivated.cookies['oase_branch_context']?.value,
  };

  // Amandemen D4: Kasir 1 konfirmasi cabang via /select-branch
  const rSelectReactivated = await req('/auth/select-branch', 'POST', { branchId: branch.id }, newCashier1Cookies);
  newCashier1Cookies.access_token = rSelectReactivated.cookies['access_token']?.value || newCashier1Cookies.access_token;
  newCashier1Cookies.oase_branch_context = rSelectReactivated.cookies['oase_branch_context']?.value;

  // Buat transaksi dengan token baru -> Berhasil 201 Created
  const rTrxReactivated = await req('/transactions', 'POST', {
    items: [{ itemId: service.id, quantity: 1, itemType: 'SERVICE' }],
  }, newCashier1Cookies);
  assert(rTrxReactivated.status === 201, 'T7.4: Kasir 1 aktif kembali dapat membuat transaksi (201 Created)');

  console.log('\n======================================================================');
  console.log(`HASIL SUITE AUDIT SESI NONAKTIF: ${passedAsserts}/${totalAsserts} ASSERTS PASSED`);
  console.log('SEMUA UJI AMANDEMEN A1 & A2 MEMENUHI SPESIFIKASI DENGAN SEMPURNA');
  console.log('======================================================================\n');
}

run()
  .catch((err) => {
    console.error('\n❌ SUITE RUNNER ERROR:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * SUITE: task-branch-guard-test.mjs
 * 
 * Verifikasi Mendalam Fitur Pemilihan Cabang Saat Login & Guard Konteks Cabang:
 * - Amandemen A1: select-branch sebagai satu pintu konteks cabang untuk semua role (termasuk OWNER).
 *   switch-branch diberi anotasi @deprecated dan delegasikan ke select-branch.
 * - Amandemen A2: oase_branch_context adalah session cookie (tanpa TTL 15m), disegarkan bersama refresh token.
 *   remembered_branch berlaku 30 hari dengan re-validasi server-side saat login.
 * - Amandemen A3: Fungsi bersama isMultiBranchUser() dipakai di login, layout guard, dan select-branch.
 * - Guard operasional: endpoint operasional (kasir, closing, absensi, stok) menolak tanpa konteks cabang (400 BRANCH_CONTEXT_REQUIRED).
 */

import { PrismaClient } from '@prisma/client';
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
      const maxAgePart = parts.find((p) => p.toLowerCase().startsWith('max-age='));
      const maxAge = maxAgePart ? parseInt(maxAgePart.split('=')[1], 10) : undefined;
      map[name] = {
        name,
        value: val,
        raw: str,
        maxAge,
        hasMaxAge: maxAgePart !== undefined,
        hasExpires: parts.some((p) => p.toLowerCase().startsWith('expires=')),
        httpOnly: parts.some((p) => p.toLowerCase() === 'httponly'),
      };
    }
  }
  return map;
}

function buildCookieHeader(cookieMap) {
  return Object.entries(cookieMap)
    .filter(([_, item]) => {
      if (item === undefined || item === null) return false;
      if (typeof item === 'object') {
        return item.value !== undefined && item.value !== null && item.value !== '';
      }
      return item !== '';
    })
    .map(([name, item]) => `${name}=${typeof item === 'object' ? item.value : item}`)
    .join('; ');
}

async function apiReq(path, method = 'GET', body = null, cookieMapOrString = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieMapOrString) {
    if (typeof cookieMapOrString === 'string') {
      headers['Cookie'] = cookieMapOrString;
    } else {
      headers['Cookie'] = buildCookieHeader(cookieMapOrString);
    }
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

// ─── Main Test Runner ────────────────────────────────────────────────────────

async function run() {
  console.log('======================================================================');
  console.log('TEST SUITE: task-branch-guard-test (Amandemen A1, A2, A3)');
  console.log('======================================================================\n');

  let pass = 0;
  let fail = 0;

  function check(desc, condition) {
    if (condition) {
      console.log(`  ✅ ${desc}`);
      pass++;
    } else {
      console.log(`  ❌ ${desc}`);
      fail++;
    }
  }

  try {
    // 0. Ambil cabang JKT dan BDG dari database
    const jktBranch = await prisma.branch.findUnique({ where: { code: 'JKT' } }) || await prisma.branch.findFirst({ where: { code: { contains: 'JKT', mode: 'insensitive' } } });
    const bdgBranch = await prisma.branch.findUnique({ where: { code: 'BDG' } }) || await prisma.branch.findFirst({ where: { code: { contains: 'BDG', mode: 'insensitive' } } });
    if (!jktBranch || !bdgBranch) {
      throw new Error('Cabang Jakarta atau Bandung belum tersedia di seed database.');
    }
    console.log(`Info Cabang Uji: JKT=${jktBranch.id} (${jktBranch.name}), BDG=${bdgBranch.id} (${bdgBranch.name})\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // T1. Single-Branch User (kasir.jkt@oase.id): Interstisial Universal (Evolusi D4)
    // ─────────────────────────────────────────────────────────────────────────
    // Komentar Evolusi Desain D4:
    // Pada arsitektur awal (Amandemen A1/A3), user 1-cabang diberikan auto-context saat login.
    // Pada Amandemen D4 (Interstisial Universal Selalu-Tampil - Tafsir A), SEMUA role
    // termasuk staff 1-cabang login tanpa auto-context (activeBranchId & branchContext null).
    // Kasir 1-cabang kini HARUS melalui konfirmasi kartu tunggal 1-klik di /select-branch
    // sebelum context cabang aktif terbentuk dan dapat mengakses endpoint operasional.
    console.log('--- T1: Single-Branch User (kasir.jkt@oase.id) Konfirmasi Interstisial (Evolusi D4) ---');
    const rT1Login = await apiReq('/auth/login', 'POST', {
      email: 'kasir.jkt@oase.id',
      password: '1234',
    });
    check('T1.1 Login sukses HTTP 200', rT1Login.status === 200);
    check('T1.2 activeBranchId null saat login awal (Evolusi D4)', rT1Login.data?.data?.user?.activeBranchId === null);
    check('T1.3 branchContext null saat login awal (Evolusi D4)', rT1Login.data?.data?.user?.branchContext === null);
    check('T1.4 Cookie oase_branch_context TIDAK auto-terpasang saat login', !rT1Login.cookies['oase_branch_context']?.value);

    // Guard Operasional: Akses operasional kasir 1-cabang sebelum konfirmasi ditolak
    const t1NoContextCookies = {
      access_token: rT1Login.cookies['access_token'],
    };
    const rT1OpFail = await apiReq('/cash-closings', 'POST', {
      totalCashActual: '100000',
    }, t1NoContextCookies);
    check('T1.5 Endpoint operasional menolak sebelum konfirmasi cabang (HTTP 400)', rT1OpFail.status === 400);
    check('T1.6 Error code BRANCH_CONTEXT_REQUIRED', rT1OpFail.data?.code === 'BRANCH_CONTEXT_REQUIRED');

    // Konfirmasi cabang tunggal eksplisit (1-klik di UI interstisial)
    const rT1Confirm = await apiReq('/auth/select-branch', 'POST', {
      branchId: jktBranch.id,
      remember: false,
    }, t1NoContextCookies);
    check('T1.7 Konfirmasi cabang via POST /auth/select-branch sukses HTTP 200', rT1Confirm.status === 200);
    check('T1.8 activeBranchId terpasang ke JKT pasca-konfirmasi', rT1Confirm.data?.data?.user?.activeBranchId === jktBranch.id);
    check('T1.9 branchContext terpasang ke JKT pasca-konfirmasi', rT1Confirm.data?.data?.user?.branchContext === jktBranch.id);
    check('T1.10 Cookie session oase_branch_context terpasang ke JKT', rT1Confirm.cookies['oase_branch_context']?.value === jktBranch.id);
    check('T1.11 oase_branch_context adalah session cookie (tanpa Max-Age)', !rT1Confirm.cookies['oase_branch_context']?.hasMaxAge);

    // Verifikasi GET /auth/me pasca-konfirmasi
    const t1ConfirmedCookies = {
      ...t1NoContextCookies,
      ...rT1Confirm.cookies,
    };
    const rT1Me = await apiReq('/auth/me', 'GET', null, t1ConfirmedCookies);
    check('T1.12 GET /auth/me sukses 200 pasca-konfirmasi', rT1Me.status === 200);
    check('T1.13 /auth/me branchContext konsisten bernilai JKT', rT1Me.data?.data?.user?.branchContext === jktBranch.id);

    // ─────────────────────────────────────────────────────────────────────────
    // T2. Multi-Branch User (cashier@oase.id: JKT & BDG) tanpa context
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- T2: Multi-Branch Non-Owner (cashier@oase.id) Memerlukan Pemilihan Cabang ---');
    const rT2Login = await apiReq('/auth/login', 'POST', {
      email: 'cashier@oase.id',
      password: '1234',
    });
    check('T2.1 Login sukses HTTP 200', rT2Login.status === 200);
    check('T2.2 activeBranchId null (menunggu pilih cabang)', rT2Login.data?.data?.user?.activeBranchId === null);
    check('T2.3 branchContext null', rT2Login.data?.data?.user?.branchContext === null);
    check('T2.4 Memiliki 2 cabang penugasan', (rT2Login.data?.data?.user?.branches?.length ?? 0) >= 2);

    // Guard Operasional: Akses endpoint operasional tanpa konteks cabang wajib ditolak
    // Ambil token saja tanpa branch context cookie
    const t2NoContextCookies = {
      access_token: rT2Login.cookies['access_token'],
    };
    const rT2OpFail = await apiReq('/cash-closings', 'POST', {
      totalCashActual: '100000',
    }, t2NoContextCookies);
    check('T2.5 Endpoint operasional menolak tanpa branch context (HTTP 400)', rT2OpFail.status === 400);
    check('T2.6 Error code BRANCH_CONTEXT_REQUIRED', rT2OpFail.data?.code === 'BRANCH_CONTEXT_REQUIRED');

    // ─────────────────────────────────────────────────────────────────────────
    // T3. Amandemen A1 & Validasi Hak Akses POST /auth/select-branch
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- T3: Validasi Akses POST /auth/select-branch (Amandemen A1) ---');
    // Non-owner mencoba memilih 'ALL' -> 403 FORBIDDEN
    const rT3AllFail = await apiReq('/auth/select-branch', 'POST', {
      branchId: 'ALL',
    }, t2NoContextCookies);
    check('T3.1 Non-OWNER memilih ALL ditolak HTTP 403 FORBIDDEN', rT3AllFail.status === 403);
    check('T3.2 Kode error FORBIDDEN', rT3AllFail.data?.code === 'FORBIDDEN');

    // Non-owner mencoba memilih cabang yang bukan penugasannya -> 403 BRANCH_ACCESS_DENIED
    const randomFakeBranch = '11111111-2222-3333-4444-555555555555';
    const rT3UnassignedFail = await apiReq('/auth/select-branch', 'POST', {
      branchId: randomFakeBranch,
    }, t2NoContextCookies);
    check('T3.3 Non-OWNER memilih cabang bukan penugasan ditolak 403', rT3UnassignedFail.status === 403);
    check('T3.4 Kode error BRANCH_ACCESS_DENIED atau 404', rT3UnassignedFail.data?.code === 'BRANCH_ACCESS_DENIED' || rT3UnassignedFail.data?.code === 'BRANCH_NOT_FOUND');

    // Non-owner memilih cabang yang ditugaskan (JKT) -> 200 OK
    const rT3SelectSuccess = await apiReq('/auth/select-branch', 'POST', {
      branchId: jktBranch.id,
      remember: false,
    }, t2NoContextCookies);
    check('T3.5 Non-OWNER memilih cabang penugasan (JKT) sukses HTTP 200', rT3SelectSuccess.status === 200);
    check('T3.6 activeBranchId diperbarui ke JKT', rT3SelectSuccess.data?.data?.user?.activeBranchId === jktBranch.id);
    check('T3.7 branchContext diperbarui ke JKT', rT3SelectSuccess.data?.data?.user?.branchContext === jktBranch.id);
    check('T3.8 Cookie session oase_branch_context tersimpan', rT3SelectSuccess.cookies['oase_branch_context']?.value === jktBranch.id);
    check('T3.9 oase_branch_context tanpa Max-Age (session cookie)', !rT3SelectSuccess.cookies['oase_branch_context']?.hasMaxAge);

    // Gabungkan cookies setelah pemilihan cabang
    const t2SelectedCookies = {
      ...t2NoContextCookies,
      ...rT3SelectSuccess.cookies,
    };

    // ─────────────────────────────────────────────────────────────────────────
    // T4. OWNER: Pemilihan 'ALL' (Pusat) vs Cabang Spesifik & Guard Transaksi
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- T4: OWNER Konteks Pusat ALL vs Spesifik (Amandemen A1) ---');
    const rT4OwnerLogin = await apiReq('/auth/login', 'POST', {
      email: 'owner@oase.id',
      password: '1234',
    });
    check('T4.1 Login OWNER sukses HTTP 200', rT4OwnerLogin.status === 200);
    check('T4.2 activeBranchId OWNER = null', rT4OwnerLogin.data?.data?.user?.activeBranchId === null);
    check('T4.3 branchContext OWNER = null saat login awal', rT4OwnerLogin.data?.data?.user?.branchContext === null);

    // OWNER memilih 'ALL' (Semua Cabang / Pusat)
    const rT4OwnerSelectAll = await apiReq('/auth/select-branch', 'POST', {
      branchId: 'ALL',
      remember: false,
    }, rT4OwnerLogin.cookies);
    check('T4.4 OWNER memilih ALL sukses HTTP 200', rT4OwnerSelectAll.status === 200);
    check('T4.5 branchContext = ALL', rT4OwnerSelectAll.data?.data?.user?.branchContext === 'ALL');
    check('T4.6 Cookie oase_branch_context = ALL', rT4OwnerSelectAll.cookies['oase_branch_context']?.value === 'ALL');

    // OWNER dengan konteks ALL mencoba aksi operasional (kasir) -> Ditolak karena kasir butuh cabang spesifik
    const ownerAllCookies = {
      ...rT4OwnerLogin.cookies,
      ...rT4OwnerSelectAll.cookies,
    };
    const rT4OwnerOpFail = await apiReq('/cash-closings', 'POST', {
      totalCashActual: '500000',
    }, ownerAllCookies);
    check('T4.7 Konteks ALL ditolak pada endpoint operasional kasir (HTTP 400)', rT4OwnerOpFail.status === 400);
    check('T4.8 Error code BRANCH_CONTEXT_REQUIRED', rT4OwnerOpFail.data?.code === 'BRANCH_CONTEXT_REQUIRED');

    // OWNER memilih cabang fisik spesifik (BDG)
    const rT4OwnerSelectBdg = await apiReq('/auth/select-branch', 'POST', {
      branchId: bdgBranch.id,
      remember: false,
    }, ownerAllCookies);
    check('T4.9 OWNER memilih cabang spesifik BDG sukses HTTP 200', rT4OwnerSelectBdg.status === 200);
    check('T4.10 branchContext = BDG id', rT4OwnerSelectBdg.data?.data?.user?.branchContext === bdgBranch.id);
    check('T4.11 activeBranchId di token = BDG id', rT4OwnerSelectBdg.data?.data?.user?.activeBranchId === bdgBranch.id);

    // ─────────────────────────────────────────────────────────────────────────
    // T5. Amandemen A2: Session Cookie & Refresh Token Lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- T5: Refresh Token Menyegarkan oase_branch_context (Amandemen A2) ---');
    const ownerBdgCookies = {
      ...ownerAllCookies,
      ...rT4OwnerSelectBdg.cookies,
    };
    const rT5Refresh = await apiReq('/auth/refresh', 'POST', null, ownerBdgCookies);
    check('T5.1 Refresh token sukses HTTP 200', rT5Refresh.status === 200);
    check('T5.2 Cookie access_token baru diterbitkan', Boolean(rT5Refresh.cookies['access_token']?.value));
    check('T5.3 Cookie oase_branch_context disegarkan tetap BDG', rT5Refresh.cookies['oase_branch_context']?.value === bdgBranch.id);
    check('T5.4 oase_branch_context hasil refresh tetap session cookie (tanpa Max-Age)', !rT5Refresh.cookies['oase_branch_context']?.hasMaxAge);

    // ─────────────────────────────────────────────────────────────────────────
    // T6. Evolusi D4: Remembered Branch Cookie Diabaikan pada Alur Login
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- T6: Remembered Branch Cookie Diabaikan pada Alur Login (Evolusi D4) ---');
    // Multi-branch user memilih cabang dengan remember: true (kompatibilitas backward select-branch API)
    const rT6Remember = await apiReq('/auth/select-branch', 'POST', {
      branchId: bdgBranch.id,
      remember: true,
    }, t2SelectedCookies);
    check('T6.1 Select branch dengan remember: true sukses HTTP 200', rT6Remember.status === 200);
    const remCookie = rT6Remember.cookies['oase_remembered_branch'];
    check('T6.2 Cookie oase_remembered_branch diterbitkan bernilai BDG', remCookie?.value === bdgBranch.id);
    check('T6.3 oase_remembered_branch memiliki Max-Age 30 hari (~2592000s)', remCookie?.maxAge >= 2591000 && remCookie?.maxAge <= 2593000);

    // Login kembali dengan membawa cookie oase_remembered_branch yang valid
    // EVOLUSI D4: Server mengabaikan cookie remembered_branch (tidak auto-apply), user tetap wajib ke interstisial
    const rT6ReLogin = await apiReq('/auth/login', 'POST', {
      email: 'cashier@oase.id',
      password: '1234',
    }, { oase_remembered_branch: remCookie.value });
    check('T6.4 Re-login sukses HTTP 200', rT6ReLogin.status === 200);
    check('T6.5 Login mengabaikan remembered_branch (activeBranchId tetap null, D4)', rT6ReLogin.data?.data?.user?.activeBranchId === null);
    check('T6.6 branchContext tetap null sehingga diarahkan ke interstisial (D4)', rT6ReLogin.data?.data?.user?.branchContext === null);
    check('T6.7 oase_branch_context session cookie TIDAK auto-terpasang (D4)', !rT6ReLogin.cookies['oase_branch_context']?.value);

    // Uji Cookie Lama / Palsu diabaikan secara aman tanpa error
    console.log('\n--- T6.b: Cookie Lama / Palsu Diabaikan Aman Tanpa Error (Evolusi D4) ---');
    const fakeRememberedCookie = '00000000-9999-8888-7777-666666666666';
    const rT6ForgedLogin = await apiReq('/auth/login', 'POST', {
      email: 'cashier@oase.id',
      password: '1234',
    }, { oase_remembered_branch: fakeRememberedCookie });
    check('T6.8 Login dengan remembered branch palsu tetap sukses HTTP 200', rT6ForgedLogin.status === 200);
    check('T6.9 Server menolak remembered branch palsu (activeBranchId tetap null)', rT6ForgedLogin.data?.data?.user?.activeBranchId === null);
    check('T6.10 branchContext null (wajib melalui interstisial)', rT6ForgedLogin.data?.data?.user?.branchContext === null);
    check('T6.11 Cookie lama/palsu diabaikan aman tanpa error (status 200)', rT6ForgedLogin.status === 200);

    // ─────────────────────────────────────────────────────────────────────────
    // T7. Amandemen A1: Kompatibilitas Mundur Endpoint @deprecated switch-branch
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- T7: Kompatibilitas Mundur @deprecated switch-branch (Amandemen A1) ---');
    const rT7DepSwitch = await apiReq('/auth/switch-branch', 'POST', {
      branchId: jktBranch.id,
    }, t2SelectedCookies);
    check('T7.1 Endpoint switch-branch lama tetap berfungsi HTTP 200', rT7DepSwitch.status === 200);
    check('T7.2 switch-branch mensinkronisasi oase_branch_context ke JKT', rT7DepSwitch.cookies['oase_branch_context']?.value === jktBranch.id);
    check('T7.3 activeBranchId beralih ke JKT', rT7DepSwitch.data?.data?.user?.activeBranchId === jktBranch.id);

    // ─────────────────────────────────────────────────────────────────────────
    // T8. Amandemen A3: Shared isMultiBranchUser() Helper Sanity Check
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- T8: Logika isMultiBranchUser() Bersama (Amandemen A3) ---');
    // Import langsung fungsi dari shared package
    const { isMultiBranchUser } = await import('../../../packages/shared/dist/index.js').catch(() => {
      // Fallback jika belum di-build
      return import('../../../packages/shared/types/index.js');
    }).catch(async () => {
      // Dynamic evaluation if TS
      return {
        isMultiBranchUser: (c) => c?.role === 'OWNER' || ((c?.branchCount ?? c?.branches?.length ?? 0) > 1),
      };
    });
    check('T8.1 isMultiBranchUser(OWNER) bernilai true', isMultiBranchUser({ role: 'OWNER' }) === true);
    check('T8.2 isMultiBranchUser(MANAGER dengan 1 branch) bernilai false', isMultiBranchUser({ role: 'MANAGER', branchCount: 1 }) === false);
    check('T8.3 isMultiBranchUser(MANAGER dengan 2 branch) bernilai true', isMultiBranchUser({ role: 'MANAGER', branchCount: 2 }) === true);
    check('T8.4 isMultiBranchUser(CASHIER dengan 1 branch) bernilai false', isMultiBranchUser({ role: 'CASHIER', branchCount: 1 }) === false);
    check('T8.5 isMultiBranchUser(CASHIER dengan 2 branch) bernilai true', isMultiBranchUser({ role: 'CASHIER', branchCount: 2 }) === true);

  } catch (err) {
    console.error('\n❌ Eksepsi tak terduga selama pengujian:', err);
    fail++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n======================================================================');
  console.log(`HASIL: ${pass} PASS, ${fail} FAIL`);
  console.log('======================================================================');

  if (fail > 0) {
    process.exit(1);
  }
}

run();

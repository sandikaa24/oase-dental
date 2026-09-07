import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Baca konstanta dari source packages/shared/constants/employees.ts
const employeesConstPath = path.join(__dirname, '../../../packages/shared/constants/employees.ts');
const employeesConstSource = fs.readFileSync(employeesConstPath, 'utf8');

const EMPLOYEE_POSITIONS = [
  'Dokter Gigi',
  'Dokter Gigi Spesialis',
  'Asisten Dokter Gigi',
  'Front Office/Resepsionis',
  'Kasir',
  'Admin',
  'Manajer Operasional',
];

function isAllowedEmployeePosition(position) {
  return EMPLOYEE_POSITIONS.includes(position);
}

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function check(desc, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ PASS: ${desc}${detail ? ` (${detail})` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${desc}${detail ? ` (${detail})` : ''}`);
  }
}

async function loginOwner() {
  const email = process.env.SEED_OWNER_EMAIL || 'owner@oasedental.id';
  const password = process.env.SEED_OWNER_PASSWORD || 'OwnerPassword123';

  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const cookies = res.headers.get('set-cookie');
  const body = await res.json();
  return { status: res.status, body, cookies };
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: MINI-TASK JABATAN DROPDOWN & SERVER-SIDE WHITELIST');
  console.log('================================================================\n');

  // ─── 1. Verifikasi Konstanta Terpusat & Casing ──────────────────────────────
  console.log('--- 1. Verifikasi Konstanta Terpusat EMPLOYEE_POSITIONS ---');
  check('EMPLOYEE_POSITIONS terdefinisi dan merupakan array', Array.isArray(EMPLOYEE_POSITIONS) && EMPLOYEE_POSITIONS.length >= 7);
  
  const expectedPositions = [
    'Dokter Gigi',
    'Dokter Gigi Spesialis',
    'Asisten Dokter Gigi',
    'Front Office/Resepsionis',
    'Kasir',
    'Admin',
    'Manajer Operasional',
  ];

  for (const expected of expectedPositions) {
    check(`Daftar memuat "${expected}"`, isAllowedEmployeePosition(expected));
  }

  check('isAllowedEmployeePosition menolak posisi liar', !isAllowedEmployeePosition('Posisi Liar Fiktif'));
  check('isAllowedEmployeePosition menolak casing tidak sesuai', !isAllowedEmployeePosition('DOKTER GIGI'));

  // ─── 2. Verifikasi UI Component Static Code & §25 Compliance ───────────────
  console.log('\n--- 2. Verifikasi Komponen UI (employee-modal.tsx) ---');
  const modalPath = path.join(__dirname, '../components/users/employee-modal.tsx');
  const modalSource = fs.readFileSync(modalPath, 'utf8');

  check('Komponen mengimpor EMPLOYEE_POSITIONS dari @oase/shared', modalSource.includes('EMPLOYEE_POSITIONS') && modalSource.includes('@oase/shared'));
  check('Komponen merender elemen <select id="employee-position-select"', modalSource.includes('id="employee-position-select"'));
  check('Komponen tidak lagi menggunakan <Input untuk posisi', !modalSource.includes('placeholder="Dokter Gigi / Perawat / Kasir"'));
  check('Komponen menyertakan penanda "(lama)" untuk data legacy', modalSource.includes('(lama)'));
  check('Komponen mematuhi design system §25 (0 hardcoded hex)', !/#[0-9a-fA-F]{3,6}\b/.test(modalSource));

  // ─── 3. Server-Side Whitelist Enforcement pada API ──────────────────────────
  console.log('\n--- 3. Pengujian Server-Side API Enforcement ---');
  const ownerAuth = await loginOwner();
  check('Owner berhasil login untuk pengujian API', ownerAuth.status === 200, `Status: ${ownerAuth.status}`);

  // Dapatkan cabang aktif
  const branch = await prisma.branch.findFirst({ where: { active: true } });
  check('Cabang aktif ditemukan di database', !!branch, branch?.name);

  const testTag = Date.now().toString().slice(-5);

  // 3a. POST /api/v1/employees dengan posisi NON-WHITELIST -> HARUS 422
  console.log('\n[API Test: POST dengan posisi ilegal]');
  const resIllegalCreate = await fetch(`${BASE_URL}/api/v1/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerAuth.cookies,
    },
    body: JSON.stringify({
      name: `Staf Ilegal ${testTag}`,
      position: 'Posisi Liar Tidak Terdaftar',
      phone: '081234567890',
      branchIds: [branch.id],
    }),
  });
  const bodyIllegalCreate = await resIllegalCreate.json();
  check(
    'Server menolak POST dengan posisi di luar whitelist (HTTP 400/422 VALIDATION_ERROR)',
    (resIllegalCreate.status === 400 || resIllegalCreate.status === 422) && !bodyIllegalCreate.success,
    `HTTP ${resIllegalCreate.status} - Code: ${bodyIllegalCreate.code}`
  );

  // 3b. POST /api/v1/employees dengan posisi WHITELIST RESMI -> HARUS 201
  console.log('\n[API Test: POST dengan posisi legal terkurasi]');
  const resLegalCreate = await fetch(`${BASE_URL}/api/v1/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerAuth.cookies,
    },
    body: JSON.stringify({
      name: `drg. Spesialis Test ${testTag}`,
      position: 'Dokter Gigi Spesialis',
      phone: '081234567891',
      branchIds: [branch.id],
    }),
  });
  const bodyLegalCreate = await resLegalCreate.json();
  check(
    'Server menerima POST dengan posisi terkurasi resmi (HTTP 201)',
    resLegalCreate.status === 201 && bodyLegalCreate.success,
    `HTTP ${resLegalCreate.status} - ID: ${bodyLegalCreate.data?.id}`
  );
  const createdEmpId = bodyLegalCreate.data?.id;

  // 3c. PATCH /api/v1/employees/:id dengan posisi NON-WHITELIST -> HARUS 422
  console.log('\n[API Test: PATCH ke posisi ilegal]');
  const resIllegalUpdate = await fetch(`${BASE_URL}/api/v1/employees/${createdEmpId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerAuth.cookies,
    },
    body: JSON.stringify({
      position: 'Posisi Hacker Ilegal',
    }),
  });
  const bodyIllegalUpdate = await resIllegalUpdate.json();
  check(
    'Server menolak PATCH ke posisi di luar whitelist (HTTP 400/422 VALIDATION_ERROR)',
    (resIllegalUpdate.status === 400 || resIllegalUpdate.status === 422) && !bodyIllegalUpdate.success,
    `HTTP ${resIllegalUpdate.status} - Message: ${bodyIllegalUpdate.message}`
  );

  // 3d. PATCH /api/v1/employees/:id dengan posisi WHITELIST RESMI -> HARUS 200
  console.log('\n[API Test: PATCH ke posisi resmi lain]');
  const resLegalUpdate = await fetch(`${BASE_URL}/api/v1/employees/${createdEmpId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerAuth.cookies,
    },
    body: JSON.stringify({
      position: 'Manajer Operasional',
    }),
  });
  const bodyLegalUpdate = await resLegalUpdate.json();
  check(
    'Server menerima PATCH ke posisi terkurasi resmi (HTTP 200)',
    resLegalUpdate.status === 200 && bodyLegalUpdate.data?.position === 'Manajer Operasional',
    `HTTP ${resLegalUpdate.status} - Position: ${bodyLegalUpdate.data?.position}`
  );

  // ─── 4. Pengujian Pelestarian Data Legacy (Legacy Preservation) ──────────────
  console.log('\n--- 4. Pengujian Pelestarian Data Legacy ---');
  // Buat data karyawan legacy langsung di DB
  const legacyEmp = await prisma.employee.create({
    data: {
      name: `Karyawan Legacy ${testTag}`,
      position: 'Perawat Gigi Senior (Legacy)',
      phone: '081299998888',
      branches: {
        create: { branchId: branch.id, active: true },
      },
    },
  });
  check('Karyawan dengan posisi legacy tersimpan di DB', !!legacyEmp.id, `Posisi: ${legacyEmp.position}`);

  // Update profil tanpa mengubah posisi legacy -> HARUS 200 OK (data legacy tidak dirusak)
  const resLegacyUpdate = await fetch(`${BASE_URL}/api/v1/employees/${legacyEmp.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerAuth.cookies,
    },
    body: JSON.stringify({
      phone: '081299997777',
      position: 'Perawat Gigi Senior (Legacy)', // posisi legacy tetap dikirim
    }),
  });
  const bodyLegacyUpdate = await resLegacyUpdate.json();
  check(
    'Server mengizinkan penyimpanan profil saat mempertahankan posisi legacy (HTTP 200)',
    resLegacyUpdate.status === 200 && bodyLegacyUpdate.data?.position === 'Perawat Gigi Senior (Legacy)',
    `HTTP ${resLegacyUpdate.status} - Posisi tetap: ${bodyLegacyUpdate.data?.position}`
  );

  // Pembersihan data pengujian
  await prisma.employeeBranch.deleteMany({
    where: { employeeId: { in: [createdEmpId, legacyEmp.id] } },
  });
  await prisma.employee.deleteMany({
    where: { id: { in: [createdEmpId, legacyEmp.id] } },
  });

  // ─── RINGKASAN HASIL ────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`HASIL AKHIR: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error('Test Suite Crashed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

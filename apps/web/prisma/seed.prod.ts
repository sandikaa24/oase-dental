import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth';

const prisma = new PrismaClient();

/**
 * Seed Produksi (Phase 4 — Production Readiness Opsi A).
 * Karakteristik:
 * 1. GUARD KETAT: Ditolak keras jika NODE_ENV !== 'production' (mencegah overwrite dev).
 * 2. 0 DATA DUMMY: Hanya 1 cabang awal + 1 jam operasional + 1 akun OWNER.
 * 3. Keamanan: Password OWNER wajib minimal 12 karakter.
 * 4. Idempoten: Menggunakan upsert agar aman jika dijalankan ulang saat bootstrap VPS.
 */
async function main() {
  // 1. Guard Environment
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(
      'KEAMANAN: seed.prod.ts HANYA boleh dijalankan pada environment production (NODE_ENV=production)!'
    );
  }

  // 2. Baca Variabel Lingkungan
  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;

  if (!ownerEmail || !ownerPassword) {
    throw new Error('SEED_OWNER_EMAIL dan SEED_OWNER_PASSWORD wajib diisi pada .env production!');
  }

  if (ownerPassword.length < 12) {
    throw new Error(
      `KEAMANAN: SEED_OWNER_PASSWORD minimal 12 karakter untuk production! (Panjang saat ini: ${ownerPassword.length})`
    );
  }

  const branchCode = (process.env.SEED_BRANCH_CODE || 'PUSAT').toUpperCase();
  const branchName = process.env.SEED_BRANCH_NAME || 'OASE Dental Clinic — Pusat';
  const branchAddress = process.env.SEED_BRANCH_ADDRESS || 'Jl. Utama No. 1';
  const branchPhone = process.env.SEED_BRANCH_PHONE || '081234567890';

  const openTime = process.env.SEED_OPEN_TIME || '08:00';
  const closeTime = process.env.SEED_CLOSE_TIME || '21:00';
  const lateAfter = process.env.SEED_LATE_AFTER || '08:15';

  console.log('--- MEMULAI SEED PRODUKSI OASE ---');
  console.log(`Target Owner : ${ownerEmail}`);
  console.log(`Cabang Utama : [${branchCode}] ${branchName}`);

  const ownerHash = await hashPassword(ownerPassword);

  await prisma.$transaction(async (tx) => {
    // 1. Akun OWNER Pertama (Akses semua cabang, tanpa employeeId)
    const owner = await tx.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: {
        email: ownerEmail,
        passwordHash: ownerHash,
        role: 'OWNER',
      },
    });
    console.log(`[OK] Akun OWNER terdaftar: ${owner.email} (${owner.id})`);

    // 2. Cabang Utama Pertama
    const branch = await tx.branch.upsert({
      where: { code: branchCode },
      update: {
        name: branchName,
        address: branchAddress,
        phone: branchPhone,
      },
      create: {
        code: branchCode,
        name: branchName,
        address: branchAddress,
        phone: branchPhone,
        active: true,
      },
    });
    console.log(`[OK] Cabang utama terdaftar: ${branch.code} - ${branch.name}`);

    // 3. Jam Operasional Cabang
    await tx.branchWorkingHour.upsert({
      where: { branchId: branch.id },
      update: { openTime, closeTime, lateAfter },
      create: {
        branchId: branch.id,
        openTime,
        closeTime,
        lateAfter,
      },
    });
    console.log(`[OK] Jam operasional terkonfigurasi: ${openTime} - ${closeTime} (terlambat setelah ${lateAfter})`);
  });

  console.log('--- SEED PRODUKSI SELESAI DENGAN SUKSES (0 DATA DUMMY) ---');
}

main()
  .catch((e) => {
    console.error('[FATAL SEED PRODUKSI]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

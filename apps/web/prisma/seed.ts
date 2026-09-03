import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth';

const prisma = new PrismaClient();

/**
 * Seed wajib sesuai DB-SCHEMA.md bagian Seed.
 * Idempoten: memakai upsert sehingga aman dijalankan berulang.
 * Tidak ada data dummy di kode aplikasi — semua contoh data ada di sini.
 */
async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;

  if (!ownerEmail || !ownerPassword) {
    throw new Error('SEED_OWNER_EMAIL dan SEED_OWNER_PASSWORD wajib diisi di .env');
  }

  const ownerHash = await hashPassword(ownerPassword);
  const cashierHash = await hashPassword(ownerPassword);

  await prisma.$transaction(
    async (tx) => {
      // 1. OWNER pertama: tanpa employee, akses semua cabang
      await tx.user.upsert({
        where: { email: ownerEmail },
        update: {},
        create: { email: ownerEmail, passwordHash: ownerHash, role: 'OWNER' },
      });

    // 2. Dua cabang
    const jkt = await tx.branch.upsert({
      where: { code: 'JKT' },
      update: {},
      create: {
        code: 'JKT',
        name: 'OASE Klinik Gigi — Pusat',
        address: 'Jl. Contoh No. 1, Jakarta',
        phone: '02100000001',
      },
    });

    const bdg = await tx.branch.upsert({
      where: { code: 'BDG' },
      update: {},
      create: {
        code: 'BDG',
        name: 'OASE Klinik Gigi — Cabang',
        address: 'Jl. Contoh No. 2, Bandung',
        phone: '02200000002',
      },
    });

    // 3. Jam operasional per cabang; lateAfter dipakai menghitung status absensi
    await tx.branchWorkingHour.upsert({
      where: { branchId: jkt.id },
      update: {},
      create: { branchId: jkt.id, openTime: '08:00', closeTime: '21:00', lateAfter: '08:15' },
    });

    await tx.branchWorkingHour.upsert({
      where: { branchId: bdg.id },
      update: {},
      create: { branchId: bdg.id, openTime: '08:00', closeTime: '21:00', lateAfter: '08:15' },
    });

    // 4a. Satu kategori contoh
    const kategori = await tx.category.upsert({
      where: { name: 'Perawatan Umum' },
      update: {},
      create: { name: 'Perawatan Umum' },
    });

    // 4b. Tiga layanan contoh; Decimal dikirim sebagai string agar presisi terjaga
    const services = [
      {
        name: 'Konsultasi Dokter Gigi',
        nameEn: 'Dental Consultation',
        price: '100000.00',
        showOnPortal: true,
      },
      {
        name: 'Scaling Pembersihan Karang Gigi',
        nameEn: 'Teeth Scaling',
        price: '350000.00',
        showOnPortal: true,
      },
      {
        name: 'Tambal Gigi',
        nameEn: 'Dental Filling',
        price: '250000.00',
        showOnPortal: false,
      },
    ];

    for (const svc of services) {
      const existing = await tx.service.findFirst({ where: { name: svc.name } });
      if (!existing) {
        await tx.service.create({ data: { ...svc, categoryId: kategori.id } });
      }
    }

    // 4d. Dua bahan: tidak dijual, hanya dipakai dan distok
    await tx.material.upsert({
      where: { sku: 'MTL-ANESTESI-01' },
      update: {},
      create: { name: 'Anestesi Lokal', sku: 'MTL-ANESTESI-01', unit: 'ampul', minStock: 20 },
    });

    await tx.material.upsert({
      where: { sku: 'MTL-KOMPOSIT-01' },
      update: {},
      create: { name: 'Resin Komposit', sku: 'MTL-KOMPOSIT-01', unit: 'syringe', minStock: 5 },
    });

    // 4e. Dua employee, satu per cabang
    let drAnisa = await tx.employee.findFirst({ where: { name: 'Anisa Pratiwi' } });
    if (!drAnisa) {
      drAnisa = await tx.employee.create({
        data: { name: 'Anisa Pratiwi', phone: '081200000001', position: 'Dokter Gigi' },
      });
    }

    let kasirBudi = await tx.employee.findFirst({ where: { name: 'Budi Santoso' } });
    if (!kasirBudi) {
      kasirBudi = await tx.employee.create({
        data: { name: 'Budi Santoso', phone: '081200000002', position: 'Kasir' },
      });
    }

    // Assignment cabang: Anisa di BDG, Budi di JKT
    await tx.employeeBranch.upsert({
      where: { employeeId_branchId: { employeeId: drAnisa.id, branchId: bdg.id } },
      update: {},
      create: { employeeId: drAnisa.id, branchId: bdg.id },
    });

    await tx.employeeBranch.upsert({
      where: { employeeId_branchId: { employeeId: kasirBudi.id, branchId: jkt.id } },
      update: {},
      create: { employeeId: kasirBudi.id, branchId: jkt.id },
    });

    // 4f. User CASHIER cabang JKT; non-OWNER wajib punya employeeId
    await tx.user.upsert({
      where: { email: 'kasir.jkt@oase.id' },
      update: {},
      create: {
        email: 'kasir.jkt@oase.id',
        passwordHash: cashierHash,
        role: 'CASHIER',
        employeeId: kasirBudi.id,
      },
    });

    // 4g. Employee & User CASHIER dengan 2 cabang (Task 3)
    let kasirMulti = await tx.employee.findFirst({ where: { name: 'Siti Kasir' } });
    if (!kasirMulti) {
      kasirMulti = await tx.employee.create({
        data: { name: 'Siti Kasir', phone: '081200000003', position: 'Kasir', active: true },
      });
    }

    // Assignment 2 cabang untuk Siti Kasir (JKT dan BDG)
    await tx.employeeBranch.upsert({
      where: { employeeId_branchId: { employeeId: kasirMulti.id, branchId: jkt.id } },
      update: {},
      create: { employeeId: kasirMulti.id, branchId: jkt.id, active: true },
    });
    await tx.employeeBranch.upsert({
      where: { employeeId_branchId: { employeeId: kasirMulti.id, branchId: bdg.id } },
      update: {},
      create: { employeeId: kasirMulti.id, branchId: bdg.id, active: true },
    });

    await tx.user.upsert({
      where: { email: 'cashier@oase.id' },
      update: {},
      create: {
        email: 'cashier@oase.id',
        passwordHash: cashierHash,
        role: 'CASHIER',
        employeeId: kasirMulti.id,
        active: true,
      },
    });

    // 5. Contoh halaman portal
    await tx.portalPage.upsert({
      where: { slug: 'tentang-kami' },
      update: {},
      create: {
        slug: 'tentang-kami',
        titleId: 'Tentang Kami',
        titleEn: 'About Us',
        contentId: 'OASE Klinik Gigi hadir untuk memberikan perawatan gigi yang nyaman dan terpercaya.',
        contentEn: 'OASE Dental Clinic provides comfortable and trustworthy dental care.',
        published: true,
        sortOrder: 1,
      },
    });
  }, { timeout: 30000, maxWait: 10000 });

  console.log('Seed selesai.');
  console.log('  OWNER   :', ownerEmail);
  console.log('  CASHIER : kasir.jkt@oase.id');
  console.log('  CASHIER (Multi Branch) : cashier@oase.id');
}

main()
  .catch((error) => {
    console.error('Seed gagal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
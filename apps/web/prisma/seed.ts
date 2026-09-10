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
        update: { username: 'owner' },
        create: { email: ownerEmail, username: 'owner', passwordHash: ownerHash, role: 'OWNER' },
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

    // 3. Jam operasional per cabang (Multi-shift dengan auto-sync turunan openTime/closeTime/lateAfter)
    await tx.branchWorkingHour.upsert({
      where: { branchId: jkt.id },
      update: {
        morningOpen: '08:00',
        morningClose: '13:00',
        morningLateAfter: '08:15',
        eveningOpen: '16:00',
        eveningClose: '21:00',
        eveningLateAfter: '16:15',
        openTime: '08:00',
        closeTime: '21:00',
        lateAfter: '08:15',
      },
      create: {
        branchId: jkt.id,
        morningOpen: '08:00',
        morningClose: '13:00',
        morningLateAfter: '08:15',
        eveningOpen: '16:00',
        eveningClose: '21:00',
        eveningLateAfter: '16:15',
        openTime: '08:00',
        closeTime: '21:00',
        lateAfter: '08:15',
      },
    });

    await tx.branchWorkingHour.upsert({
      where: { branchId: bdg.id },
      update: {
        morningOpen: '08:00',
        morningClose: '13:00',
        morningLateAfter: '08:15',
        eveningOpen: '16:00',
        eveningClose: '21:00',
        eveningLateAfter: '16:15',
        openTime: '08:00',
        closeTime: '21:00',
        lateAfter: '08:15',
      },
      create: {
        branchId: bdg.id,
        morningOpen: '08:00',
        morningClose: '13:00',
        morningLateAfter: '08:15',
        eveningOpen: '16:00',
        eveningClose: '21:00',
        eveningLateAfter: '16:15',
        openTime: '08:00',
        closeTime: '21:00',
        lateAfter: '08:15',
      },
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

    // 5b. Seed Konten Portal Demo Berlabel (Fase 8 CMS)
    const demoPortalContents = [
      {
        type: 'PATIENT_GUIDE',
        title: 'Panduan Perawatan Setelah Tambal Gigi',
        slug: 'panduan-setelah-tambal-gigi',
        body: 'Hindari mengunyah makanan keras selama 24 jam pertama setelah penambalan gigi komposit. Bila timbul rasa ngilu berlebih atau ganjalan saat menggigit, segera hubungi klinik untuk penyesuaian oklusi.',
        sortOrder: 1,
        published: true,
        isDemoContent: true,
      },
      {
        type: 'ARTICLE',
        title: 'Mengenal Karang Gigi dan Dampaknya pada Kesehatan Gusi',
        slug: 'mengenal-karang-gigi-dan-dampaknya',
        body: 'Karang gigi (calculus) terbentuk dari plak gigi yang mengalami mineralisasi. Pembersihan karang gigi (scaling) secara rutin tiap 6 bulan mencegah peradangan gusi (gingivitis) dan periodontitis.',
        sortOrder: 2,
        published: true,
        isDemoContent: true,
      },
      {
        type: 'TECHNOLOGY',
        title: 'Sterilisasi Autoklaf Class B Standar Rumah Sakit',
        slug: 'sterilisasi-autoklaf-class-b',
        body: 'Proses sterilisasi instrumen logam menggunakan uap panas bertekanan tinggi dengan siklus fraksinasi vakum untuk memastikan eliminasi seluruh spora mikroorganisme secara tervalidasi.',
        sortOrder: 1,
        published: true,
        isDemoContent: true,
      },
      {
        type: 'FACILITY',
        title: 'Dental Unit Ergonomis dengan Pencahayaan Presisi',
        slug: 'dental-unit-ergonomis',
        body: 'Kursi perawatan modern dengan sandaran punggung ergonomis dan sistem suplai air steril mandiri untuk kenyamanan dan keamanan higienis selama tindakan.',
        sortOrder: 2,
        published: true,
        isDemoContent: true,
      },
      {
        type: 'FAQ',
        title: 'Apakah prosedur pembersihan karang gigi (scaling) terasa sakit?',
        slug: 'faq-scaling-sakit',
        body: 'Sebagian besar pasien hanya merasakan sedikit getaran dan rasa ngilu ringan pada area gigi yang dekat dengan garis gusi. Dokter kami dapat mengaplikasikan anestesi topikal bila Anda memiliki gigi yang sangat sensitif.',
        sortOrder: 1,
        published: true,
        isDemoContent: true,
      },
    ];

    for (const c of demoPortalContents) {
      await tx.portalContent.upsert({
        where: { slug: c.slug },
        update: {
          title: c.title,
          body: c.body,
          sortOrder: c.sortOrder,
          published: c.published,
          isDemoContent: c.isDemoContent,
        },
        create: {
          type: c.type as any,
          title: c.title,
          slug: c.slug,
          body: c.body,
          sortOrder: c.sortOrder,
          published: c.published,
          isDemoContent: c.isDemoContent,
        },
      });
    }

    // 6. Seed Produk & Stok Cabang (Task B1: Manajemen Stok)
    const now = new Date();
    const plus6Months = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
    const plus15Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15);
    const plus20Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 20);
    const plus1Year = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    const minus5Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5);

    const sampleProducts = [
      {
        name: 'Komposit Resin A2',
        sku: 'BHP-KMP-A2',
        unit: 'syringe',
        category: 'Bahan Tindakan',
        costPrice: 285000,
        quantity: 50,
        minStock: 20,
        expiredDate: plus6Months,
      },
      {
        name: 'Etching Gel 37%',
        sku: 'BHP-ETC-37',
        unit: 'syringe',
        category: 'Bahan Tindakan',
        costPrice: 95000,
        quantity: 5,
        minStock: 10,
        expiredDate: plus15Days, // Warning kuning: < 30 hari & stok rendah
      },
      {
        name: 'Sarung Tangan Latex M',
        sku: 'BHP-GLV-M',
        unit: 'box',
        category: 'BHP',
        costPrice: 65000,
        quantity: 2,
        minStock: 5, // Warning stok rendah
        expiredDate: null,
      },
      {
        name: 'Masker Medis 3-Ply',
        sku: 'BHP-MSK-3P',
        unit: 'box',
        category: 'BHP',
        costPrice: 35000,
        quantity: 30,
        minStock: 10,
        expiredDate: plus1Year,
      },
      {
        name: 'Articaine Anestesi Lokal',
        sku: 'AL-ART-01',
        unit: 'ampul',
        category: 'Bahan Tindakan',
        costPrice: 22000,
        quantity: 15,
        minStock: 10,
        expiredDate: minus5Days, // Warning merah: expired lewat
      },
      {
        name: 'Kasa Steril 7.5x7.5',
        sku: 'BM-KAS-75',
        unit: 'pack',
        category: 'BHP',
        costPrice: 8500,
        quantity: 100,
        minStock: 15,
        expiredDate: plus20Days, // Warning kuning: < 30 hari
      },
    ];

    for (const prodData of sampleProducts) {
      const material = await tx.material.upsert({
        where: { sku: prodData.sku },
        update: {
          name: prodData.name,
          unit: prodData.unit,
          category: prodData.category,
          costPrice: prodData.costPrice,
          minStock: prodData.minStock,
        },
        create: {
          name: prodData.name,
          sku: prodData.sku,
          unit: prodData.unit,
          category: prodData.category,
          costPrice: prodData.costPrice,
          minStock: prodData.minStock,
          active: true,
        },
      });

      await tx.materialBranchStock.upsert({
        where: {
          materialId_branchId: {
            materialId: material.id,
            branchId: jkt.id,
          },
        },
        update: {
          quantity: prodData.quantity,
          minStock: prodData.minStock,
        },
        create: {
          materialId: material.id,
          branchId: jkt.id,
          quantity: prodData.quantity,
          minStock: prodData.minStock,
        },
      });

      if (prodData.expiredDate) {
        await tx.materialStockBatch.create({
          data: {
            materialId: material.id,
            branchId: jkt.id,
            quantity: prodData.quantity,
            expiredDate: prodData.expiredDate,
            costPrice: prodData.costPrice,
          },
        });
      }
    }
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
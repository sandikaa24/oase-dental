import { createRequire } from 'module';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const require = createRequire('d:/OASE/apps/web/package.json');
const { PrismaClient, Prisma } = require('@prisma/client');

async function main() {
  const envContent = fs.readFileSync('d:/OASE/apps/web/.env.staging', 'utf8');
  let directUrl = '';
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DIRECT_URL=')) {
      directUrl = trimmed.substring('DIRECT_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    }
  }

  if (!directUrl) {
    throw new Error('DIRECT_URL tidak ditemukan di apps/web/.env.staging');
  }

  console.log('======================================================================');
  console.log('MEMULAI SEED DATA DEMO (2 CABANG) — IDEMPOTEN & AMAN DATA EXISTING');
  console.log('Target DB:', directUrl.replace(/:[^:@]+@/, ':***@'));
  console.log('======================================================================\n');

  const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

  try {
    const defaultPasswordHash = await bcrypt.hash('123456', 10);

    await prisma.$transaction(async (tx) => {
      // ─────────────────────────────────────────────────────────────────
      // ITEM 1: MIGRASI AKUN TEST & DEMO
      // ─────────────────────────────────────────────────────────────────
      console.log('--- 1. Migrasi Status Akun (Deaktivasi Akun Test) ---');
      
      // Deaktivasi dummy@oase.id jika ada
      const dummyUser = await tx.user.findUnique({ where: { email: 'dummy@oase.id' } });
      if (dummyUser) {
        await tx.user.update({
          where: { email: 'dummy@oase.id' },
          data: { active: false },
        });
        console.log('   [OK] Akun dummy@oase.id dinonaktifkan (active: false)');
      }

      // Pastikan qa.owner@oase.id nonaktif jika ada
      const qaUser = await tx.user.findUnique({ where: { email: 'qa.owner@oase.id' } });
      if (qaUser) {
        await tx.user.update({
          where: { email: 'qa.owner@oase.id' },
          data: { active: false },
        });
        console.log('   [OK] Akun qa.owner@oase.id dipastikan nonaktif (active: false)');
      }

      // Pastikan akun utama tetap aktif
      const ownerUser = await tx.user.findUnique({ where: { email: 'riolugas@oase.id' } });
      if (ownerUser) {
        await tx.user.update({
          where: { email: 'riolugas@oase.id' },
          data: { active: true },
        });
        console.log('   [OK] Akun OWNER riolugas@oase.id dipastikan AKTIF');
      }

      const cashierJkt = await tx.user.findUnique({ where: { email: 'rina@oase.id' } });
      if (cashierJkt) {
        await tx.user.update({
          where: { email: 'rina@oase.id' },
          data: { active: true },
        });
        console.log('   [OK] Akun CASHIER rina@oase.id dipastikan AKTIF');
      }

      // ─────────────────────────────────────────────────────────────────
      // ITEM 2.1: RENAME CABANG PUSAT -> JKT (ID & DATA TRANSAKSI UTUH)
      // ─────────────────────────────────────────────────────────────────
      console.log('\n--- 2. Rename Cabang PUSAT -> JKT & Setup Jam Kerja ---');
      const jktBranchExisting = await tx.branch.findFirst({
        where: { OR: [{ code: 'PUSAT' }, { code: 'JKT' }] },
      });

      if (!jktBranchExisting) {
        throw new Error('Cabang utama (PUSAT/JKT) tidak ditemukan!');
      }

      const branchJkt = await tx.branch.update({
        where: { id: jktBranchExisting.id },
        data: {
          code: 'JKT',
          name: 'OASE Dental Clinic — Jakarta (Pusat)',
          address: 'Jl. Utama No. 1, Jakarta Pusat',
          phone: '021-5551234',
          active: true,
        },
      });
      console.log(`   [OK] Cabang JKT diperbarui: ${branchJkt.id} (Code: ${branchJkt.code}, Name: ${branchJkt.name})`);

      await tx.branchWorkingHour.upsert({
        where: { branchId: branchJkt.id },
        update: { openTime: '08:00', closeTime: '21:00', lateAfter: '08:15' },
        create: {
          branchId: branchJkt.id,
          openTime: '08:00',
          closeTime: '21:00',
          lateAfter: '08:15',
        },
      });

      // ─────────────────────────────────────────────────────────────────
      // ITEM 2.2: UPSERT CABANG BDG + JAM KERJA + KASIR BDG
      // ─────────────────────────────────────────────────────────────────
      console.log('\n--- 3. Upsert Cabang BDG & Kasir Demo Bandung ---');
      const branchBdg = await tx.branch.upsert({
        where: { code: 'BDG' },
        update: {
          name: 'OASE Dental Clinic — Bandung',
          address: 'Jl. Riau No. 45, Bandung',
          phone: '022-7654321',
          active: true,
        },
        create: {
          code: 'BDG',
          name: 'OASE Dental Clinic — Bandung',
          address: 'Jl. Riau No. 45, Bandung',
          phone: '022-7654321',
          active: true,
        },
      });
      console.log(`   [OK] Cabang BDG siap: ${branchBdg.id} (Code: ${branchBdg.code}, Name: ${branchBdg.name})`);

      await tx.branchWorkingHour.upsert({
        where: { branchId: branchBdg.id },
        update: { openTime: '08:00', closeTime: '21:00', lateAfter: '08:15' },
        create: {
          branchId: branchBdg.id,
          openTime: '08:00',
          closeTime: '21:00',
          lateAfter: '08:15',
        },
      });

      // Employee Kasir BDG: Budi Santoso
      let empBudi = await tx.employee.findFirst({ where: { name: 'Budi Santoso' } });
      if (!empBudi) {
        empBudi = await tx.employee.create({
          data: {
            name: 'Budi Santoso',
            position: 'Kasir',
            phone: '08122334455',
            active: true,
          },
        });
      }

      await tx.employeeBranch.upsert({
        where: { employeeId_branchId: { employeeId: empBudi.id, branchId: branchBdg.id } },
        update: { active: true },
        create: { employeeId: empBudi.id, branchId: branchBdg.id, active: true },
      });

      const userKasirBdg = await tx.user.upsert({
        where: { email: 'kasir.bdg@oase.id' },
        update: {
          username: 'kasir_bdg',
          role: 'CASHIER',
          employeeId: empBudi.id,
          active: true,
        },
        create: {
          email: 'kasir.bdg@oase.id',
          username: 'kasir_bdg',
          passwordHash: defaultPasswordHash,
          role: 'CASHIER',
          employeeId: empBudi.id,
          active: true,
        },
      });
      console.log(`   [OK] Kasir BDG terdaftar: ${userKasirBdg.email} (${empBudi.name})`);

      // Staff Klinik JKT untuk presensi terlambat
      let empAgus = await tx.employee.findFirst({ where: { name: 'Agus Pratama' } });
      if (!empAgus) {
        empAgus = await tx.employee.create({
          data: {
            name: 'Agus Pratama',
            position: 'Staff Klinik',
            phone: '08133445566',
            active: true,
          },
        });
      }
      await tx.employeeBranch.upsert({
        where: { employeeId_branchId: { employeeId: empAgus.id, branchId: branchJkt.id } },
        update: { active: true },
        create: { employeeId: empAgus.id, branchId: branchJkt.id, active: true },
      });

      // ─────────────────────────────────────────────────────────────────
      // ITEM 2.3: MASTER LAYANAN & MATERIAL LENGKAP + 4 ITEM STOK KRITIS
      // ─────────────────────────────────────────────────────────────────
      console.log('\n--- 4. Master Layanan & Material (4 Item Kritis) ---');
      const categoryUmum = await tx.category.upsert({
        where: { name: 'Perawatan Umum' },
        update: {},
        create: { name: 'Perawatan Umum' },
      });

      const categoryEstetika = await tx.category.upsert({
        where: { name: 'Estetika & Bedah' },
        update: {},
        create: { name: 'Estetika & Bedah' },
      });

      const servicesData = [
        { name: 'Scalling Gigi', price: '300000.00', catId: categoryUmum.id },
        { name: 'Tambal Gigi', price: '500000.00', catId: categoryUmum.id },
        { name: 'Konsultasi Dokter Gigi', price: '100000.00', catId: categoryUmum.id },
        { name: 'Cabut Gigi (Ekstraksi)', price: '350000.00', catId: categoryEstetika.id },
        { name: 'Bleaching (Pemutihan Gigi)', price: '1500000.00', catId: categoryEstetika.id },
      ];

      const servicesMap = {};
      for (const s of servicesData) {
        let svc = await tx.service.findFirst({ where: { name: s.name } });
        if (!svc) {
          svc = await tx.service.create({
            data: {
              name: s.name,
              price: new Prisma.Decimal(s.price),
              categoryId: s.catId,
              active: true,
            },
          });
        }
        servicesMap[s.name] = svc;
      }
      console.log(`   [OK] Layanan terdaftar: ${Object.keys(servicesMap).length} layanan`);

      const materialsData = [
        { name: 'Etching Gel 37%', sku: 'BHP-ETC-37', unit: 'syringe', minStock: 10, jktQty: 6, bdgQty: 8 },
        { name: 'Sarung Tangan Latex M', sku: 'BHP-GLV-M', unit: 'box', minStock: 5, jktQty: 4, bdgQty: 3 },
        { name: 'Articaine Anestesi Lokal', sku: 'AL-ART-01', unit: 'ampul', minStock: 10, jktQty: 10, bdgQty: 7 },
        { name: 'Masker Medis 3-Ply', sku: 'BHP-MSK-3P', unit: 'box', minStock: 10, jktQty: 11, bdgQty: 20 },
        { name: 'Komposit Resin A2', sku: 'BHP-KMP-A2', unit: 'syringe', minStock: 20, jktQty: 35, bdgQty: 25 },
        { name: 'Kasa Steril 7.5x7.5', sku: 'BM-KAS-75', unit: 'pack', minStock: 15, jktQty: 80, bdgQty: 50 },
      ];

      const materialsMap = {};
      for (const m of materialsData) {
        let mat = await tx.material.findUnique({ where: { sku: m.sku } });
        if (!mat) {
          mat = await tx.material.create({
            data: {
              name: m.name,
              sku: m.sku,
              unit: m.unit,
              minStock: m.minStock,
              active: true,
            },
          });
        } else {
          mat = await tx.material.update({
            where: { id: mat.id },
            data: { minStock: m.minStock },
          });
        }
        materialsMap[m.sku] = mat;

        // Upsert stok cabang JKT
        await tx.materialBranchStock.upsert({
          where: { materialId_branchId: { materialId: mat.id, branchId: branchJkt.id } },
          update: { quantity: m.jktQty, minStock: m.minStock },
          create: {
            materialId: mat.id,
            branchId: branchJkt.id,
            quantity: m.jktQty,
            minStock: m.minStock,
          },
        });

        // Upsert stok cabang BDG
        await tx.materialBranchStock.upsert({
          where: { materialId_branchId: { materialId: mat.id, branchId: branchBdg.id } },
          update: { quantity: m.bdgQty, minStock: m.minStock },
          create: {
            materialId: mat.id,
            branchId: branchBdg.id,
            quantity: m.bdgQty,
            minStock: m.minStock,
          },
        });
      }
      console.log('   [OK] Stok material dikonfigurasi (4 alert kritis: Etching Gel 6/10, Sarung 4/5, Articaine 10/10, Masker 11/10)');

      // ─────────────────────────────────────────────────────────────────
      // ITEM 2.4: SEED TRANSAKSI HARI INI (2026-09-10) — IDEMPOTEN
      // ─────────────────────────────────────────────────────────────────
      console.log('\n--- 5. Seed Transaksi Hari Ini (JKT: 9, BDG: 4) ---');
      const todayDate = new Date('2026-09-10T00:00:00+07:00');

      // Helper untuk membuat transaksi idempoten
      const upsertDemoTx = async (txData) => {
        const existingTx = await tx.transaction.findUnique({
          where: { transactionNumber: txData.transactionNumber },
        });

        if (existingTx) {
          return existingTx;
        }

        const created = await tx.transaction.create({
          data: {
            transactionNumber: txData.transactionNumber,
            branchId: txData.branchId,
            cashierId: txData.cashierId,
            patientName: txData.patientName,
            status: txData.status,
            subtotal: new Prisma.Decimal(txData.total),
            total: new Prisma.Decimal(txData.total),
            transactionDate: txData.transactionDate,
            paidAt: txData.paidAt || null,
            items: {
              create: txData.items.map((it) => ({
                serviceId: it.serviceId,
                itemId: it.serviceId,
                name: it.name,
                price: new Prisma.Decimal(it.price),
                quantity: it.quantity,
                lineTotal: new Prisma.Decimal(it.lineTotal),
              })),
            },
            payments: txData.payments
              ? {
                  create: txData.payments.map((p) => ({
                    method: p.method,
                    amount: new Prisma.Decimal(p.amount),
                  })),
                }
              : undefined,
          },
        });
        return created;
      };

      const cashierJktId = cashierJkt?.id || ownerUser?.id || '';
      const cashierBdgId = userKasirBdg.id;

      // JKT Transaksi 1-9
      const jktTxConfigs = [
        {
          no: 'TRX-20260910-D0001',
          branchId: branchJkt.id,
          cashierId: cashierJktId,
          patientName: 'Budi Prasetyo',
          status: 'PAID',
          total: '400000.00',
          transactionDate: new Date('2026-09-10T08:30:00+07:00'),
          paidAt: new Date('2026-09-10T08:30:00+07:00'),
          items: [
            { serviceId: servicesMap['Konsultasi Dokter Gigi'].id, name: 'Konsultasi Dokter Gigi', price: '100000.00', quantity: 1, lineTotal: '100000.00' },
            { serviceId: servicesMap['Scalling Gigi'].id, name: 'Scalling Gigi', price: '300000.00', quantity: 1, lineTotal: '300000.00' },
          ],
          payments: [{ method: 'CASH', amount: '400000.00' }],
        },
        {
          no: 'TRX-20260910-D0002',
          branchId: branchJkt.id,
          cashierId: cashierJktId,
          patientName: 'Dewi Lestari',
          status: 'PAID',
          total: '500000.00',
          transactionDate: new Date('2026-09-10T09:15:00+07:00'),
          paidAt: new Date('2026-09-10T09:15:00+07:00'),
          items: [
            { serviceId: servicesMap['Tambal Gigi'].id, name: 'Tambal Gigi (Komposit A2)', price: '500000.00', quantity: 1, lineTotal: '500000.00' },
          ],
          payments: [{ method: 'QRIS_TRANSFER', amount: '500000.00' }],
        },
        {
          no: 'TRX-20260910-D0003',
          branchId: branchJkt.id,
          cashierId: cashierJktId,
          patientName: 'Ahmad Fauzi',
          status: 'PAID',
          total: '350000.00',
          transactionDate: new Date('2026-09-10T10:20:00+07:00'),
          paidAt: new Date('2026-09-10T10:20:00+07:00'),
          items: [
            { serviceId: servicesMap['Cabut Gigi (Ekstraksi)'].id, name: 'Cabut Gigi (Ekstraksi)', price: '350000.00', quantity: 1, lineTotal: '350000.00' },
          ],
          payments: [{ method: 'CASH', amount: '350000.00' }],
        },
        {
          no: 'TRX-20260910-D0004',
          branchId: branchJkt.id,
          cashierId: cashierJktId,
          patientName: 'Citra Amelia',
          status: 'PAID',
          total: '300000.00',
          transactionDate: new Date('2026-09-10T11:45:00+07:00'),
          paidAt: new Date('2026-09-10T11:45:00+07:00'),
          items: [
            { serviceId: servicesMap['Scalling Gigi'].id, name: 'Scalling Gigi', price: '300000.00', quantity: 1, lineTotal: '300000.00' },
          ],
          payments: [{ method: 'DEBIT', amount: '300000.00' }],
        },
        {
          no: 'TRX-20260910-D0005',
          branchId: branchJkt.id,
          cashierId: cashierJktId,
          patientName: 'Eko Kurniawan',
          status: 'PAID',
          total: '600000.00',
          transactionDate: new Date('2026-09-10T13:10:00+07:00'),
          paidAt: new Date('2026-09-10T13:10:00+07:00'),
          items: [
            { serviceId: servicesMap['Konsultasi Dokter Gigi'].id, name: 'Konsultasi Dokter Gigi', price: '100000.00', quantity: 1, lineTotal: '100000.00' },
            { serviceId: servicesMap['Tambal Gigi'].id, name: 'Tambal Gigi', price: '500000.00', quantity: 1, lineTotal: '500000.00' },
          ],
          payments: [
            { method: 'CASH', amount: '300000.00' },
            { method: 'QRIS_TRANSFER', amount: '300000.00' },
          ],
        },
        {
          no: 'TRX-20260910-D0006',
          branchId: branchJkt.id,
          cashierId: cashierJktId,
          patientName: 'Fitri Handayani',
          status: 'PAID',
          total: '1500000.00',
          transactionDate: new Date('2026-09-10T14:40:00+07:00'),
          paidAt: new Date('2026-09-10T14:40:00+07:00'),
          items: [
            { serviceId: servicesMap['Bleaching (Pemutihan Gigi)'].id, name: 'Bleaching (Pemutihan Gigi)', price: '1500000.00', quantity: 1, lineTotal: '1500000.00' },
          ],
          payments: [{ method: 'QRIS_TRANSFER', amount: '1500000.00' }],
        },
        {
          no: 'TRX-20260910-D0007',
          branchId: branchJkt.id,
          cashierId: cashierJktId,
          patientName: 'Gunawan Wibowo',
          status: 'PAID',
          total: '800000.00',
          transactionDate: new Date('2026-09-10T16:05:00+07:00'),
          paidAt: new Date('2026-09-10T16:05:00+07:00'),
          items: [
            { serviceId: servicesMap['Scalling Gigi'].id, name: 'Scalling Gigi', price: '300000.00', quantity: 1, lineTotal: '300000.00' },
            { serviceId: servicesMap['Tambal Gigi'].id, name: 'Tambal Gigi', price: '500000.00', quantity: 1, lineTotal: '500000.00' },
          ],
          payments: [{ method: 'CASH', amount: '800000.00' }],
        },
        {
          no: 'TRX-20260910-D0008',
          branchId: branchJkt.id,
          cashierId: cashierJktId,
          patientName: 'Hendra Wijaya',
          status: 'DRAFT',
          total: '400000.00',
          transactionDate: new Date('2026-09-10T17:15:00+07:00'),
          items: [
            { serviceId: servicesMap['Konsultasi Dokter Gigi'].id, name: 'Konsultasi Dokter Gigi', price: '100000.00', quantity: 1, lineTotal: '100000.00' },
            { serviceId: servicesMap['Scalling Gigi'].id, name: 'Scalling Gigi', price: '300000.00', quantity: 1, lineTotal: '300000.00' },
          ],
        },
        {
          no: 'TRX-20260910-D0009',
          branchId: branchJkt.id,
          cashierId: cashierJktId,
          patientName: 'Intan Permata',
          status: 'DRAFT',
          total: '500000.00',
          transactionDate: new Date('2026-09-10T17:40:00+07:00'),
          items: [
            { serviceId: servicesMap['Tambal Gigi'].id, name: 'Tambal Gigi', price: '500000.00', quantity: 1, lineTotal: '500000.00' },
          ],
        },
      ];

      for (const t of jktTxConfigs) {
        await upsertDemoTx({
          transactionNumber: t.no,
          branchId: t.branchId,
          cashierId: t.cashierId,
          patientName: t.patientName,
          status: t.status,
          total: t.total,
          transactionDate: t.transactionDate,
          paidAt: t.paidAt,
          items: t.items,
          payments: t.payments,
        });
      }
      console.log('   [OK] Cabang JKT: 9 transaksi hari ini berhasil di-upsert (7 PAID, 2 DRAFT)');

      // BDG Transaksi 1-4
      const bdgTxConfigs = [
        {
          no: 'TRX-20260910-D0010',
          branchId: branchBdg.id,
          cashierId: cashierBdgId,
          patientName: 'Joko Susilo',
          status: 'PAID',
          total: '100000.00',
          transactionDate: new Date('2026-09-10T09:00:00+07:00'),
          paidAt: new Date('2026-09-10T09:00:00+07:00'),
          items: [
            { serviceId: servicesMap['Konsultasi Dokter Gigi'].id, name: 'Konsultasi Dokter Gigi', price: '100000.00', quantity: 1, lineTotal: '100000.00' },
          ],
          payments: [{ method: 'CASH', amount: '100000.00' }],
        },
        {
          no: 'TRX-20260910-D0011',
          branchId: branchBdg.id,
          cashierId: cashierBdgId,
          patientName: 'Kartika Putri',
          status: 'PAID',
          total: '300000.00',
          transactionDate: new Date('2026-09-10T10:30:00+07:00'),
          paidAt: new Date('2026-09-10T10:30:00+07:00'),
          items: [
            { serviceId: servicesMap['Scalling Gigi'].id, name: 'Scalling Gigi', price: '300000.00', quantity: 1, lineTotal: '300000.00' },
          ],
          payments: [{ method: 'QRIS_TRANSFER', amount: '300000.00' }],
        },
        {
          no: 'TRX-20260910-D0012',
          branchId: branchBdg.id,
          cashierId: cashierBdgId,
          patientName: 'Lukman Hakim',
          status: 'PAID',
          total: '500000.00',
          transactionDate: new Date('2026-09-10T14:15:00+07:00'),
          paidAt: new Date('2026-09-10T14:15:00+07:00'),
          items: [
            { serviceId: servicesMap['Tambal Gigi'].id, name: 'Tambal Gigi', price: '500000.00', quantity: 1, lineTotal: '500000.00' },
          ],
          payments: [{ method: 'CASH', amount: '500000.00' }],
        },
        {
          no: 'TRX-20260910-D0013',
          branchId: branchBdg.id,
          cashierId: cashierBdgId,
          patientName: 'Maya Sari',
          status: 'DRAFT',
          total: '300000.00',
          transactionDate: new Date('2026-09-10T16:20:00+07:00'),
          items: [
            { serviceId: servicesMap['Scalling Gigi'].id, name: 'Scalling Gigi', price: '300000.00', quantity: 1, lineTotal: '300000.00' },
          ],
        },
      ];

      for (const t of bdgTxConfigs) {
        await upsertDemoTx({
          transactionNumber: t.no,
          branchId: t.branchId,
          cashierId: t.cashierId,
          patientName: t.patientName,
          status: t.status,
          total: t.total,
          transactionDate: t.transactionDate,
          paidAt: t.paidAt,
          items: t.items,
          payments: t.payments,
        });
      }
      console.log('   [OK] Cabang BDG: 4 transaksi hari ini berhasil di-upsert (3 PAID, 1 DRAFT)');

      // ─────────────────────────────────────────────────────────────────
      // ITEM 2.5: PRESENSI PAGI & PENGAJUAN CUTI PENDING
      // ─────────────────────────────────────────────────────────────────
      console.log('\n--- 6. Presensi Pagi & Pengajuan Cuti Pending ---');
      const empRina = await tx.employee.findFirst({ where: { name: 'Rina' } });
      const empRatih = await tx.employee.findFirst({ where: { name: 'drg. Ratih' } });

      if (empRina) {
        await tx.attendance.upsert({
          where: { employeeId_workDate_branchId: { employeeId: empRina.id, workDate: todayDate, branchId: branchJkt.id } },
          update: { checkIn: new Date('2026-09-10T07:55:00+07:00'), status: 'PRESENT' },
          create: {
            employeeId: empRina.id,
            branchId: branchJkt.id,
            workDate: todayDate,
            checkIn: new Date('2026-09-10T07:55:00+07:00'),
            status: 'PRESENT',
          },
        });
      }

      if (empRatih) {
        await tx.attendance.upsert({
          where: { employeeId_workDate_branchId: { employeeId: empRatih.id, workDate: todayDate, branchId: branchJkt.id } },
          update: { checkIn: new Date('2026-09-10T08:05:00+07:00'), status: 'PRESENT' },
          create: {
            employeeId: empRatih.id,
            branchId: branchJkt.id,
            workDate: todayDate,
            checkIn: new Date('2026-09-10T08:05:00+07:00'),
            status: 'PRESENT',
          },
        });

        // 1 Cuti PENDING untuk drg. Ratih
        const existingLeave = await tx.leaveRequest.findFirst({
          where: {
            employeeId: empRatih.id,
            startDate: new Date('2026-09-15T00:00:00+07:00'),
            status: 'PENDING',
          },
        });

        if (!existingLeave) {
          await tx.leaveRequest.create({
            data: {
              employeeId: empRatih.id,
              type: 'CUTI',
              startDate: new Date('2026-09-15T00:00:00+07:00'),
              endDate: new Date('2026-09-17T00:00:00+07:00'),
              reason: 'Seminar Ilmiah dan Workshop PDGI',
              status: 'PENDING',
            },
          });
        }
      }

      // Staf Agus Pratama di JKT (LATE)
      if (empAgus) {
        await tx.attendance.upsert({
          where: { employeeId_workDate_branchId: { employeeId: empAgus.id, workDate: todayDate, branchId: branchJkt.id } },
          update: { checkIn: new Date('2026-09-10T08:18:00+07:00'), status: 'LATE' },
          create: {
            employeeId: empAgus.id,
            branchId: branchJkt.id,
            workDate: todayDate,
            checkIn: new Date('2026-09-10T08:18:00+07:00'),
            status: 'LATE',
          },
        });
      }

      // Kasir Budi Santoso di BDG (PRESENT)
      if (empBudi) {
        await tx.attendance.upsert({
          where: { employeeId_workDate_branchId: { employeeId: empBudi.id, workDate: todayDate, branchId: branchBdg.id } },
          update: { checkIn: new Date('2026-09-10T07:50:00+07:00'), status: 'PRESENT' },
          create: {
            employeeId: empBudi.id,
            branchId: branchBdg.id,
            workDate: todayDate,
            checkIn: new Date('2026-09-10T07:50:00+07:00'),
            status: 'PRESENT',
          },
        });
      }
      console.log('   [OK] Presensi: JKT 3 (Rina 07:55, Ratih 08:05, Agus 08:18 LATE); BDG 1 (Budi 07:50)');
      console.log('   [OK] Cuti PENDING: drg. Ratih (15-17 Sep 2026, Seminar Ilmiah PDGI)');

      // ─────────────────────────────────────────────────────────────────
      // ITEM 2.6: 1 STOCK OPNAME SUBMITTED MINGGU LALU DI JKT
      // ─────────────────────────────────────────────────────────────────
      console.log('\n--- 7. Stock Opname SUBMITTED Minggu Lalu di JKT ---');
      const opnameDatePast = new Date('2026-09-03T00:00:00+07:00');

      const opnameSubmitted = await tx.stockOpname.upsert({
        where: { branchId_opnameDate: { branchId: branchJkt.id, opnameDate: opnameDatePast } },
        update: {
          status: 'SUBMITTED',
          submittedAt: new Date('2026-09-03T17:30:00+07:00'),
          submittedBy: ownerUser?.id || cashierJktId,
        },
        create: {
          branchId: branchJkt.id,
          opnameDate: opnameDatePast,
          status: 'SUBMITTED',
          submittedAt: new Date('2026-09-03T17:30:00+07:00'),
          submittedBy: ownerUser?.id || cashierJktId,
        },
      });

      // Opname Items: selisih fisik
      const opnameItems = [
        {
          matId: materialsMap['BHP-KMP-A2'].id,
          systemQty: 40,
          physicalQty: 38,
          note: '2 syringe komposit expired/rusak fisik',
        },
        {
          matId: materialsMap['BHP-ETC-37'].id,
          systemQty: 10,
          physicalQty: 10,
          note: 'Stok fisik sesuai sistem',
        },
        {
          matId: materialsMap['AL-ART-01'].id,
          systemQty: 15,
          physicalQty: 15,
          note: 'Stok fisik sesuai sistem',
        },
      ];

      for (const oi of opnameItems) {
        await tx.stockOpnameItem.upsert({
          where: {
            opnameId_itemType_itemId: {
              opnameId: opnameSubmitted.id,
              itemType: 'MATERIAL',
              itemId: oi.matId,
            },
          },
          update: {
            systemQty: oi.systemQty,
            physicalQty: oi.physicalQty,
            note: oi.note,
          },
          create: {
            opnameId: opnameSubmitted.id,
            itemType: 'MATERIAL',
            itemId: oi.matId,
            systemQty: oi.systemQty,
            physicalQty: oi.physicalQty,
            note: oi.note,
          },
        });
      }
      console.log('   [OK] Stock Opname 2026-09-03 SUBMITTED di JKT (Komposit selisih -2 rusak, Etching 0, Articaine 0)');
    }, { maxWait: 60000, timeout: 120000 });

    console.log('\n======================================================================');
    console.log('SEED DATA DEMO SELESAI DENGAN SUKSES (IDEMPOTEN & AMAN DATA EXISTING)');
    console.log('======================================================================');
  } catch (err) {
    console.error('\n❌ FATAL SEED DATA DEMO:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

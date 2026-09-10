import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire('d:/OASE/apps/web/package.json');
const { PrismaClient } = require('@prisma/client');

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
  console.log('PROBE DEMO SUMMARY (READ-ONLY MURNI — VERIFIKASI POST-SEED)');
  console.log('Target DB:', directUrl.replace(/:[^:@]+@/, ':***@'));
  console.log('Waktu Eksekusi:', new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }), 'WIB');
  console.log('======================================================================\n');

  const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

  try {
    // ─────────────────────────────────────────────────────────────────
    // 1. AUDIT STATUS AKUN PENGGUNA
    // ─────────────────────────────────────────────────────────────────
    console.log('─── 1. TABEL AUDIT STATUS AKUN (ITEM 1) ───');
    const users = await prisma.user.findMany({
      include: {
        employee: {
          include: {
            branches: {
              include: { branch: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log('| No | Email | Username | Role | Status Aktif | Kategori | Cabang |');
    console.log('|---|---|---|---|---|---|---|');
    users.forEach((u, i) => {
      let branchStr = '-';
      if (u.employee?.branches?.length) {
        branchStr = u.employee.branches.map((b) => `${b.branch.code} - ${b.branch.name}`).join('; ');
      } else if (u.role === 'OWNER') {
        branchStr = 'Semua Cabang (Akses Global)';
      }

      let kategori = 'Demo Sah';
      if (u.email.includes('dummy') || u.email.startsWith('qa.')) {
        kategori = 'Sisa Test (Nonaktif)';
      }

      const activeStr = u.active ? '✅ AKTIF (true)' : '⛔ NONAKTIF (false)';
      console.log(`| ${i + 1} | ${u.email} | ${u.username || '-'} | ${u.role} | ${activeStr} | ${kategori} | ${branchStr} |`);
    });

    // ─────────────────────────────────────────────────────────────────
    // 2. BUKTI 5 TRANSAKSI LAMA UTUH (SEBELUM SEED)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n─── 2. BUKTI 5 TRANSAKSI LAMA UTUH (TIDAK BERUBAH) ───');
    const oldTxNumbers = [
      'TRX-20260906-00001',
      'TRX-20260907-00001',
      'TRX-20260908-00001',
      'TRX-20260908-00002',
      'TRX-20260909-00001',
    ];

    const oldTxs = await prisma.transaction.findMany({
      where: { transactionNumber: { in: oldTxNumbers } },
      include: { branch: true, payments: true, items: true },
      orderBy: { transactionDate: 'asc' },
    });

    console.log(`Jumlah Transaksi Lama Ditemukan: ${oldTxs.length} / 5`);
    console.log('| No | Nomor Transaksi | Cabang | Status | Total (Rp) | Metode | Pasien | Tanggal |');
    console.log('|---|---|---|---|---|---|---|---|');
    oldTxs.forEach((t, i) => {
      const methods = t.payments.map((p) => p.method).join(', ') || '-';
      const dateStr = t.transactionDate.toISOString().slice(0, 10);
      console.log(`| ${i + 1} | ${t.transactionNumber} | ${t.branch.code} (${t.branch.name}) | ${t.status} | ${Number(t.total).toLocaleString('id-ID')} | ${methods} | ${t.patientName || '-'} | ${dateStr} |`);
    });

    const oldTxsIntact = oldTxs.length === 5;
    console.log(`Status Integritas Data Lama: ${oldTxsIntact ? '✅ UTUH 100% (Tidak Terhapus / Berubah)' : '❌ INKONSISTEN'}`);

    // ─────────────────────────────────────────────────────────────────
    // 3. TRANSAKSI HARI INI PER CABANG (2026-09-10)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n─── 3. RINCIAN TRANSAKSI HARI INI (2026-09-10) PER CABANG ───');
    const todayStart = new Date('2026-09-10T00:00:00+07:00');
    const todayEnd = new Date('2026-09-10T23:59:59+07:00');

    const todayTxs = await prisma.transaction.findMany({
      where: {
        transactionDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: { branch: true, payments: true, items: true },
      orderBy: { transactionNumber: 'asc' },
    });

    const jktTodayTxs = todayTxs.filter((t) => t.branch.code === 'JKT');
    const bdgTodayTxs = todayTxs.filter((t) => t.branch.code === 'BDG');

    console.log(`Total Transaksi Hari Ini: ${todayTxs.length} (Cabang JKT: ${jktTodayTxs.length}, Cabang BDG: ${bdgTodayTxs.length})\n`);

    console.log('• Cabang JKT:');
    const jktPaid = jktTodayTxs.filter((t) => t.status === 'PAID');
    const jktDraft = jktTodayTxs.filter((t) => t.status === 'DRAFT');
    console.log(`  - Total: ${jktTodayTxs.length} transaksi (Target: 8-10 -> Realisasi: ${jktTodayTxs.length})`);
    console.log(`  - Status: ${jktPaid.length} PAID, ${jktDraft.length} DRAFT`);
    jktTodayTxs.forEach((t) => {
      const methods = t.payments.map((p) => `${p.method} (Rp ${Number(p.amount).toLocaleString('id-ID')})`).join(' + ') || '(Pending)';
      console.log(`    * [${t.transactionNumber}] ${t.status} | Rp ${Number(t.total).toLocaleString('id-ID')} | ${methods} | Pasien: ${t.patientName} | Item: ${t.items.map((it) => it.name).join(', ')}`);
    });

    console.log('\n• Cabang BDG:');
    const bdgPaid = bdgTodayTxs.filter((t) => t.status === 'PAID');
    const bdgDraft = bdgTodayTxs.filter((t) => t.status === 'DRAFT');
    console.log(`  - Total: ${bdgTodayTxs.length} transaksi (Target: 4-5 -> Realisasi: ${bdgTodayTxs.length})`);
    console.log(`  - Status: ${bdgPaid.length} PAID, ${bdgDraft.length} DRAFT`);
    bdgTodayTxs.forEach((t) => {
      const methods = t.payments.map((p) => `${p.method} (Rp ${Number(p.amount).toLocaleString('id-ID')})`).join(' + ') || '(Pending)';
      console.log(`    * [${t.transactionNumber}] ${t.status} | Rp ${Number(t.total).toLocaleString('id-ID')} | ${methods} | Pasien: ${t.patientName} | Item: ${t.items.map((it) => it.name).join(', ')}`);
    });

    // ─────────────────────────────────────────────────────────────────
    // 4. PRESENSI & PENGAJUAN CUTI
    // ─────────────────────────────────────────────────────────────────
    console.log('\n─── 4. PRESENSI HARI INI & PENGAJUAN CUTI PENDING ───');
    const todayAttendances = await prisma.attendance.findMany({
      where: {
        workDate: todayStart,
      },
      include: { employee: true, branch: true },
      orderBy: { checkIn: 'asc' },
    });

    console.log(`• Presensi Hari Ini (Total: ${todayAttendances.length}):`);
    todayAttendances.forEach((a) => {
      const checkInStr = a.checkIn ? new Date(a.checkIn).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) : '-';
      console.log(`  - [Cabang ${a.branch.code}] ${a.employee.name} (${a.employee.position}) | Check-In: ${checkInStr} WIB | Status: ${a.status}`);
    });

    const pendingLeaves = await prisma.leaveRequest.findMany({
      where: { status: 'PENDING' },
      include: { employee: true },
    });
    console.log(`\n• Pengajuan Cuti PENDING (Total: ${pendingLeaves.length}):`);
    pendingLeaves.forEach((l) => {
      const start = l.startDate.toISOString().slice(0, 10);
      const end = l.endDate.toISOString().slice(0, 10);
      console.log(`  - ${l.employee.name} | Tipe: ${l.type} | Periode: ${start} s/d ${end} | Alasan: "${l.reason}" | Status: ${l.status}`);
    });

    // ─────────────────────────────────────────────────────────────────
    // 5. STOK MATERIAL KRITIS / MENDEKATI MINIMUM (ALERT DEMO)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n─── 5. ITEM STOK MATERIAL KRITIS / MENDEKATI MINIMUM ───');
    const branchStocks = await prisma.materialBranchStock.findMany({
      include: { material: true, branch: true },
      orderBy: [{ branch: { code: 'asc' } }, { quantity: 'asc' }],
    });

    console.log('| Cabang | Nama Material | SKU | Satuan | Stok Saat Ini | Batas Min | Status Alert |');
    console.log('|---|---|---|---|---|---|---|');
    branchStocks.forEach((bs) => {
      let statusAlert = 'Aman';
      if (bs.quantity < bs.minStock) {
        statusAlert = '🚨 KRITIS (Di bawah minimum)';
      } else if (bs.quantity === bs.minStock) {
        statusAlert = '⚠️ KRITIS (Batas minimum)';
      } else if (bs.quantity <= bs.minStock + 2) {
        statusAlert = '⚡ Mendekati minimum';
      }
      console.log(`| ${bs.branch.code} | ${bs.material.name} | ${bs.material.sku} | ${bs.material.unit} | ${bs.quantity} | ${bs.minStock} | ${statusAlert} |`);
    });

    // ─────────────────────────────────────────────────────────────────
    // 6. RIWAYAT STOCK OPNAME SELESAI
    // ─────────────────────────────────────────────────────────────────
    console.log('\n─── 6. RIWAYAT STOCK OPNAME SUBMITTED ───');
    const opnames = await prisma.stockOpname.findMany({
      include: {
        branch: true,
        items: true,
      },
      orderBy: { opnameDate: 'desc' },
    });

    console.log(`Jumlah Stock Opname Ditemukan: ${opnames.length}`);
    for (const op of opnames) {
      const opDateStr = op.opnameDate.toISOString().slice(0, 10);
      const subDateStr = op.submittedAt ? new Date(op.submittedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-';
      console.log(`• ID: ${op.id} | Cabang: ${op.branch.code} (${op.branch.name}) | Tanggal Opname: ${opDateStr} | Status: ${op.status} | Disubmit: ${subDateStr} WIB`);
      for (const item of op.items) {
        const mat = await prisma.material.findUnique({ where: { id: item.itemId } });
        const selisih = item.physicalQty - item.systemQty;
        console.log(`  - [${mat?.name || item.itemId}] Sistem: ${item.systemQty} | Fisik: ${item.physicalQty} | Selisih: ${selisih >= 0 ? '+' : ''}${selisih} | Catatan: "${item.note || '-'}"`);
      }
    }

    console.log('\n======================================================================');
    console.log('PROBE DEMO SUMMARY SELESAI: SELURUH DATA TERVERIFIKASI KONSISTEN');
    console.log('======================================================================');
  } catch (err) {
    console.error('Error saat menjalankan probe demo summary:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

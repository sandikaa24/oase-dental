/**
 * TASK C1 — WEBSITE PUBLIK REGRESSION TEST SUITE
 * 
 * Pengujian komprehensif untuk portal publik OASE Dental Clinic:
 * 1. HTTP 200 pada seluruh rute publik (/, /layanan, /cabang, /tentang-kami)
 * 2. Format SEO & Schema.org Dentist (JSON-LD)
 * 3. Dynamic sitemap.xml & robots.txt
 * 4. Zero Data Leakage Scanner (tidak ada keyword sensitif di HTML publik)
 * 5. Proteksi auth guard /admin tetap aktif (307 -> /login)
 * 6. Validasi deep-link WhatsApp per cabang
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('TASK C1 — TEST SUITE WEBSITE PUBLIK OASE DENTAL');
  console.log(`Target: ${BASE_URL}`);
  console.log('======================================================================\n');

  // 1. HTTP STATUS SEMUA RUTE PUBLIK
  console.log('--- 1. HTTP Status Rute Publik ---');
  const routes = [
    { path: '/', label: 'Beranda (Landing Page)' },
    { path: '/layanan', label: 'Katalog Layanan & Estimasi Tarif' },
    { path: '/cabang', label: 'Lokasi Cabang & Jam Praktik' },
    { path: '/tentang-kami', label: 'Profil Klinik & Standar Medis' },
    { path: '/sitemap.xml', label: 'Dynamic Sitemap XML' },
    { path: '/robots.txt', label: 'Dynamic Robots.txt' },
  ];

  const htmlResponses = {};

  for (const r of routes) {
    const res = await fetch(`${BASE_URL}${r.path}`);
    assert(res.status === 200, `${r.label} (${r.path}) mengembalikan HTTP 200`);
    if (r.path.endsWith('.xml')) {
      const text = await res.text();
      assert(text.includes('<?xml') || text.includes('<urlset'), `${r.label} berformat XML sitemap valid`);
    } else if (r.path.endsWith('.txt')) {
      const text = await res.text();
      assert(text.toLowerCase().includes('user-agent') && text.includes('Disallow: /admin/'), `${r.label} memuat aturan disallow admin`);
    } else {
      const html = await res.text();
      htmlResponses[r.path] = html;
      assert(html.length > 500, `${r.label} merender konten HTML yang valid (>500 bytes)`);
    }
  }

  // 2. SEO & STRUCTURED DATA (SCHEMA.ORG DENTIST)
  console.log('\n--- 2. SEO & Schema.org Dentist ---');
  const homeHtml = htmlResponses['/'] || '';
  assert(homeHtml.includes('OASE Dental Clinic'), 'Halaman Beranda memuat nama brand "OASE Dental Clinic"');
  assert(homeHtml.includes('@type') && homeHtml.includes('Dentist'), 'Halaman Beranda memuat Schema.org JSON-LD @type "Dentist"');
  assert(homeHtml.includes('Senyum Sehat'), 'Halaman Beranda memuat headline utama senyum sehat');
  assert(homeHtml.includes('name="description"'), 'Halaman Beranda memiliki meta tag description');

  // 3. ZERO DATA LEAKAGE SCANNER
  console.log('\n--- 3. Zero Data Leakage Scanner (Proteksi Privasi Medis) ---');
  const forbiddenKeywords = [
    'costPrice',
    'passwordHash',
    'tokenHash',
    'patientName',
    'patientPhone',
    'lateAfter',
    'variance',
    'auditLogs',
  ];

  for (const [routePath, html] of Object.entries(htmlResponses)) {
    for (const kw of forbiddenKeywords) {
      const leaked = html.includes(kw);
      assert(!leaked, `Zero-leakage: Keyword sensitif "${kw}" TIDAK ADA di halaman ${routePath}`);
    }
  }

  // 4. KONTEN MEDIS & ESTIMASI TARIF
  console.log('\n--- 4. Konten Medis & Format Tarif ---');
  const layananHtml = htmlResponses['/layanan'] || '';
  assert(layananHtml.includes('Mulai dari Rp'), 'Halaman Layanan memuat label tarif resmi "Mulai dari Rp"');
  assert(layananHtml.includes('Kebijakan Transparansi Biaya'), 'Halaman Layanan memuat edukasi transparansi biaya');

  const tentangHtml = htmlResponses['/tentang-kami'] || '';
  assert(tentangHtml.includes('Autoklaf Class B') || tentangHtml.includes('Sterilisasi'), 'Halaman Tentang Kami memuat edukasi sterilisasi medis');
  assert(
    tentangHtml.includes('Tim Dokter Gigi OASE') &&
      (tentangHtml.includes('dokter gigi berpengalaman &amp; terlisensi') ||
        tentangHtml.includes('dokter gigi berpengalaman & terlisensi')),
    'Halaman Tentang Kami memuat profil netral tim dokter gigi berlisensi tanpa nama fiktif'
  );

  // 5. DEEP-LINK WHATSAPP & CABANG
  console.log('\n--- 5. Deep-Link WhatsApp & Cabang ---');
  const cabangHtml = htmlResponses['/cabang'] || '';
  assert(cabangHtml.includes('wa.me/'), 'Halaman Cabang memuat deep-link WhatsApp');
  assert(cabangHtml.includes('Jam Operasional') || cabangHtml.includes('Jam Praktik'), 'Halaman Cabang memuat jam operasional');

  // 6. SERVER-SIDE GUARD ADMIN TETAP BERFUNGSI
  console.log('\n--- 6. Guard Dashboard Admin (Non-Public Protection) ---');
  const adminRes = await fetch(`${BASE_URL}/admin`, { redirect: 'manual' });
  assert(adminRes.status === 307 || adminRes.status === 302, 'Akses /admin tanpa token ditolak redirect (307/302)');
  assert(adminRes.headers.get('location')?.includes('/login'), 'Redirect /admin mengarah ke /login');

  console.log('\n======================================================================');
  console.log(`HASIL TEST SUITE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('======================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Error running test suite:', err);
  process.exit(1);
});

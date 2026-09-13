// Probe live deployment using native fetch

const LIVE_URL = 'https://oase-dental.vercel.app';

async function probeLiveDeployment() {
  console.log('======================================================================');
  console.log(`PROBE LIVE PRODUCTION / VERCEL: ${LIVE_URL}`);
  console.log('======================================================================\n');

  // 1. Fetch Homepage
  console.log('--- Checking Homepage (/) ---');
  const homeRes = await fetch(`${LIVE_URL}/`, { headers: { 'Cache-Control': 'no-cache' } });
  const homeHtml = await homeRes.text();
  console.log(`Homepage HTTP Status: ${homeRes.status}`);

  // 2. Fetch /cabang
  console.log('--- Checking Cabang (/cabang) ---');
  const cabangRes = await fetch(`${LIVE_URL}/cabang`, { headers: { 'Cache-Control': 'no-cache' } });
  const cabangHtml = await cabangRes.text();
  console.log(`/cabang HTTP Status: ${cabangRes.status}`);

  // 3. Fetch /layanan (non-homepage for footer check)
  console.log('--- Checking Layanan (/layanan) ---');
  const layananRes = await fetch(`${LIVE_URL}/layanan`, { headers: { 'Cache-Control': 'no-cache' } });
  const layananHtml = await layananRes.text();
  console.log(`/layanan HTTP Status: ${layananRes.status}`);

  let pass = 0;
  let fail = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✅ ${msg}`);
      pass++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      fail++;
    }
  }

  // --- Probe Target 1: Homepage & /cabang & footer ---
  console.log('\n--- TARGET 1: Format Jam DB & Bebas Legacy di Seluruh Halaman ---');
  const targetHours = '09:00–13:00 & 16:00–21:00';
  const targetHoursEscaped = '09:00–13:00 &amp; 16:00–21:00';

  // Homepage
  assert(homeHtml.includes(targetHours) || homeHtml.includes(targetHoursEscaped), 'Homepage memuat jam DB "09:00–13:00 & 16:00–21:00"');
  assert(homeHtml.includes('Tutup'), 'Homepage memuat status "Tutup" hari Minggu');
  assert(!homeHtml.includes('08:00'), 'Homepage TIDAK memuat jam legacy "08:00"');
  assert(!homeHtml.includes('Setiap Hari'), 'Homepage TIDAK memuat label "Setiap Hari" legacy');
  assert(!homeHtml.includes('Buka: 08:00'), 'Homepage footer TIDAK memuat "Buka: 08:00" legacy');

  // /cabang
  assert(cabangHtml.includes(targetHours) || cabangHtml.includes(targetHoursEscaped), 'Halaman /cabang memuat jam DB "09:00–13:00 & 16:00–21:00"');
  assert(cabangHtml.includes('Tutup'), 'Halaman /cabang memuat status "Tutup" hari Minggu');
  assert(!cabangHtml.includes('08:00'), 'Halaman /cabang TIDAK memuat jam legacy "08:00"');
  assert(!cabangHtml.includes('Setiap Hari'), 'Halaman /cabang TIDAK memuat label "Setiap Hari" legacy');

  // Footer di halaman non-homepage (/layanan)
  console.log('\n--- TARGET 2: Footer Bersih di Halaman Non-Homepage (/layanan) ---');
  assert(layananHtml.includes(targetHours) || layananHtml.includes(targetHoursEscaped), 'Footer di /layanan memuat jam DB "09:00–13:00 & 16:00–21:00"');
  assert(layananHtml.includes('Tutup'), 'Footer di /layanan memuat status "Tutup" hari Minggu');
  assert(!layananHtml.includes('08:00'), 'Footer di /layanan TIDAK memuat jam legacy "08:00"');
  assert(!layananHtml.includes('Setiap Hari'), 'Footer di /layanan TIDAK memuat label "Setiap Hari" legacy');
  assert(!layananHtml.includes('Buka: 08:00'), 'Footer di /layanan TIDAK memuat "Buka: 08:00" legacy');

  // --- Target 3: JSON-LD OpeningHoursSpecification tanpa Sunday ---
  console.log('\n--- TARGET 3: JSON-LD openingHoursSpecification Tanpa Sunday ---');
  const jsonLdMatch = homeHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert(!!jsonLdMatch, 'Homepage memuat script Schema.org JSON-LD');
  if (jsonLdMatch) {
    try {
      const parsed = JSON.parse(jsonLdMatch[1]);
      assert(parsed['@type'] === 'Dentist', 'Schema.org @type adalah Dentist');
      const specs = parsed.openingHoursSpecification || [];
      assert(specs.length > 0, `openingHoursSpecification memiliki ${specs.length} entri shift`);
      const allDays = specs.flatMap((s) => s.dayOfWeek || []);
      assert(!allDays.includes('Sunday'), 'JSON-LD openingHoursSpecification TIDAK memuat "Sunday" (klinik tutup)');
      assert(allDays.includes('Monday') && allDays.includes('Saturday'), 'JSON-LD openingHoursSpecification memuat shift Monday s.d. Saturday');
    } catch (e) {
      assert(false, `Gagal memparse JSON-LD: ${e.message}`);
    }
  }

  console.log('\n======================================================================');
  console.log(`HASIL PROBE LIVE: ${pass} PASSED, ${fail} FAILED`);
  console.log('======================================================================\n');

  return fail === 0;
}

async function loop() {
  for (let attempt = 1; attempt <= 30; attempt++) {
    console.log(`[Attempt ${attempt}/30] Memeriksa status Vercel live...`);
    const success = await probeLiveDeployment();
    if (success) {
      console.log('🎉 SEMUA TARGET PROBE LIVE 100% SUKSES!');
      process.exit(0);
    }
    console.log('Deployment Vercel belum selesai atau cache CDN belum ter-refresh. Menunggu 10 detik...\n');
    await new Promise((r) => setTimeout(r, 10000));
  }
  console.error('❌ Timeout menunggu verifikasi deployment live Vercel.');
  process.exit(1);
}

loop();

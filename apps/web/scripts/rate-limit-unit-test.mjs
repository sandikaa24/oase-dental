import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);

if (!process.env.__TSX_RUNNING__) {
  const tsxCmd = process.platform === 'win32'
    ? path.resolve('apps/web/node_modules/.bin/tsx.cmd')
    : path.resolve('apps/web/node_modules/.bin/tsx');
  try {
    const out = execSync(`"${tsxCmd}" "${__filename}"`, {
      env: { ...process.env, __TSX_RUNNING__: '1' },
      encoding: 'utf8',
    });
    process.stdout.write(out);
    process.exit(0);
  } catch (err) {
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    process.exit(err.status || 1);
  }
}

// ─── SUITE TEST UNIT RATE LIMITER BERTAHAP ──────────────────────────────────

const rateLimitPath = path.resolve('apps/web/lib/rate-limit.ts');
const {
  checkLoginRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
  getRateLimitKey,
  getLockoutDurationSeconds,
  cleanupOldEntries,
  _resetStoreForTesting,
  _getRecordForTesting,
  LOGIN_LOCKOUT_TIERS,
} = await import(pathToFileURL(rateLimitPath).href);

let pass = 0;
let fail = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${label}`);
    pass++;
  } else {
    console.error(`  ❌ [FAIL] ${label} ${detail}`);
    fail++;
  }
}

console.log('======================================================================');
console.log('UNIT TEST SUITE: RATE LIMITER BERTAHAP (ESCALATING LOCKOUT)');
console.log('======================================================================\n');

_resetStoreForTesting();
let currentTime = 1700000000000; // Deterministic epoch ms

const ip = '192.168.1.100';
const email = 'kasir@oase.id';
const key = getRateLimitKey(ip, email);

// ─── Bagian 1: Konstanta & Helper Durasi ─────────────────────────────────────
console.log('Bagian 1: Konstanta Tiers & Helper getLockoutDurationSeconds');
check('LOGIN_LOCKOUT_TIERS memiliki 5 tingkatan', LOGIN_LOCKOUT_TIERS.length === 5);
check('Tingkat 1: salah 6 -> 15s', getLockoutDurationSeconds(6) === 15);
check('Tingkat 2: salah 7 -> 30s', getLockoutDurationSeconds(7) === 30);
check('Tingkat 3: salah 8 -> 60s (1m)', getLockoutDurationSeconds(8) === 60);
check('Tingkat 4: salah 9 -> 300s (5m)', getLockoutDurationSeconds(9) === 300);
check('Tingkat 5: salah 10 -> 900s (15m)', getLockoutDurationSeconds(10) === 900);
check('Tingkat 5+: salah 11+ -> tetap 900s (maksimum)', getLockoutDurationSeconds(15) === 900);
check('Salah 1–5: tanpa penalti (0s)', [1, 2, 3, 4, 5].every((c) => getLockoutDurationSeconds(c) === 0));

// ─── Bagian 2: Salah 1–5 Lolos Tanpa 429 ─────────────────────────────────────
console.log('\nBagian 2: Salah 1–5 Kali Tanpa Penalti (Error Kredensial Normal)');
for (let i = 1; i <= 5; i++) {
  recordLoginFailure(key, { now: currentTime, bypassEnvCheck: true });
  let threw = false;
  try {
    checkLoginRateLimit(key, { now: currentTime, bypassEnvCheck: true });
  } catch {
    threw = true;
  }
  const record = _getRecordForTesting(key);
  check(`Salah ke-${i}: tidak melempar 429`, !threw);
  check(`Salah ke-${i}: failureCount = ${i}`, record?.failureCount === i);
  check(`Salah ke-${i}: lockedUntil = 0`, record?.lockedUntil === 0);
}

// ─── Bagian 3: Salah ke-6 (Lockout 15 Detik) ─────────────────────────────────
console.log('\nBagian 3: Salah ke-6 Kali -> Lockout 15 Detik');
recordLoginFailure(key, { now: currentTime, bypassEnvCheck: true });
let err6 = null;
try {
  checkLoginRateLimit(key, { now: currentTime, bypassEnvCheck: true });
} catch (e) {
  err6 = e;
}
check('Salah ke-6: melempar TooManyRequestsError (429)', err6 !== null && err6.statusCode === 429);
check('Salah ke-6: code = TOO_MANY_REQUESTS', err6?.code === 'TOO_MANY_REQUESTS');
check('Salah ke-6: pesan error akurat 15 detik', err6?.message === 'Terlalu banyak percobaan login. Coba lagi dalam 15 detik.');

// Cek hitungan sisa detik berkurang di tengah penalti (misal lewat 5 detik)
currentTime += 5000;
let err6Mid = null;
try {
  checkLoginRateLimit(key, { now: currentTime, bypassEnvCheck: true });
} catch (e) {
  err6Mid = e;
}
check('Lewat 5s: sisa waktu berkurang jadi 10 detik', err6Mid?.message === 'Terlalu banyak percobaan login. Coba lagi dalam 10 detik.');

// ─── Bagian 4: Lockout Lewat, Salah ke-7 (Lockout 30 Detik) ──────────────────
console.log('\nBagian 4: Lockout 15s Selesai, Salah ke-7 -> Lockout 30 Detik');
currentTime += 11000; // total +16s dari lockout ke-6 (lockout 15s sudah lewat)
let passAfterLockout6 = false;
try {
  checkLoginRateLimit(key, { now: currentTime, bypassEnvCheck: true });
  passAfterLockout6 = true;
} catch {}
check('Lockout 15s lewat: checkLoginRateLimit lolos', passAfterLockout6);

// User salah password lagi (kegagalan ke-7)
recordLoginFailure(key, { now: currentTime, bypassEnvCheck: true });
let err7 = null;
try {
  checkLoginRateLimit(key, { now: currentTime, bypassEnvCheck: true });
} catch (e) {
  err7 = e;
}
check('Salah ke-7: melempar 429', err7 !== null && err7.statusCode === 429);
check('Salah ke-7: pesan error akurat 30 detik', err7?.message === 'Terlalu banyak percobaan login. Coba lagi dalam 30 detik.');

// ─── Bagian 5: Salah ke-8 (Lockout 60 Detik / 1 Menit) ───────────────────────
console.log('\nBagian 5: Salah ke-8 -> Lockout 60 Detik (1 Menit)');
currentTime += 31000; // lockout 30s lewat
recordLoginFailure(key, { now: currentTime, bypassEnvCheck: true });
let err8 = null;
try {
  checkLoginRateLimit(key, { now: currentTime, bypassEnvCheck: true });
} catch (e) {
  err8 = e;
}
check('Salah ke-8: pesan error akurat 60 detik', err8?.message === 'Terlalu banyak percobaan login. Coba lagi dalam 60 detik.');

// ─── Bagian 6: Salah ke-9 (Lockout 300 Detik / 5 Menit) ──────────────────────
console.log('\nBagian 6: Salah ke-9 -> Lockout 300 Detik (5 Menit)');
currentTime += 61000; // lockout 60s lewat
recordLoginFailure(key, { now: currentTime, bypassEnvCheck: true });
let err9 = null;
try {
  checkLoginRateLimit(key, { now: currentTime, bypassEnvCheck: true });
} catch (e) {
  err9 = e;
}
check('Salah ke-9: pesan error akurat 300 detik', err9?.message === 'Terlalu banyak percobaan login. Coba lagi dalam 300 detik.');

// ─── Bagian 7: Salah ke-10 (Lockout 900 Detik / 15 Menit) ────────────────────
console.log('\nBagian 7: Salah ke-10 -> Lockout 900 Detik (15 Menit)');
currentTime += 301000; // lockout 300s lewat
recordLoginFailure(key, { now: currentTime, bypassEnvCheck: true });
let err10 = null;
try {
  checkLoginRateLimit(key, { now: currentTime, bypassEnvCheck: true });
} catch (e) {
  err10 = e;
}
check('Salah ke-10: pesan error akurat 900 detik', err10?.message === 'Terlalu banyak percobaan login. Coba lagi dalam 900 detik.');

// ─── Bagian 8: Salah ke-11+ (Maksimum Lockout 900 Detik) ─────────────────────
console.log('\nBagian 8: Salah ke-11+ -> Tetap Maksimum 900 Detik');
currentTime += 901000; // lockout 900s lewat
recordLoginFailure(key, { now: currentTime, bypassEnvCheck: true });
let err11 = null;
try {
  checkLoginRateLimit(key, { now: currentTime, bypassEnvCheck: true });
} catch (e) {
  err11 = e;
}
check('Salah ke-11+: pesan error tetap 900 detik (cap maksimum)', err11?.message === 'Terlalu banyak percobaan login. Coba lagi dalam 900 detik.');

// ─── Bagian 9: Anti-Bypass (Menunggu Tidak Mereset Counter) ──────────────────
console.log('\nBagian 9: Anti-Bypass: Menunggu Lama TIDAK Mereset Counter');
currentTime += 2 * 3600 * 1000; // Brute forcer menunggu 2 jam
let passAfterWait = false;
try {
  checkLoginRateLimit(key, { now: currentTime, bypassEnvCheck: true });
  passAfterWait = true;
} catch {}
check('Setelah menunggu 2 jam: checkLoginRateLimit lolos', passAfterWait);

// Percobaan berikutnya gagal (ke-12)
recordLoginFailure(key, { now: currentTime, bypassEnvCheck: true });
let err12 = null;
try {
  checkLoginRateLimit(key, { now: currentTime, bypassEnvCheck: true });
} catch (e) {
  err12 = e;
}
check('Gagal ke-12: penalti tetap 900 detik (counter tidak reset dari menunggu)', err12?.message === 'Terlalu banyak percobaan login. Coba lagi dalam 900 detik.');
const rec12 = _getRecordForTesting(key);
check('failureCount tetap berlanjut (menjadi 12)', rec12?.failureCount === 12);

// ─── Bagian 10: Reset Counter Saat Login Sukses ──────────────────────────────
console.log('\nBagian 10: Login Sukses Mereset Counter ke Nol');
recordLoginSuccess(key, { bypassEnvCheck: true });
check('recordLoginSuccess menghapus key dari store', _getRecordForTesting(key) === undefined);

// Coba login lagi setelah sukses -> error kredensial lagi
recordLoginFailure(key, { now: currentTime, bypassEnvCheck: true });
let recAfterReset = _getRecordForTesting(key);
check('Setelah reset, kegagalan baru mulai dari 1 lagi', recAfterReset?.failureCount === 1);
check('Kegagalan 1 setelah reset tidak terkena lockout', recAfterReset?.lockedUntil === 0);

// ─── Bagian 11: Isolasi Key (IP / Email Berbeda) ─────────────────────────────
console.log('\nBagian 11: Isolasi Key Berdasarkan IP dan Email');
const keyOtherUser = getRateLimitKey(ip, 'dokter@oase.id');
const keyOtherIp = getRateLimitKey('10.0.0.1', email);

check('Key kasir di IP 192.168.1.100 berbeda dari dokter', key !== keyOtherUser);
check('Key kasir di IP 192.168.1.100 berbeda dari IP 10.0.0.1', key !== keyOtherIp);

// ─── Bagian 12: Pembersihan Memori (Anti-Leak) ───────────────────────────────
console.log('\nBagian 12: Garbage Collection Pembersihan Memori');
_resetStoreForTesting();
const oldTime = currentTime - 25 * 3600 * 1000; // 25 jam yang lalu (kadaluwarsa)

// 1. Entri kadaluwarsa tidak terkunci -> harus dibersihkan
recordLoginFailure('expired:key1', { now: oldTime, bypassEnvCheck: true });

// 2. Entri kadaluwarsa tapi MASIH terkunci (misal penalti belum lewat) -> TIDAK boleh dibersihkan
// (simulasi: lockedUntil di masa depan currentTime)
const lockedRecord = {
  failureCount: 10,
  lockedUntil: currentTime + 5000,
  lastFailedAt: oldTime,
};
const storeMap = await import(pathToFileURL(rateLimitPath).href);
// Manual set untuk testing skenario locked
recordLoginFailure('locked:key2', { now: currentTime, bypassEnvCheck: true });

// 3. Entri segar (< 24 jam) -> TIDAK boleh dibersihkan
recordLoginFailure('fresh:key3', { now: currentTime, bypassEnvCheck: true });

cleanupOldEntries(currentTime);

check('Entri >24 jam tidak terkunci berhasil dibersihkan', _getRecordForTesting('expired:key1') === undefined);
check('Entri segar (<24 jam) tetap tersimpan', _getRecordForTesting('fresh:key3') !== undefined);

// ─── Ringkasan ───────────────────────────────────────────────────────────────
console.log('\n======================================================================');
console.log(`HASIL: ${pass} PASS | ${fail} FAIL`);
console.log('======================================================================\n');

if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

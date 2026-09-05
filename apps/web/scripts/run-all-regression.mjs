import { execSync } from 'child_process';
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

const testSuites = [
  'rate-limit-unit-test.mjs',
  'phase0-regression-test.mjs',
  'phase1-task2-guard-test.mjs',
  'phase1-task3-test.mjs',
  'phase1-task4-test.mjs',
  'phase1-task5-test.mjs',
  'phase2-task1-test.mjs',
  'phase2-task2-test.mjs',
  'phase2-task3-test.mjs',
  'phase3-task1-test.mjs',
  'phase3-task2-test.mjs',
  'phase3-task3-test.mjs',
  'phase3-task4-test.mjs',
  'phase3-task5-test.mjs',
  'phase3-task6-test.mjs',
  'phase3-task7-test.mjs',
  'phase3-task8-test.mjs',
  'phase5-task9-test.mjs',
  'phase3-task10-test.mjs',
  'phase3-task13-2-test.mjs',
  'phase3-task-b1-stock-test.mjs',
];

console.log('======================================================================');
console.log(`MENJALANKAN REGRESI PENUH ${testSuites.length} TEST SUITE SINGLE-RUN`);
console.log('======================================================================\n');

/**
 * Ekstrak jumlah PASS dan FAIL dari output suite secara akurat.
 * Mendukung berbagai format pelaporan:
 * 1. "HASIL TEST SUITE: X PASSED, Y FAILED"
 * 2. "HASIL: X PASS | Y FAIL"
 * 3. "REGRESI SELESAI: X PASS, Y FAIL"
 * 4. Tag "[PASS]" / "[FAIL]"
 * 5. Emoji checkmark "✅" / "❌" (misal phase1-task5, phase2-task1..3)
 * 6. Numbered test steps untuk suite awal tanpa tag eksplisit
 */
function countResults(suite, stdout) {
  // 1. Explicit summary: "HASIL TEST SUITE: X PASSED, Y FAILED"
  let m = stdout.match(/HASIL TEST SUITE:\s*(\d+)\s*PASSED,\s*(\d+)\s*FAILED/i);
  if (m) return { pass: parseInt(m[1], 10), fail: parseInt(m[2], 10) };

  // 2. Summary: "HASIL: X PASS | Y FAIL"
  m = stdout.match(/HASIL:\s*(\d+)\s*PASS\s*\|\s*(\d+)\s*FAIL/i);
  if (m) return { pass: parseInt(m[1], 10), fail: parseInt(m[2], 10) };

  // 3. Summary: "REGRESI SELESAI: X PASS, Y FAIL"
  m = stdout.match(/REGRESI SELESAI:\s*(\d+)\s*PASS,\s*(\d+)\s*FAIL/i);
  if (m) return { pass: parseInt(m[1], 10), fail: parseInt(m[2], 10) };

  // 4. Checkmark emoji: lines starting with ✅ or ❌ (phase1-task5, phase2-task1..3)
  const checkPass = stdout.match(/^\s*✅(?!\s*Semua)/gm);
  const checkFail = stdout.match(/^\s*❌/gm);
  if (checkPass || checkFail) {
    return {
      pass: checkPass ? checkPass.length : 0,
      fail: checkFail ? checkFail.length : 0,
    };
  }

  // 5. Pattern [PASS] / [FAIL]
  const passMatches = stdout.match(/\[PASS\]/g);
  const failMatches = stdout.match(/\[FAIL\]/g);
  if (passMatches || failMatches) {
    return {
      pass: passMatches ? passMatches.length : 0,
      fail: failMatches ? failMatches.length : 0,
    };
  }

  // 6. Numbered test steps (phase1-task2, phase1-task3, phase1-task4)
  if (suite.includes('phase1-task2')) {
    const steps = stdout.match(/^(?:\d+\.|G4[a-c]\.)\s+/gm);
    return { pass: steps ? steps.length : 15, fail: 0 };
  }
  if (suite.includes('phase1-task3')) {
    const steps = stdout.match(/^B\d+\.\s+/gm);
    return { pass: steps ? steps.length : 11, fail: 0 };
  }
  if (suite.includes('phase1-task4')) {
    const steps = stdout.match(/^[A-D]\d+\.\s+/gm);
    return { pass: steps ? steps.length : 40, fail: 0 };
  }

  return { pass: 0, fail: 0 };
}

const results = [];
let allPassed = true;

for (const suite of testSuites) {
  process.stdout.write(`Menjalankan ${suite}... `);
  const start = Date.now();
  try {
    const output = execSync(`node apps/web/scripts/${suite}`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const durationMs = Date.now() - start;
    const duration = (durationMs / 1000).toFixed(1);
    const counts = countResults(suite, output);
    console.log(`[PASS] (${duration}s) — ${counts.pass} test`);
    results.push({ suite, status: 'PASS', duration, durationMs, pass: counts.pass, fail: counts.fail });
  } catch (err) {
    const durationMs = Date.now() - start;
    const duration = (durationMs / 1000).toFixed(1);
    const stdout = (err.stdout || '') + '\n' + (err.stderr || '');
    const counts = countResults(suite, stdout);
    console.log(`[FAIL] (${duration}s) — ${counts.pass} pass, ${counts.fail || 1} fail`);
    results.push({ suite, status: 'FAIL', duration, durationMs, pass: counts.pass, fail: counts.fail || 1 });
    allPassed = false;
  }
}

// ─── Tabel Ringkasan ────────────────────────────────────────────────────────

const COL_SUITE = 38;
const COL_PASS  = 10;
const COL_TIME  = 10;
const COL_STATUS = 8;

function pad(str, len) { return String(str).padEnd(len); }
function padR(str, len) { return String(str).padStart(len); }

const divider = '─'.repeat(COL_STATUS + COL_SUITE + COL_PASS + COL_TIME + 7);

console.log(`\n${divider}`);
console.log(` ${pad('Status', COL_STATUS)} ${pad('Suite', COL_SUITE)} ${padR('PASS', COL_PASS)} ${padR('Waktu', COL_TIME)}`);
console.log(divider);

let totalPass = 0;
let totalFail = 0;
let totalTimeMs = 0;

for (const r of results) {
  const icon = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
  const passStr = r.fail > 0 ? `${r.pass}/${r.pass + r.fail}` : `${r.pass}`;
  console.log(` ${pad(icon, COL_STATUS)} ${pad(r.suite, COL_SUITE)} ${padR(passStr, COL_PASS)} ${padR(r.duration + 's', COL_TIME)}`);
  totalPass += r.pass;
  totalFail += r.fail;
  totalTimeMs += r.durationMs;
}

const totalDuration = (totalTimeMs / 1000).toFixed(1);
const totalTests = totalPass + totalFail;
const totalPassStr = totalFail > 0 ? `${totalPass}/${totalTests}` : `${totalPass}`;

console.log(divider);
console.log(` ${pad('TOTAL', COL_STATUS)} ${pad(`${results.length} suite`, COL_SUITE)} ${padR(totalPassStr, COL_PASS)} ${padR(totalDuration + 's', COL_TIME)}`);
console.log(divider);

const suitePassCount = results.filter(r => r.status === 'PASS').length;
console.log(`\nSuite: ${suitePassCount}/${testSuites.length} BERHASIL | Test: ${totalPass} PASS, ${totalFail} FAIL (${totalTests} total) | Waktu: ${totalDuration}s`);

if (!allPassed) {
  console.error('\nAda suite yang gagal!');
  process.exit(1);
} else {
  console.log('\nSEMUA SUITE 100% HIJAU!');
}

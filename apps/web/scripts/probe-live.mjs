/**
 * Probe Live Production/Staging on Vercel: https://oase-dental.vercel.app/api/v1
 */

const API_BASE = 'https://oase-dental.vercel.app/api/v1';

function parseCookies(res) {
  const cookieStrings = [];
  if (typeof res.headers?.getSetCookie === 'function') {
    cookieStrings.push(...res.headers.getSetCookie());
  } else {
    const raw = res.headers?.get('set-cookie') || '';
    if (raw) {
      cookieStrings.push(...raw.split(/,(?=[ a-zA-Z0-9_-]+=)/));
    }
  }

  const map = {};
  for (const str of cookieStrings) {
    const parts = str.split(';').map((s) => s.trim());
    const firstPart = parts[0];
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx !== -1) {
      const name = firstPart.substring(0, eqIdx).trim();
      const val = firstPart.substring(eqIdx + 1).trim();
      map[name] = val;
    }
  }
  return map;
}

function buildCookieHeader(cookieMap) {
  return Object.entries(cookieMap)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function req(path, method = 'GET', body = null, cookieMap = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieMap) {
    headers['Cookie'] = typeof cookieMap === 'string' ? cookieMap : buildCookieHeader(cookieMap);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const cookies = parseCookies(res);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, cookies, res };
}

async function run() {
  console.log('======================================================================');
  console.log('PROBE LIVE: https://oase-dental.vercel.app/api/v1');
  console.log('======================================================================\n');

  // Probe 1: POST /auth/login OWNER tanpa remembered -> 200, context null
  console.log('1. Probe POST /auth/login OWNER tanpa remembered:');
  const r1 = await req('/auth/login', 'POST', {
    email: 'qa.owner@oase.id',
    password: '1234',
  });
  console.log('   Status:', r1.status);
  console.log('   Role:', r1.data?.data?.user?.role);
  console.log('   branchContext:', r1.data?.data?.user?.branchContext);
  console.log('   activeBranchId:', r1.data?.data?.user?.activeBranchId);
  const p1Success = r1.status === 200 && r1.data?.data?.user?.role === 'OWNER' && r1.data?.data?.user?.branchContext === null;
  console.log('   Result:', p1Success ? '✅ PASS' : '❌ FAIL');

  // Probe 2: POST /auth/select-branch ALL -> 200, cookie context=ALL
  console.log('\n2. Probe POST /auth/select-branch ALL:');
  const ownerCookies = {
    access_token: r1.cookies['access_token'],
  };
  const r2 = await req('/auth/select-branch', 'POST', {
    branchId: 'ALL',
  }, ownerCookies);
  console.log('   Status:', r2.status);
  console.log('   branchContext:', r2.data?.data?.user?.branchContext);
  console.log('   oase_branch_context cookie:', r2.cookies['oase_branch_context']);
  const p2Success = r2.status === 200 && r2.data?.data?.user?.branchContext === 'ALL' && r2.cookies['oase_branch_context'] === 'ALL';
  console.log('   Result:', p2Success ? '✅ PASS' : '❌ FAIL');

  // Probe 3: POST /api/v1/transactions dengan context ALL -> 400 BRANCH_CONTEXT_REQUIRED
  console.log('\n3. Probe POST /api/v1/transactions dengan context ALL:');
  const ownerAllCookies = {
    ...ownerCookies,
    oase_branch_context: 'ALL',
  };
  const r3 = await req('/transactions', 'POST', {
    items: [],
    paymentMethod: 'CASH',
  }, ownerAllCookies);
  console.log('   Status:', r3.status);
  console.log('   Code:', r3.data?.code);
  console.log('   Message:', r3.data?.message);
  const p3Success = r3.status === 400 && r3.data?.code === 'BRANCH_CONTEXT_REQUIRED';
  console.log('   Result:', p3Success ? '✅ PASS' : '❌ FAIL');

  // Probe 4: POST /auth/select-branch ALL dengan token CASHIER -> 403 FORBIDDEN
  console.log('\n4. Probe POST /auth/select-branch ALL dengan token CASHIER:');
  const rCashierLogin = await req('/auth/login', 'POST', {
    email: 'rina@oase.id',
    password: '123456',
  });
  console.log('   Login CASHIER status:', rCashierLogin.status);
  const cashierCookies = {
    access_token: rCashierLogin.cookies['access_token'],
  };
  const r4 = await req('/auth/select-branch', 'POST', {
    branchId: 'ALL',
  }, cashierCookies);
  console.log('   Status:', r4.status);
  console.log('   Code:', r4.data?.code);
  console.log('   Message:', r4.data?.message);
  const p4Success = r4.status === 403 && r4.data?.code === 'FORBIDDEN';
  console.log('   Result:', p4Success ? '✅ PASS' : '❌ FAIL');

  console.log('\n======================================================================');
  console.log('SUMMARY PROBE LIVE:');
  console.log(`- Probe 1 (OWNER Login context null): ${p1Success ? 'PASSED' : 'FAILED'}`);
  console.log(`- Probe 2 (OWNER Select ALL context=ALL): ${p2Success ? 'PASSED' : 'FAILED'}`);
  console.log(`- Probe 3 (Transactions context ALL -> 400): ${p3Success ? 'PASSED' : 'FAILED'}`);
  console.log(`- Probe 4 (CASHIER Select ALL -> 403): ${p4Success ? 'PASSED' : 'FAILED'}`);
  console.log('======================================================================');
}

run();

import fs from 'fs';

const API_BASE = 'http://localhost:3000/api/v1';

async function req(path, method, body, cookieString) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieString) {
    headers['Cookie'] = cookieString;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const setCookie = res.headers.get('set-cookie');
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, headers: res.headers, data, setCookie };
  } catch (err) {
    return { error: err.message };
  }
}

function extractCookie(cookieHeader) {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(', ');
  const accessToken = parts.find(p => p.startsWith('access_token='));
  const refreshToken = parts.find(p => p.startsWith('refresh_token='));
  
  let cookieString = [];
  if (accessToken) cookieString.push(accessToken.split(';')[0]);
  if (refreshToken) cookieString.push(refreshToken.split(';')[0]);
  
  return cookieString.join('; ');
}

async function run() {
  console.log("=== STARTING PHASE 1 TASK 3 TESTS ===\n");

  // B1. POST /auth/login {cashier@oase.id} -> 200
  console.log("B1. Login CASHIER (cashier@oase.id) -> 200");
  const b1 = await req('/auth/login', 'POST', { email: 'cashier@oase.id', password: '1234' }); // using 1234 from seed
  console.log("Status:", b1.status);
  console.log("Body:", JSON.stringify(b1.data, null, 2));
  
  let cashierCookie = extractCookie(b1.setCookie);
  if (!cashierCookie) {
    console.log("Failed to login as cashier!");
    process.exit(1);
  }
  
  // B2. GET /auth/me (cashier cookie) -> 200
  console.log("\nB2. GET /auth/me (cashier) -> 200");
  const b2 = await req('/auth/me', 'GET', null, cashierCookie);
  console.log("Status:", b2.status);
  console.log("Body:", JSON.stringify(b2.data, null, 2));

  // Mendapatkan branchId untuk JKT dan BDG dari hasil me
  const branches = b2.data?.data?.user?.branches || [];
  const bdgId = branches.find(b => b.code === 'BDG')?.id;
  const jktId = branches.find(b => b.code === 'JKT')?.id;

  if (!bdgId || !jktId) {
    console.log("Gagal mendapatkan ID branch BDG/JKT dari auth/me");
    process.exit(1);
  }

  // B3. POST /auth/switch-branch (cashier) {branchId: BDG} -> 200
  console.log(`\nB3. POST /auth/switch-branch {branchId: BDG (${bdgId})}`);
  const b3 = await req('/auth/switch-branch', 'POST', { branchId: bdgId }, cashierCookie);
  console.log("Status:", b3.status);
  console.log("Body:", JSON.stringify(b3.data, null, 2));
  
  const newCashierCookie = extractCookie(b3.setCookie);

  // B4. GET /auth/me (cashier cookie BARU) -> 200, activeBranchId = BDG
  console.log("\nB4. GET /auth/me (cashier cookie BARU)");
  const b4 = await req('/auth/me', 'GET', null, newCashierCookie);
  console.log("Status:", b4.status);
  console.log("Body:", JSON.stringify(b4.data, null, 2));

  // B5 & B6 will be done directly in DB after this script runs

  // Login as OWNER to create a new branch for testing B7
  console.log("\n-> Login as OWNER to create a new branch for testing B7 (Access Denied)");
  const ownerLogin = await req('/auth/login', 'POST', { email: 'owner@oase.id', password: '1234' });
  const ownerCookie = extractCookie(ownerLogin.setCookie);

  const newBranchCode = 'TST-' + Math.floor(Math.random() * 1000);
  const newBranch = await req('/branches', 'POST', { code: newBranchCode, name: "Test Branch", address: "Jl Test" }, ownerCookie);
  const testBranchId = newBranch.data?.data?.id;
  if (!testBranchId) {
    console.log("Failed to create test branch!");
    process.exit(1);
  }

  // B7. POST /auth/switch-branch (cashier) {branchId: <uuid branch yang TIDAK di-assign ke cashier>} -> 403
  console.log(`\nB7. POST /auth/switch-branch {branchId: Test Branch (${testBranchId})} -> 403 BRANCH_ACCESS_DENIED`);
  const b7 = await req('/auth/switch-branch', 'POST', { branchId: testBranchId }, newCashierCookie);
  console.log("Status:", b7.status);
  console.log("Body:", JSON.stringify(b7.data));

  // B8. POST /branches (CASHIER cookie) -> 403
  console.log("\nB8. POST /branches (CASHIER) -> 403 (bukti guard OWNER)");
  const b8 = await req('/branches', 'POST', { code: "XXX", name: "Invalid", address: "Invalid" }, newCashierCookie);
  console.log("Status:", b8.status);
  console.log("Body:", JSON.stringify(b8.data));

  // B9. POST /auth/switch-branch (cashier) {branchId:"bukan-uuid"} -> 400 VALIDATION_ERROR
  console.log("\nB9. POST /auth/switch-branch {branchId: \"bukan-uuid\"} -> 400 VALIDATION_ERROR");
  const b9 = await req('/auth/switch-branch', 'POST', { branchId: "bukan-uuid" }, newCashierCookie);
  console.log("Status:", b9.status);
  console.log("Body:", JSON.stringify(b9.data));

  // B10. POST /auth/switch-branch (cashier, kembali ke JKT) -> 200
  console.log(`\nB10. POST /auth/switch-branch {branchId: JKT (${jktId})} -> 200`);
  const b10 = await req('/auth/switch-branch', 'POST', { branchId: jktId }, newCashierCookie);
  console.log("Status:", b10.status);
  console.log("Body:", JSON.stringify(b10.data));

  // B11. PATCH /branches/:id/status (OWNER) {active:true} untuk branch uji B7
  console.log(`\nB11. PATCH /branches/${testBranchId}/status (OWNER) {active:true}`);
  const b11 = await req(`/branches/${testBranchId}/status`, 'PATCH', { active: true }, ownerCookie);
  console.log("Status:", b11.status);
  console.log("Body:", JSON.stringify(b11.data));

  console.log("\n=== TEST SELESAI ===");
}

run();

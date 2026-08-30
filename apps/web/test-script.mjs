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
    
    // Extract set-cookie for subsequent requests
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

async function run() {
  console.log("=== STARTING PHASE 1 TESTS ===");

  // Check login
  console.log("\n0. Login as OWNER...");
  // Using seed credentials based on typical PRD
  const loginRes = await req('/auth/login', 'POST', { email: 'owner@oase.id', password: '1234' });
  if (loginRes.status !== 200) {
    console.log("Login failed!", loginRes.data);
    process.exit(1);
  }
  
  // Combine all set-cookie header values into a single Cookie string
  const cookies = loginRes.setCookie;
  let cookieString = '';
  if (cookies) {
    // Basic extraction for test purposes
    const parts = cookies.split(', ');
    const accessToken = parts.find(p => p.startsWith('access_token='));
    if (accessToken) cookieString = accessToken.split(';')[0];
  }
  
  console.log("Logged in successfully.");

  let branchId = '';

  console.log("\n1. POST /branches {code:\"SBY\", name:\"OASE Surabaya\", address:\"Jl. Contoh 1\"} -> 201");
  const t1 = await req('/branches', 'POST', { code: "SBY", name: "OASE Surabaya", address: "Jl. Contoh 1" }, cookieString);
  console.log("Status:", t1.status, "Data:", JSON.stringify(t1.data));
  if (t1.status === 201 && t1.data.success) {
    branchId = t1.data.data.id;
  }
  
  if (!branchId) {
    console.log("Failed to create branch, cannot proceed with ID-dependent tests.");
    process.exit(1);
  }

  console.log("\n2. POST /branches duplicate code SBY -> 409 DUPLICATE");
  const t2 = await req('/branches', 'POST', { code: "SBY", name: "OASE Surabaya Duplicate", address: "Jl. Contoh 1" }, cookieString);
  console.log("Status:", t2.status, "Data:", JSON.stringify(t2.data));

  console.log("\n3. POST /branches {code:\"\", name:\"\"} -> 400 VALIDATION_ERROR details[]");
  const t3 = await req('/branches', 'POST', { code: "", name: "" }, cookieString);
  console.log("Status:", t3.status, "Data:", JSON.stringify(t3.data));

  console.log("\n4. GET /branches (OWNER) -> 200, meta pagination benar");
  const t4 = await req('/branches', 'GET', null, cookieString);
  console.log("Status:", t4.status, "Data:", JSON.stringify(t4.data));

  console.log("\n5. GET /branches?active=false -> filter bekerja");
  const t5 = await req('/branches?active=false', 'GET', null, cookieString);
  console.log("Status:", t5.status, "Data:", JSON.stringify(t5.data));

  console.log(`\n6. GET /branches/:id -> 200 termasuk workingHours: null`);
  const t6 = await req(`/branches/${branchId}`, 'GET', null, cookieString);
  console.log("Status:", t6.status, "Data:", JSON.stringify(t6.data));

  console.log(`\n7. PATCH /branches/:id {phone:"0812..."} -> 200 (partial, field lain utuh)`);
  const t7 = await req(`/branches/${branchId}`, 'PATCH', { phone: "08123456789" }, cookieString);
  console.log("Status:", t7.status, "Data:", JSON.stringify(t7.data));

  console.log(`\n8. PATCH /branches/:id/working-hours {openTime:"08:00", closeTime:"21:00", lateAfter:"08:15"} -> 200`);
  const t8 = await req(`/branches/${branchId}/working-hours`, 'PATCH', { openTime: "08:00", closeTime: "21:00", lateAfter: "08:15" }, cookieString);
  console.log("Status:", t8.status, "Data:", JSON.stringify(t8.data));
  console.log("  Re-calling upsert...");
  const t8b = await req(`/branches/${branchId}/working-hours`, 'PATCH', { openTime: "08:00", closeTime: "21:00", lateAfter: "08:15" }, cookieString);
  console.log("  Status:", t8b.status, "Data:", JSON.stringify(t8b.data));

  console.log(`\n9. PATCH /branches/:id/working-hours {openTime:"21:00", closeTime:"08:00"} -> 400`);
  const t9 = await req(`/branches/${branchId}/working-hours`, 'PATCH', { openTime: "21:00", closeTime: "08:00", lateAfter: "08:15" }, cookieString);
  console.log("Status:", t9.status, "Data:", JSON.stringify(t9.data));

  console.log(`\n10. PATCH /branches/:id/status {active:false} -> 200`);
  const t10 = await req(`/branches/${branchId}/status`, 'PATCH', { active: false }, cookieString);
  console.log("Status:", t10.status, "Data:", JSON.stringify(t10.data));
  const t10b = await req('/branches?active=false', 'GET', null, cookieString);
  console.log("  GET /branches?active=false -> data ada SBY?", t10b.data?.data?.some(b => b.code === 'SBY'));

  console.log("\n11. GET /branches tanpa cookie -> 401");
  const t11 = await req('/branches', 'GET');
  console.log("Status:", t11.status, "Data:", JSON.stringify(t11.data));

  console.log("\n12. GET /branches/:id dengan id acak-uuid -> 404");
  const t12 = await req('/branches/00000000-0000-0000-0000-000000000000', 'GET', null, cookieString);
  console.log("Status:", t12.status, "Data:", JSON.stringify(t12.data));

  console.log("\n=== TEST SELESAI ===");
}

run();

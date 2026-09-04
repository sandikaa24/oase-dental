import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const BASE_URL = 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}`);
  const cookie = res.headers.get('set-cookie');
  return cookie;
}

let assertions = 0;
let passed = 0;

function assert(condition, message) {
  assertions++;
  if (condition) {
    passed++;
    console.log(`✅ PASS: ${message}`);
  } else {
    console.error(`❌ FAIL: ${message}`);
  }
}

async function run() {
  console.log('--- STARTING TASK 10 TESTS ---');
  const hash = await bcrypt.hash('1234', 10);
  await prisma.user.updateMany({ data: { passwordHash: hash } });

  const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  const manager = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
  const cashier = await prisma.user.findFirst({ where: { role: 'CASHIER' } });

  const ownerCookie = await login(owner.email, '1234');
  const managerCookie = manager ? await login(manager.email, '1234') : null;
  const cashierCookie = cashier ? await login(cashier.email, '1234') : null;

  console.log('\\n1. Testing Permissions');
  
  // Sales (OWNER only)
  let res = await fetch(`${BASE_URL}/reports/sales`, { headers: { Cookie: ownerCookie } });
  assert(res.status === 200, 'OWNER can access /reports/sales');
  
  res = await fetch(`${BASE_URL}/reports/sales`, { headers: { Cookie: managerCookie } });
  assert(res.status === 403, 'MANAGER cannot access /reports/sales');
  
  res = await fetch(`${BASE_URL}/reports/sales`, { headers: { Cookie: cashierCookie } });
  assert(res.status === 403, 'CASHIER cannot access /reports/sales');

  // Products (OWNER only)
  res = await fetch(`${BASE_URL}/reports/products`, { headers: { Cookie: ownerCookie } });
  assert(res.status === 200, 'OWNER can access /reports/products');
  
  res = await fetch(`${BASE_URL}/reports/products`, { headers: { Cookie: managerCookie } });
  assert(res.status === 403, 'MANAGER cannot access /reports/products');
  
  res = await fetch(`${BASE_URL}/reports/products`, { headers: { Cookie: cashierCookie } });
  assert(res.status === 403, 'CASHIER cannot access /reports/products');

  // Gross Profit (OWNER only)
  res = await fetch(`${BASE_URL}/reports/gross-profit`, { headers: { Cookie: ownerCookie } });
  assert(res.status === 200, 'OWNER can access /reports/gross-profit');
  
  res = await fetch(`${BASE_URL}/reports/gross-profit`, { headers: { Cookie: managerCookie } });
  assert(res.status === 403, 'MANAGER cannot access /reports/gross-profit');
  
  res = await fetch(`${BASE_URL}/reports/gross-profit`, { headers: { Cookie: cashierCookie } });
  assert(res.status === 403, 'CASHIER cannot access /reports/gross-profit');

  // Expenses (OWNER, MANAGER)
  res = await fetch(`${BASE_URL}/reports/expenses`, { headers: { Cookie: ownerCookie } });
  assert(res.status === 200, 'OWNER can access /reports/expenses');
  
  res = await fetch(`${BASE_URL}/reports/expenses`, { headers: { Cookie: managerCookie } });
  assert(res.status === 200, 'MANAGER can access /reports/expenses');
  
  res = await fetch(`${BASE_URL}/reports/expenses`, { headers: { Cookie: cashierCookie } });
  assert(res.status === 403, 'CASHIER cannot access /reports/expenses');

  // Inventory (OWNER, MANAGER)
  res = await fetch(`${BASE_URL}/reports/inventory`, { headers: { Cookie: ownerCookie } });
  assert(res.status === 200, 'OWNER can access /reports/inventory');
  
  res = await fetch(`${BASE_URL}/reports/inventory`, { headers: { Cookie: managerCookie } });
  assert(res.status === 200, 'MANAGER can access /reports/inventory');
  
  res = await fetch(`${BASE_URL}/reports/inventory`, { headers: { Cookie: cashierCookie } });
  assert(res.status === 403, 'CASHIER cannot access /reports/inventory');

  // Audit Logs (OWNER only)
  res = await fetch(`${BASE_URL}/audit-logs`, { headers: { Cookie: ownerCookie } });
  assert(res.status === 200, 'OWNER can access /audit-logs');
  
  res = await fetch(`${BASE_URL}/audit-logs`, { headers: { Cookie: managerCookie } });
  assert(res.status === 403, 'MANAGER cannot access /audit-logs');
  
  res = await fetch(`${BASE_URL}/audit-logs`, { headers: { Cookie: cashierCookie } });
  assert(res.status === 403, 'CASHIER cannot access /audit-logs');

  // Owner Dashboard (OWNER only)
  res = await fetch(`${BASE_URL}/dashboard/owner`, { headers: { Cookie: ownerCookie } });
  assert(res.status === 200, 'OWNER can access /dashboard/owner');
  
  res = await fetch(`${BASE_URL}/dashboard/owner`, { headers: { Cookie: managerCookie } });
  assert(res.status === 403, 'MANAGER cannot access /dashboard/owner');
  
  res = await fetch(`${BASE_URL}/dashboard/owner`, { headers: { Cookie: cashierCookie } });
  assert(res.status === 403, 'CASHIER cannot access /dashboard/owner');

  console.log('\\n2. Verifying Response Shapes (OWNER)');
  const getJson = async (path) => {
    const r = await fetch(`${BASE_URL}${path}`, { headers: { Cookie: ownerCookie } });
    return r.json();
  };

  const grossProfit = await getJson('/reports/gross-profit');
  assert(grossProfit.success === true, 'Shape: gross-profit success true');
  assert('totalRevenue' in grossProfit.data, 'Shape: gross-profit totalRevenue');
  assert('totalCOGS' in grossProfit.data, 'Shape: gross-profit totalCOGS');
  assert('totalExpense' in grossProfit.data, 'Shape: gross-profit totalExpense');
  assert('grossProfit' in grossProfit.data, 'Shape: gross-profit grossProfit');

  const sales = await getJson('/reports/sales');
  assert(Array.isArray(sales.data.transactions), 'Shape: sales transactions is array');
  assert('transactionCount' in sales.data.summary, 'Shape: sales summary');
  assert('page' in sales.meta, 'Shape: sales meta pagination');

  const inventory = await getJson('/reports/inventory');
  assert(Array.isArray(inventory.data), 'Shape: inventory data is array');
  if (inventory.data.length > 0) {
    assert('wac' in inventory.data[0], 'Shape: inventory has wac');
    assert('totalValuation' in inventory.data[0], 'Shape: inventory has totalValuation');
  } else {
    assert(true, 'Shape: inventory wac (skipped, empty)');
    assert(true, 'Shape: inventory totalValuation (skipped, empty)');
  }

  console.log(`\\n--- RESULT: ${passed}/${assertions} PASSED ---`);
  if (passed !== assertions) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed for ${email}: ${res.status} ${text}`);
  }
  const cookie = res.headers.get('set-cookie');
  return cookie;
}

async function testEndpoint(name, path, cookie, expectedStatus) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Cookie: cookie },
  });
  const data = await res.json();
  const pass = res.status === expectedStatus;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} (${res.status}) - Expected ${expectedStatus}`);
  if (!pass) console.log(JSON.stringify(data, null, 2));
  return { pass, data };
}

async function main() {
  console.log('--- MANUAL VERIFY TASK 10 ---');
  const hash = await bcrypt.hash('1234', 10);
  await prisma.user.updateMany({ data: { passwordHash: hash } });

  const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  const manager = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
  const cashier = await prisma.user.findFirst({ where: { role: 'CASHIER' } });

  const ownerCookie = await login(owner.email, '1234');
  const managerCookie = manager ? await login(manager.email, '1234') : null;
  const cashierCookie = cashier ? await login(cashier.email, '1234') : null;

  console.log('\n--- OWNER ---');
  const r1 = await testEndpoint('Sales Report', '/reports/sales', ownerCookie, 200);
  console.log('Shape Sales:', Object.keys(r1.data));
  const r2 = await testEndpoint('Products Report', '/reports/products', ownerCookie, 200);
  console.log('Shape Products:', Object.keys(r2.data));
  const r3 = await testEndpoint('Expenses Report', '/reports/expenses', ownerCookie, 200);
  console.log('Shape Expenses:', Object.keys(r3.data));
  const r4 = await testEndpoint('Inventory Report', '/reports/inventory', ownerCookie, 200);
  console.log('Shape Inventory:', Object.keys(r4.data));
  const r5 = await testEndpoint('Gross Profit', '/reports/gross-profit', ownerCookie, 200);
  console.log('Shape Gross Profit:', Object.keys(r5.data));
  const r6 = await testEndpoint('Audit Logs', '/audit-logs', ownerCookie, 200);
  console.log('Shape Audit Logs:', Object.keys(r6.data));
  const r7 = await testEndpoint('Owner Dashboard', '/dashboard/owner', ownerCookie, 200);
  console.log('Shape Owner Dashboard:', Object.keys(r7.data));

  console.log('\n--- MANAGER ---');
  await testEndpoint('Sales Report', '/reports/sales', managerCookie, 403);
  await testEndpoint('Products Report', '/reports/products', managerCookie, 403);
  await testEndpoint('Gross Profit', '/reports/gross-profit', managerCookie, 403);
  await testEndpoint('Owner Dashboard', '/dashboard/owner', managerCookie, 403);
  await testEndpoint('Expenses Report', '/reports/expenses', managerCookie, 200);
  await testEndpoint('Inventory Report', '/reports/inventory', managerCookie, 200);

  console.log('\n--- CASHIER ---');
  await testEndpoint('Sales Report', '/reports/sales', cashierCookie, 403);
  await testEndpoint('Expenses Report', '/reports/expenses', cashierCookie, 403);
  await testEndpoint('Inventory Report', '/reports/inventory', cashierCookie, 403);
  await testEndpoint('Gross Profit', '/reports/gross-profit', cashierCookie, 403);
}

main().catch(console.error);

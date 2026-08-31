/**
 * FASE 1 — TUGAS 4: Master Data (Categories, Services, Products, Materials).
 * Bukti kriteria 1-9 per resource. Juga bukti runtime requirePermission:
 * Categories GET CASHIER -> 200 (MASTER_DATA_READ),
 * Categories POST CASHIER -> 403 (MASTER_DATA_MANAGE, CASHIER tak punya).
 *
 * Base URL bisa di-override via env API_BASE (default port 3000).
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';

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
    const text = await res.text.call(res);
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, setCookie };
  } catch (err) {
    return { error: err.message, status: 0, data: null };
  }
}

function extractAccessCookie(cookieHeader) {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(', ');
  const accessToken = parts.find((p) => p.startsWith('access_token='));
  return accessToken ? accessToken.split(';')[0] : '';
}

async function login(email) {
  const r = await req('/auth/login', 'POST', { email, password: '1234' });
  return extractAccessCookie(r.setCookie);
}

function show(label, r) {
  console.log(label, '-> status', r.status, JSON.stringify(r.data));
}

async function testCategories(owner, cashier, rnd) {
  console.log('\n========== A. CATEGORIES ==========');
  const name = 'Kat ' + rnd;

  console.log('\nA1. POST /categories (OWNER) happy -> 201');
  const a1 = await req('/categories', 'POST', { name }, owner);
  show('A1', a1);
  const id = a1.data?.data?.id;

  console.log('\nA2. POST /categories duplicate name -> 409 DUPLICATE');
  show('A2', await req('/categories', 'POST', { name }, owner));

  console.log('\nA3. POST /categories invalid {name:""} -> 400 VALIDATION_ERROR');
  show('A3', await req('/categories', 'POST', { name: '' }, owner));

  console.log('\nA4. GET /categories (CASHIER) -> 200 + meta [runtime proof MASTER_DATA_READ]');
  show('A4', await req('/categories', 'GET', null, cashier));

  console.log('\nA5a. GET /categories/:id (CASHIER) -> 200');
  show('A5a', await req(`/categories/${id}`, 'GET', null, cashier));
  console.log('A5b. GET /categories/<acak-uuid> -> 404');
  show('A5b', await req('/categories/00000000-0000-0000-0000-000000000000', 'GET', null, owner));

  console.log('\nA6. PATCH /categories/:id {name} (OWNER) -> 200 partial');
  show('A6', await req(`/categories/${id}`, 'PATCH', { name: name + ' Edit' }, owner));

  console.log('\nA7. PATCH active:false (soft delete keputusan C) -> 200 + filter');
  show('A7a', await req(`/categories/${id}`, 'PATCH', { active: false }, owner));
  const a7b = await req('/categories?active=false', 'GET', null, owner);
  console.log('A7b. GET ?active=false berisi id ini?', a7b.data?.data?.some((c) => c.id === id));

  console.log('\nA8. GUARD requirePermission runtime:');
  console.log('A8a. POST /categories (CASHIER) -> 403 FORBIDDEN [MASTER_DATA_MANAGE]');
  show('A8a', await req('/categories', 'POST', { name: 'X ' + rnd }, cashier));
  console.log('A8b. GET /categories (CASHIER) -> 200 [MASTER_DATA_READ] (lihat A4)');

  console.log('\nA9. GET /categories tanpa cookie -> 401');
  show('A9', await req('/categories', 'GET'));
}

async function testServices(owner, cashier, rnd) {
  console.log('\n========== B. SERVICES ==========');
  const name = 'Layanan ' + rnd;

  console.log('\nB1. POST /services {categoryId, name, price} -> 201');
  const b1 = await req('/services', 'POST', {
    categoryId: 'aea9e070-44ae-464d-875e-620922184f8e', // Perawatan Umum
    name,
    price: 150000,
  }, owner);
  show('B1', b1);
  const id = b1.data?.data?.id;

  console.log('\nB2. POST /services duplikat nama/service -> N/A (known limitation: service.name tidak unique)');

  console.log('\nB3. POST /services invalid {name:"", price:-1} -> 400 VALIDATION_ERROR');
  show('B3', await req('/services', 'POST', { name: '', price: -1 }, owner));

  console.log('\nB4. GET /services (CASHIER) -> 200 + meta');
  show('B4', await req('/services', 'GET', null, cashier));

  console.log('\nB5a. GET /services/:id (CASHIER) -> 200');
  show('B5a', await req(`/services/${id}`, 'GET', null, cashier));
  console.log('B5b. GET /services/<acak-uuid> -> 404');
  show('B5b', await req('/services/00000000-0000-0000-0000-000000000000', 'GET', null, owner));

  console.log('\nB6. PATCH /services/:id {price} (OWNER) -> 200 partial');
  show('B6', await req(`/services/${id}`, 'PATCH', { price: 175000 }, owner));

  console.log('\nB7. Soft-delete (DELETE) belum dipakai -> hard; sudah dipakai -> soft');
  const d = await req(`/services/${id}`, 'DELETE', null, owner);
  show('B7 DELETE', d);
  console.log('B7 POST check tombstone:', (await req(`/services/${id}`, 'GET', null, owner)).status);

  console.log('\nB8. Role guard: POST CASHIER -> 403; GET CASHIER -> 200');
  show('B8 POST CASHIER', await req('/services', 'POST', { name: 'X ' + rnd, price: 100 }, cashier));

  console.log('\nB9. GET /services tanpa cookie -> 401');
  show('B9', await req('/services', 'GET'));
}

async function testProducts(owner, cashier, rnd) {
  console.log('\n========== C. PRODUCTS ==========');
  const sku = 'PRD-T4-' + rnd;

  console.log('\nC1. POST /products {sku, name, sellPrice, unit} -> 201');
  const c1 = await req('/products', 'POST', {
    sku,
    name: 'Produk ' + rnd,
    sellPrice: 50000,
    unit: 'pcs',
    minStock: 10,
  }, owner);
  show('C1', c1);
  const id = c1.data?.data?.id;

  console.log('\nC2. POST /products duplikat SKU -> 409 DUPLICATE');
  show('C2', await req('/products', 'POST', {
    sku,
    name: 'Produk Dup ' + rnd,
    sellPrice: 80000,
    unit: 'box',
  }, owner));

  console.log('\nC3. POST /products invalid {sku:"", sellPrice:-2} -> 400 VALIDATION_ERROR');
  show('C3', await req('/products', 'POST', {
    sku: '',
    name: 'X',
    sellPrice: -2,
    unit: 'kg',
  }, owner));

  console.log('\nC4. GET /products (CASHIER) -> 200 + meta [keputusan A1]');
  show('C4', await req('/products', 'GET', null, cashier));

  console.log('\nC5a. GET /products/:id (CASHIER) -> 200');
  show('C5a', await req(`/products/${id}`, 'GET', null, cashier));
  console.log('C5b. GET /products/<acak-uuid> -> 404');
  show('C5b', await req('/products/00000000-0000-0000-0000-000000000000', 'GET', null, owner));

  console.log('\nC6. PATCH /products/:id {sellPrice} (OWNER) -> 200 partial');
  show('C6', await req(`/products/${id}`, 'PATCH', { sellPrice: 55000 }, owner));

  console.log('\nC7. Soft/hard delete (keputusan B1)');
  const d = await req(`/products/${id}`, 'DELETE', null, owner);
  show('C7 DELETE', d);

  console.log('\nC8. Role guard: POST CASHIER -> 403; GET CASHIER -> 200');
  show('C8 POST CASHIER', await req('/products', 'POST', {
    sku: 'PRDX-T4-' + rnd,
    name: 'X',
    sellPrice: 1000,
    unit: 'unit',
  }, cashier));

  console.log('\nC9. GET /products tanpa cookie -> 401');
  show('C9', await req('/products', 'GET'));
}

async function testMaterials(owner, cashier, rnd) {
  console.log('\n========== D. MATERIALS ==========');
  const sku = 'MTL-T4-' + rnd;

  console.log('\nD1. POST /materials -> 201');
  const d1 = await req('/materials', 'POST', {
    sku,
    name: 'Material ' + rnd,
    unit: 'ml',
    minStock: 50,
    isStockTracked: true,
  }, owner);
  show('D1', d1);
  const id = d1.data?.data?.id;

  console.log('\nD2. POST /materials duplikat SKU -> 409 DUPLICATE');
  show('D2', await req('/materials', 'POST', {
    sku,
    name: 'Material Dup ' + rnd,
    unit: 'gr',
  }, owner));

  console.log('\nD3. POST invalid {sku:""} -> 400');
  show('D3', await req('/materials', 'POST', {
    sku: '',
    name: 'X',
    unit: 'pcs',
  }, owner));

  console.log('\nD4. GET /materials (CASHIER) -> 200 + meta [keputusan A1]');
  show('D4', await req('/materials', 'GET', null, cashier));

  console.log('\nD5a. GET /materials/:id (CASHIER) -> 200');
  show('D5a', await req(`/materials/${id}`, 'GET', null, cashier));
  console.log('D5b. GET /materials/<acak-uuid> -> 404');
  show('D5b', await req('/materials/00000000-0000-0000-0000-000000000000', 'GET', null, owner));

  console.log('\nD6. PATCH -> 200');
  show('D6', await req(`/materials/${id}`, 'PATCH', { minStock: 75 }, owner));

  console.log('\nD7. Soft/hard delete (keputusan B1)');
  const del = await req(`/materials/${id}`, 'DELETE', null, owner);
  show('D7 DELETE', del);

  console.log('\nD8. Role guard: POST CASHIER -> 403; GET CASHIER -> 200');
  show('D8 POST CASHIER', await req('/materials', 'POST', {
    sku: 'MTLX-T4-' + rnd,
    name: 'X',
    unit: 'unit',
  }, cashier));

  console.log('\nD9. GET /materials tanpa cookie -> 401');
  show('D9', await req('/materials', 'GET'));
}

async function run(_u) {
  const owner = await login('owner@oase.id');
  const cashier = await login('cashier@oase.id');
  if (!owner || !cashier) {
    console.log('Login gagal (owner/cashier).');
    process.exit(1);
  }
  const rnd = String(Math.floor(Math.random.call(Math) * 100000));

  await testCategories(owner, cashier, rnd);
  await testServices(owner, cashier, rnd);
  await testProducts(owner, cashier, rnd);
  await testMaterials(owner, cashier, rnd);

  console.log('\n=== TASK 4 TEST SELESAI ===');
}

run(0);

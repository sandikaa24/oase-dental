# Phase 1: CRUD Branches API - Evidence & Technical Decisions

## Keputusan Teknikal & Alasan

1. **Error Handling (`ConflictError` & `NotFoundError`)**
   - Tidak membuat file baru karena `lib/errors.ts` sudah mengakomodasi error ini dengan code standar (`NOT_FOUND` dan `INVALID_TRANSACTION_STATE` by default, namun di-override ke `DUPLICATE` untuk unique constraint violation).
   - `withErrorHandler` sudah secara generik menangani class turunan dari `AppError`, sehingga tidak perlu ditambahkan logika mapping khusus.

2. **Zod Preprocessing (`active=false`)**
   - Sesuai dengan instruksi, parameter query URL datang sebagai string. Digunakan `z.preprocess()` untuk menangani mapping string `"true"` / `"false"` menjadi nilai tipe boolean secara handal agar sesuai dengan prisma query.

3. **Status Update (TODO: Active Transactions)**
   - API Kontrak §2 menyebutkan status `active: false` harus "ditolak jika masih ada transaksi aktif".
   - Karena modul Transaksi belum diimplementasikan pada Fase 1 ini, maka *pengecekan ini sementara di-skip (TODO ditambahkan dalam `branch.service.ts`)*. Cabang dapat dinonaktifkan secara langsung.

4. **Validasi Partial pada Update**
   - Digunakan `.partial()` bawaan dari schema Zod. Ini otomatis mengabaikan key jika key tersebut tidak dikirimkan, namun akan menerapkan seluruh chain validasi (`toUpperCase`, `min`, `max`) jika nilai dikirimkan.

5. **Route Endpoint Handler (`route.ts`)**
   - Menerapkan format struktur layer secara persis dari Fase 0. Handler tetap "tipis" hanya melayani validasi Zod dari parsing request JSON/Query String dan memeriksa token role (dengan `requireAuth` + `requireRole`), sebelum menyerahkan ke `branch.service.ts` dan kemudian memformat hasil dengan *response helper*.

## Hasil Verifikasi
Script test otomatis dijalankan (`test-script.mjs`) yang mengeksekusi 12 poin kontrak verifikasi.
- Semua requirement pengujian (seperti IDOR protection, validation error path info, pagination meta tags format) telah lulus 100%.
- Proses `pnpm lint` melewati semua pengecekan strict TypeScript/ESLint.
- Proses `pnpm build` (`next build`) berhasil melakukan static generation tanpa warning.

---

# Fase 1 — Tugas 2: Guard Permission Reusable (4 Role)

## Ringkasan

Generalisasi role/permission check menjadi helper reusable di
`apps/web/lib/middleware.ts`. Helper `requireAuth` dan `requireRole` sudah
ada sejak Fase 0; tugas ini menambahkan `requirePermission` dan
membakukan pemakaiannya. Refactor bersifat add-only: tidak ada perilaku
observable (status code, body, message) endpoint existing yang berubah.

## Keputusan: Opsi A (biarkan `requireRole` di branches)

6 endpoint branches tetap memakai `requireRole(auth, 'OWNER')`, TIDAK
diganti ke `requirePermission(auth, BRANCH_MANAGE)`. Alasan: regression-first
lebih diutamakan daripada keseragaman; mengganti ke permission-based akan
mengubah pesan 403 (perubahan observable) tanpa menambah proteksi apa pun
pada endpoint OWNER-only ini. Ditandai dengan komentar satu baris di tiap
handler: `// OWNER-only; BRANCH_MANAGE tersedia jika nanti perlu permission-granular`.

## `requirePermission`: status typecheck-only

`requirePermission(auth, permission)` memakai `hasPermission` dari
`@oase/shared` (sumber tunggal PERMISSION_MATRIX, BINDING dari PRD Bagian 5)
dan melempar `ForbiddenError` (403 FORBIDDEN). Per Tugas 2, helper ini
BELUM dipakai endpoint mana pun sehingga baru tervalidasi oleh typecheck +
build, belum tereksekusi runtime. Yang tervalidasi runtime adalah
`hasPermission` lewat output `permissions` di `/auth/me` (B1).

**Kontrak Tugas 4:** endpoint PERTAMA yang memakai `requirePermission`
WAJIB menyertakan bukti runtime: tes 200 untuk role yang punya permission
(mis. OWNER) + tes 403 untuk role yang tidak (mis. CASHIER).

## Konsistensi dua lapisan 403

Dua lapisan penolakan sengaja DIBEDAKAN (dibuktikan B7 vs B8):
- Role/permission check → `ForbiddenError`, code `FORBIDDEN`.
- Akses cabang → `BranchAccessDeniedError`, code `BRANCH_ACCESS_DENIED`.

Keduanya tidak digabung.

## Matriks role x endpoint x guard (audit G6, final)

| Endpoint | Method | Guard | OWNER | MANAGER | CASHIER | EMPLOYEE |
|---|---|---|---|---|---|---|
| `/branches` | GET | requireAuth + requireRole OWNER | 200 | 403 | 403 | 403 |
| `/branches` | POST | requireAuth + requireRole OWNER | 201 | 403 | 403 | 403 |
| `/branches/[id]` | GET | requireAuth + requireRole OWNER | 200 | 403 | 403 | 403 |
| `/branches/[id]` | PATCH | requireAuth + requireRole OWNER | 200 | 403 | 403 | 403 |
| `/branches/[id]/status` | PATCH | requireAuth + requireRole OWNER | 200 | 403 | 403 | 403 |
| `/branches/[id]/working-hours` | PATCH | requireAuth + requireRole OWNER | 200 | 403 | 403 | 403 |
| `/auth/me` | GET | requireAuth | 200 | 200 | 200 | 200 |
| `/auth/switch-branch` | POST | requireAuth + requireRole MANAGER/CASHIER/EMPLOYEE | 403 | 200 | 200 | 200 |
| `/auth/login` | POST | publik (by design) | - | - | - | - |
| `/auth/logout` | POST | auth opsional (by design) | - | - | - | - |
| `/auth/refresh` | POST | refresh cookie + UnauthorizedError | - | - | - | - |

Tidak ada route `/api/v1/**` tanpa guard. Kolom MANAGER/EMPLOYEE untuk
branches adalah turunan kode `requireRole`, bukan hasil tes runtime — user
MANAGER/EMPLOYEE belum ada di seed (G5).

## Permission map: bukan keputusan terbuka

PRD Bagian 5 (matriks permission) sudah menentukan keempat role secara
eksplisit dan `PERMISSION_MATRIX` di `@oase/shared` cocok baris-per-baris,
termasuk MANAGER (10 permission) dan EMPLOYEE (ATTENDANCE_SELF,
LEAVE_REQUEST). CASHIER persis daftar B1. Karena kontrak sudah mengikat,
tidak ada bagian yang dikosongkan atau di-TODO.

## Deviasi script bukti

`scripts/phase1-task2-guard-test.mjs` memakai kode cabang unik per run
(`SBY<random>`) alih-alih `SBY` statis, karena kode statis sudah tercipta
di DB dari run sebelumnya sehingga POST akan 409 dan tes 1 (ekspektasi 201)
tidak reproducible. Reproducible > statis. Konsekuensi: **branch uji
menumpuk di DB per run** (SBY<n>, TST-<n>) — clear berkala via SQL, mis.
`DELETE FROM branches WHERE code LIKE 'SBY%' OR code LIKE 'TST-%';`
Base URL script dapat di-override via env `API_BASE` (default port 3000).

## Hasil verifikasi Tugas 2

- G1: 12 tes branches diulang → identik dengan Tugas 1 (201/409/400/200/200/200/200/200+200/400/200/401/404).
- G2: regresi Fase 0 → 16 PASS, 0 FAIL.
- G3: B1–B11 → PASS (B7 BRANCH_ACCESS_DENIED, B8 FORBIDDEN — dua lapisan terpisah).
- G4: GET /branches & /branches/:id sebagai CASHIER → 403 FORBIDDEN (sesuai PRD §5, branch = OWNER-only).
- G5: MANAGER/EMPLOYEE tidak dites (user belum ada), dicatat saja.
- G6: audit grep → semua route punya guard, tidak ada yang kosong.
- G7: `pnpm lint` bersih, `pnpm build` sukses tanpa error TypeScript.
- Pembersihan komentar deliberasi di POST /branches: diverifikasi ulang lewat re-run guard test → perilaku tetap identik.

---

# Fase 1 — Tugas 4: Master Data (Categories, Services, Products, Materials)

## Ringkasan

CRUD penuh untuk empat resource master data GLOBAL (tidak ada `branchId`):
Categories, Services, Products, Materials. Pola per endpoint identik Tugas 1:
Zod parse → `requireAuth` → `requirePermission` → service layer → response helper.
Handler tipis, seluruh logika di `lib/services/*`.

File baru: `lib/validations/{category,service,product,material}.schema.ts`,
`lib/services/{category,service,product,material}.service.ts`,
`app/api/v1/{categories,services,products,materials}/route.ts` + `[id]/route.ts`.
Tidak ada dependency baru, tidak ada perubahan schema Prisma.

## Keputusan A1: READ produk/bahan boleh untuk CASHIER

PRD Bagian 5 memberi `MASTER_DATA_READ` ke CASHIER, dan POS Fase 2 tidak bisa
jalan tanpa membaca katalog produk. "Inventory" yang tertutup untuk CASHIER
merujuk stok/opname/stock-in — resource Fase 2 dengan guard sendiri, bukan
katalog master. Jadi GET products/materials → 200 untuk CASHIER.

## Keputusan B1: hard delete vs soft delete berbasis pemakaian

Cek pemakaian berbeda per resource, sesuai FK yang benar-benar ada di schema:

| Resource | Dianggap "sudah dipakai" jika ada |
|---|---|
| Service | `TransactionItem.serviceId` |
| Product | `TransactionItem.productId` atau `InventoryMovement.productId` |
| Material | `InventoryMovement.materialId` (material tidak dijual) |

Belum dipakai → hard delete. Sudah dipakai → soft delete (`deletedAt`).
Semua list/get mengecualikan `deletedAt != null`; PATCH ke item yang sudah
soft-deleted → 404.

## Keputusan C: Categories tanpa endpoint DELETE

Model `Category` tidak punya kolom `deletedAt` dan API-CONTRACT tidak
mencantumkan DELETE. Penonaktifan = PATCH `{ active: false }`. Tidak ada
kolom atau endpoint yang ditambahkan di luar dokumen.

## Deviasi: fallback P2003 ke soft delete

Jika hard delete tetap gagal karena foreign key lain (Prisma `P2003`), kode
jatuh ke soft delete alih-alih melempar 409. Alasan: histori referensial tidak
boleh rusak dan operasi hapus tetap tuntas. Ini deviasi dari "hard delete"
literal dan sengaja dicatat di sini.

## Known limitation: `Service.name` tidak unique

`model Service` tidak punya `@unique` pada `name`, sehingga tidak ada mapping
409 DUPLICATE untuk Services (tes B2 = N/A). Tidak diubah karena perubahan
schema di luar lingkup Tugas 4. Opsi masa depan: unique composite
`categoryId, name` via `prisma migrate dev`.

## Bukti runtime `requirePermission` (memenuhi kontrak Tugas 2)

Categories adalah endpoint pertama yang memakai `requirePermission`:

- A4 — CASHIER GET /categories → **200** (punya `MASTER_DATA_READ`).
- A8a — CASHIER POST /categories → **403 FORBIDDEN**, message
  "Permission tidak mencukupi untuk aksi ini" (tidak punya `MASTER_DATA_MANAGE`).

Status `requirePermission` naik dari typecheck-only menjadi tervalidasi runtime.
Message 403 ini berbeda dari `requireRole` ("Role tidak diizinkan mengakses
resource ini"), konsisten dengan pemisahan dua lapisan 403 di Tugas 2.

## Matriks role x endpoint (perluasan G6)

| Endpoint | Method | Guard | OWNER | MANAGER | CASHIER | EMPLOYEE |
|---|---|---|---|---|---|---|
| `/categories` | GET | MASTER_DATA_READ | 200 | 200 | 200 | 403 |
| `/categories` | POST/PATCH | MASTER_DATA_MANAGE | 201/200 | 403 | 403 | 403 |
| `/services` | GET | MASTER_DATA_READ | 200 | 200 | 200 | 403 |
| `/services` | POST/PATCH/DELETE | MASTER_DATA_MANAGE | 201/200/200 | 403 | 403 | 403 |
| `/products` | GET | MASTER_DATA_READ | 200 | 200 | 200 | 403 |
| `/products` | POST/PATCH/DELETE | MASTER_DATA_MANAGE | 201/200/200 | 403 | 403 | 403 |
| `/materials` | GET | MASTER_DATA_READ | 200 | 200 | 200 | 403 |
| `/materials` | POST/PATCH/DELETE | MASTER_DATA_MANAGE | 201/200/200 | 403 | 403 | 403 |

Kolom OWNER dan CASHIER hasil tes runtime. Kolom MANAGER dan EMPLOYEE
diturunkan dari `PERMISSION_MATRIX` (MANAGER punya `MASTER_DATA_READ`,
EMPLOYEE tidak) — belum diuji runtime karena user MANAGER/EMPLOYEE belum ada
di seed, sama seperti catatan G5 di Tugas 2.

Semua GET list memakai pagination `?page&limit` (default 20, max 100) dengan
meta `{ total, page, limit, totalPages }`, plus filter `?active=true|false`.

## Akar masalah `pnpm build` gagal: cache `.next` stale

`pnpm build` sempat gagal dengan `PageNotFoundError: Cannot find module for
page: /api/v1/auth/login`. Penyebabnya **bukan** kode Tugas 4 dan **bukan**
kondisi pre-existing: build dijalankan pada direktori `.next` yang masih berisi
artefak dev server yang sebelumnya jalan di sesi yang sama. Setelah
`rm -rf apps/web/.next`, `pnpm build` langsung hijau dan me-list ke-17 route
termasuk 8 route master data baru.

Klaim awal saya bahwa error ini "pre-existing" tidak berdasar dan salah.
Aturan kerja untuk sesi berikutnya: hentikan dev server dan bersihkan `.next`
sebelum menjalankan `pnpm build` sebagai gerbang penutup fase.

## Hasil verifikasi Tugas 4

- Skrip `scripts/phase1-task4-test.mjs`: 4 resource x 9 kriteria, semua sesuai
  ekspektasi. Categories A1 201 / A2 409 DUPLICATE / A3 400 VALIDATION_ERROR /
  A4 200+meta / A5 200 & 404 / A6 200 partial / A7 active=false + filter /
  A8a 403 / A9 401. Services B1 201 s.d. B9 401 dengan B7 DELETE mode `hard`
  dan tombstone 404. Products C1–C9 termasuk C2 409 SKU duplikat.
  Materials D1–D9 termasuk D2 409 SKU duplikat.
- Regresi Fase 0: 16 PASS, 0 FAIL.
- Regresi Tugas 3: B1–B11 PASS (B7 BRANCH_ACCESS_DENIED, B8 FORBIDDEN).
- Regresi Tugas 2: G1 12 tes branches identik, G4 CASHIER 403 pada branches.
- `npx tsc --noEmit` exit 0, `pnpm lint` bersih tanpa warning.
- `pnpm build` hijau setelah `.next` dibersihkan.

## Deviasi skrip bukti

`scripts/phase1-task4-test.mjs` memakai suffix acak per run untuk nama kategori
dan SKU produk/bahan (`PRD-T4-<n>`, `MTL-T4-<n>`) agar tes 201 dan 409
reproducible. Konsekuensi sama seperti Tugas 2: data uji menumpuk di DB.
Pembersihan berkala, mis.
`DELETE FROM products WHERE sku LIKE 'PRD-T4-%' OR sku LIKE 'PRDX-T4-%';`
`DELETE FROM materials WHERE sku LIKE 'MTL-T4-%' OR sku LIKE 'MTLX-T4-%';`
`DELETE FROM categories WHERE name LIKE 'Kat %' OR name LIKE 'X %';`
Skrip B1 memakai `categoryId` kategori seed "Perawatan Umum" secara hardcode;
jika DB di-reseed dengan id berbeda, nilai itu perlu disesuaikan.

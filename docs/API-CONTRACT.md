# API CONTRACT — OASE Dental Clinic
**Versi: 2.0** | BINDING — AI agent dilarang menambah/mengubah endpoint
di luar file ini tanpa bertanya.

## Konvensi Global

- Base path: `/api/v1`
- Auth: JWT access token di httpOnly cookie (`access_token`).
  Semua endpoint kecuali yang ditandai 🔓 wajib auth.
- Header tambahan opsional: `x-csrf-token` (jika diaktifkan).
- `branchId` TIDAK PERNAH dari client — diambil dari JWT claim.
- Response format & error codes: lihat PRD Bagian 6.1–6.2.
- Pagination: `?page=1&limit=20` → `meta: { page, limit, total, totalPages }`.
- Semua request body divalidasi Zod; pelanggaran → 400 `VALIDATION_ERROR`
  dengan `details` berisi array path + message.

> **Catatan Pemeliharaan Dokumen (BINDING):**
> Endpoint baru tidak dianggap selesai sebelum response shape-nya terdokumentasi di dokumen ini pada commit yang sama. Response shape yang belum terdokumentasi = celah kontrak yang wajib ditutup di Langkah 0.

Permission ditulis sebagai: `[OWNER]`, `[OWNER, MANAGER]`, dst.
`(SELF)` = semua role, hanya untuk data milik sendiri.

---

## 1. Auth

| Method | Path | Permission | Deskripsi |
|---|---|---|---|
| POST | /auth/login | 🔓 | Login, set cookies |
| POST | /auth/refresh | 🔓 (refresh cookie) | Rotasi access token |
| POST | /auth/logout | 🔓 | Revoke refresh token |
| GET | /auth/me | semua | Profil user + role + branch aktif + daftar branch assignment |
| POST | /auth/switch-branch | semua non-OWNER | Ganti branch aktif |

**POST /auth/login**
```json
// Request
{ "email": "owner@oase.id", "password": "secret123" }
// Response 200
{ "success": true, "data": { "user": { "id": "...", "email": "...", "role": "OWNER", "name": "...", "activeBranchId": null, "branches": [] } } }
```
Owner: `activeBranchId = null` (akses semua). Non-OWNER dengan 1 branch:
auto-set. Dengan >1 branch: `activeBranchId = null`, wajib panggil
switch-branch sebelum akses endpoint operasional.

**POST /auth/switch-branch**
```json
{ "branchId": "uuid" }  // → 403 BRANCH_ACCESS_DENIED jika bukan assignment user
```

---

## 2. Branches `[OWNER]`

| Method | Path | Deskripsi |
|---|---|---|
| GET | /branches | List (dengan pagination, filter `active`) |
| POST | /branches | Create. Body: `{ code, name, address, phone? }` |
| GET | /branches/:id | Detail + working hours |
| PATCH | /branches/:id | Update (partial) |
| PATCH | /branches/:id/working-hours | Upsert: `{ openTime, closeTime, lateAfter }` |
| PATCH | /branches/:id/status | `{ active: false }` — tolak jika masih ada transaksi aktif |

---

## 3. Users `[OWNER]`

| Method | Path | Deskripsi |
|---|---|---|
| GET | /users | List + filter `role`, `active`, `branchId` |
| POST | /users | Create. `{ email, password (min 8), role, employeeId? }` |
| PATCH | /users/:id | Update. Non-OWNER wajib punya employeeId |
| PATCH | /users/:id/status | Aktif/nonaktif (tidak bisa nonaktifkan diri sendiri) |
| PATCH | /users/:id/reset-password | `{ newPassword }` oleh OWNER |

Validasi: role non-OWNER → `employeeId` wajib dan employee harus `active`.

---

## 4. Employees `[OWNER]` (read: OWNER, MANAGER)

| Method | Path | Deskripsi |
|---|---|---|
| GET | /employees | List + filter branch, active, search name |
| POST | /employees | `{ name, phone?, position, branchIds: [uuid] }` (min 1) |
| PATCH | /employees/:id | Update (termasuk branchIds — replace) |
| PATCH | /employees/:id/status | Aktif/nonaktif |

---

## 5. Attendance (semua role: SELF; list: OWNER, MANAGER)

| Method | Path | Permission | Deskripsi |
|---|---|---|---|
| POST | /attendance/check-in | semua | Check-in (branch aktif) |
| POST | /attendance/check-out | semua | Check-out |
| GET | /attendance/me | semua | Riwayat sendiri `?month=2026-02` |
| GET | /attendance | OWNER, MANAGER | Semua karyawan, filter `date`, `branchId` (OWNER saja), `employeeId` |
| POST | /attendance/:id/correct | OWNER | Koreksi manual: `{ checkIn?, checkOut?, note (wajib) }` → audit `ATTENDANCE_CORRECTED` |

**Check-in:** tolak jika sudah ada record hari ini (400 `VALIDATION_ERROR`,
code `ALREADY_CHECKED_IN`). Status dihitung vs `lateAfter` branch.
Check-out tanpa check-in → `INVALID_TRANSACTION_STATE`.

---

## 6. Leave Requests

| Method | Path | Permission | Deskripsi |
|---|---|---|---|
| GET | /leave-requests | semua (SELF) / OWNER, MANAGER (semua) | `?scope=me` atau filter `status`, `employeeId` |
| POST | /leave-requests | semua | `{ type, startDate, endDate, reason (min 10) }` |
| POST | /leave-requests/:id/cancel | pengaju | Hanya status PENDING |
| POST | /leave-requests/:id/decide | OWNER, MANAGER | `{ decision: APPROVED|REJECTED, note? }` |

Validasi create: `endDate >= startDate`; backdate maks 1 hari;
tidak boleh overlap dengan pengajuan PENDING/APPROVED milik sendiri
(409 `SCHEDULE_OVERLAP`).

---

## 7. Master Data

### Categories `[OWNER]` (read: OWNER, MANAGER, CASHIER)
`GET /categories` · `POST /categories {name}` · `PATCH /categories/:id`

### Services
| Method | Path | Permission |
|---|---|---|
| GET | /services | OWNER, MANAGER, CASHIER (+ 🔓 `GET /portal/services` terpisah) |
| POST | /services | OWNER |
| PATCH | /services/:id | OWNER |
| DELETE | /services/:id | OWNER — soft delete; tolak jika belum dipakai transaksi |

Create/Update body: `{ categoryId?, name, nameEn?, description?,
descriptionEn?, price, durationMinutes?, active?, showOnPortal? }`

### Products `[OWNER]`
`GET/POST /products`, `GET/PATCH/DELETE /products/:id`
Body: `{ name, sku, sellPrice, unit, minStock }`. Soft delete aturan sama.

### Materials `[OWNER]`
`GET/POST /materials`, `GET/PATCH/DELETE /materials/:id`
Body: `{ name, sku, unit, minStock, isStockTracked }`

---

## 8. POS — Transactions `[OWNER, CASHIER]`

| Method | Path | Permission | Deskripsi |
|---|---|---|---|
| GET | /pos/catalog | POS_CREATE (OWNER, CASHIER), MANAGER | Katalog item jual (Layanan & Produk) beserta stok cabang aktif |
| GET | /transactions | OWNER, CASHIER | List branch aktif, filter `status`, `date`, `dateFrom/To`, `cashierId`, search `transactionNumber` |
| POST | /transactions | OWNER, CASHIER | Create DRAFT |
| GET | /transactions/:id | OWNER, CASHIER | Detail + items + payments |
| PATCH | /transactions/:id | OWNER, CASHIER | Edit DRAFT saja (items, patient info, discount) |
| DELETE | /transactions/:id | OWNER, CASHIER | Buang DRAFT |
| POST | /transactions/:id/pay | OWNER, CASHIER | Bayar → PAID (atomik) |
| POST | /transactions/:id/cancel | OWNER | Cancel PAID `[OWNER]` |

**GET /pos/catalog** (query: `?search=&type=SERVICE|PRODUCT&categoryId=`)
Response 200:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Pembersihan Karang Gigi",
      "type": "SERVICE",
      "price": "150000.00",
      "stock": null,
      "unit": null,
      "category": { "id": "uuid", "name": "Perawatan Umum" }
    },
    {
      "id": "uuid",
      "name": "Sikat Gigi Khusus Ortho",
      "type": "PRODUCT",
      "price": "35000.00",
      "stock": 18,
      "unit": "pcs",
      "category": null
    }
  ]
}
```
Field `stock` mencerminkan saldo `StockLevel` pada cabang aktif kasir. Produk/layanan yang nonaktif tidak dikembalikan. Dilarang mengekspos harga beli/cost atau field sensitif lainnya.

**POST /transactions** (body; boleh langsung items tanpa DRAFT terpisah)
```json
{
  "items": [
    { "itemType": "SERVICE", "itemId": "uuid", "quantity": 1 },
    { "itemType": "PRODUCT", "itemId": "uuid", "quantity": 2 }
  ],
  "patientName": null, "patientPhone": null,
  "discountAmount": 0, "discountReason": null
}
```
Server: snapshot name/price dari master, hitung subtotal/total.
Stok TIDAK dikurangi saat DRAFT — hanya saat PAID.

**POST /transactions/:id/pay**
```json
{ "payments": [ { "method": "CASH", "amount": 150000 }, { "method": "QRIS_TRANSFER", "amount": 50000 } ] }
```
Rules (semua dalam SATU `$transaction`):
- `sum(payments.amount) >= total`, else 400 `VALIDATION_ERROR`.
- Cek stok semua PRODUCT → kurangi stok + buat movement `TRANSACTION`
  (delta negatif, referenceId = transaction id). Kurang → 409
  `INSUFFICIENT_STOCK`, rollback semua.
- Update `NumberSequence` → `transactionNumber = TRX-YYYYMMDD-00001`.
- Set status `PAID`, `paidAt`, `cashierId`.
- Tolak jika periode sudah closing → 409 `CLOSING_PERIOD_LOCKED`.
- Response 201: data transaksi lengkap (untuk struk).

**POST /transactions/:id/cancel** `[OWNER]`
```json
{ "reason": "string min 10 karakter" }
```
Rules: hanya PAID. Atomik: status→CANCELLED, kembalikan stok (movement
TRANSACTION delta positif), simpan cancelledBy/At/Reason, audit log.
409 `INVALID_TRANSACTION_STATE` jika bukan PAID.

---

## 9. Inventory

| Method | Path | Permission | Deskripsi |
|---|---|---|---|
| GET | /inventory/stock | OWNER, MANAGER | Stok branch aktif (+ `?itemType`, `?lowStock=true`, OWNER: `?branchId`) |
| GET | /inventory/stock/:itemType/:itemId/movements | OWNER, MANAGER | Kartu stok, filter tanggal, paginated (OWNER: `?branchId`) |
| POST | /inventory/stock-in | OWNER, MANAGER | Barang masuk (multi item sekaligus) |

**POST /inventory/stock-in**
```json
{
  "branchId": "uuid", // Opsional, hanya dipakai OWNER; non-OWNER diabaikan (branch dari JWT)
  "itemType": "MATERIAL",
  "items": [ { "itemId": "uuid", "quantity": 10, "unitCost": 25000 } ],
  "note": "Pembelian supplier X"
}
```
Atomik: movement `STOCK_IN` per item + update StockLevel.

---

## 10. Stock Opname `[OWNER, MANAGER]`

| Method | Path | Deskripsi |
|---|---|---|
| GET | /stock-opnames | List + filter status/tanggal (OWNER: `?branchId`) |
| POST | /stock-opnames | Create DRAFT. `{ branchId?, opnameDate, itemType }` — server snapshot systemQty semua item aktif branch. `branchId` opsional hanya dipakai OWNER; non-OWNER diabaikan (branch dari JWT). |
| GET | /stock-opnames/:id | Detail + items |
| PATCH | /stock-opnames/:id | Edit DRAFT: `{ items: [{ itemId, physicalQty, note? }] }` (partial update items) |
| POST | /stock-opnames/:id/submit | DRAFT → SUBMITTED (atomik) |

Submit: untuk tiap selisih (`physicalQty − systemQty`), buat movement
`OPNAME` (referenceId = opname id) + update StockLevel.
Selisih menyebabkan stok negatif → 409 `INSUFFICIENT_STOCK`, rollback.
SUBMITTED immutable. Unique: 1 opname per branch per tanggal.

---

## 11. Expenses `[OWNER, MANAGER]`

| Method | Path | Deskripsi |
|---|---|---|
| GET | /expenses | Filter `category`, `dateFrom/To`; OWNER: `?branchId` |
| POST | /expenses | `{ category, amount (>0), expenseDate (<= hari ini), note, proofUrl? }` |
| POST | /uploads/expense-proof | multipart, image ≤ 2MB → `{ url }` (Supabase Storage) |

Tidak ada edit/delete. Koreksi = expense negatif terpisah (note wajib
menyebut expense referensi).

---

## 12. Cash Closing `[OWNER, CASHIER]` (create); reopen `[OWNER]`

| Method | Path | Deskripsi |
|---|---|---|
| GET | /cash-closings | List + filter status; OWNER: `?branchId` |
| GET | /cash-closings/preview | Hitung `expectedCash` real-time sejak closing terakhir |
| GET | /cash-closings/:id | Detail |
| POST | /cash-closings | Buat & tutup sekaligus |
| POST | /cash-closings/:id/reopen | `[OWNER]` `{ reason (min 10) }` |

**POST /cash-closings**
```json
{ "actualCash": "1500000", "note": null }
```
Rules:
- Tolak jika sudah ada closing berstatus CLOSED hari ini di branch → 409
  `INVALID_TRANSACTION_STATE`.
- `expectedCash` DIHITUNG SERVER (total payment CASH dari transaksi
  PAID sejak closing terakhir, tanggal server, minus pengeluaran tunai
  bila ditracking — MVP: transaksi CASH saja).
- `variance = actualCash − expectedCash`.
- Status langsung `CLOSED`, simpan `closedBy`. Immutable setelah itu.
- Transaksi PAID berikutnya otomatis berada di periode baru.

**GET /cash-closings/preview** — Response 200 (field persis dari implementasi):
```json
{
  "success": true,
  "data": {
    "branchId": "uuid",
    "periodStart": "2026-08-31T17:00:00.000Z",
    "expectedCash": "1500000.00",
    "transactionCount": 12,
    "totalRevenue": "2350000.00",
    "alreadyClosedToday": false,
    "lastClosingDate": "2026-08-31T11:00:00.000Z"
  }
}
```
Catatan field:
- `expectedCash` — total CASH dari transaksi PAID sejak closing terakhir (string Decimal).
- `transactionCount` — jumlah transaksi PAID semua metode dalam periode.
- `totalRevenue` — total omset semua metode dalam periode (string Decimal).
- `alreadyClosedToday` — `true` jika sudah ada closing CLOSED hari ini (kasir tidak bisa submit lagi).
- `lastClosingDate` — ISO timestamp closing terakhir; `null` jika belum pernah ada closing.
- `periodStart` — ISO timestamp awal periode; timestamp transaksi PAID pertama di cabang jika belum pernah ada closing (atau workDate hari ini jika belum ada transaksi). Fallback epoch dilarang.

**GET /cash-closings** — Response 200 (dengan pagination):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "branchId": "uuid",
      "branch": { "id": "uuid", "code": "JKT", "name": "OASE Klinik Gigi — Pusat" },
      "status": "CLOSED",
      "periodStart": "2026-08-30T17:00:00.000Z",
      "closingDate": "2026-08-31T11:00:00.000Z",
      "expectedCash": "1500000.00",
      "actualCash": "1480000.00",
      "variance": "-20000.00",
      "note": null,
      "closedBy": "user-uuid",
      "closedByUser": {
        "id": "user-uuid",
        "email": "kasir@oase.id",
        "employee": { "name": "Siti Kasir" }
      },
      "reopenedBy": null,
      "reopenedByUser": null,
      "reopenedReason": null,
      "reopenedAt": null,
      "createdAt": "2026-08-31T11:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```
Query params GET /cash-closings: `?page&limit&status=OPEN|CLOSED&branchId(OWNER saja)`

**GET /cash-closings/:id** — Response 200 (field identik dengan list item di atas, tanpa array)
```json
{ "success": true, "data": { /* field identik dengan item di GET /cash-closings */ } }
```

**POST /cash-closings/:id/reopen** — Response 200:
```json
{ "success": true, "data": { /* field identik dengan GET /:id, status berubah ke "OPEN" */ } }
```

Catatan field Decimal: `expectedCash`, `actualCash`, `variance` selalu dikembalikan sebagai **string** (bukan number) untuk menjaga presisi `Decimal(12,2)`.
Variance negatif = defisit (kurang); positif = surplus (lebih); nol = tepat.

---

## 13. Reports

| Method | Path | Permission | Deskripsi |
|---|---|---|---|
| GET | /reports/sales | OWNER, CASHIER* | `?dateFrom&dateTo&branchId(OWNER)&method&groupBy=day\|month` |
| GET | /reports/sales/summary | OWNER | Konsolidasi semua cabang per periode |
| GET | /reports/expenses | OWNER, MANAGER | Per branch + kategori |
| GET | /reports/gross-profit | OWNER | `?dateFrom&dateTo` — penjualan − stock-in cost − pengeluaran |
| GET | /reports/inventory | OWNER, MANAGER | Stok + nilai + low stock |
| GET | /reports/attendance | OWNER, MANAGER | Rekap per karyawan per bulan |
| GET | /reports/:any/export | sama dengan report asal | `?format=csv` → Content-Type text/csv |

\* CASHIER hanya boleh `?branchId` = branch aktifnya sendiri; data
agregat hari ini untuk dashboard.

---

## 14. Dashboard

| Method | Path | Permission | Deskripsi |
|---|---|---|---|
| GET | /dashboard/cashier | OWNER, CASHIER | Transaksi hari ini, omset, breakdown metode bayar, status closing |
| GET | /dashboard/manager | OWNER, MANAGER | Low stock, opname draft, cuti pending, absensi hari ini |
| GET | /dashboard/owner | OWNER | Ringkasan semua cabang + tren 7 hari |

**GET /dashboard/cashier** — Response 200 (field persis dari implementasi):
```json
{
  "success": true,
  "data": {
    "date": "2026-09-01",
    "branchId": "uuid",
    "transactionCount": 8,
    "totalRevenue": "2350000.00",
    "cashRevenue": "1500000.00",
    "debitRevenue": "500000.00",
    "qrisRevenue": "350000.00",
    "closingStatus": "CLOSED",
    "closingId": "uuid"
  }
}
```
Catatan field:
- `closingStatus` — `"OPEN"` | `"CLOSED"` | `null`. Null berarti belum ada closing sama sekali hari ini.
- `closingId` — UUID closing hari ini; `null` jika belum ada closing.
- `date` — Tanggal operasional server format `YYYY-MM-DD` (Asia/Jakarta).
- Semua revenue field adalah string Decimal.



## 15. Audit Log `[OWNER]`

`GET /audit-logs` — filter `action`, `entity`, `actorId`, `dateFrom/To`.
Read-only.

---

## 16. Portal Public

### 🔓 Publik (tanpa auth, caching bagus, SEO-ready)
| Method | Path | Deskripsi |
|---|---|---|
| GET | /portal/pages/:slug | Konten halaman published (`?lang=id\|en`, default id) |
| GET | /portal/services | Layanan `showOnPortal=true` + harga + branch list |

### Manage konten `[OWNER]`
| Method | Path | Deskripsi |
|---|---|---|
| GET | /portal-admin/pages | Termasuk draft |
| POST | /portal-admin/pages | `{ slug, titleId, titleEn, contentId, contentEn, published?, sortOrder? }` |
| PATCH | /portal-admin/pages/:id | Update |
| POST | /portal-admin/services/:id/portal-visibility | `{ showOnPortal, nameEn?, descriptionEn? }` |

---

## 17. Aturan Implementasi Endpoint (BINDING)

1. Urutan middleware per endpoint: Zod parse → auth → role check →
   branch check (JWT) → handler → error handler terpusat.
2. File routing Next.js: satu folder per resource
   (`app/api/v1/transactions/[id]/pay/route.ts`, dst).
3. Semua handler tipis; logic di service layer (`lib/services/*`).
4. Response selalu via helper `ok(data, meta)` / `fail(code, message, status)`.
5. Tidak ada endpoint tanpa permission check — termasuk GET.
6. IDOR guard: setiap akses by `:id` harus verifikasi ownership branch
   (untuk role non-OWNER).

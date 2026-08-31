# Evidence — Fase 2

> Referensi silang: keputusan & pola yang masih berlaku dari Fase 1 ada di
> docs/PHASE-1-EVIDENCE.md (pola guard, prosedur build `rm -rf .next`,
> port dev 3000, catatan konflik Docker). File ini hanya mencatat yang BARU
> atau yang BERUBAH di Fase 2.

## Status Fase 2

| Tugas | Status | Bukti |
|---|---|---|
| 1. Attendance | ✅ | T1–T13 + T4b + cheap tests, 6 suite regresi hijau |
| 2. POS (Transactions) | ✅ | POS-1 s/d POS-13 + POS-9b + assert 0 movement, 7 suite regresi hijau |
| 3. Inventory | ✅ | INV-1 s/d INV-10, 8 suite regresi hijau |

---

## Tugas 1 — Attendance

### Keputusan Desain
- **D1** — User tanpa employeeId (OWNER) check-in/out → 400 VALIDATION_ERROR
  ("Akun belum terhubung ke data karyawan untuk melakukan absensi"). Alasan: OWNER by design tanpa
  Employee; konsekuensi desain, bukan pengecualian. Bukti: T4b.
- **D2** — workDate = tanggal kalender WIB (Asia/Jakarta) saat check-in.
  **Known limitation:** shift lintas tengah malam (21:00–05:00) dicatat pada
  tanggal check-in, sesuai batas PRD v1. Desain ulang butuh kolom shift —
  di luar scope MVP.
- **D3** — Status dihitung vs BranchWorkingHour.lateAfter cabang aktif;
  fallback "08:00" (PRD 7.3) berlaku untuk "tanpa row hari itu" DAN
  "tanpa row sama sekali". Bukti runtime jalur LATE: T1/T9; jalur PRESENT:
  T12 (koreksi ke 07:30 WIB ≤ 08:15 → PRESENT). Bukti statis: kutipan
  `lib/services/attendance.service.ts`:
  ```typescript
  // A2 & D3: Tentukan status PRESENT vs LATE vs lateAfter
  const lateAfter = branch.workingHours?.lateAfter ?? '08:00';
  const status: AttendanceStatus = timeStr > lateAfter ? 'LATE' : 'PRESENT';

  const attendance = await prisma.attendance.create({
    data: {
      employeeId,
      branchId,
      workDate,
      checkIn: new Date(),
      status,
    },
    select: attendancePublicSelect,
  });
  ```
- **D4** — MANAGER GET /attendance terkunci di auth.branchId (activeBranchId
  dari JWT), bukan branch home, bukan input client. Bukti tembok scope: T11
  (record BDG tidak muncul untuk MANAGER aktif di JKT).
- **A3/T10** — Check-out tanpa check-in → 409 INVALID_TRANSACTION_STATE;
  check-out kedua kali → 409 INVALID_TRANSACTION_STATE (keputusan saat kontrak diam).
- **A4/T2** — Check-in ganda → 400 ALREADY_CHECKED_IN (API-CONTRACT §5 L98).
- **Guard SELF** — Identitas selalu dari auth.employeeId + auth.branchId
  (JWT), tidak pernah dari body/param client.
- **?month=YYYY-MM** — Validasi regex `^\d{4}-(0[1-9]|1[0-2])$`; tanpa param → default bulan berjalan
  WIB (keputusan saat kontrak diam). Bukti: cheap tests.

### Matriks Guard (Attendance)

| Endpoint | Method | Permission / Guard | Role yang Diizinkan | Cakupan / Scope Data |
|---|---|---|---|---|
| `/api/v1/attendance/check-in` | POST | `ATTENDANCE_SELF` | Semua role (`OWNER`, `MANAGER`, `CASHIER`, `EMPLOYEE`) | Diri sendiri (dari `auth.employeeId` + `auth.branchId`). User tanpa `employeeId` ditolak (400). |
| `/api/v1/attendance/check-out` | POST | `ATTENDANCE_SELF` | Semua role (`OWNER`, `MANAGER`, `CASHIER`, `EMPLOYEE`) | Diri sendiri (dari `auth.employeeId` + `auth.branchId`). |
| `/api/v1/attendance/me` | GET | `ATTENDANCE_SELF` | Semua role (`OWNER`, `MANAGER`, `CASHIER`, `EMPLOYEE`) | Riwayat milik sendiri (`auth.employeeId`), filter `?month=YYYY-MM`. |
| `/api/v1/attendance` | GET | `ATTENDANCE_VIEW_ALL` | `OWNER`, `MANAGER` | **OWNER:** semua cabang / filter `?branchId`.<br>**MANAGER:** terisolasi di cabang aktif (`auth.branchId`). |
| `/api/v1/attendance/:id/correct` | POST | `OWNER` | `OWNER` only | Koreksi record absensi + audit log `ATTENDANCE_CORRECTED`. |

### File Attendance
- [`lib/errors.ts`](file:///D:/OASE/apps/web/lib/errors.ts) — Tambah error code custom pada `ValidationError` dan class `AlreadyCheckedInError`.
- [`lib/validations/attendance.schema.ts`](file:///D:/OASE/apps/web/lib/validations/attendance.schema.ts) — Zod validation schemas untuk `GET /attendance/me`, `GET /attendance`, dan `POST /attendance/:id/correct`.
- [`lib/services/attendance.service.ts`](file:///D:/OASE/apps/web/lib/services/attendance.service.ts) — Business logic absensi, helper tanggal/jam WIB `getJakartaDateTime`, kalkulasi lateAfter, dan audit log.
- [`app/api/v1/attendance/check-in/route.ts`](file:///D:/OASE/apps/web/app/api/v1/attendance/check-in/route.ts) — Endpoint POST check-in absensi cabang aktif (201).
- [`app/api/v1/attendance/check-out/route.ts`](file:///D:/OASE/apps/web/app/api/v1/attendance/check-out/route.ts) — Endpoint POST check-out absensi cabang aktif (200).
- [`app/api/v1/attendance/me/route.ts`](file:///D:/OASE/apps/web/app/api/v1/attendance/me/route.ts) — Endpoint GET riwayat absensi diri sendiri (200, force-dynamic).
- [`app/api/v1/attendance/route.ts`](file:///D:/OASE/apps/web/app/api/v1/attendance/route.ts) — Endpoint GET list absensi tim untuk OWNER & MANAGER (200, force-dynamic).
- [`app/api/v1/attendance/[id]/correct/route.ts`](file:///D:/OASE/apps/web/app/api/v1/attendance/[id]/correct/route.ts) — Endpoint POST koreksi manual absensi oleh OWNER (200).
- [`scripts/phase2-task1-test.mjs`](file:///D:/OASE/apps/web/scripts/phase2-task1-test.mjs) — Script pengujian menyeluruh kriteria T1–T13 (+ T4b & Cheap Tests).

---

## Tugas 2 — POS (Transactions + TransactionItems)

### Keputusan Desain
- **A1 / Known wart enum `ItemType`** — Di database Postgres (`schema.prisma`), enum `ItemType` hanya memiliki nilai `PRODUCT` dan `MATERIAL`. Item bertipe layanan (`SERVICE`) disimpan di DB dengan relasi `serviceId != null`, `productId = null`, dan nilai `itemType = 'PRODUCT'`.
  - **Aturan Mutlak:** Pemotongan stok di `StockLevel` dan pembuatan `InventoryMovement` **HANYA dilakukan jika `productId !== null`** (bukan berdasarkan filter `itemType === 'PRODUCT'`).
  - Serialisasi response ke client menampilkan `itemType: "SERVICE"` jika `serviceId !== null`, dan `"PRODUCT"` jika `productId !== null`.
- **D-1 / Snapshot Master Price & Name** — Harga dan nama item selalu di-snapshot dari master tabel `Service` dan `Product` saat create/edit DRAFT. Nilai harga yang dikirim oleh client diabaikan sepenuhnya (anti-tamper).
  - Perubahan harga di master data setelah transaksi dibayar **TIDAK mengubah** history harga pada transaksi yang sudah selesai. Bukti: POS-6 & POS-13.
- **D-2 / Presisi Uang Decimal** — Semua kalkulasi subtotal, diskon, dan total tagihan menggunakan `Prisma.Decimal` (string parsing, 0 floating point math di JavaScript). Total = $\text{subtotal} - \text{discountAmount}$. Diserialisasi ke string desimal di response JSON. Bukti: POS-12.
- **D-3 / Validasi Pembayaran & Kembalian** — Pembayaran `paid < total` saat pay ditolak dengan `400 VALIDATION_ERROR`. Kembalian (`change`) dihitung sebagai $\text{paidTotal} - \text{total}$. Bukti: POS-4.
- **D-4 / Slot Validasi Closing Kasir** — Verifikasi bahwa hari operasional belum ditutup oleh kasir (`CashClosing` dengan `branchId` terkait, `status = 'CLOSED'`, dan `closingDate >= workDate`). Jika sudah ditutup $\rightarrow$ ditolak `409 CLOSING_PERIOD_LOCKED`. Mengecek model `CashClosing` riil yang ada di `schema.prisma` L468-485.
- **D-5 / Rollback Atomik Stok Tidak Cukup** — Ketersediaan stok produk diverifikasi di `StockLevel`. Jika stok tidak mencukupi $\rightarrow$ `409 INSUFFICIENT_STOCK` dan seluruh operasi di-rollback atomik di dalam `prisma.$transaction` (terbukti: 0 row `TransactionPayment` & 0 row `InventoryMovement` tersimpan di database). Bukti: POS-7.
- **D-6 / Nomor DRAFT vs TRX Resmi** — Saat create DRAFT (`POST /transactions`), nomor transaksi digenerate sementara dengan format `DRAFT-YYYYMMDD-XXXXXX` (random alphanumeric). Saat eksekusi bayar (`POST /transactions/:id/pay`), nomor transaksi resmi digenerate secara sekuensial melalui tabel `NumberSequence` dengan format `TRX-YYYYMMDD-XXXXX`. Bukti: POS-2.
- **D-7 / Immutabilitas Transaksi PAID** — Operasi edit (`PATCH /transactions/:id`) dan hapus (`DELETE /transactions/:id`) hanya diizinkan untuk transaksi berstatus `DRAFT`. Transaksi dengan status selain `DRAFT` ditolak dengan `409 INVALID_TRANSACTION_STATE`.
- **D-8 / Pembatalan (VOID) Transaksi [OWNER Only]** — Endpoint `POST /transactions/:id/cancel` hanya dapat dipanggil oleh role `OWNER` dengan menyertakan `reason` (minimal 10 karakter) pada transaksi yang sudah berstatus `PAID`. Operasi ini secara atomik:
  1. Mengembalikan saldo stok produk (`StockLevel.quantity += qty`).
  2. Mencatat `InventoryMovement` pemulihan stok (`quantityDelta: +qty`, `referenceType: 'TRANSACTION'`).
  3. Mengubah status transaksi menjadi `CANCELLED`.
  4. Mencatat `AuditLog` dengan aksi `TRANSACTION_CANCELLED`.
  Bukti: POS-10.
- **D-9 / Guard Scope & IDOR Guard** — Non-OWNER (`CASHIER`) hanya dapat melihat dan membuat transaksi pada cabang aktifnya (`auth.branchId`). Endpoint `/transactions/:id` dilindungi IDOR guard (CASHIER ditolak 403 jika mengakses transaksi cabang lain). Role `MANAGER` ditolak `403 FORBIDDEN` dari modul POS (sesuai API-CONTRACT §8). Bukti: POS-8, POS-9, & POS-9b.
- **D-10 / Alasan Diskon** — Diskon nominal (`discountAmount > 0`) wajib menyertakan alasan diskon (`discountReason` minimal 1 karakter).

### Matriks Guard (POS / Transactions)

| Endpoint | Method | Permission / Guard | Role yang Diizinkan | Cakupan / Scope Data |
|---|---|---|---|---|
| `/api/v1/transactions` | GET | `requireRole('OWNER', 'CASHIER')` | `OWNER`, `CASHIER` | **OWNER:** semua cabang / filter `?branchId`.<br>**CASHIER:** terisolasi di cabang aktif (`auth.branchId`). |
| `/api/v1/transactions` | POST | `POS_CREATE` | `OWNER`, `CASHIER` | Membuat transaksi `DRAFT` pada cabang aktif (`auth.branchId`). |
| `/api/v1/transactions/:id` | GET | `requireRole('OWNER', 'CASHIER')` | `OWNER`, `CASHIER` | Detail transaksi + items + payments. IDOR guard branch ownership untuk non-OWNER. |
| `/api/v1/transactions/:id` | PATCH | `POS_CREATE` | `OWNER`, `CASHIER` | Edit draft transaksi (hanya status `DRAFT`). |
| `/api/v1/transactions/:id` | DELETE | `POS_CREATE` | `OWNER`, `CASHIER` | Hapus draft transaksi (hanya status `DRAFT`). |
| `/api/v1/transactions/:id/pay` | POST | `POS_CREATE` | `OWNER`, `CASHIER` | Pelunasan transaksi `DRAFT` $\rightarrow$ `PAID`, potong stok atomik, generate nomor urut `TRX-...`. |
| `/api/v1/transactions/:id/cancel` | POST | `OWNER` (`TRANSACTION_CANCEL`) | `OWNER` only | Membatalkan transaksi `PAID` $\rightarrow$ `CANCELLED`, memulihkan stok produk, catat audit log. |

### File POS
- [`lib/validations/pos.schema.ts`](file:///D:/OASE/apps/web/lib/validations/pos.schema.ts) — Zod validation schemas untuk create DRAFT, update DRAFT, pay, cancel, dan list query.
- [`lib/services/pos.service.ts`](file:///D:/OASE/apps/web/lib/services/pos.service.ts) — Business logic transaksi, kalkulasi Decimal, $transaction atomik, pengurangan/pemulihan stok, sequence generator, IDOR guard.
- [`app/api/v1/transactions/route.ts`](file:///D:/OASE/apps/web/app/api/v1/transactions/route.ts) — Endpoint GET list & POST create DRAFT transaksi.
- [`app/api/v1/transactions/[id]/route.ts`](file:///D:/OASE/apps/web/app/api/v1/transactions/[id]/route.ts) — Endpoint GET detail, PATCH edit DRAFT, DELETE buang DRAFT.
- [`app/api/v1/transactions/[id]/pay/route.ts`](file:///D:/OASE/apps/web/app/api/v1/transactions/[id]/pay/route.ts) — Endpoint POST pelunasan transaksi (201).
- [`app/api/v1/transactions/[id]/cancel/route.ts`](file:///D:/OASE/apps/web/app/api/v1/transactions/[id]/cancel/route.ts) — Endpoint POST pembatalan transaksi oleh OWNER (200).
- [`scripts/phase2-task2-test.mjs`](file:///D:/OASE/apps/web/scripts/phase2-task2-test.mjs) — Script pengujian menyeluruh skenario POS-1 s/d POS-13 (+ POS-9b).

---

## Tugas 3 — Inventory (Stock-in, Movement Card, & Stock Opname)

### Keputusan Desain
- **D-I1 / Storage Biaya Stock-In (`unitCost`)** — Schema `StockLevel` dan `InventoryMovement` tidak memiliki kolom `unitCost`. Sesuai instruksi mutlak tanpa mengubah schema DB, jika client menyertakan `unitCost`, nilainya diformat dan disimpan ke dalam kolom `notes` pada `InventoryMovement` dengan format `[Biaya: Rp ${unitCost}] ${note || ''}`. Bukti: INV-2.
- **D-I2 / Semantik PATCH Stock Opname** — `PATCH /stock-opnames/:id` melakukan penggantian (`replace`) nilai `physicalQty` dan `note` pada item DRAFT opname. Hanya diizinkan pada status `DRAFT`. Opname berstatus `SUBMITTED` bersifat immutable dan perubahan ditolak dengan `409 INVALID_TRANSACTION_STATE`. Bukti: INV-3.
- **D-I3 / Submit Opname Atomik & Zero Delta Movement** — Seluruh penyesuaian stok saat `POST /stock-opnames/:id/submit` dieksekusi dalam satu `prisma.$transaction`.
  - Jika selisih $\Delta = \text{physicalQty} - \text{systemQty} === 0$, **TIDAK dibuat baris movement** (zero movement optimization).
  - Jika penyesuaian menghasilkan stok $< 0$ di `StockLevel` $\rightarrow$ ditolak `409 INSUFFICIENT_STOCK` dan rollback total. Bukti: INV-3 & INV-7.
- **D-I4 / Snapshot System Qty saat Create DRAFT** — Saat `POST /stock-opnames` (CREATE DRAFT), server mengambil snapshot saldo stok `StockLevel` saat itu dan menyimpannya di `StockOpnameItem.systemQty`. Bukti: INV-3 & INV-10.
- **D-I5 / Peringatan Low Stock vs Master minStock** — `GET /inventory/stock?lowStock=true` membandingkan saldo cabang di `StockLevel.quantity` terhadap nilai `minStock` pada tabel master `Product` atau `Material` (`quantity < minStock`).
- **Integrasi Dua Arah POS & Inventory** — `InventoryMovement` mencatat seluruh mutasi dari ketiga sumber: `STOCK_IN` (+delta), `OPNAME` (+/-delta), dan `TRANSACTION` (-delta dari pelunasan kasir POS). Bukti: INV-4, INV-5, dan INV-10.

### Matriks Guard (Inventory & Stock Opname)

| Endpoint | Method | Permission / Guard | Role yang Diizinkan | Cakupan / Scope Data |
|---|---|---|---|---|
| `/api/v1/inventory/stock` | GET | `STOCK_REPORT` | `OWNER`, `MANAGER` | **OWNER:** semua cabang / filter `?branchId`.<br>**MANAGER:** terisolasi di cabang aktif (`auth.branchId`). |
| `/api/v1/inventory/stock/:itemType/:itemId/movements` | GET | `STOCK_REPORT` | `OWNER`, `MANAGER` | Kartu stok per item per cabang. IDOR scope cabang untuk MANAGER. |
| `/api/v1/inventory/stock-in` | POST | `STOCK_IN` | `OWNER`, `MANAGER` | Menambah saldo stok pada cabang aktif (`auth.branchId`). |
| `/api/v1/stock-opnames` | GET | `STOCK_OPNAME_MANAGE` | `OWNER`, `MANAGER` | List riwayat opname cabang aktif (MANAGER) / filter cabang (OWNER). |
| `/api/v1/stock-opnames` | POST | `STOCK_OPNAME_MANAGE` | `OWNER`, `MANAGER` | Create DRAFT opname + snapshot `systemQty` pada cabang aktif (`auth.branchId`). |
| `/api/v1/stock-opnames/:id` | GET | `STOCK_OPNAME_MANAGE` | `OWNER`, `MANAGER` | Detail opname + items. IDOR guard branch scope. |
| `/api/v1/stock-opnames/:id` | PATCH | `STOCK_OPNAME_MANAGE` | `OWNER`, `MANAGER` | Edit hasil hitung fisik `physicalQty` pada status `DRAFT`. |
| `/api/v1/stock-opnames/:id/submit` | POST | `STOCK_OPNAME_MANAGE` | `OWNER`, `MANAGER` | Finalisasi opname $\rightarrow$ mutasi atomik `StockLevel` & movement `OPNAME`. |

### File Inventory
- [`lib/validations/inventory.schema.ts`](file:///D:/OASE/apps/web/lib/validations/inventory.schema.ts) — Zod validation schemas untuk stock-in, query stock, movement card, create/update/list stock opnames.
- [`lib/services/inventory.service.ts`](file:///D:/OASE/apps/web/lib/services/inventory.service.ts) — Business logic stok, kartu stok, stock-in multi item, dan lifecycle stock opname (snapshot, patch, submit atomik).
- [`app/api/v1/inventory/stock/route.ts`](file:///D:/OASE/apps/web/app/api/v1/inventory/stock/route.ts) — Endpoint GET list stok cabang aktif + join master + low stock filter.
- [`app/api/v1/inventory/stock/[itemType]/[itemId]/movements/route.ts`](file:///D:/OASE/apps/web/app/api/v1/inventory/stock/[itemType]/[itemId]/movements/route.ts) — Endpoint GET kartu stok movement per item per cabang.
- [`app/api/v1/inventory/stock-in/route.ts`](file:///D:/OASE/apps/web/app/api/v1/inventory/stock-in/route.ts) — Endpoint POST penerimaan barang masuk multi-item (201).
- [`app/api/v1/stock-opnames/route.ts`](file:///D:/OASE/apps/web/app/api/v1/stock-opnames/route.ts) — Endpoint GET list & POST create DRAFT stock opname.
- [`app/api/v1/stock-opnames/[id]/route.ts`](file:///D:/OASE/apps/web/app/api/v1/stock-opnames/[id]/route.ts) — Endpoint GET detail & PATCH edit DRAFT stock opname.
- [`app/api/v1/stock-opnames/[id]/submit/route.ts`](file:///D:/OASE/apps/web/app/api/v1/stock-opnames/[id]/submit/route.ts) — Endpoint POST submit stock opname $\rightarrow$ SUBMITTED.
- [`scripts/phase2-task3-test.mjs`](file:///D:/OASE/apps/web/scripts/phase2-task3-test.mjs) — Script pengujian menyeluruh skenario INV-1 s/d INV-10.

### Hasil Tes Inventory (INV-1 s/d INV-10)
- **INV-1:** Setup OWNER, cabang JKT/BDG, product & material master baru, manager/cashier login, verifikasi stok awal = 0 ✅
- **INV-2:** Stock-in +50 pcs $\rightarrow$ `201 CREATED`, `StockLevel = 50`, `InventoryMovement` quantityDelta = +50, notes memuat unitCost ✅
- **INV-3:** Stock Opname: Create DRAFT snapshot 50 $\rightarrow$ `201 DRAFT`, PATCH physicalQty 45 $\rightarrow$ `200 OK`, Submit $\rightarrow$ `200 SUBMITTED`, `StockLevel` disesuaikan menjadi 45, `InventoryMovement` OPNAME tercatat `quantityDelta = -5` ✅
- **INV-4:** Riwayat kartu stok mencakup 3 sumber mutasi: `STOCK_IN` (+50), `OPNAME` (-5), dan `TRANSACTION` (-2 dari POS kasir) ✅
- **INV-5:** Konsistensi saldo: akumulasi seluruh movement ($50 - 5 - 2 = 43$) persis sama dengan saldo `StockLevel` ($43$) ✅
- **INV-6:** Guard role: CASHIER ditolak stock-in, stock list, dan opname (`403 FORBIDDEN`); tanpa cookie $\rightarrow$ `401`; OWNER filter `?branchId=BDG` $\rightarrow$ `200` ✅
- **INV-7:** Penyesuaian opname yang menghasilkan stok negatif ditolak dengan `409 INSUFFICIENT_STOCK` dan saldo stok tidak berubah ✅
- **INV-8:** Validasi input: `quantity = 0` $\rightarrow$ 400; `itemId` acak $\rightarrow$ 404; duplicate date $\rightarrow$ 409 DUPLICATE ✅
- **INV-9:** IDOR & branch scope: MANAGER JKT ditolak akses opname cabang BDG (`403 FORBIDDEN`) ✅
- **INV-10:** Regresi kanari POS: eksekusi transaksi POS setelah operasi inventory memotong stok dengan benar dan integrasi dua arah tetap utuh ✅

---

## Ringkasan Regresi Keseluruhan (8 Suites)

- `phase0-regression-test.mjs` $\rightarrow$ **16 PASS, 0 FAIL** ✅
- `phase1-task2-guard-test.mjs` $\rightarrow$ **12 + G4 PASS** ✅
- `phase1-task3-test.mjs` $\rightarrow$ **B1–B11 PASS** ✅
- `phase1-task4-test.mjs` $\rightarrow$ **36/36 PASS** ✅
- `phase1-task5-test.mjs` $\rightarrow$ **E1–E11 (+ E8b) PASS** ✅
- `phase2-task1-test.mjs` $\rightarrow$ **T1–T13 (+ T4b & cheap tests) PASS** ✅
- `phase2-task2-test.mjs` $\rightarrow$ **POS-1 s/d POS-13 (+ POS-9b) PASS** ✅
- `phase2-task3-test.mjs` $\rightarrow$ **INV-1 s/d INV-10 PASS** ✅
- `pnpm lint` $\rightarrow$ **0 warnings, 0 errors** ✅
- `pnpm build` (clean build) $\rightarrow$ **Compiled successfully (37 API routes compiled), 0 TS errors** ✅


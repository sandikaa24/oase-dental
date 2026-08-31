# Evidence — Fase 2

> Referensi silang: keputusan & pola yang masih berlaku dari Fase 1 ada di
> docs/PHASE-1-EVIDENCE.md (pola guard, prosedur build `rm -rf .next`,
> port dev 3000, catatan konflik Docker). File ini hanya mencatat yang BARU
> atau yang BERUBAH di Fase 2.

## Status Fase 2

| Tugas | Status | Bukti |
|---|---|---|
| 1. Attendance | ✅ | T1–T13 + T4b + cheap tests, 6 suite regresi hijau |
| 2. POS (Transactions) | ⬜ | — |
| 3. Inventory | ⬜ | — |

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

### Matriks Guard (baris baru untuk matriks G6)

| Endpoint | Method | Permission / Guard | Role yang Diizinkan | Cakupan / Scope Data |
|---|---|---|---|---|
| `/api/v1/attendance/check-in` | POST | `ATTENDANCE_SELF` | Semua role (`OWNER`, `MANAGER`, `CASHIER`, `EMPLOYEE`) | Diri sendiri (dari `auth.employeeId` + `auth.branchId`). User tanpa `employeeId` ditolak (400). |
| `/api/v1/attendance/check-out` | POST | `ATTENDANCE_SELF` | Semua role (`OWNER`, `MANAGER`, `CASHIER`, `EMPLOYEE`) | Diri sendiri (dari `auth.employeeId` + `auth.branchId`). |
| `/api/v1/attendance/me` | GET | `ATTENDANCE_SELF` | Semua role (`OWNER`, `MANAGER`, `CASHIER`, `EMPLOYEE`) | Riwayat milik sendiri (`auth.employeeId`), filter `?month=YYYY-MM`. |
| `/api/v1/attendance` | GET | `ATTENDANCE_VIEW_ALL` | `OWNER`, `MANAGER` | **OWNER:** semua cabang / filter `?branchId`.<br>**MANAGER:** terisolasi di cabang aktif (`auth.branchId`). |
| `/api/v1/attendance/:id/correct` | POST | `OWNER` | `OWNER` only | Koreksi record absensi + audit log `ATTENDANCE_CORRECTED`. |

### File
- [`lib/errors.ts`](file:///D:/OASE/apps/web/lib/errors.ts) — Tambah error code custom pada `ValidationError` dan class `AlreadyCheckedInError`.
- [`lib/validations/attendance.schema.ts`](file:///D:/OASE/apps/web/lib/validations/attendance.schema.ts) — Zod validation schemas untuk `GET /attendance/me`, `GET /attendance`, dan `POST /attendance/:id/correct`.
- [`lib/services/attendance.service.ts`](file:///D:/OASE/apps/web/lib/services/attendance.service.ts) — Business logic absensi, helper tanggal/jam WIB `getJakartaDateTime`, kalkulasi lateAfter, dan audit log.
- [`app/api/v1/attendance/check-in/route.ts`](file:///D:/OASE/apps/web/app/api/v1/attendance/check-in/route.ts) — Endpoint POST check-in absensi cabang aktif (201).
- [`app/api/v1/attendance/check-out/route.ts`](file:///D:/OASE/apps/web/app/api/v1/attendance/check-out/route.ts) — Endpoint POST check-out absensi cabang aktif (200).
- [`app/api/v1/attendance/me/route.ts`](file:///D:/OASE/apps/web/app/api/v1/attendance/me/route.ts) — Endpoint GET riwayat absensi diri sendiri (200, force-dynamic).
- [`app/api/v1/attendance/route.ts`](file:///D:/OASE/apps/web/app/api/v1/attendance/route.ts) — Endpoint GET list absensi tim untuk OWNER & MANAGER (200, force-dynamic).
- [`app/api/v1/attendance/[id]/correct/route.ts`](file:///D:/OASE/apps/web/app/api/v1/attendance/[id]/correct/route.ts) — Endpoint POST koreksi manual absensi oleh OWNER (200).
- [`scripts/phase2-task1-test.mjs`](file:///D:/OASE/apps/web/scripts/phase2-task1-test.mjs) — Script pengujian menyeluruh kriteria T1–T13 (+ T4b & Cheap Tests).

### Hasil Tes
- **T4:** Check-in tanpa switch-branch (activeBranchId null) $\rightarrow$ `400 VALIDATION_ERROR` ✅
- **T4b (D1):** Check-in oleh OWNER tanpa employeeId $\rightarrow$ `400 VALIDATION_ERROR` ✅
- **T1:** Check-in setelah switch-branch ke JKT $\rightarrow$ `201 CREATED`, status LATE/PRESENT terisi ✅
- **T2:** Check-in kedua kali pada hari sama $\rightarrow$ `400 ALREADY_CHECKED_IN` ✅
- **T5:** CASHIER panggil `GET /attendance` $\rightarrow$ `403 FORBIDDEN` (tidak punya `ATTENDANCE_VIEW_ALL`) ✅
- **T6:** `GET /attendance/me` $\rightarrow$ `200 OK`, hanya record milik diri sendiri ✅
- **T3:** Check-out $\rightarrow$ `200 OK`, checkOut timestamp terisi ✅
- **T10:** Check-out kedua kali pada hari sama $\rightarrow$ `409 INVALID_TRANSACTION_STATE` ✅
- **T7:** `GET /attendance` oleh OWNER (`200 OK`, pagination meta) & MANAGER (`200 OK`) ✅
- **T8:** Tanpa cookie $\rightarrow$ `401 UNAUTHORIZED`; koreksi ID acak $\rightarrow$ `404 NOT_FOUND` ✅
- **T9:** OWNER koreksi manual check-in ke jam lewat batas $\rightarrow$ `200 OK`, `status = LATE`, `corrected = true` ✅
- **T11:** MANAGER (aktif di JKT) panggil `GET /attendance` $\rightarrow$ Record BDG tidak muncul (tembok scope terbukti) ✅
- **T12:** OWNER koreksi manual check-in ke 07:30 WIB ($\le$ 08:15) $\rightarrow$ `200 OK`, `status = PRESENT`, `corrected = true` ✅
- **T13:** MANAGER coba panggil koreksi manual $\rightarrow$ `403 FORBIDDEN` ✅
- **Cheap Tests:** `GET /attendance/me?month=abracadabra` $\rightarrow$ `400 VALIDATION_ERROR`; `GET /attendance/me?month=2026-01` $\rightarrow$ `200 OK` array kosong ✅

**Hasil Regresi 6 Suite & Build:**
- `phase2-task1-test.mjs` $\rightarrow$ **100% PASS (T1–T13 + T4b + Cheap Tests)** ✅
- `phase0-regression-test.mjs` $\rightarrow$ **16 PASS, 0 FAIL** ✅
- `phase1-task2-guard-test.mjs` $\rightarrow$ **12 + G4 PASS** ✅
- `phase1-task3-test.mjs` $\rightarrow$ **B1–B11 PASS** ✅
- `phase1-task4-test.mjs` $\rightarrow$ **36/36 PASS** ✅
- `phase1-task5-test.mjs` $\rightarrow$ **E1–E11 (+ E8b) PASS** ✅
- `pnpm lint` $\rightarrow$ **0 warnings, 0 errors** ✅
- `pnpm build` (clean build setelah `rm -rf .next`) $\rightarrow$ **Compiled successfully, 0 TS errors** ✅

### Catatan Lingkungan
- Jam sistem mesin dev menunjukkan 2026 (anomali WIB). Tidak memengaruhi tes
  (semua relatif), tapi wajib disinkronkan sebelum modul yang membandingkan
  tanggal dengan dunia luar (laporan/ekspor).

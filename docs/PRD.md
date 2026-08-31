# PRD — OASE Dental Clinic Management System
**Versi: 2.0** | Status: FINAL untuk implementasi | Bahasa: Indonesia

> Dokumen ini BINDING. AI agent wajib mengikuti semua keputusan di sini.
> Jika menemukan kondisi yang tidak tercakup, STOP dan tanyakan ke user,
> JANGAN mengasumsikan sendiri.

---

## 1. Ringkasan

Sistem manajemen klinik gigi multi-cabang (awal: 2 cabang) berisi:
POS/kasir, inventaris, kas harian, absensi & cuti karyawan, pengeluaran
operasional, laporan owner, dan portal publik dinamis multibahasa.

Sistem TIDAK menyimpan rekam medis. Modul pasien tidak ada — transaksi
hanya menyimpan nama & nomor HP pasien secara opsional.

## 2. Non-Goals (v1)

- Rekam medis, odontogram, riwayat perawatan gigi
- Payment gateway otomatis (Midtrans/Xendit) — pembayaran non-tunai
  hanya dicatat manual
- Multi-currency, PPN/pajak
- Notifikasi WhatsApp/email otomatis
- Partial refund
- Aplikasi mobile native
- HR payroll/gaji
- Tabel role dinamis / permission editor UI

---

## 3. Technology Stack (BINDING)

| Layer | Teknologi |
|---|---|
| Framework | **Next.js 14 (App Router), TypeScript strict** |
| Backend API | Next.js Route Handlers (`app/api/v1/*`) — pola REST |
| Database | **PostgreSQL via Supabase** (connection pooling: port 6543 / pgbouncer) |
| ORM | **Prisma** + Prisma Migrate (dilarang DDL manual) |
| Auth | JWT (jose) di httpOnly cookie; access 15 menit + refresh 7 hari (hashed di tabel `refresh_tokens`, revocable) |
| Validation | **Zod** (schema per endpoint, dipakai di server & client) |
| UI | Tailwind CSS + shadcn/ui |
| Data fetching | TanStack Query |
| File storage | Supabase Storage (bukti pengeluaran, foto layanan) |
| Monorepo | pnpm workspace: `apps/web` (Next.js), `packages/shared` (types, enums, konstanta) |
| Waktu server | Semua timestamp UTC di database; ditampilkan sebagai Asia/Jakarta |

**Struktur folder (BINDING):**
```
apps/web/
  app/                    # pages (portal publik + /admin dashboard)
  app/api/v1/...          # REST API
  lib/                    # prisma client, auth helpers, dll
packages/shared/
  types/ enums/ constants/
docs/
  PRD.md  DB-SCHEMA.md  API-CONTRACT.md
```

---

## 4. Deployment

### Fase 1 (Sekarang): Vercel + Supabase
- Frontend + API: Vercel (satu project Next.js)
- Database: Supabase Postgres (region Singapore)
- Storage: Supabase Storage
- Backup: fitur backup Supabase (minimum harian)

### Fase 2 (Kedepannya): VPS + Docker Compose
Desain wajib portable: TIDAK boleh memakai fitur Vercel-only di
business logic (cron via Vercel boleh, tapi logic di dalam kode).
Konfigurasi via environment variables, tanpa hardcoded URL.

**Environment variables (wajib):**
```
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
SEED_OWNER_EMAIL=
SEED_OWNER_PASSWORD=
APP_URL=
```

---

## 5. Roles & Permissions (BINDING)

Role = enum fixed pada `users.role`: `OWNER | MANAGER | CASHIER | EMPLOYEE`.
Tidak ada tabel role. Tidak ada role editor. Mapping permission
disimpan sebagai konstanta di `packages/shared/constants/permissions.ts`.

**Aturan dasar:**
- Hanya ada 1 endpoint registrasi user, dan hanya OWNER yang boleh mengaksesnya.
- OWNER tidak butuh branch assignment (akses semua cabang).
- SEMUA user non-OWNER wajib punya `employee_id` (relasi ke Employee).
- User non-OWNER wajib punya minimal 1 branch assignment
  (reuse `EmployeeBranch`). `branch_id` aktif disimpan di JWT
  saat login / `POST /api/v1/auth/switch-branch`.
- Semua endpoint operasional mengambil `branch_id` dari JWT,
  BUKAN dari query/body. Server tolak jika ada `branch_id` dari client.
- Semua role non-OWNER otomatis mewarisi permission EMPLOYEE
  (absen & ajukan cuti/izin untuk diri sendiri).

### Matriks Permission

| Fitur | OWNER | MANAGER | CASHIER | EMPLOYEE |
|---|---|---|---|---|
| User management | ✅ | ❌ | ❌ | ❌ |
| Branch management | ✅ | ❌ | ❌ | ❌ |
| Master data (layanan, produk, bahan, kategori) CRUD | ✅ | ❌ | ❌ | ❌ |
| Master data: read | ✅ | ✅ | ✅ | ❌ |
| POS: buat transaksi & bayar | ✅ | ❌ | ✅ | ❌ |
| Cancel transaksi PAID | ✅* | ❌ | ❌ | ❌ |
| Cash closing (buat) | ✅ | ❌ | ✅ | ❌ |
| Cash closing: reopen | ✅ | ❌ | ❌ | ❌ |
| Stock in (barang masuk) | ✅ | ✅ | ❌ | ❌ |
| Stock opname (buat & submit) | ✅ | ✅ | ❌ | ❌ |
| Laporan stok | ✅ | ✅ | ❌ | ❌ |
| Pengeluaran: buat | ✅ | ✅ | ❌ | ❌ |
| Laporan pengeluaran | ✅ | ✅ | ❌ | ❌ |
| Absensi: check-in/out sendiri | ✅ | ✅ | ✅ | ✅ |
| Data absensi semua karyawan | ✅ | ✅ | ❌ | ❌ |
| Ajukan cuti/izin | ✅ | ✅ | ✅ | ✅ |
| Setujui/tolak cuti/izin | ✅ | ✅ | ❌ | ❌ |
| Laporan penjualan & konsolidasi | ✅ | ❌ | ❌ | ❌ |
| Audit log | ✅ | ❌ | ❌ | ❌ |
| Konten portal publik (halaman statis) | ✅ | ❌ | ❌ | ❌ |

\* Cancel transaksi PAID yang sudah masuk periode closing tetap boleh
oleh OWNER (lihat 7.7).

**Kasir vs Manager:** keduanya role berbeda dan TIDAK saling mewarisi.
Cashier tidak bisa akses inventaris; Manager tidak bisa akses POS.

---

## 6. Konvensi Global (BINDING)

### 6.1 Response format
```json
// Sukses
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 143, "totalPages": 8 } }
// Error
{ "success": false, "message": "human-readable", "code": "MACHINE_CODE" }
```
Pagination: `?page=1&limit=20`, default 20, max 100.

### 6.2 Kode error standar
`VALIDATION_ERROR`(400) `UNAUTHORIZED`(401) `FORBIDDEN`(403)
`BRANCH_ACCESS_DENIED`(403) `NOT_FOUND`(404) `INSUFFICIENT_STOCK`(409)
`INVALID_TRANSACTION_STATE`(409) `CLOSING_PERIOD_LOCKED`(409)
`SCHEDULE_OVERLAP`(409) `INTERNAL_ERROR`(500)

### 6.3 Prinsip lintas modul
1. **Atomic flow**: transaksi POS = stok + pembayaran + nomor dalam SATU
   database transaction. Gagal satu = gagal semua.
2. **Snapshot harga**: `transaction_items` menyimpan salinan
   `name`, `price`, `unit` saat transaksi. Edit master TIDAK mengubah histori.
3. **Stok tidak boleh negatif**: server tolak (`INSUFFICIENT_STOCK`).
4. **Semua aksi write → audit log** (`actor_id`, `action`, `entity`,
   `entity_id`, `before`, `after`, `ip`, `created_at`).
5. **Tanggal operasional dari server** (Asia/Jakarta), tidak pernah dari client.
6. **Soft delete** (`deleted_at`) untuk master data yang sudah dipakai
   transaksi; hard delete hanya untuk data yang belum pernah dipakai.
7. **Immutable**: transaksi `PAID`, `CANCELLED`, cash closing `CLOSED`,
   dan audit log tidak boleh di-update.

## 6.4 FRONTEND DESIGN SYSTEM (BINDING)

Seluruh implementasi frontend WAJIB mengikuti design system yang terdokumentasi di:

```text
docs/ui-design-system.md
```

Ketentuan:

1. **Status: BINDING.** File tersebut berlaku sebagai kontrak UI, setara
   kedudukannya dengan API-CONTRACT untuk backend.
2. **Pembagian kewenangan:**
   - Persoalan tampilan/visual (warna, tipografi, komponen, state, format
     tampilan) → `docs/ui-design-system.md` yang menang.
   - Persoalan logika/data (bentuk request/response, validasi, alur bisnis)
     → API-CONTRACT yang menang.
3. **Wajib dibaca di Langkah 0** setiap tugas frontend. Bagian design system
   yang relevan dengan tugas tersebut wajib dikutip dalam laporan Langkah 0
   (sama seperti kutipan API-CONTRACT).
4. **Self-check kepatuhan** (§25 ui-design-system.md) wajib dieksekusi dan
   hasilnya dilaporkan di evidence setiap tugas frontend, sebagai bagian
   dari definisi "selesai".
5. Pelanggaran design system ditangani sama seperti pelanggaran kontrak API:
   ditolak pada review, wajib diperbaiki sebelum commit.

---

## 7. Modul

### 7.1 Auth
- Login: email + password (bcrypt, cost 10+).
- Logout: revoke refresh token.
- `POST /api/v1/auth/switch-branch`: ganti branch aktif → token baru.
  Hanya ke branch yang ada di assignment user.
- Owner pertama dibuat via seed script (`prisma db seed`) dari env var.
- Tidak ada registrasi publik, tidak ada self-service reset password
  di MVP (reset oleh OWNER).

### 7.2 Branch Management (Owner)
- CRUD cabang: `name`, `code` (unique, 3–5 huruf, mis. `JKT`), `address`,
  `phone`, `active`.
- Cabang tidak boleh dihapus jika masih punya transaksi → nonaktifkan saja.

### 7.3 Employee, Attendance & Leave
**Employee master (Owner):** `name`, `phone`, `position` (teks bebas,
mis. "Dokter Gigi", "Kasir"), `branch assignment` (multi), `active`.
Employee boleh punya 0..1 user account (dibuat terpisah oleh Owner).

**Absensi (karyawan self-service):**
- `POST /attendance/check-in` → catat server time + branch aktif.
- `POST /attendance/check-out`.
- Aturan: 1 record per karyawan per hari per cabang. Check-in ganda ditolak.
  Check-out tanpa check-in ditolak.
- Status: dihitung server — `PRESENT` (≤ jam masuk default 08:00),
  `LATE` (di atasnya). Jam masuk/kerja per branch configurable.
- Owner/Manager: read semua; Owner boleh koreksi manual (wajib alasan,
  audit log). Manager read-only.
- Karyawan melihat riwayat sendiri.

**Pengajuan Cuti/Izin:**
- `POST /leave-requests`: `type` (CUTI | IZIN | SAKIT), `start_date`,
  `end_date`, `reason` (min 10 karakter). Boleh backdate maksimal 1 hari.
- Status: `PENDING → APPROVED | REJECTED` (oleh OWNER atau MANAGER).
- Tidak boleh tanggal bentrok dengan pengajuan pending/approved milik sendiri.
- Tidak boleh edit setelah diputus. PENDING bisa dibatalkan sendiri oleh pengaju.

### 7.4 Master Data (Owner)
Tiga katalog terpisah:
1. **Service (Layanan):** `name`, `description`, `price`, `duration_minutes`,
   `active`, `show_on_portal`. Dipakai di POS + portal publik (dinamis).
2. **Product (Produk jual):** `name`, `sku` (unique), `sell_price`,
   `unit`, `min_stock`, `active`. Stok per branch.
3. **Material (Bahan):** `name`, `sku` (unique), `unit`, `min_stock`,
   `active`, `is_stock_tracked`. Bahan tidak dijual, hanya dipakai/stok.

`min_stock` hidup di master (satu nilai global), perbandingan stok dilakukan
per branch terhadap nilai master ini. Tidak ada override per branch di MVP.

### 7.5 POS — Transaksi
**Flow kasir:** pilih layanan/produk → (opsional isi nama & HP pasien) →
diskon (wajib alasan) → pilih metode bayar (boleh split: CASH, DEBIT,
QRIS/TRANSFER — dicatat manual, tanpa integrasi gateway) → bayar →
kunci jadi `PAID` → cetak struk (browser print).

**Status:** `DRAFT → PAID → CANCELLED`. Tidak ada status lain.
- `DRAFT` boleh diedit/dibuang. `PAID` immutable (kecuali cancel 7.7).
- Hanya boleh PAID jika hari operasional = hari ini (server, Asia/Jakarta)
  dan periode belum ditutup cash closing. Pelanggaran → `CLOSING_PERIOD_LOCKED`.

**Acceptance criteria (contoh wajib):**
- Given stok produk 3, When kasir menjual 4, Then 409 `INSUFFICIENT_STOCK`
  dan TIDAK ADA record yang tersimpan.
- Given transaksi berhasil, When dilihat 1 tahun kemudian, Then harga item
  sama dengan saat transaksi (snapshot), meski master price sudah berubah.

### 7.6 Inventory
- Movement ledger: setiap perubahan stok = baris `inventory_movements`
  (`branch_id`, `item_type` PRODUCT|MATERIAL, `item_id`, `quantity_delta`,
  `reference_type` (STOCK_IN | TRANSACTION | MANUAL_ADJUSTMENT | DAMAGE |
  EXPIRED | OPNAME), `reference_id`, `notes`, `created_by`, `created_at`).
  **Stok saat ini selalu dihitung/di-cache dari movement — tidak ada
  update stok langsung tanpa movement.**
- Stock in (Owner + Manager): tambah stok, wajib catat biaya opsional.
- Kartu stok per item per branch (riwayat movement) — read-only.
- Peringatan stok < min_stock di dashboard Manager.

### 7.7 Stock Opname
- 1 opname = 1 branch, 1 tanggal, list item + `system_qty` (read-only)
  + `physical_qty` + `note`.
- Status: `DRAFT → SUBMITTED` (final, immutable).
- Saat SUBMIT: generate `MANUAL_ADJUSTMENT` movements untuk selisih,
  dalam satu database transaction. Selisih tidak boleh mengubah stok
  jadi negatif (tolak submit jika ya).
- Owner + Manager boleh membuat & submit.

### 7.8 Pengeluaran (Expenses)
- `POST /expenses`: `category` (enum: OPERASIONAL | GAJI | SEWA | UTILITAS |
  SUPPLIER | LAINNYA), `amount` (>0), `expense_date` (<= hari ini),
  `note`, `
proof_url (nullable, gambar dari Supabase Storage, max 2MB)`.

Status: RECORDED (final, immutable). Koreksi = buat expense
negatif baru terpisah dengan referensi expense asli di note.
Read: Owner + Manager (semua branch untuk Owner; branch aktif
untuk Manager).
> ⚠️ The response reached the length limit. Reply **continue** to get the rest.
### 7.9 Cash Closing (Kas Harian)
- 1 closing per branch, mencakup semua transaksi CASH `PAID`
  dengan `transaction_date` sejak closing sebelumnya sampai sekarang.
  Aturan kunci:
    1.Hanya 1 closing aktif per branch. Closing baru hanya boleh
    dibuat jika closing sebelumnya berstatus `CLOSED`.
    2.Setelah closing, transaksi PAID baru dengan tanggal dalam
    periode yang sudah tertutup DITOLAK (`CLOSING_PERIOD_LOCKED`).
    3.Tanggal closing dari server, bukan input bebas client.
- Flow: sistem hitung `expected_cash` (total CASH dari transaksi +
  cash in − pengeluaran cash sejak closing terakhir, bila ada) →
  kasir hitung fisik → input `actual_cash` → selisih `variance`
  tersimpan otomatis → submit → status `CLOSED` (immutable).
- Reopen HANYA oleh OWNER via `POST /api/v1/cash-closings/:id/reopen`
  dengan alasan wajib → status kembali `OPEN`, audit log dibuat.
- Cancel transaksi yang sudah masuk periode closing TETAP boleh
  oleh OWNER; payment tersimpan sebagai histori, stok dikembalikan,
  dan selisih kas menjadi tanggung jawab operasional (tercatat di
  audit log + note). Tidak mengubah `expected_cash` closing yang
  sudah final.
### 7.10 Portal Pub (dinamis, multibahasa ID/EN)
- Route: / dan subhalaman; bahasa via `?lang=en` atau path prefix
  /en (pilih salah satu; rekomendasi: path prefix /en, default ID).
- Konten dinamis dari dashboard:
  - Halaman statis (Profil, Kontak, dll.): tabel portal_pages
    (slug, title_id, title_en, content_id, content_en,
    published). Editor teks sederhana (textarea; WYSIWYG boleh
    jika mudah via library).
  - Daftar layanan & harga: dari master Service (show_on_portal=true),
    nama & deskripsi versi ID/EN (name_en, description_en opsional —
    fallback ke versi ID).
  - Branch info: dari master Branch.
- SEO: metadata dinamis, sitemap, mobile-first.
- Tidak ada booking online di MVP — hanya CTA WhatsApp/telpon.
### 7.11 Laporan
- Owner (semua cabang): penjualan per periode (filter tanggal +
  branch, metode bayar), konsolidasi multi-cabang, pengeluaran,
  laba kotor (penjualan − biaya stock in − pengeluaran),
  peringatan stok.
- Manager: laporan stok, opname, pengeluaran, absensi (branch aktif).
- Export CSV untuk semua laporan. Tidak ada PDF report di MVP
  (struk POS tetap print).
### 7.12 Dashboard (per role)
- Kasir: ringkasan hari ini (transaksi, omset, metode bayar), tombol
  POS & closing.
- Manager: stok < min_stock, opname pending, pengajuan cuti pending,
  absensi hari ini.
- Owner: ringkasan semua cabang + trending 7 hari.
### 8. Acceptance Criteria Global (wajib dipenuhi sebelum "selesai")
1.  Login → JWT httpOnly cookie → dashboard sesuai role.
2.  Kasir cabang A TIDAK bisa melihat/mengubah data cabang B
    (uji dengan token manual tanpa UI).
3.  Jual produk melebihi stok → 409, tidak ada side-effect di database.
4.  Snapshot harga: ubah harga master → transaksi lama tidak berubah.
5.  Tidak bisa membuat transaksi PAID di periode yang sudah di-closing.
6.  Cancel transaksi → stok kembali, payment histori tersimpan, audit log ada.
7.  Stock opname submit → movement adjustment terbuat otomatis, atomik.
8.  Non-OWNER tidak bisa akses endpoint user management (403).
9.  Semua list endpoint punya pagination & format response konsisten.
10. Portal publik menampilkan layanan dari master data (ubah di dashboard
    → berubah di portal) dalam ID dan EN.
11. pnpm build sukses tanpa error TypeScript.
12. Seed: owner + 2 cabang + master data contoh.
### 9. Aturan Implementasi untuk AI Agent (BINDING)
1.  Kerjakan fase demi fase (urutan di Bagian 11), jangan lompat.
    Setiap fase harus lolos pnpm build + dev server jalan sebelum lanjut.
2.  Setiap endpoint: Zod validation → cek auth → cek role → cek branch
    → logic → response konvensi 6.1. Tidak ada exception.
3.  Semua write multi-tabel dalam satu prisma.$transaction.
4.  Jangan buat tabel/kolom di luar DB-SCHEMA.md. Jangan buat endpoint
    di luar API-CONTRACT.md. Ingin menambah → tanyakan dulu.
5.  Tidak ada data dummy di kode; semua via seed script.
6.  Error jangan di-swallow; gunakan error handler terpusat.
7.  Comment kode dalam bahasa Indonesia untuk logic yang tidak trivial.
8.  Jika instruksi user bertentangan dengan PRD ini, tunjukkan konfliknya
    dan minta keputusan.
### 10. Urutan Fase Implementasi
Fase	Isi
  0.	Setup monorepo, Prisma schema, migrate, seed, auth lengkap
  1.	Branch + Employee + User management
  2.	Master data (Service, Product, Material, kategori)
  3.	POS + Inventory movements (inti — paling teliti)
  4.	Cash closing + cancel transaksi
  5.	Stock in, stock opname, kartu stok
  6.	Absensi + cuti/izin + pengeluaran
  7.	Laporan + dashboard per role + audit log viewer
  8.	Portal publik multibahasa + konten dinamis
# AGENTS.md — Instruksi AI Agent (WAJIB DIBACA DULU)

Project: **OASE Dental Clinic Management System**
Solo developer dibantu AI. Kode akan di-review manusia — tulis dengan rapi.

---

## 1. Sumber Kebaharuan (Urutan Prioritas)

Jika ada konflik antar dokumen, urutan kebenaran:

1. Instruksi langsung dari user di percakapan (tapi lihat aturan 8 di bawah)
2. `docs/PRD.md` (v2.0)
3. `docs/API-CONTRACT.md` (v2.0)
4. `docs/DB-SCHEMA.md` (v2.0)
5. `docs/ui-design-system.md` — spesifikasi visual lengkap (BINDING untuk
   semua tugas frontend; menang atas PRD dalam persoalan tampilan/visual)
6. Kode yang sudah ada di repo

Baca semua file di `docs/` SEBELUM menulis kode apa pun.

---

## 2. Aturan Mutlak (Pelanggaran = Kerja Ulang)

1. **Jangan mengarang.** Jika sesuatu tidak tercakup di dokumen
   (endpoint baru, tabel baru, kolom baru, fitur baru) → STOP dan
   tanyakan ke user. Jangan berasumsi.
2. **Jangan menambah file/dependency di luar yang diperlukan.**
   Setiap dependency baru harus disebutkan alasannya.
3. **Stack tidak boleh diubah.** Next.js 14 App Router + TypeScript
   strict + Prisma + PostgreSQL (Supabase) + Tailwind + shadcn/ui +
   TanStack Query + Zod + jose (JWT). Dilarang menambah Redux,
   Express, NestJS, atau ORM lain.
4. **Dilarang SQL/DDL manual.** Perubahan schema HANYA via
   `prisma migrate dev`.
5. **Semua uang = `Decimal(12,2)`.** Tidak ada Float untuk uang.
6. **Semua write multi-tabel = satu `prisma.$transaction`.**
7. **`branchId` tidak pernah dari client** — selalu dari JWT claim.
8. **Jika instruksi user bertentangan dengan PRD**, tunjukkan
   konfliknya dan minta keputusan sebelum eksekusi. Jangan diam-diam
   mengubah PRD atau mengabaikan PRD.
8a. **Jika premis instruksi tidak sesuai kondisi repo** (endpoint/
    dokumen/file yang diasumsikan sudah ada ternyata belum
    diimplementasi) → STOP dan melapor. Mengeksekusi sendiri
    "agar tugas selesai" dilarang, sebagus apapun hasilnya.
8b. **Endpoint baru tidak dianggap selesai sebelum response
    shape-nya terdokumentasi di API-CONTRACT.md** pada commit
    yang sama.
9. **Tidak ada data dummy di kode.** Semua via seed script.
10. **Tidak ada `any` di TypeScript.** Error jangan di-swallow.
11. **`docs/ui-design-system.md` wajib dipatuhi pada setiap tugas
    frontend.** Wajib dibaca pada Langkah 0; bagian yang relevan wajib
    dikutip dalam laporan; self-check kepatuhan (§25 design system)
    wajib dilaporkan di evidence. Hardcoded hex di komponen, komponen
    duplicate di luar `components/ui/`, dan pelanggaran format data
    (Rupiah / Asia-Jakarta) = kerja ulang.
12. **Verifikasi visual wajib untuk fitur frontend:** test suite
    API tidak menjalankan hydration React maupun kode client —
    status HTTP 200 tidak membuktikan halaman berfungsi. Sebelum
    commit: walkthrough manual di browser + DevTools Network;
    tidak boleh ada request gagal (4xx/5xx) yang tidak dijelaskan.
13. **Pola data-fetching client = TanStack Query;**
    QueryClientProvider dideklarasikan di `admin-shell.tsx`
    SEBELUM hook dipakai di view/komponen anak.
14. **Perubahan file di luar batas tugas WAJIB dilaporkan di AWAL
    laporan dengan alasan** — tidak boleh tersembunyi di daftar
    file.
15. **Setiap guard sesi/redirect wajib diuji skenario ghost token**
    (cookie valid di client, invalid/revoked di DB) dan dibuktikan
    berakhir di form login — bukan infinite redirect loop. Guard
    yang memindahkan user HANYA boleh berbasis status sesi
    TERVALIDASI (user dari /auth/me), dilarang berbasis presence
    cookie. Simulasi alur loop wajib diuraikan di laporan.
    Berlaku juga untuk skenario role: modul ber-cabang wajib
    diuji dua persona — role DENGAN cabang aktif (MANAGER/
    KASHIER) dan role TANPA cabang aktif (OWNER, activeBranchId
    null) — keduanya wajib berakhir pada UX yang benar, bukan
    pesan error guard. Skenario ini lahir dari bug nyata Tugas 4
    (OWNER terblokir kartu stok meski 104 test PASS).
16. **Aturan Lingkungan & Proteksi Database (Anti-Menyiram DB):**
    - `.env` lokal = Docker/Postgres dev lokal, PERMANEN.
    - Kredensial staging/remote HIDUP di env var per-perintah
      terminal atau file terpisah yang ter-gitignore (misal
      `.env.staging`) — TIDAK PERNAH di `.env`.
    - Test suite (`run-all-regression.mjs`) WAJIB menolak jalan
      jika `DATABASE_URL` mengandung kata `"supabase"`, `"pooler."`,
      atau `"staging"` (guard 3 baris di awal runner).
    - Pelanggaran = test suite menyiram database staging atau
      — jauh lebih fatal nanti — database produksi klinik.

---

## 3. Workflow Kerja

- Kerjakan **satu fase per sesi** (urutan fase: PRD Bagian 10).
  Selesai fase = `pnpm build` sukses + dev server jalan.
- Sebelum mulai: nyatakan ringkas rencana kerja fase ini
  (file apa saja yang akan dibuat/diubah), tunggu konfirmasi user.
- **Langkah 0 untuk setiap tugas:** sebelum menulis kode, baca dokumen
  kontrak yang relevan (API-CONTRACT, PRD, ui-design-system.md untuk
  frontend), kutip bagian yang relevan dalam laporan, dan tunjukkan
  semua kebuntuan/kontrak diam — lalu TUNGGU keputusan. Jangan
  mengarang untuk menutup celah kontrak.
- **Langkah 0 juga wajib memverifikasi premis terhadap repo:** cek
  direktori `apps/web/app/api/v1/` dan `lib/services/` sebelum
  berasumsi endpoint sudah ada. Kontrak di dokumen tidak berarti kode
  sudah ada.
- Setelah selesai fase: tulis ringkasan yang sudah dibuat + cara
  menguji manual + daftar hal yang belum selesai (jika ada).
- Jangan menyentuh modul fase lain "sekalian biar lengkap".
- Sebelum menulis kode, agent WAJIB memastikan semua package yang
  dibutuhkan fase ini tercantum di rencana kerja beserta perintah
  instalasinya (mis. `pnpm add jose bcryptjs @types/node`). Jika agent
  tidak punya akses terminal, tampilkan daftar perintah ke user untuk
  dijalankan manual sebelum lanjut.
- Saat mengedit file di docs (terutama prisma/schema.prisma), tulis
  ulang file secara utuh atau edit blok yang presisi. Setelah selesai,
  WAJIB jalankan `prisma validate` dan tampilkan outputnya sebelum
  melanjutkan langkah berikutnya.
- **Tanpa persetujuan eksplisit user: tidak ada commit.** Commit hanya
  setelah review lulus dan user memberi instruksi commit.

---

## 4. Pola Wajib per Endpoint

Urutan di setiap route handler:

```
Zod parse body/query → auth (JWT cookie) → role check →
branch check → handler logic → response helper
```

- Response sukses: `ok(data, meta?)` → `{ success: true, data, meta? }`
- Response error: `fail(code, message)` →
  `{ success: false, message, code }`
- Kode error standar: lihat PRD Bagian 6.2.
- Pagination semua GET list: `?page&limit` (default 20, max 100).
- IDOR guard: akses by `:id` wajib verifikasi branch ownership
  untuk role non-OWNER.
- Logic jangan ditulis di route handler — taruh di `lib/services/*`.
  Handler tipis saja.

---

## 5. Struktur Repo

```
apps/web/            # Next.js (portal publik + /admin dashboard + API routes)
  app/api/v1/...     # REST API
  app/               # halaman frontend (login, /admin, dll.)
  components/        # komponen React (components/ui/ = reusable wajib)
  lib/services/      # business logic
  lib/               # prisma client, auth helper, response helper
  scripts/           # test suite regresi per tugas
  prisma/            # schema.prisma, migrations, seed.ts
packages/shared/     # types, enums, konstanta permission matrix
docs/                # PRD.md, DB-SCHEMA.md, API-CONTRACT.md, ui-design-system.md
```

Monorepo pnpm workspace. Jalankan apa pun dari root: `pnpm dev`,
`pnpm build`, `pnpm db:migrate`, `pnpm db:seed`.

---

## 6. Hal yang Sering Terlupakan (checklist sebelum selesai fase)

- [ ] Snapshot harga/nama di `transaction_items` (bukan join master)
- [ ] `StockLevel` dan `InventoryMovement` di-update dalam transaction yang sama
- [ ] Stok tidak boleh negatif → 409 `INSUFFICIENT_STOCK` + rollback total
- [ ] Tanggal operasional dari server (Asia/Jakarta), bukan client
- [ ] Audit log untuk setiap aksi write
- [ ] Master data yang sudah dipakai transaksi: soft delete, bukan hard delete
- [ ] Transaksi PAID / closing CLOSED / opname SUBMITTED = immutable
- [ ] Semua GET list punya pagination
- [ ] Tidak ada password/token/PII di log
- [ ] Tidak ada token di localStorage (sesi = httpOnly cookie)
- [ ] Guard frontend = UX saja; penolakan keamanan tetap dari server (401/403)
- [ ] Self-check design system §25 dijalankan (tugas frontend) dan dilaporkan
- [ ] Response shape endpoint baru terdokumentasi di API-CONTRACT.md
- [ ] Walkthrough visual browser + DevTools Network bersih (frontend)
- [ ] `pnpm build` sukses tanpa error TypeScript + `pnpm lint` bersih
- [ ] Suite regresi yang ada tetap hijau (jangan ada yang rusak)

---

## 7. Batas Fungsional (Jangan Dibuat — Out of Scope v1)

Rekam medis, payment gateway, notifikasi otomatis (WA/email),
partial refund, payroll, multi-currency, pajak, mobile app,
tabel role dinamis, booking online di portal publik.

Jika user memintanya, ingatkan bahwa ini out-of-scope v1 dan minta
konfirmasi eksplisit untuk mengubah PRD sebelum dibangun.

---

## 8. Regresi & Bukti (definisi "selesai")

Sebuah tugas dianggap selesai HANYA jika:

1. Semua kriteria uji tugas tersebut hijau (output mentah dilaporkan).
2. Seluruh test suite regresi yang sudah ada tetap hijau.
3. `pnpm lint` + `pnpm build` bersih.
4. Keputusan desain yang diambil dilaporkan (keputusan + alasan).
5. Self-check kepatuhan (backend: aturan 5/6/7; frontend: design
   system §25) dilaporkan.
6. Verifikasi visual browser dilakukan untuk tugas frontend (aturan 12).
7. Tidak ada perubahan di luar batas tugas yang tidak dilaporkan
   (aturan 14).
8. Tidak ada commit tanpa persetujuan user.

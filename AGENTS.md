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
5. Kode yang sudah ada di repo

Baca ketiga file di `docs/` SEBELUM menulis kode apa pun.

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
9. **Tidak ada data dummy kode.** Semua via seed script.
10. **Tidak ada `any` di TypeScript.** Error jangan di-swallow.

---

## 3. Workflow Kerja

- Kerjakan **satu fase per sesi** (urutan fase: PRD Bagian 10).
  Selesai fase = `pnpm build` sukses + dev server jalan.
- Sebelum mulai: nyatakan ringkas rencana kerja fase ini
  (file apa saja yang akan dibuat/diubah), tunggu konfirmasi user.
- Setelah selesai fase: tulis ringkasan yang sudah dibuat + cara
  menguji manual + daftar hal yang belum selesai (jika ada).
- Jangan menyentuh modul fase lain "sekalian biar lengkap".
- Sebelum menulis kode, agent WAJIB memastikan semua package yang dibutuhkan fase ini tercantum di rencana kerja beserta        perintah instalasinya (mis. pnpm add jose bcryptjs @types/node). Jika agent tidak punya akses terminal, tampilkan daftar perintah ke user untuk dijalankan manual sebelum lanjut.
- Saat mengedit file yang ada di docs (terutama prisma/schema.prisma), tulis ulang file secara utuh atau edit blok yang presisi. Setelah selesai, WAJIB jalankan prisma validate dan tampilkan outputnya sebelum melanjutkan langkah berikutnya.
---

## 4. Pola Wajib per Endpoint

Urutan di setiap route handler:

```
Zod parse body/query → auth (JWT cookie) → role check →
branch check → handler logic → response helper
```

- Response sukses: `ok(data, meta?)` → `{ success: true, data, meta? }`
- Response error: `fail(code, message,)` →
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
  lib/services/      # business logic
  lib/               # prisma client, auth helper, response helper
packages/shared/     # types, enums, konstanta permission matrix
docs/                # PRD.md, DB-SCHEMA.md, API-CONTRACT.md
prisma/              # schema.prisma, migrations, seed.ts
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
- [ ] `pnpm build` sukses tanpa error TypeScript

---

## 7. Batas Fungsional (Jangan Dibuat — Out of Scope v1)

Rekam medis, payment gateway, notifikasi otomatis (WA/email),
partial refund, payroll, multi-currency, pajak, mobile app,
tabel role dinam, booking online di portal publik.

Jika user memintanya, ingatkan bahwa ini out-of-scope v1 dan minta
konfirmasi eksplisit untuk mengubah PRD sebelum dibangun.

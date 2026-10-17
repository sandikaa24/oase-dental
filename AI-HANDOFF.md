# 🦷 OASE DENTAL — AI HANDOFF & DEVELOPMENT GUIDE

> Dokumen ini ditulis agar AI assistant (Claude, Ox Alpha, Copilot, dll.) dapat
> melanjutkan pengembangan proyek ini tanpa kehilangan konteks.
> Terakhir diperbarui: setelah deploy commit `5f83927` (fitur jam operasional dinamis tuntas).

---

## 1. APA INI

Sistem manajemen klinik gigi multi-cabang (OASE Dental) dengan:

- **Web publik** (marketing site): homepage, /cabang, /layanan, dst.
- **Portal internal**: absensi geofence, stok, cabang, konten portal.
- **Dashboard owner**: kelola jam operasional per cabang (multi-shift), live ke seluruh situs.

Owner: **Sandika** (GitHub: `sandikaa24`). Bahasa komunikasi: **Indonesia**.

## 2. LOKASI & STACK

| Hal | Nilai |
|---|---|
| Root proyek | `D:\OASE` |
| Monorepo | pnpm workspace, app utama di `apps/web` |
| Framework | Next.js (App Router, `(public)` route group untuk situs publik) |
| DB | PostgreSQL via **Supabase** (project `japwlbqitbkeywidkkzt`, region ap-southeast-1) |
| ORM | Prisma — schema di `apps/web/prisma/schema.prisma` |
| Deploy | **Vercel**, produksi: `https://oase-dental.vercel.app` (GitHub → auto-deploy dari `main`) |
| Repo | `github.com/sandikaa24/oase-dental` |
| Remote Vercel project | `sandikas-projects-dc22e8dc/oase-dental-web` |

## 3. KREDENSIAL & ENV

- File `apps/web/.env` (lokal) dan `apps/web/.env.staging`.
- **DATABASE_URL** memakai Supabase *pooler* port `6543` → **WAJIB** ada `?pgbouncer=true`.
- **DIRECT_URL** memakai port `5432` (direct) untuk migrasi Prisma.
- Env produksi dikelola di dashboard Vercel (bukan di repo).
- ⚠️ JANGAN pernah commit file `.env*` atau menempelkan kredensial ke chat/log publik.

## 4. ARSITEKTUR PENTING

### Jam operasional — SATU SUMBER KEBENARAN
- Sumber: tabel `Branch` (Prisma) — multi-shift per hari per cabang.
- **TIDAK BOLEH ADA jam hardcoded** (`08:00`, "Setiap Hari", "Buka:") di kode frontend.
- Semua konsumen jam membaca DB via `apps/web/lib/services/public.service.ts`:
  - Homepage seksi 7, footer (`public-footer.tsx`), halaman `/cabang`, JSON-LD Schema.org.
- JSON-LD `openingHoursSpecification`: 6 shift Senin–Sabtu, **tanpa Sunday** (klinik tutup Minggu).
- Payload API `getPublicBranches` **tanpa field `workingHours` legacy** (zero-leakage).
- Cache: ISR / revalidate ±60 detik.

### Prisma client
- `apps/web/lib/prisma.ts` sudah menangani pgbouncer otomatis. Jangan diubah asal-asalan.

### Absensi geofence
- Radius 100M ketat. Di klinik → 201, di luar → 403. Uji via test suite task 7.

### Portal content
- `apps/web/lib/services/portal-content.service.ts` — query dibuat resilient (jangan buat build gagal karena data kosong).

## 5. SKRIP & TESTING

| Perintah | Fungsi |
|---|---|
| `pnpm --filter @oase/web dev` | Dev server (localhost:3000) |
| `pnpm lint` / `pnpm build` | Wajib bersih sebelum commit |
| `node apps/web/scripts/run-all-regression.mjs` | **29 suite regresi (954 test) — wajib 100% hijau** |
| `node apps/web/scripts/probe-deploy.mjs` | Probe live produksi (cek jam DB, bebas legacy, JSON-LD) |
| `node apps/web/scripts/task-c1-public-web-test.mjs` | Test situs publik (82 assertion) |
| `pnpm db:seed` / `pnpm db:reset` | Seed / reset DB lokal |

Konvensi: test suite bernama `phaseN-taskX-test.mjs`. Jika mengubah fitur publik,
jalankan regresi penuh + probe-deploy setelah deploy.

## 6. ALUR KERJA YANG SUDAH TERBUKTI (IKUTI INI)

1. **Sebelum coding**: baca file relevan, jangan menebak struktur.
2. **Coding**: perubahan kecil & fokus; satu commit = satu maksud.
3. **Uji lokal dulu**: `pnpm lint` → `pnpm build` → regresi penuh.
4. **Tanya owner SEBELUM push**: commit di luar persetujuan = pelanggaran proses
   (sudah pernah dicatat; laporkan dulu apa & kenapa, tunggu "ya").
5. **Push → tunggu deploy Vercel** (cek via GitHub commit statuses API, bukan asumsi).
6. **Probe live**: `node apps/web/scripts/probe-deploy.mjs` — wajib PASS sebelum lapor selesai.
7. **Laporan**: sertakan commit SHA, status Vercel (READY), hasil probe, hasil test, dan
   konfirmasi apakah ada migrasi DB.

## 7. CATATAN DEPLOYMENT (PELAJARAN BIAR TIDAK DIULANG)

- Build Vercel pernah **gagal** karena static generation → koneksi pooler Supabase.
  Solusi: parameter `pgbouncer=true` (sudah permanen). Jika build gagal lagi dengan
  error koneksi, cek dulu ini.
- Verifikasi build lokal dengan env staging (`apps/web/.env.staging`) SEBELUM push.
- Cek status deploy: `GET api.github.com/repos/sandikaa24/oase-dental/commits/<sha>/statuses`
  (header `User-Agent` wajib).
- `npx vercel inspect <deployment-id> --logs` untuk log build jika ada token vercel.

## 8. GAYA KERJA OWNER (PENTING UNTUK AI)

- Owner menginginkan: **jujur, terbuka, laporan konkret dengan angka/bukti**, bukan klaim.
- AI harus **identifikasi diri sebagai dirinya sendiri**, tidak menyembunyikan pihak di baliknya.
- Jangan pernah pura-pura sukses; jika gagal, laporkan gagal + penyebab + rencana.
- Owner menyukai ringkasan tabel status di akhir pekerjaan.
- Bahasa Indonesia santai-profesional; boleh ada humor ringan, tetap presisi teknis.

## 9. PETA FILE KRITIS

apps/web/
├── prisma/schema.prisma # model Branch (jam multi-shift), dll.
├── lib/prisma.ts # client + pgbouncer
├── lib/services/public.service.ts # getPublicBranches (TANPA workingHours legacy)
├── lib/services/portal-content.service.ts
├── app/(public)/
│ ├── layout.tsx # footer global
│ ├── page.tsx # homepage (seksi 7 = jam operasional)
│ └── cabang/page.tsx
├── components/public/public-footer.tsx
├── components/public/whatsapp-floating-btn.tsx
└── scripts/
├── run-all-regression.mjs # runner 29 suite
├── probe-deploy.mjs # probe live produksi
└── phase*-task*-test.mjs # suite per fitur


## 10. STATUS SAAT DOKUMEN INI DITULIS

- ✅ Editor jam operasional multi-shift per cabang (live)
- ✅ Semua tampilan publik membaca DB; legacy `08:00` hilang total (render + payload)
- ✅ JSON-LD tanpa Sunday; deploy produksi READY; regresi 954/954
- ⏳ Belum / backlog owner:
  - Pin koordinat (lat/lng) cabang JKT & BDG untuk geofence
  - Uji absensi end-to-end dari HP asli
  - (Tambahkan item baru di sini ke depannya)

---

## CARA MEMAKAI DOKUMEN INI (UNTUK OWNER)

Saat mulai sesi baru dengan AI, tempel/arahkan AI membaca file ini, lalu katakan misalnya:

> "Baca AI-HANDOFF.md. Saya ingin menambah fitur X. Ikuti alur kerja di dokumen itu."

AI yang membaca dokumen ini akan tahu: stack-nya, di mana file penting, aturan
jam operasional, perintah test, alur deploy yang aman, dan gaya komunikasi Anda.

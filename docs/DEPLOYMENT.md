# Panduan Deployment & Production Readiness — OASE Dental Clinic

Dokumen ini adalah spesifikasi panduan operasional deployment sistem OASE Dental Clinic Management System untuk lingkungan **Staging (Vercel)** dan **Production (Self-Hosted VPS Docker)**.

---

## 1. Arsitektur Dua Jalur Deployment (Dual-Path Strategy)

Sistem OASE dirancang dengan fleksibilitas deployment sesuai kebutuhan:

| Aspek | Staging / Preview | Production (Opsi A) |
|---|---|---|
| **Platform** | Vercel (Serverless Next.js) | VPS Ubuntu Linux (Docker Compose) |
| **Database** | Supabase Postgres (Managed) | PostgreSQL 16 Alpine (Self-Hosted Docker) |
| **File Storage** | Supabase Storage / Mock | Local Persistent Volume (`/app/uploads`) |
| **Reverse Proxy** | Vercel Edge Gateway | Caddy Server (Automated HTTPS/Let's Encrypt) |
| **Tujuan** | Verifikasi fitur, review UI, staging | Operasional klinik live, kedaulatan data penuh |

---

## 2. Panduan Deployment VPS Production (Docker Compose)

### 2.1 Prasyarat Server VPS
- **OS**: Ubuntu 22.04 LTS atau 24.04 LTS (x86_64 / ARM64).
- **Spesifikasi Minimal**: 2 vCPU, 2 GB RAM (disarankan 4 GB untuk build), 40 GB SSD.
- **Tools**: Docker Engine versi 24+ & Docker Compose Plugin.
- **Port Terbuka**: 80 (HTTP) dan 443 (HTTPS) pada firewall UFW.

### 2.2 Langkah Instalasi & Bootstrap
1. **Clone Repository**:
   ```bash
   git clone https://github.com/sandikaa24/oase-dental.git /opt/oase
   cd /opt/oase
   ```

2. **Konfigurasi Environment Production**:
   Salin template dan sesuaikan isian kredensial:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Pastikan variabel kunci berikut diisi dengan nilai rahasia acak yang kuat:
   - `POSTGRES_PASSWORD`: Password database PostgreSQL.
   - `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET`: Minimal 32 karakter acak (dibuat via `openssl rand -base64 48`).
   - `APP_URL` & `APP_DOMAIN`: Domain klinik aktif (misal `klinik.oase.id`).
   - `SEED_OWNER_EMAIL` & `SEED_OWNER_PASSWORD`: Akun Owner pertama (password minimal 12 karakter).

3. **Build & Jalankan Kontainer**:
   ```bash
   docker compose build --no-cache
   docker compose up -d
   ```
   Periksa status kontainer:
   ```bash
   docker compose ps
   ```
   Pastikan `oase-postgres` (healthy), `oase-app`, dan `oase-caddy` berjalan normal.

---

## 3. Database Migration & Production Seeding

> [!CAUTION]
> **DILARANG MENGGUNAKAN `prisma migrate dev` ATAU `db:reset` DI PRODUCTION!**
> Perintah `migrate dev` dapat merusak skema dan `db:reset` akan menghapus seluruh data transaksi pasien.

Saat pertama kali `docker compose up -d` dijalankan, kontainer PostgreSQL `oase-postgres` masih kosong dan belum memiliki relasi tabel. Lakukan inisialisasi skema database melalui salah satu alur berikut:

### 3.1 Alur Migrasi Database (Pilih salah satu)
- **Opsi A (Direkomendasikan via Host Server)**: Jalankan migrasi dari host server yang memiliki pnpm dan repository OASE:
  ```bash
  DATABASE_URL="postgresql://oase_user:<PASSWORD>@localhost:5432/oase_db?schema=public" pnpm --filter @oase/web exec prisma migrate deploy
  ```
- **Opsi B (Langsung via CLI Postgres Container)**: Pipe file SQL migrasi langsung ke container database tanpa memerlukan Node.js di server:
  ```bash
  cat apps/web/prisma/migrations/*/migration.sql | docker exec -i oase-postgres psql -U oase_user -d oase_db
  ```

### 3.2 Menjalankan Seed Produksi (0 Data Dummy)
Setelah tabel database terbentuk, bootstrap akun Owner dan cabang utama:
```bash
NODE_ENV=production DATABASE_URL="postgresql://oase_user:<PASSWORD>@localhost:5432/oase_db?schema=public" pnpm db:seed:prod
```
Script `seed.prod.ts` memiliki proteksi ketat:
1. Menolak dieksekusi jika `NODE_ENV !== 'production'`.
2. Menolak dieksekusi jika password Owner kurang dari 12 karakter.
3. Idempoten (menggunakan upsert) sehingga aman jika dijalankan ulang.
4. Hanya membuat:
   - 1 Akun `OWNER` (dari `SEED_OWNER_EMAIL`).
   - 1 Cabang Pusat (dari `SEED_BRANCH_CODE` & `SEED_BRANCH_NAME`).
   - 1 Jam Operasional Cabang.
5. Nol data dummy (tidak ada data transaksi, kasir, atau pasien palsu).

---

## 4. Strategi Backup Otomatis & Retensi 7 Hari

Data klinik gigi adalah data sensitif yang wajib di-backup secara reguler. Terdapat 2 komponen data:
1. **Database PostgreSQL**: Relasi transaksi, rekam stok, absensi, pengeluaran, akun.
2. **Volume Uploads**: File bukti kuitansi/nota pengeluaran di `/app/uploads/expense-proofs`.

### 4.1 Script Backup Otomatis (`/opt/oase/scripts/backup.sh`)
Buat file skrip backup di VPS:
```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/backups/oase"
DATE=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "[$DATE] Memulai backup OASE Dental..."

# 1. Backup PostgreSQL
docker compose -f /opt/oase/docker-compose.yml exec -T postgres pg_dump -U oase_user oase_db | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# 2. Backup File Bukti Uploads
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C /var/lib/docker/volumes/oase-uploads-data/_data .

# 3. Rotasi Backup: Hapus file lebih lama dari 7 hari
find "$BACKUP_DIR" -type f -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "[$DATE] Backup selesai dan file > 7 hari dibersihkan."
```
Beri izin eksekusi:
```bash
chmod +x /opt/oase/scripts/backup.sh
```

### 4.2 Cron Job Harian
Jadwalkan backup dieksekusi setiap malam pukul 02:00 WIB via `crontab -e`:
```cron
0 2 * * * /opt/oase/scripts/backup.sh >> /var/log/oase-backup.log 2>&1
```

---

## 5. Jalur Staging (Vercel + Supabase `oase-staging`)

Jalur deployment Staging ditujukan untuk demo dan peninjauan fungsional/UI bersama klien. Staging menggunakan **Vercel Serverless** terhubung ke database **Supabase PostgreSQL `oase-staging`** (Region Singapore).

### 5.1 Pengaturan Project di Vercel Dashboard
1. **Import Repository**:
   - Buka [Vercel Dashboard](https://vercel.com/dashboard) → *Add New Project* → pilih repositori `sandikaa24/oase-dental`.
2. **Pengaturan Monorepo & Root Directory**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Klik *Edit*, pilih folder `apps/web`.
   - Pastikan opsi *"Include source files outside of the Root Directory in the Build Step"* dalam keadaan **AKTIF** (agar paket `@oase/shared` dan pnpm workspace terdeteksi).
3. **Region Serverless Function**:
   - Repositori telah dilengkapi file `vercel.json` yang mengunci region ke **`sin1`** (Singapore / AWS ap-southeast-1). Hal ini menempatkan komputasi serverless Vercel dalam satu fasilitas jaringan dengan database Supabase Singapore, meminimalkan latensi kueri.

### 5.2 Konfigurasi Environment Variables di Vercel
Tambahkan seluruh variabel lingkungan berikut pada tab **Project Settings > Environment Variables** (centang untuk *Production*, *Preview*, dan *Development* bila diperlukan):

| Nama Variabel | Contoh Format Nilai | Keterangan Wajib |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.[ref]:[pwd]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true` | **Wajib port 6543** + parameter `?pgbouncer=true` (PgBouncer Transaction Pooler untuk serverless). |
| `DIRECT_URL` | `postgresql://postgres.[ref]:[pwd]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` | **Wajib port 5432** direct connection (digunakan Prisma Client untuk validasi skema). |
| `JWT_ACCESS_SECRET` | *(string acak minimal 32 karakter)* | Kunci enkripsi token akses JWT sesi staging. |
| `JWT_REFRESH_SECRET` | *(string acak minimal 32 karakter)* | Kunci enkripsi refresh token staging. |
| `COOKIE_SECURE` | `true` | Wajib `true` karena domain Vercel berjalan pada HTTPS. |
| `NODE_ENV` | `production` | Mengaktifkan optimasi runtime produksi Next.js. |
| `APP_URL` | `https://oase-dental-staging.vercel.app` | URL domain Vercel staging Anda. |
| `STORAGE_DRIVER` | `supabase` | Mengaktifkan driver penyimpanan bukti nota ke Supabase Storage. |
| `SUPABASE_URL` | `https://[ref].supabase.co` | Endpoint REST project Supabase `oase-staging`. |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Kunci bypass RLS server-side untuk upload bukti nota ke bucket `expense-proofs`. |

> [!CAUTION]
> **JANGAN PERNAH MENYIMPAN KREDENSIAL DI FILE YANG DI-COMMIT KE GIT!**
> Seluruh kredensial rahasia di atas wajib dimasukkan langsung oleh Owner melalui Vercel dashboard.

### 5.3 Menjalankan Migrasi Skema ke Supabase Staging dari Lokal
Karena PgBouncer pooler (port 6543) tidak mendukung perintah DDL migrasi skema (`pg_advisory_lock`), eksekusi migrasi skema dijalankan sekali dari komputer lokal Owner melalui **connection direct (port 5432)**:

1. Buka terminal di komputer lokal dari root repositori `d:\OASE`.
2. Jalankan perintah migrasi Prisma dengan mengarahkan `DATABASE_URL` ke `DIRECT_URL`:
   ```powershell
   $env:DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
   pnpm --filter @oase/web exec prisma migrate deploy
   ```
3. Output akan menampilkan seluruh riwayat migrasi sukses diterapkan ke database Supabase staging.

### 5.4 Seeding Data Awal Staging
Setelah skema tabel terbentuk di Supabase staging, inisialisasi akun Owner dan cabang pusat menggunakan script produksi (0 dummy):

```powershell
$env:NODE_ENV="production"
$env:DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
$env:SEED_OWNER_EMAIL="owner@oasedental.id"
$env:SEED_OWNER_PASSWORD="password-owner-sangat-kuat-min-12-char"
$env:SEED_BRANCH_CODE="PUSAT"
$env:SEED_BRANCH_NAME="OASE Dental Clinic — Pusat"

pnpm db:seed:prod
```

Setelah akun Owner terbentuk, Owner dapat langsung login ke web staging Vercel dan membuat akun Manager serta Kasir melalui menu **Kelola Pengguna** (`/admin/users`).

### 5.5 Prosedur Reset Data Staging
Jika selama sesi review data transaksi staging telah kotor dan ingin direset kembali ke kondisi awal yang bersih:
1. Jalankan kueri pembersihan tabel transaksi operasional via Supabase SQL Editor:
   ```sql
   TRUNCATE TABLE transactions, transaction_items, cash_closings, expenses, stock_opnames, stock_opname_items, inventory_movements, attendances, leave_requests CASCADE;
   ```
2. Atau jalankan ulang migrasi bersih bila diperlukan:
   ```powershell
   $env:DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
   pnpm --filter @oase/web exec prisma migrate reset --force
   pnpm db:seed:prod
   ```

---

## 6. Aturan & Kebijakan Keamanan Krusial

### 6.1 Test Suite DILARANG Dijalankan ke Database Production
> [!CRITICAL]
> **JANGAN PERNAH MENJALANKAN `pnpm test` ATAU `run-all-regression.mjs` DENGAN `DATABASE_URL` PRODUCTION.**
> Test suite OASE dirancang end-to-end yang melakukan:
> - Pembersihan data closing kas (`prisma.cashClosing.deleteMany`).
> - Pembuatan kasir dan cabang uji dummy (`TST-*`, `CB*`, `SBY*`).
> - Koreksi absensi acak dan mutasi stok.
> Menjalankan test suite ke production akan merusak integritas buku kas klinik!

### 6.2 Supabase Dev-Only & Rotasi Kredensial
- Pada arsitektur produksi VPS (Opsi A), seluruh penyimpanan file dilakukan di volume lokal mandiri (`uploads-data`) di bawah kendali reverse proxy Caddy & Next.js route guard (`EXPENSE_REPORT`).
- Supabase bersifat **Dev-Only** atau Staging-Only.
- Kredensial `SUPABASE_SERVICE_ROLE_KEY` yang pernah dibagikan/terekspos di lingkungan komunikasi wajib segera dirotasi melalui dashboard Supabase sebelum rilis.

### 6.3 Limitasi In-Memory Rate Limiter pada Serverless
- Modul `apps/web/lib/rate-limit.ts` menggunakan sliding window berbasis in-memory `Map`.
- Pada lingkungan **VPS Docker (Production)**: Bekerja sempurna karena aplikasi berjalan sebagai single instance container yang persisten.
- Pada lingkungan **Serverless (Vercel Staging)**: Instance container Next.js bersifat stateless dan auto-scaled secara dinamis. Rate limiting in-memory hanya efektif per-lambda instance. Jika staging membutuhkan rate limiting terdistribusi, pasang Redis (Upstash) di kemudian hari.
- Proteksi brute force login otomatis di-bypass ketika `NODE_ENV !== 'production'` sehingga tidak mengganggu otomasi regresi test suite.

---

## 7. Mode Production Sementara di Windows PC (Transisi Go-Live)

Sesuai keputusan arsitektur awal, sistem OASE dapat dijalankan langsung pada PC Windows klinik dengan memadukan **Docker Desktop untuk PostgreSQL** dan **Node.js native untuk Next.js App**:

### 7.1 Prasyarat & Konfigurasi Lingkungan
1. **Docker Desktop for Windows**: Terinstal dan aktif (menggunakan backend WSL2).
2. **Node.js v20+ & pnpm v9+**: Terinstal di Windows host.
3. **File `.env` Produksi di Root Repositori**:
   ```env
   # Database (Docker container postgres di localhost)
   POSTGRES_DB=oase_db
   POSTGRES_USER=oase_user
   POSTGRES_PASSWORD=ganti_dengan_password_sangat_rahasia_123
   DATABASE_URL="postgresql://oase_user:ganti_dengan_password_sangat_rahasia_123@localhost:5432/oase_db?schema=public"

   # Auth & Session Cookie
   JWT_ACCESS_SECRET="min_32_karakter_acak_rahasia_jwt_access_token_oase"
   JWT_REFRESH_SECRET="min_32_karakter_acak_rahasia_jwt_refresh_token_oase"
   COOKIE_SECURE=false

   # Application & Runtime
   NODE_ENV=production
   APP_URL="http://localhost:3000"
   PORT=3000
   UPLOAD_DIR="./apps/web/public/uploads"

   # Initial Seed Owner
   SEED_OWNER_EMAIL="owner@oasedental.id"
   SEED_OWNER_PASSWORD="password-owner-kuat-minimal-12-karakter"
   SEED_BRANCH_CODE="PUSAT"
   SEED_BRANCH_NAME="OASE Dental Clinic — Pusat"
   ```
   > [!IMPORTANT]
   > `COOKIE_SECURE=false` wajib digunakan karena akses produksi awal berjalan melalui protokol HTTP lokal (LAN/localhost) tanpa sertifikat TLS HTTPS kustom.

### 7.2 Urutan Inisialisasi Database & Seeding Pertama Kali
Jalankan langkah-langkah berikut secara berurutan:
1. **Jalankan Kontainer Database PostgreSQL**:
   ```powershell
   docker compose up -d postgres
   ```
   Verifikasi kontainer aktif:
   ```powershell
   docker ps --filter "name=oase-postgres"
   ```
2. **Terapkan Migrasi Skema**:
   ```powershell
   pnpm --filter @oase/web exec prisma migrate deploy
   ```
3. **Inisialisasi Akun Owner & Cabang Utama (Seed Produksi)**:
   ```powershell
   $env:NODE_ENV="production"; pnpm db:seed:prod
   ```
   *Catatan: Script ini idempoten, menolak data dummy, dan hanya membuat 1 akun Owner serta 1 cabang pusat.*

### 7.3 Menjalankan Aplikasi Web Produksi
Kompilasi dan jalankan server Next.js:
```powershell
pnpm build
pnpm start
```
- Server aktif melayani request kasir dan staf di `http://localhost:3000` (atau IP lokal LAN klinik misal `http://192.168.1.100:3000`).
- Mode `NODE_ENV=production` mengaktifkan in-memory rate limiter (maksimal 5 kegagalan login berturut-turut per 15 menit).

### 7.4 Kebijakan Daya & Pencegahan Sleep PC Windows
Agar operasional kasir dan pencatatan absensi tidak terputus di tengah hari:
> [!WARNING]
> **PC Windows yang menjadi host server TIDAK BOLEH SLEEP pada jam operasional klinik!**

Jalankan perintah berikut di PowerShell (Run as Administrator) untuk menonaktifkan sleep saat terhubung ke listrik AC:
```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

### 7.5 Otomatisasi Backup & Task Scheduler Windows
Gunakan script `scripts\backup-prod.ps1` yang otomatis mengeksekusi `pg_dump`, mengompresi volume uploads bukti kuitansi, menghapus arsip > 7 hari, dan mencatat log.

Daftarkan 2 trigger pada **Windows Task Scheduler** (`taskschd.msc`):

#### Trigger 1: Backup Harian Setelah Tutup Klinik
- **Nama Task**: `OASE-Dental-Daily-Backup`
- **Trigger**: *Daily*, pukul `23:00` WIB setiap hari.
- **Action**: *Start a program*
  - **Program/script**: `powershell.exe`
  - **Add arguments**: `-ExecutionPolicy Bypass -WindowStyle Hidden -File "D:\OASE\scripts\backup-prod.ps1" -RetentionDays 7`
  - **Start in**: `D:\OASE`
- **Settings**: Centang *"Run whether user is logged on or not"* dan *"Do not store password"*.

#### Trigger 2: At Startup (Auto-Start Services & Backup Saat Boot)
- **Nama Task**: `OASE-Dental-Startup-AutoRun`
- **Trigger**: *At startup* (dengan penundaan 1 menit untuk memastikan Docker engine siap).
- **Action**: *Start a program*
  - **Program/script**: `powershell.exe`
  - **Add arguments**: `-ExecutionPolicy Bypass -Command "docker compose -f D:\OASE\docker-compose.yml up -d postgres; powershell -ExecutionPolicy Bypass -File D:\OASE\scripts\backup-prod.ps1; cd D:\OASE; pnpm start"`
  - **Start in**: `D:\OASE`

---

## 8. Prosedur Fallback Manual Hari Pertama (SOP Kertas → Input Ulang)

Apabila terjadi situasi darurat pada hari pertama go-live (pemadaman listrik berkepanjangan, kegagalan perangkat keras PC, atau kerusakan jaringan):

### 8.1 Formulir Kertas Fisik Darurat (Kesiapan Meja Kasir)
Sebelum klinik dibuka, kasir dan front-desk wajib menyiapkan bundel formulir kertas manual:
1. **Formulir Transaksi Pelayanan Pasien**:
   - Kolom: `[Nomor Urut / Jam Pelayanan]`, `[Nama Pasien / No. RM]`, `[Dokter Pemeriksa]`, `[Tindakan Layanan & Obat yang Diberikan]`, `[Tarif Satuan & Total Tagihan]`, `[Metode Pembayaran: Tunai / Debit EDC / QRIS Statis]`, `[Nomor Bukti Approval EDC / RRN]`, `[Nama & Paraf Kasir]`.
2. **Formulir Pengeluaran Kas Darurat**:
   - Kolom: `[Jam]`, `[Keperluan Belanja / Biaya]`, `[Nominal]`, `[Penerima / Toko]`, `[Kuitansi Fisik / Bon Terlampir]`.
3. **Kartu Stok Bahan Medis Fisik**:
   - Catat setiap ampul anestesi, komposit, atau obat yang diambil selama sistem offline.

### 8.2 Prosedur Rekonsiliasi & Input Ulang (Back-Entry)
Segera setelah PC server dan sistem kembali menyala normal:
1. **Buka Shift Kasir**: Pastikan kasir login dan memeriksa jam sistem server.
2. **Urutan Input Data Berurutan (Chronological Order)**:
   - **Langkah 1 (Absensi)**: Pastikan absensi jam masuk staf klinik diinput atau disesuaikan terlebih dahulu.
   - **Langkah 2 (Stok Masuk / Penyesuaian)**: Jika ada penerimaan bahan medis dari supplier selama offline, input melalui menu *Inventaris > Penerimaan Stok* agar HPP WAC akurat.
   - **Langkah 3 (Transaksi Kasir)**: Masukkan satu per satu transaksi dari form kertas ke menu *Kasir (POS)* sesuai urutan waktu pasien dilayani.
     - Pilih dokter dan layanan yang sesuai.
     - Masukkan metode bayar (Tunai, Debit dengan nomor referensi EDC yang dicatat di kertas, atau QRIS).
     - Selesaikan pembayaran (`PAID`).
   - **Langkah 4 (Pengeluaran Operasional)**: Masukkan seluruh pengeluaran kas darurat pada menu *Pengeluaran*, lampirkan foto bon/kuitansi fisik yang sudah difoto melalui kamera HP/scanner.
3. **Verifikasi & Rekonsiliasi Closing Kas**:
   - Buka menu *Tutup Kas (Closing)*.
   - Bandingkan kalkulasi sistem dengan fisik:
     - Total Fisik Uang Tunai di laci kasir == `cashRevenue` pada sistem closing.
     - Total Struk EDC Mandiri/BCA == `debitRevenue`.
     - Total Laporan Settlement QRIS == `qrisRevenue`.
   - Jika semua angka cocok, masukkan nominal uang fisik dan submit closing kas (`CLOSED`).
   - Lampirkan form kertas transaksi darurat ke dalam ordner fisik arsip kas harian bersama struk closing digital.


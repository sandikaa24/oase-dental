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

## 5. Jalur Staging (Vercel)

1. Hubungkan repository GitHub ke Vercel Dashboard.
2. Atur Root Directory ke `./apps/web` (atau biarkan pnpm monorepo workspace).
3. Isi Environment Variables pada Settings Vercel:
   - `DATABASE_URL`: Connection string PostgreSQL eksternal (Supabase/Neon).
   - `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET`.
   - `APP_URL`: Domain staging Vercel (misal `https://oase-dental-staging.vercel.app`).
4. Jalankan migrasi melalui pipeline CI/CD atau terminal lokal terhubung ke DB staging.

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

## 7. Mode Production Sementara di Windows PC (Transisi)

Apabila sistem hendak dijalankan dalam mode production secara mandiri di PC Windows klinik sebelum server VPS Linux tersedia, ikuti panduan transisi berikut:

### 7.1 Menjalankan Aplikasi
Jalankan perintah build dan start dari root repository:
```bash
pnpm build
pnpm start
```
- Menjalankan `pnpm start` secara otomatis menetapkan `NODE_ENV=production`.
- Dalam mode ini, seluruh proteksi keamanan tingkat produksi aktif penuh, termasuk **In-Memory Rate Limiter** pada endpoint login (`/api/v1/auth/login`, maksimal 5 kegagalan per IP/email per 15 menit).

### 7.2 Peringatan Database & Seeding
> [!WARNING]
> **JANGAN jalankan `pnpm db:seed:prod` selama masih memakai DB dev!**
> Script `seed.prod.ts` ditujukan eksklusif untuk database produksi yang masih bersih/kosong. Jika Anda masih menggunakan database development/staging, jangan jalankan script tersebut agar data operasional yang ada tidak terganggu.

### 7.3 Backup Harian via Windows Task Scheduler
Untuk mengamankan data klinik di Windows PC secara berkala:
1. **Database**: Jalankan `pg_dump` ke file `.sql` menggunakan binary PostgreSQL lokal.
2. **File Uploads**: Salin folder penyimpanan bukti nota pengeluaran (`uploads/` atau path yang dikonfigurasi di `UPLOAD_DIR`).
3. **Automasi**: Buat script `.bat` atau `.ps1` yang menjalankan kedua proses di atas, lalu jadwalkan eksekusi otomatis setiap hari di luar jam operasional klinik melalui **Windows Task Scheduler** (`taskschd.msc`).

### 7.4 Catatan Arsitektur
> [!NOTE]
> Menjalankan aplikasi langsung di Windows PC merupakan **mode transisi operasional sementara**. Target akhir standar rilis sistem OASE tetap mengacu pada arsitektur **Self-Hosted VPS Docker** (Linux + Docker Compose + Caddy otomatis HTTPS) sesuai panduan utama di Bagian 2 dokumen ini demi keandalan, isolasi proses, dan kedaulatan data jangka panjang.

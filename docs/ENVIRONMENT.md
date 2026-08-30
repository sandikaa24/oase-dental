# Environment Variables — OASE

Karena file `.env.example` tidak bisa disimpan di repo (secara keamanan diblokir), berikut daftar wajib yang harus ada di `.env` pada `apps/web/` (atau di-root jika menggunakan Prisma CLI dari root).

## Wajib

| Variable | Contoh | Keterangan |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:6543/db?pgbouncer=true` | PostgreSQL Supabase. Untuk local dev tanpa pgbouncer cukup `postgresql://user:pass@localhost:5432/oase` |
| `JWT_ACCESS_SECRET` | string acak ≥ 32 char | Secret untuk sign access token (jose HS256) |
| `JWT_REFRESH_SECRET` | string acak ≥ 32 char | Secret untuk sign refresh token (jose HS256) |
| `SEED_OWNER_EMAIL` | `owner@oase.id` | Email owner pertama (hanya dipakai seed) |
| `SEED_OWNER_PASSWORD` | minimal 8 char | Password owner pertama (hanya dipakai seed) |
| `APP_URL` | `http://localhost:3000` | Base URL aplikasi |

## Cara pakai

1. Salin nilai di atas ke file `.env` di `apps/web/.env`.
2. Prisma CLI dibaca dari root monorepo (workspace). Jika `prisma/schema.prisma`
   ada di root, letakkan `DATABASE_URL` di `.env` root juga (atau sesuaikan path).
3. JANGAN commit `.env` ke git — sudah ada di `.gitignore`.
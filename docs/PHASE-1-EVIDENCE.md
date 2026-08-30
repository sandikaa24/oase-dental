# Phase 1: CRUD Branches API - Evidence & Technical Decisions

## Keputusan Teknikal & Alasan

1. **Error Handling (`ConflictError` & `NotFoundError`)**
   - Tidak membuat file baru karena `lib/errors.ts` sudah mengakomodasi error ini dengan code standar (`NOT_FOUND` dan `INVALID_TRANSACTION_STATE` by default, namun di-override ke `DUPLICATE` untuk unique constraint violation).
   - `withErrorHandler` sudah secara generik menangani class turunan dari `AppError`, sehingga tidak perlu ditambahkan logika mapping khusus.

2. **Zod Preprocessing (`active=false`)**
   - Sesuai dengan instruksi, parameter query URL datang sebagai string. Digunakan `z.preprocess()` untuk menangani mapping string `"true"` / `"false"` menjadi nilai tipe boolean secara handal agar sesuai dengan prisma query.

3. **Status Update (TODO: Active Transactions)**
   - API Kontrak §2 menyebutkan status `active: false` harus "ditolak jika masih ada transaksi aktif".
   - Karena modul Transaksi belum diimplementasikan pada Fase 1 ini, maka *pengecekan ini sementara di-skip (TODO ditambahkan dalam `branch.service.ts`)*. Cabang dapat dinonaktifkan secara langsung.

4. **Validasi Partial pada Update**
   - Digunakan `.partial()` bawaan dari schema Zod. Ini otomatis mengabaikan key jika key tersebut tidak dikirimkan, namun akan menerapkan seluruh chain validasi (`toUpperCase`, `min`, `max`) jika nilai dikirimkan.

5. **Route Endpoint Handler (`route.ts`)**
   - Menerapkan format struktur layer secara persis dari Fase 0. Handler tetap "tipis" hanya melayani validasi Zod dari parsing request JSON/Query String dan memeriksa token role (dengan `requireAuth` + `requireRole`), sebelum menyerahkan ke `branch.service.ts` dan kemudian memformat hasil dengan *response helper*.

## Hasil Verifikasi
Script test otomatis dijalankan (`test-script.mjs`) yang mengeksekusi 12 poin kontrak verifikasi.
- Semua requirement pengujian (seperti IDOR protection, validation error path info, pagination meta tags format) telah lulus 100%.
- Proses `pnpm lint` melewati semua pengecekan strict TypeScript/ESLint.
- Proses `pnpm build` (`next build`) berhasil melakukan static generation tanpa warning.

# PHASE-3-EVIDENCE.md — Bukti Eksekusi Frontend (Fase 3)

Dokumentasi keputusan arsitektur, bukti verifikasi, dan preseden visual untuk Fase 3 (Frontend & Portal Publik).

---

## TUGAS 1: FRONTEND FOUNDATION

### 1. Keputusan Desain & Arsitektur Frontend (F-A1 s/d F-A6)

| Kode | Area | Keputusan BINDING | Rasional & Implementasi |
|---|---|---|---|
| **F-A1** | **Design System Tokens** | Token warna & tipografi sesuai `docs/ui-design-system.md` §18 | Primary `#0F766E` (Deep Teal), Primary Soft `#CCFBF1`, Surface `#FFFFFF`, Background `#F8FAFC`, Border `#E2E8F0`, Foreground `#0F172A`, Status (Success, Warning, Danger, Info), Role colors, Branch indicator. Didefinisikan di `apps/web/tailwind.config.ts`. |
| **F-A2** | **Navigasi Terpusat** | Single config array di `lib/navigation.ts` | Navigasi menu utama dikelola dalam satu array typed metadata dengan icon Lucide, href, grup (`clinical`, `inventory_finance`, `staff`, `management`, `public`), dan `requiredPermission`. |
| **F-A3** | **Menu Filtering by Permission** | Dynamic default-DENY filter | Menggunakan `getAuthorizedNavItems(user.permissions)` berdasarkan claim permission yang diterima dari backend `/auth/me`, bukan static role mapping. Item tanpa permission yang cukup tidak pernah dirender ke DOM. |
| **F-A4** | **API Client & 401 Interceptor** | Auto token refresh with deduplication | `fetchApi` di `lib/api-client.ts` meng-intercept respons 401 pada protected endpoint. Memanggil `POST /api/v1/auth/refresh` satu kali (dengan single in-flight promise), lalu me-retry request asli jika refresh berhasil. |
| **F-A5** | **Hybrid Route Guard** | Server 307 redirect + Client `useAuth` | `app/admin/layout.tsx` memeriksa keberadaan cookie auth (`access_token`/`refresh_token`) di sisi server dan langsung me-redirect 307 ke `/login` tanpa flash UI. Di client, `AuthProvider` memvalidasi sesi dan menyediakan state reaktif. |
| **F-A6** | **Tooling UI & Test Suite** | Tailored components & headless integration suite | Komponen reusable di `components/ui/` (`Button`, `Input`, `Card`, `Badge`, `RoleBadge`, `Skeleton`, `Placeholder`, `EmptyState`, `ErrorBanner`). Pengujian end-to-end melalui script `scripts/phase3-task1-test.mjs` (UI-1 s/d UI-9). |

---

### 2. Preseden Warna Semantik Dashboard (§3, §5, §6, §18)

Untuk kartu statistik dan widget dashboard, diputuskan sistem multi-warna semantik:
- **Operasional POS / Transaksi Utama**: `bg-primary-soft text-primary` (Deep Teal)
- **Peringatan / Stok Menipis / Tutup Kas Pending**: `bg-warning-bg text-warning-icon text-warning-text` (Amber)
- **Status Sistem Normal / Kehadiran Lengkap**: `bg-success-bg text-success-icon text-success-text` (Green)
- **Informasi Operasional / Presensi Staf**: `bg-info-bg text-info-icon text-info-text` (Blue)
- **Hak Akses Eksekutif / Manajemen User**: `bg-role-owner-bg text-role-owner-text` (Purple)

Semua komponen strictly memakai token semantik Tailwind dan dilarang memakai arbitrary color (`-[#...`) atau hex hardcoded di JSX.

---

### 3. Perbaikan 3 Isu Hasil Review Visual

1. **Isu 1 — Menu Master Data Muncul di Sidebar Cashier**:
   - **Root cause**: `Permission.MASTER_DATA_READ` tercantum di `PERMISSION_MATRIX.CASHIER` di `packages/shared/constants/permissions.ts`.
   - **Fix**: Dihapus dari matriks CASHIER (least privilege). Kasir kini mendapat 403 FORBIDDEN pada akses master data langsung dan menu Master Data tersembunyi secara otomatis.
2. **Isu 2 — Pill Cabang Cashier Tampil "Pilih Cabang"**:
   - **Root cause**: Komponen `Header` tidak mem-fallback langsung ke single assigned branch saat user non-OWNER hanya memiliki 1 cabang.
   - **Fix**: Resolusi `activeBranch` disempurnakan untuk membaca `user.branches[0]` pada single-branch user. Dropdown switch dinonaktifkan/disembunyikan untuk single-branch dan tetap aktif untuk multi-branch.
3. **Isu 3 — Standarisasi Ikon Multi-Warna**:
   - **Keputusan**: Preseden sistem multi-warna semantik berbasis design system token §18 disahkan dan diterapkan seragam.

---

### 4. Hasil Verifikasi & Test Suite

- **Self-check Design System §25**:
  - Hardcoded hex di komponen/app: **0 match (BERSIH)**
  - Console.log liar: **0 match (BERSIH)**
  - Shadow-lg/xl berlebihan: **0 match (BERSIH)**
  - Arbitrary color syntax: **0 match (BERSIH)**
- **Test Suite Phase 3 Task 1 (`phase3-task1-test.mjs`)**: **18 PASSED, 0 FAILED (100%)**
- **Test Suite Regresi API Backend (Phase 0, Phase 1 Tasks 2–5, Phase 2 Tasks 1–3)**: **100% HIJAU (8/8 Suite PASS)**
- **Linter & Build**: `pnpm lint` bersih (0 errors/warnings) & `pnpm build` bersih (33 static/dynamic routes terkompilasi).

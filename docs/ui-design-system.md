# OASE UI DESIGN SYSTEM RULE

## 1. STATUS

Rule ini WAJIB dipatuhi oleh seluruh implementasi frontend OASE Dental Clinic.

File ini merupakan sumber kebenaran utama untuk:

* warna
* typography
* spacing
* border
* radius
* button
* input
* card
* sidebar
* header
* badge
* status indicator
* dashboard UI
* state & feedback
* format data

Agent TIDAK BOLEH membuat design system alternatif tanpa alasan teknis yang terdokumentasi.

Kedudukan dokumen ini: **BINDING**, setara dengan API-CONTRACT.
Untuk persoalan **tampilan/visual**, dokumen ini menang.
Untuk persoalan **logika/data**, API-CONTRACT yang menang.

---

## 2. DESIGN DIRECTION

OASE Dental Clinic menggunakan visual identity:

**Medical Professional + Modern + Premium + Clean**

UI harus memberikan kesan:

* bersih
* terpercaya
* tenang
* profesional
* modern
* mudah digunakan

Hindari:

* warna terlalu mencolok
* gradient berlebihan
* glassmorphism berlebihan
* neon color
* shadow terlalu kuat
* rounded corner berlebihan
* UI yang terlihat seperti template gaming/crypto
* penggunaan terlalu banyak warna

---

## 3. PRIMARY COLOR SYSTEM

### Primary

```text
Deep Teal
#0F766E
```

Digunakan untuk:

* primary button
* active navigation
* link utama
* important action
* selected state
* brand element

> CATATAN: Primary resmi adalah #0F766E (teal-700).
> Warna emerald #0d9488 dari usulan awal TIDAK DIGUNAKAN.
> Jika ditemukan sisa #0d9488 di kode, ganti ke token primary.

### Primary Hover

```text
#115E59
```

### Accent

```text
Aqua Teal
#14B8A6
```

Digunakan secara terbatas untuk:

* focus state
* highlight
* accent
* progress
* visual emphasis

### Primary Soft

```text
#CCFBF1
```

Digunakan untuk:

* active menu background
* soft badge
* selected item
* subtle highlight

---

## 4. NEUTRAL COLOR SYSTEM

### Application Background

```text
#F8FAFC
```

### Surface / Card

```text
#FFFFFF
```

### Primary Text

```text
#0F172A
```

### Secondary Text

```text
#64748B
```

### Border

```text
#E2E8F0
```

Jangan menggunakan pure black (#000000) untuk text utama.

---

## 5. STATUS COLORS

### Success

```text
Background: #DCFCE7
Text: #166534
Icon: #16A34A
```

### Warning

```text
Background: #FEF3C7
Text: #92400E
Icon: #D97706
```

### Danger

```text
Background: #FEE2E2
Text: #991B1B
Icon: #DC2626
```

### Info

```text
Background: #DBEAFE
Text: #1E40AF
Icon: #2563EB
```

Status colors hanya digunakan untuk:

* success
* warning
* error
* information

Jangan menggunakan status color sebagai primary branding.

---

## 6. ROLE COLORS

Role badge harus menggunakan warna soft.

### OWNER

```text
Background: #F3E8FF
Text: #7E22CE
```

### MANAGER

```text
Background: #DBEAFE
Text: #1D4ED8
```

### CASHIER

```text
Background: #CCFBF1
Text: #0F766E
```

### EMPLOYEE

```text
Background: #F1F5F9
Text: #475569
```

---

## 7. SIDEBAR

Sidebar harus menggunakan:

```text
Background: #FFFFFF
Border: #E2E8F0
Normal text: #475569
Active background: #CCFBF1
Active text: #0F766E
```

Active navigation harus mudah dikenali tetapi tidak menggunakan warna solid yang terlalu kuat.

Contoh:

```tsx
className="bg-primary-soft text-primary"
```

atau gunakan design token yang setara (lihat §18).

Sidebar harus:

* clean
* compact
* profesional
* responsif
* mendukung collapsed state

---

## 8. HEADER

Header:

```text
Background: #FFFFFF
Border: #E2E8F0
Text: #0F172A
```

Active branch indicator:

```text
Background: #F0FDFA
Text: #0F766E
Border: #CCFBF1
```

Branch indicator harus selalu terlihat jelas untuk user non-OWNER.

---

## 9. CARDS

Card:

```text
Background: #FFFFFF
Border: #E2E8F0
```

Gunakan shadow ringan.

Hindari:

* shadow besar
* outline tebal
* gradient card
* glassmorphism

Card harus terasa ringan dan profesional.

---

## 10. BUTTON

### Primary Button

```text
Background: #0F766E
Text: #FFFFFF
Hover: #115E59
```

### Secondary Button

```text
Background: #FFFFFF
Text: #334155
Border: #CBD5E1
```

### Destructive Button

```text
Background: #DC2626
Text: #FFFFFF
Hover: #B91C1C
```

Gunakan red hanya untuk tindakan destruktif (hapus, cancel transaksi, void).

Semua button wajib memiliki state: default, hover, focus-visible, disabled, loading.

---

## 11. INPUT

Default:

```text
Background: #FFFFFF
Border: #CBD5E1
Text: #0F172A
Placeholder: #94A3B8
```

Focus:

```text
Border: #14B8A6
Ring: #CCFBF1
```

Input harus mempunyai:

* label
* error message bila invalid
* focus state
* disabled state

---

## 12. LOGIN PAGE

Login page harus menggunakan:

```text
Background: #F8FAFC
Card: #FFFFFF
Heading: #0F172A
Subtitle: #64748B
Primary button: #0F766E
```

Background dapat menggunakan gradient yang sangat halus:

```css
background: linear-gradient(
  135deg,
  #F0FDFA 0%,
  #F8FAFC 50%,
  #EFF6FF 100%
);
```

Gradient tidak boleh menjadi elemen dominan.

---

## 13. TYPOGRAPHY

Prioritas:

1. Inter atau font sans-serif modern yang tersedia di project
2. Gunakan font-weight secara konsisten
3. Heading menggunakan weight 600-700
4. Body menggunakan weight 400-500
5. Jangan menggunakan terlalu banyak jenis font

Hierarchy harus jelas:

```text
Page title
Section title
Card title
Body
Caption
```

---

## 14. BORDER RADIUS

Gunakan radius modern tetapi tidak berlebihan.

Rekomendasi:

```text
sm  = 6px
md  = 8px
lg  = 12px
xl  = 16px
```

Default application component:

```text
8px - 12px
```

---

## 15. SHADOW

Gunakan shadow ringan.

Preferred:

```text
shadow-sm
```

atau custom equivalent.

Jangan menggunakan shadow besar untuk hampir semua komponen.

---

## 16. ICON

Gunakan:

```text
Lucide Icons
```

Package: `lucide-react`.

Icon harus:

* konsisten
* sederhana
* memiliki ukuran yang konsisten
* tidak mencampur icon library yang berbeda tanpa alasan

---

## 17. TAILWIND

Prioritaskan Tailwind utility classes dengan design token (lihat §18).

Contoh:

```tsx
bg-primary
text-primary
bg-primary-soft
text-foreground
text-muted
border-border
bg-background
```

Jangan membuat arbitrary color baru seperti:

```tsx
bg-[#123456]
```

kecuali warna tersebut memang didefinisikan sebagai design token di tailwind.config.ts.

---

## 18. DESIGN TOKEN (WAJIB)

Definisikan token pada `apps/web/tailwind.config.ts` SEBELUM menulis komponen apa pun. Ini bukan opsional.

```ts
colors: {
  primary: {
    DEFAULT: "#0F766E",
    hover: "#115E59",
    soft: "#CCFBF1",
  },
  accent: "#14B8A6",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  foreground: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  success: {
    bg: "#DCFCE7",
    text: "#166534",
    icon: "#16A34A",
  },
  warning: {
    bg: "#FEF3C7",
    text: "#92400E",
    icon: "#D97706",
  },
  danger: {
    bg: "#FEE2E2",
    text: "#991B1B",
    icon: "#DC2626",
    solid: "#DC2626",
  },
  info: {
    bg: "#DBEAFE",
    text: "#1E40AF",
    icon: "#2563EB",
  },
  role: {
    owner: { bg: "#F3E8FF", text: "#7E22CE" },
    manager: { bg: "#DBEAFE", text: "#1D4ED8" },
    cashier: { bg: "#CCFBF1", text: "#0F766E" },
    employee: { bg: "#F1F5F9", text: "#475569" },
  },
  "branch-indicator": {
    bg: "#F0FDFA",
    text: "#0F766E",
    border: "#CCFBF1",
  },
}
```

Aturan penggunaan:

* Semua komponen WAJIB memakai semantic token (`bg-primary`, `text-foreground`, `border-border`, `bg-surface`, dst.).
* Hardcoded hex di file komponen = **pelanggaran**.
* Hardcoded hex hanya boleh ada di `tailwind.config.ts`.

---

## 19. RESPONSIVE DESIGN

Prioritas target:

* **Desktop = target utama** (POS, dashboard, operasional harian).
* **Mobile = wajib usable** (bukan sempurna): sidebar menjadi drawer, konten tidak overflow horizontal, tombol utama terjangkau jempol.
* Tablet mengikuti perilaku desktop dengan grid yang menyesuaikan.
* Large desktop: konten max-width terpusat, jangan full-stretch.

Semua halaman wajib diperiksa minimal di 2 viewport: desktop (1280px) dan mobile (375px).

---

## 20. ACCESSIBILITY

Minimum:

* contrast harus readable
* interactive element dapat difokus
* keyboard navigation
* aria-label untuk icon-only button
* jangan menyampaikan status hanya dengan warna (selalu sertakan teks/label)
* error harus memiliki text explanation

---

## 21. IMPLEMENTATION RULE

Sebelum membuat komponen UI baru, agent WAJIB memeriksa:

1. Apakah komponen serupa sudah tersedia?
2. Apakah sudah ada design token?
3. Apakah warna sesuai design system?
4. Apakah state hover/focus/disabled/error sudah tersedia?
5. Apakah responsive?
6. Apakah accessible?

Jangan membuat komponen duplicate bila komponen reusable sudah tersedia.

Komponen reusable wajib ditaruh di:

```text
apps/web/components/ui/
```

Isi minimal yang harus ada di sana sejak tugas fondasi:

* Button (primary / secondary / destructive)
* Input (dengan label + error)
* Card
* Badge (status + role)
* Placeholder/ComingSoon

DILARANG membuat varian lokal per halaman untuk komponen di atas — halaman wajib memakai komponen dari `components/ui/`.

---

## 22. PROHIBITED UI

Agent DILARANG menggunakan:

* neon colors
* pure black background
* excessive gradients
* excessive glassmorphism
* excessive blur
* excessive rounded cards
* random color palette
* random hex colors
* inconsistent icon libraries
* unnecessary animations
* excessive shadows

---

## 23. STATE & FEEDBACK (WAJIB)

Setiap halaman dengan data wajib menangani 4 state:

### Loading

* Skeleton, bukan spinner liar.
* Minimal: skeleton untuk card dan table.

### Empty State

* Icon + teks penjelasan + CTA bila relevan.
* DILARANG menampilkan area kosong tanpa penjelasan.

### Error State

* Gunakan warna danger (§5).
* Tampilkan field `message` dari response API, bukan teks generik saja.
* Error inline untuk form; error block/banner untuk halaman.

### Success Feedback

* Toast atau inline feedback dengan warna success (§5).

### Disabled

* opacity + cursor-not-allowed, tanpa mengubah warna token.

---

## 24. FORMAT DATA (WAJIB)

* **Uang**: format Rupiah Indonesia (`Intl.NumberFormat('id-ID')`, prefix Rp), dari string Decimal response API.
  DILARANG `parseFloat` pada nilai uang untuk perhitungan tampilan.
  Format langsung dari string; perhitungan tetap di server.
* **Tanggal & jam**: waktu operasional Asia/Jakarta, format id-ID.
* **Status**: tampilkan sebagai badge warna status (§5) + teks label
  (DRAFT / PAID / CANCELLED, PRESENT / LATE, dst.) — tidak pernah warna saja.
* **Nomor transaksi** (TRX-...): monospace.

---

## 25. KEPATUAN AGENT (WAJIB)

Sebelum commit tugas frontend, agent WAJIB menjalankan self-check dan melaporkan hasilnya di evidence tugas:

```bash
# 1. Tidak ada hardcoded hex di komponen (di luar tailwind.config.ts)
grep -rn '#[0-9A-Fa-f]\{6\}' apps/web/components apps/web/app --include="*.tsx"

# 2. Tidak ada console.log liar
grep -rn 'console.log' apps/web/components apps/web/app --include="*.tsx"

# 3. Tidak ada shadow berlebihan
grep -rn 'shadow-lg\|shadow-xl\|shadow-2xl' apps/web/components apps/web/app --include="*.tsx"

# 4. Tidak ada arbitrary color
grep -rn '\-\[#' apps/web/components apps/web/app --include="*.tsx"
```

Hasil tiap grep wajib kosong (atau setiap kemunculan yang tersisa wajib dijelaskan alasannya di evidence).

Dokumen ini wajib dibaca pada Langkah 0 setiap tugas frontend, dan bagian yang relevan dengan tugas tersebut wajib dikutip dalam laporan Langkah 0.

---

## 26. FINAL UI PRINCIPLE

Setiap halaman harus terlihat sebagai bagian dari satu produk yang sama:

**OASE Dental Clinic**

Bukan kumpulan template yang berbeda.

Prioritas:

```text
Consistency
>
Clarity
>
Accessibility
>
Functionality
>
Decoration
```

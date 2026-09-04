# PANDUAN & DAFTAR UJI PENERIMAAN PENGGUNA (UAT CHECKLIST)
## OASE Dental Clinic Management System — Versi 1.0 (Go-Live Readiness)

Dokumen ini adalah instrumen pengujian resmi User Acceptance Testing (UAT) sebelum sistem dinyatakan siap beroperasi penuh (*Go-Live*) pada klinik gigi OASE. Dokumen ini dirancang **cetak-friendly** (*print-ready*) untuk ditandatangani oleh tim operasional.

---

### Informasi Pelaksanaan UAT
- **Tanggal Pengujian**: ___________________________
- **Lokasi / Cabang**: OASE Dental Clinic — ___________________________
- **Versi Rilis Aplikasi**: v1.0.0 (Commit: `bf31e62`)
- **Lingkungan Uji**: Production Staging / On-Premise PC Windows
- **Koordinator Penguji**: ___________________________

---

## 1. Kriteria Kelulusan Go-Live (Exit Criteria)

Sistem OASE dinyatakan **LULUS UAT dan LAYAK GO-LIVE** hanya jika memenuhi ambang batas kualitas berikut:
1. **Blocker (Severity 1) = 0 Temuan**: Tidak boleh ada sistem crash, kegagalan database, kehilangan data, atau kesalahan perhitungan uang (kas/kembalian/omzet/WAC).
2. **Major (Severity 2) = 0 Temuan**: Seluruh alur utama (Kasir POS, Tutup Kas, Stock-In, Approval Cuti, Laporan) wajib berfungsi tanpa hambatan operasional.
3. **Minor (Severity 3) = Maksimal Dicatat di Backlog**: Kekurangan minor pada tata letak visual atau teks yang tidak mengganggu alur bisnis dicatat untuk rilis berikutnya.

---

## 2. Matriks Pengujian Skenario Per Role

### A. Role Kasir (Front-Desk & Kasir Operasional)

| [ ] | ID Kasus Uji | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan | Hasil (P/F) | Tanggal-Jam | Penguji | Catatan |
|:---:|:---|:---|:---|:---|:---:|:---:|:---:|:---|
| [ ] | **UAT-KAS-01** | Absensi Masuk (Clock-in) | Login akun kasir → buka menu *Absensi Saya* → klik tombol *Catat Kehadiran* | Waktu masuk tercatat sesuai jam Asia/Jakarta, status tampil `TEPAT WAKTU` atau `TERLAMBAT` sesuai jadwal | | | | |
| [ ] | **UAT-KAS-02** | Buka Shift & Cek Saldo Awal | Buka menu *Tutup Kas (Closing)* → cek status sesi hari ini | Status sesi kasir terdeteksi siap transaksi; form closing menampilkan ringkasan kas masuk berjalan | | | | |
| [ ] | **UAT-KAS-03** | Transaksi POS — Layanan Gigi | Buka menu *Kasir (POS)* → pilih kategori layanan → masukkan layanan *Scaling* / *Tambal Gigi* → pilih dokter pemeriksa | Item layanan masuk ke keranjang rincian dengan harga tarif resmi yang tepat | | | | |
| [ ] | **UAT-KAS-04** | Transaksi POS — Obat/Bahan | Tambahkan obat/bahan medis (misal *Paracetamol* / *Dental Kit*) ke keranjang belanja yang sama | Item obat tergabung dalam satu keranjang belanja dengan subtotal otomatis terkalkulasi akurat | | | | |
| [ ] | **UAT-KAS-05** | Pembayaran Tunai (Cash) + Kembalian | Pilih metode *Tunai* → masukkan uang bayar lebih besar dari total tagihan → klik *Selesaikan Pembayaran* | Transaksi berstatus `PAID`, sistem menghitung uang kembalian secara tepat, struk siap cetak | | | | |
| [ ] | **UAT-KAS-06** | Pembayaran Non-Tunai (Debit Card) | Buat transaksi baru → pilih metode *Debit* → masukkan nomor referensi/approval EDC kartu | Pembayaran berhasil, nomor referensi tercatat di database, tanpa perhitungan uang kembalian | | | | |
| [ ] | **UAT-KAS-07** | Pembayaran Non-Tunai (QRIS) | Buat transaksi baru → pilih metode *QRIS* → masukkan nomor transaksi/RRN QRIS | Pembayaran berhasil tercatat sebagai QRIS, akumulasi kas non-tunai bertambah | | | | |
| [ ] | **UAT-KAS-08** | Review & Cetak Struk Pasien | Klik tombol cetak struk pada transaksi yang berhasil diselesaikan | Tampilan dialog cetak struk muncul rapi: memuat identitas klinik OASE, rincian tindakan, dan nama kasir | | | | |
| [ ] | **UAT-KAS-09** | Pemakaian Bahan Medis Otomatis | Periksa riwayat mutasi bahan setelah tindakan yang menggunakan bahan medis | Stok bahan berkurang otomatis sesuai kuantitas tindakan dengan tipe mutasi `USAGE` | | | | |
| [ ] | **UAT-KAS-10** | Preview Rekapitulasi Kas Harian | Buka menu *Tutup Kas* di akhir shift → tinjau kartu metrik preview sistem | Total uang tunai, debit, dan QRIS cocok 100% dengan fisik uang dan bukti slip transaksi kasir | | | | |
| [ ] | **UAT-KAS-11** | Submit Closing Kas (Tutup Shift) | Masukkan hitungan uang fisik kas di laci kasir → klik tombol *Tutup Kas Hari Ini* | Sesi closing terkunci (`CLOSED`), mutasi kas terkunci immutable, tidak dapat dimanipulasi lagi | | | | |
| [ ] | **UAT-KAS-12** | Absensi Pulang (Clock-out) | Buka menu *Absensi Saya* saat jam operasional berakhir → klik *Absen Pulang* | Jam pulang tercatat, durasi kerja harian terhitung, tombol absen dinonaktifkan | | | | |

---

### B. Role Manager (Kepala Operasional Cabang)

| [ ] | ID Kasus Uji | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan | Hasil (P/F) | Tanggal-Jam | Penguji | Catatan |
|:---:|:---|:---|:---|:---|:---:|:---:|:---:|:---|
| [ ] | **UAT-MGR-01** | Penerimaan Stok Masuk (Stock-In) | Buka *Inventaris* → pilih bahan medis → masukkan kuantitas masuk & harga beli satuan (`unitCost`) | Stok bertambah; mutasi `IN` mencatat harga snapshot `unitCost`; harga pokok WAC terhitung otomatis | | | | |
| [ ] | **UAT-MGR-02** | Buat Draf Stok Opname | Buka *Inventaris* → *Stok Opname* → klik *Mulai Opname Baru* | Sesi opname terbentuk dengan status `DRAFT`, memuat daftar seluruh stok fisik sistem | | | | |
| [ ] | **UAT-MGR-03** | Input & Finalisasi Stok Opname | Masukkan jumlah hitungan fisik riil di klinik → klik *Submit Opname* | Sistem menghitung selisih (+/-); otomatis membuat mutasi `ADJUSTMENT`; status menjadi `SUBMITTED` | | | | |
| [ ] | **UAT-MGR-04** | Tinjau Permohonan Cuti Staf | Buka menu *Manajemen Cuti* → periksa daftar pengajuan cuti staf cabang | Tampil nama karyawan, tanggal mulai-selesai, jenis cuti, dan alasan permohonan | | | | |
| [ ] | **UAT-MGR-05** | Keputusan Approval Cuti | Pilih salah satu permohonan → klik *Setujui* dengan catatan persetujuan | Status cuti berubah menjadi `APPROVED`, kuota hak cuti tahunan staf berkurang | | | | |
| [ ] | **UAT-MGR-06** | Keputusan Penolakan Cuti | Pilih permohonan lain → klik *Tolak* → masukkan alasan penolakan wajib | Status cuti berubah menjadi `REJECTED`, catatan alasan penolakan dapat dilihat staf | | | | |
| [ ] | **UAT-MGR-07** | Pencatatan Pengeluaran Cabang | Buka menu *Pengeluaran* → klik *Tambah Pengeluaran* → isi nominal, keterangan, dan pilih kategori | Form tervalidasi; nilai nominal tersimpan dengan presisi desimal Rupiah tanpa pembulatan liar | | | | |
| [ ] | **UAT-MGR-08** | Upload Bukti Kuitansi/Nota | Unggah file bukti kuitansi (JPG/PNG/PDF) pada form pengeluaran → klik simpan | File bukti tersimpan di volume aman; thumbnail/link preview nota dapat dibuka kembali | | | | |
| [ ] | **UAT-MGR-09** | Laporan Persediaan Cabang | Buka menu *Laporan* → pilih tab *Persediaan* | Tampil daftar stok bahan, WAC, valuasi total; bahan di bawah batas tampil badge `⚠ Kritis` | | | | |
| [ ] | **UAT-MGR-10** | Laporan Pengeluaran Cabang | Buka menu *Laporan* → pilih tab *Pengeluaran* | Menampilkan ringkasan biaya operasional cabang per kategori dan tabel rincian transaksi | | | | |
| [ ] | **UAT-MGR-11** | Pembatasan Tab Finansial | Periksa deretan tab pada halaman `/admin/reports` akun Manager | Tab *Penjualan*, *Laba Kotor*, dan *Audit Log* disembunyikan sepenuhnya (tidak ada kebocoran omzet) | | | | |

---

### C. Role Owner (Pemilik & Direktur Klinik)

| [ ] | ID Kasus Uji | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan | Hasil (P/F) | Tanggal-Jam | Penguji | Catatan |
|:---:|:---|:---|:---|:---|:---:|:---:|:---:|:---|
| [ ] | **UAT-OWN-01** | Executive Dashboard Konsolidasi | Login akun Owner → akses dashboard beranda `/admin` | Tampil ringkasan omzet hari ini, kartu performa seluruh cabang aktif, dan status audit trail | | | | |
| [ ] | **UAT-OWN-02** | Grafik Tren Pendapatan 7 Hari | Arahkan kursor (*hover*) pada grafik tren 7 hari SVG di dashboard | Tooltip menampilkan tanggal dan nominal omzet harian yang presisi pada setiap titik data | | | | |
| [ ] | **UAT-OWN-03** | Rekonsiliasi Laporan Penjualan | Buka menu *Laporan* → tab *Penjualan* → cocokan data dengan transaksi Kasir | Seluruh transaksi UAT Kasir tadi tercatat lengkap beserta metode bayar dan total omzet yang cocok 100% | | | | |
| [ ] | **UAT-OWN-04** | Laporan Produk & Layanan Terlaris | Buka tab *Produk Terlaris* pada laporan | Menampilkan peringkat tindakan gigi dan obat berdasarkan kuantitas terbanyak dan kontribusi omzet | | | | |
| [ ] | **UAT-OWN-05** | Laporan Laba Kotor & Bersih | Buka tab *Laba Kotor* pada laporan | 3 Kartu metrik (Omzet, HPP WAC, Biaya Operasional) terkalkulasi otomatis menghasilkan Laba Bersih | | | | |
| [ ] | **UAT-OWN-06** | Pemantauan Audit Trail Log | Buka tab *Audit Log* (atau menu `/admin/audit-logs`) | Seluruh aksi mutasi data (transaksi, stok, closing kas, pengeluaran) tercatat dengan nama aktor & waktu | | | | |
| [ ] | **UAT-OWN-07** | Detail Snapshot Perubahan Data | Klik tombol detail pada salah satu baris audit log | Dialog menampilkan diff JSON `oldValues` vs `newValues` secara transparan dan akurat | | | | |
| [ ] | **UAT-OWN-08** | Manajemen Akun & Hak Akses | Buka menu *Kelola Pengguna* → buat akun baru untuk staf kasir/dokter pengganti | Akun berhasil dibuat dengan role yang tepat; staf baru langsung dapat login | | | | |
| [ ] | **UAT-OWN-09** | Reset Password Staf | Pilih salah satu staf → klik tombol *Reset Password* → masukkan password baru | Password staf terbarui secara aman (bcrypt hash); staf dapat login dengan password baru | | | | |
| [ ] | **UAT-OWN-10** | Filter Cabang Laporan Global | Gunakan dropdown *Filter Cabang* pada laporan Penjualan / Persediaan | Data tabel dan metrik berganti instan menampilkan performa cabang terpilih atau konsolidasi seluruh cabang | | | | |

---

### D. Skenario Edge Cases, Keamanan, & Ketahanan Sistem

| [ ] | ID Kasus Uji | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan | Hasil (P/F) | Tanggal-Jam | Penguji | Catatan |
|:---:|:---|:---|:---|:---|:---:|:---:|:---:|:---|
| [ ] | **UAT-EDG-01** | Proteksi Brute-Force Login | Coba login salah password sebanyak 5 kali berturut-turut pada akun yang sama | Sistem mengunci percobaan login ke-6 dan menampilkan pesan error HTTP 429 (*Terlalu banyak percobaan*) | | | | |
| [ ] | **UAT-EDG-02** | Sesi Expired / Ghost Token | Simpan cookie sesi aktif → nonaktifkan akun user di DB/admin → refresh halaman aplikasi | Sistem mendeteksi akun non-aktif, menghapus cookie, dan mengarahkan ke halaman `/login` tanpa loop | | | | |
| [ ] | **UAT-EDG-03** | Pencegahan Submit Ganda | Klik tombol *Bayar* atau *Tutup Kas* sebanyak 2–3 kali secara cepat (*rapid double-click*) | Tombol otomatis berstatus *loading / disabled*; hanya 1 request yang diproses tanpa ada duplikasi | | | | |
| [ ] | **UAT-EDG-04** | Ketahanan Restart PC Tengah Hari | Jalankan 1 transaksi → matikan/restart komputer PC server → nyalakan kembali dan buka aplikasi | Kontainer database & Next.js otomatis kembali berjalan normal; transaksi sebelumnya tetap tersimpan utuh | | | | |
| [ ] | **UAT-EDG-05** | Guard URL Bypass (Kasir) | Login sebagai Kasir → ketik langsung URL `/admin/reports` atau `/admin/audit-logs` di browser | Halaman menolak akses dan menampilkan kartu `<AksesDitolakCard>` dengan tombol kembali ke Dashboard | | | | |
| [ ] | **UAT-EDG-06** | Guard Akses Role Tanpa Cabang | Uji coba user non-Owner yang belum di-assign ke cabang mana pun | Sistem menampilkan peringatan penugasan cabang (*Cabang belum diatur*) tanpa menyebabkan crash layar putih | | | | |

---

## 3. Rekapitulasi & Lembar Pengesahan Go-Live

### Ringkasan Hasil Pengujian
- **Total Skenario Diuji**: 39 Kasus Uji
- **Jumlah Lulus (PASS)**: ______ Kasus
- **Jumlah Gagal (FAIL)**: ______ Kasus
- **Jumlah Blocker / Major**: ______ Kasus (Harus **0** untuk persetujuan)

### Catatan & Temuan Minor (Backlog Pasca Rilis)
1. ____________________________________________________________________________________
2. ____________________________________________________________________________________
3. ____________________________________________________________________________________

---

### Lembar Tanda Tangan Persetujuan Go-Live (Sign-Off)

Dengan menandatangani dokumen ini, seluruh pihak menyatakan bahwa sistem **OASE Dental Clinic Management System v1.0** telah diuji secara menyeluruh, memenuhi kriteria penerimaan fungsional, dan disetujui untuk **Go-Live** pada operasional klinik harian.

| Peran Jabatan | Nama Terang | Tanda Tangan | Tanggal |
|:---|:---|:---:|:---:|
| **Pemilik Klinik (Owner)** | ___________________________ | ___________________________ | ___ / ___ / 2026 |
| **Kepala Operasional (Manager)** | ___________________________ | ___________________________ | ___ / ___ / 2026 |
| **Kasir Utama (Lead Cashier)** | ___________________________ | ___________________________ | ___ / ___ / 2026 |
| **System Administrator / IT** | ___________________________ | ___________________________ | ___ / ___ / 2026 |

---
*Dokumen resmi penjaminan mutu OASE Dental Clinic. Simpan salinan fisik bertanda tangan di arsip operasional klinik.*

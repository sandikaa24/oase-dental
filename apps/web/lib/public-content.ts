/**
 * Konten Terkurasi untuk Website Publik OASE Dental Clinic
 * Sesuai panduan Owner Task C1:
 * - Testimoni anonim tanpa nama pribadi fiktif
 * - Profil dokter profesional
 * - Pilar keunggulan standar medis klinik gigi
 */

export interface DoctorProfile {
  id: string;
  name: string;
  title: string;
  specialization: string;
  experience: string;
  scheduleSummary: string;
}

export interface ClinicPillar {
  id: string;
  title: string;
  description: string;
  iconName: string;
}

export interface PatientTestimonial {
  id: string;
  role: string;
  treatment: string;
  branchNote: string;
  quote: string;
  rating: number;
}

export const CLINIC_PILLARS: ClinicPillar[] = [
  {
    id: 'sterilization',
    title: 'Sterilisasi Standar Rumah Sakit',
    description: 'Seluruh instrumen medis melalui proses dekontaminasi dan autoklaf Class B bersertifikasi internasional, dikemas higienis dalam pouch steril per pasien.',
    iconName: 'ShieldCheck',
  },
  {
    id: 'pain-relief',
    title: 'Perawatan Minim Rasa Sakit',
    description: 'Penerapan teknik anestesi modern dan pendekatan gentle dental care untuk kenyamanan maksimal dan menghilangkan rasa cemas saat perawatan gigi.',
    iconName: 'Smile',
  },
  {
    id: 'expert-doctors',
    title: 'Dokter Gigi Berpengalaman',
    description: 'Ditangani oleh tim dokter gigi berpengalaman dan terlisensi yang komunikatif, teliti, dan mengutamakan kesehatan jangka panjang.',
    iconName: 'Stethoscope',
  },
  {
    id: 'transparent-pricing',
    title: 'Transparansi Estimasi Biaya',
    description: 'Informasi rencana tindakan dan estimasi biaya dijelaskan secara terbuka sebelum perawatan dimulai tanpa biaya tersembunyi.',
    iconName: 'Receipt',
  },
];

/**
 * kurasi manual owner — isi data asli sebelum rilis
 * Struktur dipertahankan agar nama asli tinggal ditambahkan nanti.
 */
export const CLINIC_DOCTORS: DoctorProfile[] = [
  // kurasi manual owner — isi data asli sebelum rilis
];

export const PATIENT_TESTIMONIALS: PatientTestimonial[] = [
  {
    id: 'testi-1',
    role: 'Pasien Perawatan Scaling & Polishing',
    treatment: 'Pembersihan Karang Gigi',
    branchNote: 'Cabang Pusat',
    quote: 'Pengalaman scaling paling nyaman yang pernah saya rasakan. Dokternya sangat telaten menjelaskan kondisi karang gigi dan gusi tanpa menghakimi. Ruang kliniknya sangat bersih dan wangi.',
    rating: 5,
  },
  {
    id: 'testi-2',
    role: 'Pasien Penambalan Gigi Estetik Komposit',
    treatment: 'Tambal Gigi Depan',
    branchNote: 'Cabang Utama',
    quote: 'Hasil tambalan gigi depan saya sangat natural, warnanya persis sama dengan gigi asli. Dari pendaftaran WhatsApp sampai selesai tindakan pelayanannya sangat ramah dan profesional.',
    rating: 5,
  },
  {
    id: 'testi-3',
    role: 'Pasien Konsultasi Ortodonti / Behel',
    treatment: 'Pemasangan Kawat Gigi',
    branchNote: 'Cabang Klinik',
    quote: 'Rencana perawatan behel dipaparkan sangat detail beserta estimasi biayanya di awal. Tidak ada biaya siluman. Sangat merekomendasikan OASE untuk siapa pun yang cari klinik gigi terpercaya.',
    rating: 5,
  },
];

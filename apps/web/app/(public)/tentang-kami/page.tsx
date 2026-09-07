import React from 'react';
import type { Metadata } from 'next';
import {
  ShieldCheck,
  Award,
  HeartHandshake,
  Stethoscope,
  Calendar,
  MessageCircle,
} from 'lucide-react';
import { getPublicDoctors } from '@/lib/services/portal-content.service';
import { getPublicBranches, buildWhatsAppUrl } from '@/lib/services/public.service';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Tentang Kami — Standar Medis & Profil Dokter',
  description:
    'Kenali filosofi pelayanan, standar sterilisasi autoklaf Class B, dan profil dokter gigi berlisensi di OASE Dental Clinic.',
};

export default async function TentangKamiPage() {
  const [branches, doctors] = await Promise.all([
    getPublicBranches(),
    getPublicDoctors(),
  ]);
  const defaultBranch = branches[0];
  const waUrl = buildWhatsAppUrl(defaultBranch?.phone, defaultBranch?.name);

  return (
    <div className="py-12 sm:py-16 space-y-16 sm:space-y-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Hero Section */}
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Klinik Gigi Modern & Berstandar Medis</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Komitmen Kami untuk Senyum Sehat Anda
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            OASE Dental Clinic didirikan dengan satu misi sederhana: memberikan pengalaman perawatan gigi yang berkualitas tinggi, bebas dari rasa takut, dan ramah bagi seluruh anggota keluarga.
          </p>
        </div>

        {/* 3 Nilai Utama */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="rounded-3xl border border-border bg-card p-8 space-y-3 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Sterilisasi Ketat</h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Kami menerapkan standar pencegahan infeksi rumah sakit. Setiap instrumen logam dibersihkan ultrasonic dan disterilisasi autoklaf Class B bersuhu 134°C, bersegel kedap udara hingga dibuka di depan pasien.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 space-y-3 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Gentle Care & Ramah</h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Kami memahami banyak pasien merasa cemas saat ke dokter gigi. Dokter kami selalu mendengarkan keluhan, menjelaskan langkah demi langkah, dan memastikan Anda merasa nyaman di dental chair.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 space-y-3 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Award className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Keahlian & Lisensi Resmi</h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Seluruh dokter gigi di OASE Dental memiliki Surat Tanda Registrasi (STR) aktif dan Surat Izin Praktik (SIP) resmi, serta terus memperbarui keilmuan melalui seminar dental berkelanjutan.
            </p>
          </div>
        </div>

        {/* Sterilization Protocol Detail */}
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 p-8 sm:p-12 space-y-6">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Protokol Higienitas</p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              4 Langkah Standar Sterilisasi Instrumen Medis
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Bagaimana kami melindungi kesehatan Anda dari risiko kontaminasi silang:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-primary text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Dekontaminasi</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pencucian awal dengan larutan enzimatik khusus untuk melarutkan sisa mikropartikel biologis.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-primary text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>Ultrasonic Cleaning</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pembersihan mendalam dengan gelombang ultrasonik pada celah mikro instrumen gigi yang sulit dijangkau.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-primary text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Sealing Pouch</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Instrumen dikemas rapat dalam kantong steril (sterile pouch) dengan strip indikator kimia perubahan warna.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-primary text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  4
                </span>
                <span>Autoklaf Class B</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sterilisasi uap vakum bertekanan tinggi 134°C untuk memusnahkan spora bakteri dan virus sepenuhnya.
              </p>
            </div>
          </div>
        </div>

        {/* Tim Dokter Kami */}
        <div className="space-y-8">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Tenaga Medis</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Tim Dokter Gigi OASE
            </h2>
            <p className="text-sm text-muted-foreground">
              Tim Dokter Gigi OASE — dokter gigi berpengalaman &amp; terlisensi yang berdedikasi tinggi merawat kesehatan gigi dan senyum Anda dengan standar medis terbaik.
            </p>
          </div>

          {doctors.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Stethoscope className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">{doc.name}</h3>
                      <p className="text-xs font-medium text-primary">{doc.title}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-muted-foreground pt-2 border-t border-border">
                    <p>
                      <strong className="text-foreground">Fokus:</strong> {doc.specialization}
                    </p>
                    <p>
                      <strong className="text-foreground">Pengalaman:</strong> {doc.experience}
                    </p>
                    <p className="flex items-center gap-1.5 text-primary font-medium pt-1">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>{doc.scheduleSummary}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-8 sm:p-10 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="flex flex-col items-center text-center space-y-3 md:px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Stethoscope className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Dokter Berpengalaman &amp; Terlisensi</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Setiap dokter gigi di OASE memiliki izin praktik resmi dan keahlian teruji dalam menangani ragam perawatan gigi secara profesional.
                  </p>
                </div>

                <div className="flex flex-col items-center text-center space-y-3 pt-6 md:pt-0 md:px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Etika &amp; Presisi Medis</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Mengutamakan tindakan invasif minimal, sterilisasi instrumen ketat, dan komunikasi aktif mengenai setiap langkah perawatan.
                  </p>
                </div>

                <div className="flex flex-col items-center text-center space-y-3 pt-6 md:pt-0 md:px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Konsultasi Terjadwal</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Reservasi jadwal konsultasi mudah melalui WhatsApp klinik untuk memastikan waktu perawatan yang efisien dan nyaman.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CTA Banner */}
        <div className="rounded-3xl bg-primary text-primary-foreground p-8 sm:p-12 text-center space-y-6 shadow-lg">
          <div className="mx-auto max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">Jadwalkan Konsultasi Perdana Anda</h2>
            <p className="text-xs sm:text-sm opacity-90 leading-relaxed">
              Tim resepsionis kami siap membantu mengatur jadwal kunjungan Anda dengan dokter gigi pilihan.
            </p>
          </div>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-background px-6 py-3.5 text-sm font-bold text-primary shadow hover:bg-background/90 transition-all"
          >
            <MessageCircle className="h-4 w-4" />
            Hubungi WhatsApp Kami
          </a>
        </div>
      </div>
    </div>
  );
}

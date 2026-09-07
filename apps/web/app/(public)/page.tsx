import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Smile,
  Stethoscope,
  Receipt,
  MessageCircle,
  Calendar,
  MapPin,
  Clock,
  ChevronRight,
  Star,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { getPublicServices, getPublicBranches, buildWhatsAppUrl } from '@/lib/services/public.service';
import { CLINIC_PILLARS, CLINIC_DOCTORS, PATIENT_TESTIMONIALS } from '@/lib/public-content';
import { formatRupiah } from '@/lib/formatters';

export const revalidate = 3600; // ISR cache 1 jam

export default async function HomePage() {
  const [services, branches] = await Promise.all([
    getPublicServices(),
    getPublicBranches(),
  ]);

  const defaultBranch = branches[0];
  const mainWaUrl = buildWhatsAppUrl(defaultBranch?.phone, defaultBranch?.name);

  // Map icon component untuk 4 pilar keunggulan
  const getPillarIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldCheck':
        return <ShieldCheck className="h-6 w-6 text-primary" />;
      case 'Smile':
        return <Smile className="h-6 w-6 text-primary" />;
      case 'Stethoscope':
        return <Stethoscope className="h-6 w-6 text-primary" />;
      case 'Receipt':
        return <Receipt className="h-6 w-6 text-primary" />;
      default:
        return <Sparkles className="h-6 w-6 text-primary" />;
    }
  };

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background pt-12 sm:pt-20 pb-12 sm:pb-16 border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Standar Medis Terpercaya & Dokter Berpengalaman</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl sm:leading-tight">
              Senyum Sehat, Bersih & Nyaman Bersama <span className="text-primary">OASE Dental Clinic</span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Klinik kesehatan gigi keluarga dengan pendekatan gentle care, standar sterilisasi autoklaf rumah sakit, dan estimasi biaya transparan tanpa rasa cemas.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <a
                href={mainWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg"
              >
                <MessageCircle className="h-4 w-4" />
                Reservasi Jadwal via WhatsApp
              </a>
              <Link
                href="/layanan"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/70 hover:text-primary shadow-sm"
              >
                Lihat Layanan & Biaya
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Quick Badges */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Sterilisasi Class B per Pasien</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Konsultasi Ramah & Komunikatif</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Tanpa Biaya Tersembunyi</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. QUICK BRANCH & WORKING HOURS STRIP */}
      {branches.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Jadwal Operasional Klinik</span>
                </div>
                <h2 className="text-lg font-bold text-foreground">Buka Setiap Hari untuk Kenyamanan Anda</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto">
                {branches.slice(0, 2).map((b) => (
                  <div key={b.id} className="rounded-xl border border-border/60 bg-background p-3.5 space-y-1 text-xs">
                    <p className="font-semibold text-foreground">{b.name}</p>
                    <p className="text-muted-foreground truncate">{b.address}</p>
                    {b.workingHours && (
                      <p className="text-primary font-medium">
                        Jam Buka: {b.workingHours.openTime} – {b.workingHours.closeTime} WIB
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. 4 PILAR KEUNGGULAN KLINIK */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Mengapa Memilih OASE</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Standar Perawatan Medis yang Kami Junjung Tinggi
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Kesehatan rongga mulut Anda adalah investasi masa depan. Kami memastikan setiap prosedur dilakukan dengan aman, bersih, dan menenangkan.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CLINIC_PILLARS.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md space-y-3"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                {getPillarIcon(p.iconName)}
              </div>
              <h3 className="text-base font-semibold text-foreground">{p.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. LAYANAN UNGGULAN (DINAMIS DARI DB) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Layanan & Tindakan</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Perawatan Gigi Populer
            </h2>
            <p className="text-sm text-muted-foreground">
              Daftar layanan medis terpopuler dengan estimasi tarif transparan.
            </p>
          </div>
          <Link
            href="/layanan"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Lihat Semua Layanan
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {services.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 6).map((svc) => {
              const serviceWa = buildWhatsAppUrl(defaultBranch?.phone, defaultBranch?.name, svc.name);
              return (
                <div
                  key={svc.id}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-2">
                    {svc.category && (
                      <span className="inline-block rounded-md bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        {svc.category.name}
                      </span>
                    )}
                    <h3 className="text-lg font-bold text-foreground">{svc.name}</h3>
                    {svc.nameEn && (
                      <p className="text-xs text-muted-foreground italic">{svc.nameEn}</p>
                    )}
                    {svc.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 pt-1">
                        {svc.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Estimasi Biaya</p>
                      <p className="text-base font-bold text-primary">
                        {`Mulai dari ${formatRupiah(svc.price)}`}
                      </p>
                    </div>

                    <a
                      href={serviceWa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Tanya WA
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Layanan klinik sedang disinkronkan dengan data medis terbaru.
          </div>
        )}
      </section>

      {/* 5. TIM DOKTER GIGI */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Tenaga Medis Profesional</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Ditangani oleh Dokter Gigi Berdedikasi
          </h2>
          <p className="text-sm text-muted-foreground">
            Dokter kami selalu mengedepankan komunikasi yang ramah, penjelasan komprehensif, dan tindakan yang minim rasa sakit.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CLINIC_DOCTORS.map((doc) => (
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
                  <strong className="text-foreground">Fokus Tindakan:</strong> {doc.specialization}
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
      </section>

      {/* 6. TESTIMONI PASIEN (ANONIM MEDIS) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-muted/40 border border-border p-8 sm:p-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Kepuasan Pasien</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Pengalaman Perawatan di OASE Dental
            </h2>
            <p className="text-sm text-muted-foreground">
              Ulasan nyata dari pasien yang telah mempercayakan kesehatan senyum mereka kepada klinik kami.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PATIENT_TESTIMONIALS.map((t) => (
              <div key={t.id} className="rounded-2xl border border-border bg-background p-6 shadow-sm space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-amber-500">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-500" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-semibold text-foreground">{t.role}</p>
                  <p className="text-[11px] text-muted-foreground">{t.branchNote}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. LOKASI CABANG KLINIK */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Lokasi & Akses</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Kunjungi Cabang OASE Terdekat
          </h2>
          <p className="text-sm text-muted-foreground">
            Temukan lokasi klinik terdekat dengan fasilitas ruang tunggu nyaman dan parkir memadai.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {branches.map((b) => {
            const branchWa = buildWhatsAppUrl(b.phone, b.name);
            return (
              <div
                key={b.id}
                className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">{b.name}</h3>
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Buka
                    </span>
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                    <p className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <span>{b.address}</span>
                    </p>
                    {b.workingHours && (
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0 text-primary" />
                        <span>Jam Praktik: {b.workingHours.openTime} – {b.workingHours.closeTime} WIB</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex items-center gap-3">
                  <a
                    href={branchWa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Chat WhatsApp
                  </a>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(`${b.name} ${b.address}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Peta Lokasi
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 8. CTA BANNER PENUTUP */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-primary text-primary-foreground p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden">
          <div className="mx-auto max-w-2xl space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Mulai Konsultasi Senyum Sehat Anda Hari Ini
            </h2>
            <p className="text-sm sm:text-base opacity-90 leading-relaxed">
              Hubungi staf resepsionis kami melalui WhatsApp untuk informasi jadwal dokter, konsultasi keluhan awal, atau penyesuaian waktu kunjungan Anda.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <a
              href={mainWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-background px-6 py-3.5 text-sm font-bold text-primary shadow-lg hover:bg-background/90 transition-all"
            >
              <MessageCircle className="h-4 w-4" />
              Hubungi Resepsionis via WhatsApp
            </a>
            <Link
              href="/cabang"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-primary-foreground/30 px-6 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
            >
              Lihat Alamat Cabang
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

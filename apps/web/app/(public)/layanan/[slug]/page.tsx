import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import {
  getPublicServiceBySlug,
  getPublicBranches,
  getFaqsForService,
  buildWhatsAppUrl,
} from '@/lib/services/public.service';
import { formatRupiah } from '@/lib/formatters';

interface ServiceDetailPageProps {
  params: { slug: string };
}

export const revalidate = 3600;

export async function generateMetadata({ params }: ServiceDetailPageProps): Promise<Metadata> {
  const service = await getPublicServiceBySlug(params.slug);
  if (!service) {
    return {
      title: 'Layanan Tidak Ditemukan | OASE Dental Clinic',
    };
  }
  return {
    title: `${service.name} — Layanan & Estimasi Biaya | OASE Dental Clinic`,
    description:
      service.description ||
      `Informasi detail tindakan ${service.name} di OASE Dental Clinic. Dilakukan oleh dokter gigi terlisensi dengan instrumen steril.`,
  };
}

export default async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const [service, branches] = await Promise.all([
    getPublicServiceBySlug(params.slug),
    getPublicBranches(),
  ]);

  if (!service) {
    notFound();
  }

  const faqs = await getFaqsForService(service.id);
  const defaultBranch = branches[0];
  const waUrl = buildWhatsAppUrl(defaultBranch?.phone, defaultBranch?.name, service.name);

  return (
    <div className="py-12 sm:py-16 space-y-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Breadcrumb Navigasi */}
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/layanan" className="inline-flex items-center gap-1 hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Semua Layanan</span>
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{service.category?.name || 'Tindakan'}</span>
        </nav>

        {/* Hero Section Layanan */}
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {service.category?.name || 'Perawatan Gigi'}
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                {service.name}
              </h1>
              {service.nameEn && (
                <p className="text-sm italic text-muted-foreground">{service.nameEn}</p>
              )}
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-6 text-right sm:text-right shrink-0">
              <p className="text-xs text-muted-foreground">Estimasi Tarif Tindakan:</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-primary">
                {formatRupiah(service.price)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">*Mulai dari (per tindakan/gigi)</p>
            </div>
          </div>

          <div className="border-t border-border pt-6 space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Deskripsi & Indikasi Tindakan</span>
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {service.description ||
                'Perawatan gigi terpadu yang dirancang untuk menjaga kesehatan gigi dan estetika senyum Anda. Setiap prosedur diawali dengan konsultasi mendalam dan analisis kondisi jaringan gigi.'}
            </p>
          </div>

          {/* Fitur Keunggulan Standar OASE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2.5 text-xs text-foreground font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>Instrumen Autoklaf Steril</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-foreground font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>Dokter Gigi Berlisensi</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-foreground font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>Transparansi Biaya</span>
            </div>
          </div>

          {/* CTA Reservasi */}
          <div className="pt-4 flex flex-col sm:flex-row gap-3 items-center justify-between bg-muted/30 -mx-6 -mb-6 sm:-mx-10 sm:-mb-10 p-6 sm:p-8 rounded-b-3xl border-t border-border">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Konsultasikan Kondisi Gigi Anda dengan Tim Dokter Kami
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dapatkan estimasi penanganan akurat dan jadwal kunjungan yang fleksibel.
              </p>
            </div>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity shrink-0 w-full sm:w-auto"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Konsultasi & Reservasi via WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Section FAQ Terkait Layanan */}
        {faqs.length > 0 && (
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-sm space-y-6">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Pertanyaan Sering Diajukan (FAQ)
              </h2>
            </div>
            <div className="divide-y divide-border">
              {faqs.map((faq) => (
                <div key={faq.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{faq.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {faq.body || 'Silakan konsultasikan langsung dengan tim dokter kami saat kunjungan.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

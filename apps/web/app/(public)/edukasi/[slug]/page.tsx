import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, ShieldAlert } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/formatters';

interface EdukasiDetailPageProps {
  params: { slug: string };
}

export const revalidate = 3600;

export async function generateMetadata({ params }: EdukasiDetailPageProps): Promise<Metadata> {
  const item = await prisma.portalContent.findFirst({
    where: {
      slug: params.slug,
      type: { in: ['ARTICLE', 'PATIENT_GUIDE'] },
      published: true,
    },
  });

  if (!item) {
    return {
      title: 'Artikel Tidak Ditemukan | OASE Dental Clinic',
    };
  }

  return {
    title: `${item.title} | Edukasi OASE Dental Clinic`,
    description: item.body?.slice(0, 160) || `Panduan edukasi kesehatan gigi terpercaya oleh OASE Dental Clinic.`,
  };
}

export default async function EdukasiDetailPage({ params }: EdukasiDetailPageProps) {
  const item = await prisma.portalContent.findFirst({
    where: {
      slug: params.slug,
      type: { in: ['ARTICLE', 'PATIENT_GUIDE'] },
      published: true,
    },
  });

  if (!item) {
    notFound();
  }

  return (
    <div className="py-12 sm:py-16 space-y-12">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/edukasi" className="inline-flex items-center gap-1 hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Pusat Edukasi</span>
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">
            {item.type === 'PATIENT_GUIDE' ? 'Panduan Pasien' : 'Artikel'}
          </span>
        </nav>

        {/* Header Artikel */}
        <header className="space-y-4 border-b border-border pb-6">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
              {item.type === 'PATIENT_GUIDE' ? 'Panduan Pasien' : 'Artikel Medis'}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(item.createdAt)}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
            {item.title}
          </h1>
        </header>

        {/* Konten Artikel */}
        <div className="space-y-6 text-sm sm:text-base text-foreground leading-relaxed">
          {item.imageUrl && (
            <div className="rounded-2xl overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={item.title} className="w-full h-auto object-cover max-h-96" />
            </div>
          )}

          <div className="whitespace-pre-line space-y-4">
            {item.body || 'Konten edukasi sedang dalam peninjauan klinis.'}
          </div>
        </div>

        {/* Disclaimer Medis Standar */}
        <footer className="mt-12 rounded-2xl border border-border bg-muted/30 p-5 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <span>Catatan Disclaimer Medis</span>
          </div>
          <p className="leading-relaxed">
            Artikel dan panduan ini disusun sebagai informasi kesehatan umum dan tidak menggantikan konsultasi, diagnosis, atau rencana perawatan klinis langsung dengan dokter gigi. Konsultasikan keluhan gigi Anda secara personal dengan tim dokter kami.
          </p>
        </footer>
      </article>
    </div>
  );
}

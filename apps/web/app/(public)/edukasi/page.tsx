import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, ArrowRight, Calendar } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/formatters';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Edukasi Kesehatan Gigi & Panduan Pasien | OASE Dental Clinic',
  description:
    'Artikel kesehatan gigi, tips perawatan harian, dan panduan persiapan tindakan medis terpercaya dari tim dokter gigi OASE.',
};

export default async function EdukasiIndexPage() {
  const contents = await prisma.portalContent.findMany({
    where: {
      type: { in: ['ARTICLE', 'PATIENT_GUIDE'] },
      published: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return (
    <div className="py-12 sm:py-16 space-y-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Pusat Informasi & Edukasi Pasien</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Edukasi & Panduan Kesehatan Gigi
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Kumpulan artikel medis populer, panduan perawatan sebelum & sesudah tindakan, dan tips menjaga kesehatan rongga mulut untuk seluruh keluarga.
          </p>
        </div>

        {/* Grid Artikel & Panduan */}
        {contents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-base font-medium text-foreground">Artikel Edukasi Sedang Disiapkan</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tim dokter kami sedang menyusun materi edukasi kesehatan gigi yang terverifikasi.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contents.map((item) => (
              <Link
                key={item.id}
                href={`/edukasi/${item.slug}`}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
                      {item.type === 'PATIENT_GUIDE' ? 'Panduan Pasien' : 'Artikel Medis'}
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(item.createdAt)}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {item.title}
                  </h2>

                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {item.body || 'Pelajari informasi selengkapnya mengenai perawatan gigi ini.'}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-border flex items-center gap-1 text-xs font-semibold text-primary">
                  <span>Baca Selengkapnya</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

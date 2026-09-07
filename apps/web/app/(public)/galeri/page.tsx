import React from 'react';
import type { Metadata } from 'next';
import { Camera, ShieldCheck, AlertCircle } from 'lucide-react';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Galeri Kasus Klinis (Before / After) | OASE Dental Clinic',
  description:
    'Dokumentasi hasil perawatan gigi (Before / After) di OASE Dental Clinic dengan persetujuan resmi pasien (Informed Consent).',
};

export default async function GaleriPage() {
  // Guard Server-Side: HANYA mengambil BEFORE_AFTER yang published=true DAN patientConsent=true
  const cases = await prisma.portalContent.findMany({
    where: {
      type: 'BEFORE_AFTER',
      published: true,
      patientConsent: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return (
    <div className="py-12 sm:py-16 space-y-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header Section */}
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <Camera className="h-3.5 w-3.5" />
            <span>Dokumentasi Kasus Klinis</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Galeri Hasil Perawatan (Before & After)
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Dokumentasi visual perubahan sebelum dan sesudah tindakan perawatan gigi yang dipublikasikan dengan persetujuan informed consent resmi dari pasien.
          </p>
        </div>

        {/* Disclaimer Wajib */}
        <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-muted/40 p-4 sm:p-5 flex items-start gap-3.5 text-xs sm:text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Pemberitahuan Medis (Disclaimer):</p>
            <p className="leading-relaxed">
              Foto dokumentasi di bawah ini merupakan kasus klinis nyata pasien OASE Dental Clinic.
              <strong> Hasil perawatan dapat berbeda pada setiap pasien</strong>, bergantung pada kondisi anatomis awal rongga mulut, tingkat keparahan kasus, kepatuhan instruksi dokter, dan respons biologis jaringan gigi masing-masing individu.
            </p>
          </div>
        </div>

        {/* Grid Kasus Klinis */}
        {cases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-base font-medium text-foreground">Dokumentasi Kasus Sedang Dikurasi</p>
            <p className="text-xs text-muted-foreground mt-1">
              Seluruh dokumentasi klinis yang tampil wajib melalui proses verifikasi informed consent tertulis dari pasien.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cases.map((item) => (
              <div
                key={item.id}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:border-primary/50 transition-all"
              >
                {item.imageUrl ? (
                  <div className="relative aspect-video w-full overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full bg-muted/60 flex items-center justify-center text-muted-foreground text-xs">
                    Dokumentasi Visual Kasus
                  </div>
                )}

                <div className="p-5 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Informed Consent Terverifikasi</span>
                  </div>

                  <h2 className="text-base font-bold text-foreground line-clamp-2">
                    {item.title}
                  </h2>

                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {item.body || 'Perubahan klinis sebelum dan sesudah prosedur perawatan gigi.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

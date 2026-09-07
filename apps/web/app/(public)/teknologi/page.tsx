import React from 'react';
import type { Metadata } from 'next';
import { Cpu, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Fasilitas & Standar Sterilisasi Medis | OASE Dental Clinic',
  description:
    'Standar sterilisasi autoklaf Class B, fasilitas dental unit modern, dan teknologi penunjang perawatan gigi yang nyaman dan higienis di OASE Dental Clinic.',
};

export default async function TeknologiPage() {
  const contents = await prisma.portalContent.findMany({
    where: {
      type: { in: ['FACILITY', 'TECHNOLOGY'] },
      published: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div className="py-12 sm:py-16 space-y-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <Cpu className="h-3.5 w-3.5" />
            <span>Fasilitas Klinik & Standar Higienitas</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Teknologi & Standar Sterilisasi Medis
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Kenyamanan dan keselamatan pasien adalah prioritas utama kami. Seluruh instrumen medis melalui prosedur dekontaminasi bertahap untuk memastikan perawatan yang higienis dan terpercaya.
          </p>
        </div>

        {/* 3 Pilar Standar Medis Tetap (Klaim Netral) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-foreground">
              Sterilisasi Autoklaf Class B
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Instrumen medis disterilkan menggunakan metode uap panas bertekanan tinggi bertahap, dikemas dalam kantung steril (sterile pouch) sekali pakai per pasien.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Zap className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-foreground">
              Dental Unit Ergonomis
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Kursi perawatan gigi modern dengan kontur ergonomis yang memberikan kenyamanan maksimal selama prosedur berlangsung, didukung sistem pencahayaan LED presisi.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-foreground">
              Protokol Perlindungan Higienis
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Penerapan barier pelindung sekali pakai (disposable barrier) pada area kontak dental unit dan instrumen tangan guna mencegah kontaminasi silang.
            </p>
          </div>
        </div>

        {/* Fasilitas & Teknologi Dinamis dari CMS (Bila ada) */}
        {contents.length > 0 && (
          <div className="space-y-6 pt-6 border-t border-border">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Daftar Fasilitas & Peralatan Pendukung
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {contents.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary uppercase">
                      {item.type}
                    </span>
                    <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {item.body || 'Informasi fasilitas penunjang tindakan medis.'}
                    </p>
                  </div>

                  {item.imageUrl && (
                    <div className="rounded-xl overflow-hidden border border-border mt-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imageUrl} alt={item.title} className="w-full h-48 object-cover" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

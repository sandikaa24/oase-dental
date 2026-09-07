import React from 'react';
import type { Metadata } from 'next';
import { MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { getPublicServices, getPublicBranches, buildWhatsAppUrl, PublicServiceItem } from '@/lib/services/public.service';
import { formatRupiah } from '@/lib/formatters';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Daftar Layanan & Estimasi Biaya',
  description:
    'Katalog lengkap tindakan perawatan gigi OASE Dental Clinic. Scaling, tambal gigi komposit, bleaching, behel/ortodonti, dan pencabutan gigi dengan estimasi tarif transparan.',
};

export default async function LayananPage() {
  const [services, branches] = await Promise.all([
    getPublicServices(),
    getPublicBranches(),
  ]);

  const defaultBranch = branches[0];

  // Kelompokkan layanan per kategori
  const groupedServices: Record<string, PublicServiceItem[]> = {};
  for (const svc of services) {
    const catName = svc.category?.name || 'Layanan Lainnya';
    if (!groupedServices[catName]) {
      groupedServices[catName] = [];
    }
    groupedServices[catName].push(svc);
  }

  const categoryNames = Object.keys(groupedServices);

  return (
    <div className="py-12 sm:py-16 space-y-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Katalog Perawatan Medis & Estimasi Biaya</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Layanan Perawatan Gigi Terpercaya
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Seluruh tindakan dilakukan oleh dokter gigi berlisensi menggunakan instrumen steril berstandar rumah sakit. Biaya akhir dapat disesuaikan setelah pemeriksaan klinis langsung.
          </p>
        </div>

        {/* Note Transparansi */}
        <div className="mt-8 mx-auto max-w-4xl rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 flex items-start gap-3.5 text-xs sm:text-sm text-foreground">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-primary">Kebijakan Transparansi Biaya:</p>
            <p className="text-muted-foreground leading-relaxed">
              Biaya yang tercantum merupakan estimasi dasar (&ldquo;Mulai dari&rdquo;). Dokter kami akan selalu menjelaskan kondisi gigi, alternatif tindakan, dan rincian perkiraan biaya sebelum prosedur dimulai tanpa ada biaya tersembunyi.
            </p>
          </div>
        </div>

        {/* Grouped Services List */}
        <div className="mt-12 space-y-12">
          {categoryNames.length > 0 ? (
            categoryNames.map((category) => (
              <section key={category} className="space-y-6">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {category}
                  </h2>
                  <span className="text-xs text-muted-foreground font-medium">
                    {groupedServices[category]?.length || 0} Tindakan
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {(groupedServices[category] || []).map((svc) => {
                    const waLink = buildWhatsAppUrl(defaultBranch?.phone, defaultBranch?.name, svc.name);
                    return (
                      <div
                        key={svc.id}
                        className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                      >
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-foreground">{svc.name}</h3>
                          {svc.nameEn && (
                            <p className="text-xs text-muted-foreground italic">{svc.nameEn}</p>
                          )}
                          {svc.description && (
                            <p className="text-xs sm:text-sm text-muted-foreground pt-1 leading-relaxed">
                              {svc.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[11px] text-muted-foreground">Estimasi Tarif</p>
                            <p className="text-base font-bold text-primary">
                              {`Mulai dari ${formatRupiah(svc.price)}`}
                            </p>
                          </div>

                          <a
                            href={waLink}
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
              </section>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Daftar layanan sedang diperbarui dengan jadwal medis terbaru.
            </div>
          )}
        </div>

        {/* Bottom Consultation Assistance */}
        <div className="mt-16 rounded-3xl border border-border bg-muted/40 p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="text-lg sm:text-xl font-bold text-foreground">
              Tidak Menemukan Tindakan yang Anda Butuhkan?
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Konsultasikan keluhan gigi Anda kepada staf medis kami melalui WhatsApp. Kami siap memberikan informasi rencana tindakan yang tepat.
            </p>
          </div>

          <a
            href={buildWhatsAppUrl(defaultBranch?.phone, defaultBranch?.name, 'Konsultasi Tindakan Gigi')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors shrink-0"
          >
            <MessageCircle className="h-4 w-4" />
            Konsultasi via WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

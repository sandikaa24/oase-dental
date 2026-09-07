import React from 'react';
import type { Metadata } from 'next';
import { MapPin, Phone, Clock, MessageCircle, Navigation, Building2 } from 'lucide-react';
import { getPublicBranches, buildWhatsAppUrl } from '@/lib/services/public.service';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Lokasi Cabang & Kontak Klinik',
  description:
    'Temukan alamat lengkap, jam buka operasional, dan nomor kontak WhatsApp resmi cabang OASE Dental Clinic di kota Anda.',
};

export default async function CabangPage() {
  const branches = await getPublicBranches();

  return (
    <div className="py-12 sm:py-16 space-y-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <Building2 className="h-3.5 w-3.5" />
            <span>Jaringan Klinik OASE Dental</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Lokasi Cabang & Jam Praktik
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Kunjungi cabang terdekat untuk pemeriksaan gigi berkala atau konsultasi tindakan medis. Setiap cabang dilengkapi dental unit modern dan fasilitas yang nyaman.
          </p>
        </div>

        {/* Branch Cards Grid */}
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
          {branches.map((b) => {
            const waUrl = buildWhatsAppUrl(b.phone, b.name);
            const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${b.name} ${b.address}`)}`;

            return (
              <div
                key={b.id}
                className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm flex flex-col justify-between space-y-6 transition-all hover:shadow-md"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div>
                      <span className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                        Kode Cabang: {b.code}
                      </span>
                      <h2 className="text-xl font-bold text-foreground">{b.name}</h2>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      Aktif Melayani
                    </span>
                  </div>

                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">Alamat Klinik:</p>
                        <p className="leading-relaxed">{b.address}</p>
                      </div>
                    </div>

                    {b.workingHours && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <div>
                          <p className="text-xs font-semibold text-foreground">Jam Operasional:</p>
                          <p className="text-foreground font-medium">
                            Setiap Hari: {b.workingHours.openTime} – {b.workingHours.closeTime} WIB
                          </p>
                        </div>
                      </div>
                    )}

                    {b.phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <div>
                          <p className="text-xs font-semibold text-foreground">Telepon / WhatsApp:</p>
                          <p className="text-foreground font-medium">{b.phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center gap-3">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Chat WhatsApp Cabang
                  </a>

                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    <Navigation className="h-4 w-4" />
                    Buka Rute Maps
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Fasilitas */}
        <div className="mt-16 rounded-3xl border border-border bg-muted/40 p-8 sm:p-10 space-y-6">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-foreground">Fasilitas Standar di Seluruh Cabang OASE</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Kenyamanan dan keselamatan medis adalah prioritas utama di setiap lokasi klinik kami.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="rounded-2xl border border-border bg-background p-4 text-center space-y-2">
              <p className="font-semibold text-sm text-foreground">Dental Unit Terkalibrasi</p>
              <p className="text-xs text-muted-foreground">Peralatan dental modern yang nyaman dengan pencahayaan LED ergonomis.</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4 text-center space-y-2">
              <p className="font-semibold text-sm text-foreground">Ruang Tunggu Ber-AC</p>
              <p className="text-xs text-muted-foreground">Suasana klinik yang tenang, wangi, dilengkapi WiFi dan air mineral gratis.</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4 text-center space-y-2">
              <p className="font-semibold text-sm text-foreground">Area Parkir Nyaman</p>
              <p className="text-xs text-muted-foreground">Akses mudah dan area parkir kendaraan mobil & motor yang memadai.</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4 text-center space-y-2">
              <p className="font-semibold text-sm text-foreground">Apotek & Obat Lengkap</p>
              <p className="text-xs text-muted-foreground">Pemberian resep obat pasca tindakan langsung di kasir klinik tanpa antre apotek luar.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

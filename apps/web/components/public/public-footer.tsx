import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Phone, MapPin, Clock, Heart } from 'lucide-react';
import { PublicBranchItem } from '@/lib/services/public.service';

interface PublicFooterProps {
  branches?: PublicBranchItem[];
}

export function PublicFooter({ branches = [] }: PublicFooterProps) {
  const currentYear = 2026;

  return (
    <footer className="border-t border-border bg-muted/40 text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold tracking-tight text-foreground">OASE</span>
                  <span className="text-lg font-medium tracking-tight text-primary">Dental</span>
                </div>
                <p className="text-xs text-muted-foreground font-medium">Clinic & Care</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Klinik kesehatan gigi modern dan terpercaya dengan pendekatan perawatan yang nyaman, ramah keluarga, serta standar sterilisasi medis tinggi.
            </p>
            <div className="pt-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <span>Memberikan senyum sehat sejak hari pertama</span>
              <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h3 className="text-sm font-semibold tracking-wider text-foreground uppercase">
              Navigasi Halaman
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
                  Beranda
                </Link>
              </li>
              <li>
                <Link href="/layanan" className="text-muted-foreground hover:text-primary transition-colors">
                  Daftar Layanan & Estimasi Tarif
                </Link>
              </li>
              <li>
                <Link href="/edukasi" className="text-muted-foreground hover:text-primary transition-colors">
                  Edukasi & Panduan Pasien
                </Link>
              </li>
              <li>
                <Link href="/teknologi" className="text-muted-foreground hover:text-primary transition-colors">
                  Teknologi & Sterilisasi
                </Link>
              </li>
              <li>
                <Link href="/galeri" className="text-muted-foreground hover:text-primary transition-colors">
                  Galeri Before / After
                </Link>
              </li>
              <li>
                <Link href="/cabang" className="text-muted-foreground hover:text-primary transition-colors">
                  Lokasi Cabang & Jam Praktik
                </Link>
              </li>
              <li>
                <Link href="/tentang-kami" className="text-muted-foreground hover:text-primary transition-colors">
                  Standar Medis & Profil Klinik
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-muted-foreground hover:text-primary transition-colors">
                  Portal Masuk Staf Klinik
                </Link>
              </li>
            </ul>
          </div>

          {/* Cabang & Jam Operasional */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-semibold tracking-wider text-foreground uppercase">
              Lokasi Cabang & Jam Operasional
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {branches.length > 0 ? (
                branches.slice(0, 4).map((b) => (
                  <div key={b.id} className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm shadow-sm">
                    <p className="font-semibold text-foreground">{b.name}</p>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                      <span>{b.address}</span>
                    </div>
                    {b.workingHours && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>Buka: {b.workingHours.openTime} – {b.workingHours.closeTime} WIB</span>
                      </div>
                    )}
                    {b.phone && (
                      <div className="flex items-center gap-2 text-xs font-medium text-primary">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{b.phone}</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
                  Informasi cabang sedang disinkronkan.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {currentYear} OASE Dental Clinic. Seluruh hak cipta dilindungi undang-undang.</p>
          <div className="flex items-center gap-6">
            <span>Privasi & Etika Medis</span>
            <span>Standar Sterilisasi Kemenkes RI</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

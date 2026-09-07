import React from 'react';
import type { Metadata } from 'next';
import { getPublicBranches } from '@/lib/services/public.service';
import { PublicHeader } from '@/components/public/public-header';
import { PublicFooter } from '@/components/public/public-footer';
import { WhatsAppFloatingBtn } from '@/components/public/whatsapp-floating-btn';

export const metadata: Metadata = {
  title: {
    template: '%s | OASE Dental Clinic',
    default: 'OASE Dental Clinic — Perawatan Gigi Modern, Nyaman & Terpercaya',
  },
  description:
    'Klinik gigi modern dengan standar sterilisasi medis tinggi, dokter berpengalaman, dan perawatan gigi ramah keluarga. Layanan scaling, tambal gigi, bleaching, behel, dan bedah mulut.',
  keywords: [
    'klinik gigi',
    'dokter gigi terpercaya',
    'scaling karang gigi',
    'tambal gigi estetik',
    'bleaching gigi',
    'pasang behel',
    'OASE Dental Clinic',
  ],
  openGraph: {
    title: 'OASE Dental Clinic — Senyum Sehat Keluarga',
    description:
      'Perawatan gigi modern, bersih, dan nyaman dengan dokter gigi berlisensi dan estimasi biaya transparan.',
    type: 'website',
    locale: 'id_ID',
    siteName: 'OASE Dental Clinic',
  },
};

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branches = await getPublicBranches();
  const primaryPhone = branches[0]?.phone;

  // Schema.org Dentist JSON-LD
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    name: 'OASE Dental Clinic',
    description: 'Klinik perawatan kesehatan gigi modern dan terpercaya.',
    telephone: primaryPhone || '+6281234567890',
    priceRange: 'Rp 100.000 - Rp 15.000.000',
    address: branches.map((b) => ({
      '@type': 'PostalAddress',
      streetAddress: b.address,
      addressCountry: 'ID',
    })),
    openingHoursSpecification: branches
      .filter((b) => b.workingHours)
      .map((b) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: b.workingHours?.openTime || '08:00',
        closes: b.workingHours?.closeTime || '20:00',
      })),
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Structured Data SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <PublicHeader primaryBranchPhone={primaryPhone} />
      <main className="flex-1">{children}</main>
      <PublicFooter branches={branches} />
      <WhatsAppFloatingBtn branches={branches} />
    </div>
  );
}

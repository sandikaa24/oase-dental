import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OASE Dental Clinic',
  description: 'Sistem manajemen klinik gigi',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}

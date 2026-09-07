import { prisma } from '@/lib/prisma';

export interface PublicServiceItem {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  price: string;
  category: {
    id: string;
    name: string;
  } | null;
}

export interface PublicBranchItem {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string | null;
  workingHours: {
    openTime: string;
    closeTime: string;
  } | null;
}

/**
 * Mengambil daftar layanan aktif yang ditandai showOnPortal: true.
 * Whitelist kolom aman — tanpa modal/costPrice atau data internal klinik.
 */
export async function getPublicServices(): Promise<PublicServiceItem[]> {
  try {
    const services = await prisma.service.findMany({
      where: {
        active: true,
        showOnPortal: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        nameEn: true,
        description: true,
        descriptionEn: true,
        price: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { category: { name: 'asc' } },
        { name: 'asc' },
      ],
    });

    return services.map((s) => ({
      id: s.id,
      name: s.name,
      nameEn: s.nameEn,
      description: s.description,
      descriptionEn: s.descriptionEn,
      price: s.price.toString(),
      category: s.category,
    }));
  } catch (error) {
    console.error('Gagal mengambil data layanan publik:', error);
    return [];
  }
}

/**
 * Mengambil daftar cabang klinik aktif.
 * Whitelist kolom aman — TIDAK menyertakan lateAfter (aturan keterlambatan staf).
 */
export async function getPublicBranches(): Promise<PublicBranchItem[]> {
  try {
    const branches = await prisma.branch.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        phone: true,
        workingHours: {
          select: {
            openTime: true,
            closeTime: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return branches;
  } catch (error) {
    console.error('Gagal mengambil data cabang publik:', error);
    return [];
  }
}

/**
 * Mengambil halaman statis dari tabel portal_pages berdasarkan slug.
 */
export async function getPublicPortalPage(slug: string) {
  try {
    const page = await prisma.portalPage.findFirst({
      where: {
        slug,
        published: true,
      },
    });
    return page;
  } catch (error) {
    console.error(`Gagal mengambil portal page [${slug}]:`, error);
    return null;
  }
}

/**
 * Helper pembuat URL WhatsApp Reservasi dengan pre-filled message yang ramah & terstruktur.
 */
export function buildWhatsAppUrl(branchPhone: string | null | undefined, branchName?: string, serviceName?: string): string {
  // Bersihkan format nomor HP (ganti 08xx -> 628xx, buang karakter non-digit)
  const cleanPhone = (branchPhone || '081234567890').replace(/[^0-9]/g, '');
  const internationalPhone = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone;

  let message = `Halo OASE Dental Clinic${branchName ? ` (${branchName})` : ''}, saya ingin reservasi jadwal konsultasi/pemeriksaan gigi.`;
  if (serviceName) {
    message += ` Layanan yang diminati: *${serviceName}*.`;
  }
  message += ` Mohon info ketersediaan jadwal dokter. Terima kasih!`;

  return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
}

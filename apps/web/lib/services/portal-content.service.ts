import { prisma } from '@/lib/prisma';
import { AuditAction, PortalContentType, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { CLINIC_DOCTORS, DoctorProfile } from '@/lib/public-content';

interface ListPortalContentParams {
  type?: PortalContentType;
  published?: boolean;
  isDemoContent?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Mendapatkan daftar konten portal (Admin & Publik).
 * Jika isPublic = true, hanya konten published yang dikembalikan,
 * dan untuk tipe BEFORE_AFTER hanya yang memiliki patientConsent = true.
 */
export async function listPortalContents(
  params: ListPortalContentParams,
  isPublic = false
) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.PortalContentWhereInput = {};

  if (params.type) {
    where.type = params.type;
  }

  if (isPublic) {
    where.published = true;
    if (params.type === 'BEFORE_AFTER') {
      where.patientConsent = true;
    }
  } else {
    if (params.published !== undefined) {
      where.published = params.published;
    }
    if (params.isDemoContent !== undefined) {
      where.isDemoContent = params.isDemoContent;
    }
  }

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { slug: { contains: params.search, mode: 'insensitive' } },
      { body: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.portalContent.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      include: {
        createdBy: { select: { id: true, email: true, username: true } },
      },
    }),
    prisma.portalContent.count({ where }),
  ]);

  // Server-side safety filter jika isPublic = true dan tipe bukan BEFORE_AFTER spesifik (misal ALL type)
  const filteredItems = isPublic
    ? items.filter((item) => {
        if (item.type === 'BEFORE_AFTER') {
          return item.patientConsent === true;
        }
        return true;
      })
    : items;

  return {
    items: filteredItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Mendapatkan satu konten portal berdasarkan slug.
 */
export async function getPortalContentBySlug(slug: string, isPublic = false) {
  const content = await prisma.portalContent.findUnique({
    where: { slug },
  });

  if (!content) {
    throw new NotFoundError('Konten portal tidak ditemukan');
  }

  if (isPublic) {
    if (!content.published) {
      throw new NotFoundError('Konten portal belum dipublikasikan');
    }
    if (content.type === 'BEFORE_AFTER' && !content.patientConsent) {
      throw new NotFoundError('Konten portal belum memiliki izin publikasi pasien');
    }
  }

  return content;
}

/**
 * Mendapatkan satu konten portal berdasarkan ID.
 */
export async function getPortalContentById(id: string) {
  const content = await prisma.portalContent.findUnique({
    where: { id },
  });

  if (!content) {
    throw new NotFoundError('Konten portal tidak ditemukan');
  }

  return content;
}

/**
 * Membuat konten portal baru (Admin CMS).
 */
export async function createPortalContent(
  input: {
    type: PortalContentType;
    title: string;
    slug: string;
    body?: string | null;
    imageUrl?: string | null;
    sortOrder?: number;
    published?: boolean;
    isDemoContent?: boolean;
    metadata?: Record<string, unknown>;
    patientConsent?: boolean;
  },
  actorId: string,
  ip?: string
) {
  // Cek duplikasi slug
  const existing = await prisma.portalContent.findUnique({
    where: { slug: input.slug },
  });
  if (existing) {
    throw new ConflictError(`Slug "${input.slug}" sudah digunakan`);
  }

  // Guard: BEFORE_AFTER hanya boleh published jika patientConsent true
  if (input.type === 'BEFORE_AFTER' && input.published && !input.patientConsent) {
    throw new ValidationError(
      'Konten Before/After hanya dapat dipublikasikan jika izin pasien (patientConsent) telah disetujui'
    );
  }

  // Guard: Tipe DOCTOR demo dilarang memuat nomor STR
  if (input.type === 'DOCTOR' && input.isDemoContent) {
    const metaStr = (input.metadata?.str as string) || '';
    const bodyStr = input.body || '';
    if (/\bSTR\b[^\w\n\r]*\d+/i.test(metaStr) || /\bSTR\b[^\w\n\r]*\d+/i.test(bodyStr)) {
      throw new ValidationError(
        'Konten demo profil dokter dilarang memuat nomor STR (gunakan data asli terverifikasi atau kosongkan)'
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const content = await tx.portalContent.create({
      data: {
        type: input.type,
        title: input.title,
        slug: input.slug,
        body: input.body ?? null,
        imageUrl: input.imageUrl ?? null,
        sortOrder: input.sortOrder ?? 0,
        published: input.published ?? false,
        isDemoContent: input.isDemoContent ?? false,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? {},
        patientConsent: input.patientConsent ?? false,
        createdById: actorId,
        updatedById: actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: AuditAction.CREATE,
        entity: 'PortalContent',
        entityId: content.id,
        after: JSON.stringify(content),
        ip,
      },
    });

    return content;
  });
}

/**
 * Mengubah konten portal (Admin CMS).
 */
export async function updatePortalContent(
  id: string,
  input: {
    type?: PortalContentType;
    title?: string;
    slug?: string;
    body?: string | null;
    imageUrl?: string | null;
    sortOrder?: number;
    published?: boolean;
    isDemoContent?: boolean;
    metadata?: Record<string, unknown>;
    patientConsent?: boolean;
  },
  actorId: string,
  ip?: string
) {
  const current = await prisma.portalContent.findUnique({ where: { id } });
  if (!current) {
    throw new NotFoundError('Konten portal tidak ditemukan');
  }

  // Jika slug diubah, cek duplikasi
  if (input.slug && input.slug !== current.slug) {
    const existing = await prisma.portalContent.findUnique({
      where: { slug: input.slug },
    });
    if (existing) {
      throw new ConflictError(`Slug "${input.slug}" sudah digunakan`);
    }
  }

  const effectiveType = input.type ?? current.type;
  const effectivePublished = input.published ?? current.published;
  const effectiveConsent = input.patientConsent ?? current.patientConsent;
  const effectiveIsDemo = input.isDemoContent ?? current.isDemoContent;

  // Guard: BEFORE_AFTER hanya boleh published jika patientConsent true
  if (effectiveType === 'BEFORE_AFTER' && effectivePublished && !effectiveConsent) {
    throw new ValidationError(
      'Konten Before/After hanya dapat dipublikasikan jika izin pasien (patientConsent) telah disetujui'
    );
  }

  // Guard: Tipe DOCTOR demo dilarang memuat nomor STR
  if (effectiveType === 'DOCTOR' && effectiveIsDemo) {
    const metaStr =
      ((input.metadata?.str as string) ??
      ((current.metadata as Record<string, unknown>)?.str as string)) || '';
    const bodyStr = input.body !== undefined ? (input.body || '') : (current.body || '');
    if (/\bSTR\b[^\w\n\r]*\d+/i.test(metaStr) || /\bSTR\b[^\w\n\r]*\d+/i.test(bodyStr)) {
      throw new ValidationError(
        'Konten demo profil dokter dilarang memuat nomor STR (gunakan data asli terverifikasi atau kosongkan)'
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.portalContent.update({
      where: { id },
      data: {
        ...(input.type ? { type: input.type } : {}),
        ...(input.title ? { title: input.title } : {}),
        ...(input.slug ? { slug: input.slug } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.published !== undefined ? { published: input.published } : {}),
        ...(input.isDemoContent !== undefined ? { isDemoContent: input.isDemoContent } : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
        ...(input.patientConsent !== undefined ? { patientConsent: input.patientConsent } : {}),
        updatedById: actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: AuditAction.UPDATE,
        entity: 'PortalContent',
        entityId: id,
        before: JSON.stringify(current),
        after: JSON.stringify(updated),
        ip,
      },
    });

    return updated;
  });
}

/**
 * Menghapus konten portal tunggal (Admin CMS).
 */
export async function deletePortalContent(id: string, actorId: string, ip?: string) {
  const current = await prisma.portalContent.findUnique({ where: { id } });
  if (!current) {
    throw new NotFoundError('Konten portal tidak ditemukan');
  }

  return prisma.$transaction(async (tx) => {
    await tx.portalContent.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        actorId,
        action: AuditAction.DELETE,
        entity: 'PortalContent',
        entityId: id,
        before: JSON.stringify(current),
        ip,
      },
    });

    return { id };
  });
}

/**
 * Bulk-delete semua konten demo berlabel (isDemoContent: true).
 */
export async function bulkDeleteDemoContent(
  type?: PortalContentType,
  actorId?: string,
  ip?: string
) {
  const where: Prisma.PortalContentWhereInput = {
    isDemoContent: true,
  };
  if (type) {
    where.type = type;
  }

  const itemsToDelete = await prisma.portalContent.findMany({
    where,
    select: { id: true, title: true, type: true },
  });

  if (itemsToDelete.length === 0) {
    return { count: 0, deletedIds: [] };
  }

  return prisma.$transaction(async (tx) => {
    const res = await tx.portalContent.deleteMany({ where });

    if (actorId) {
      await tx.auditLog.create({
        data: {
          actorId,
          action: AuditAction.DELETE,
          entity: 'PortalContent',
          entityId: 'BULK_DEMO',
          before: JSON.stringify(itemsToDelete),
          note: `Menghapus ${res.count} konten demo portal`,
          ip,
        },
      });
    }

    return {
      count: res.count,
      deletedIds: itemsToDelete.map((i) => i.id),
    };
  });
}

/**
 * Membaca profil dokter publik dengan fallback ke CLINIC_DOCTORS.
 * Sesuai instruksi Owner:
 * - Membaca DoctorProfile dari PortalContent (type DOCTOR, published) dulu;
 * - Fallback ke CLINIC_DOCTORS konstanta bila kosong (konstanta TIDAK dihapus).
 */
export async function getPublicDoctors(): Promise<DoctorProfile[]> {
  const dbDoctors = await prisma.portalContent.findMany({
    where: {
      type: 'DOCTOR',
      published: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  if (dbDoctors.length > 0) {
    return dbDoctors.map((doc) => {
      const meta = (doc.metadata || {}) as Record<string, unknown>;
      return {
        id: doc.id,
        name: (meta.name as string) || doc.title,
        title: (meta.title as string) || 'Dokter Gigi',
        specialization: (meta.specialization as string) || 'Dokter Gigi Umum',
        experience: (meta.experience as string) || 'Praktisi Terlisensi',
        scheduleSummary: (meta.scheduleSummary as string) || 'Senin - Sabtu',
      };
    });
  }

  // Fallback ke konstanta terkurasi jika belum ada dokter aktif di database
  return CLINIC_DOCTORS;
}

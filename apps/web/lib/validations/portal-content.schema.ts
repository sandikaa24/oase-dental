import { z } from 'zod';
import { PortalContentType } from '@prisma/client';

export const portalContentTypeEnum = z.nativeEnum(PortalContentType);

// Helper validasi STR demo guard
function containsDemoStrNumber(str?: string | null): boolean {
  if (!str) return false;
  // Menolak pola STR yang memuat angka, misal "STR-12345", "STR 123", "STR: 987"
  return /\bSTR\b[^\w\n\r]*\d+/i.test(str);
}

export const createPortalContentSchema = z
  .object({
    type: portalContentTypeEnum,
    title: z.string().trim().min(1, 'Judul wajib diisi').max(255, 'Judul maksimal 255 karakter'),
    slug: z
      .string()
      .trim()
      .min(1, 'Slug wajib diisi')
      .max(255, 'Slug maksimal 255 karakter')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung (-)'),
    body: z.string().trim().nullable().optional(),
    imageUrl: z.string().trim().nullable().optional(),
    sortOrder: z.number().int().default(0),
    published: z.boolean().default(false),
    isDemoContent: z.boolean().default(false),
    metadata: z.record(z.unknown()).default({}),
    patientConsent: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    // Guard 1: BEFORE_AFTER hanya boleh published jika patientConsent true
    if (val.type === 'BEFORE_AFTER' && val.published && !val.patientConsent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['patientConsent'],
        message: 'Konten Before/After hanya dapat dipublikasikan jika izin pasien (patientConsent) telah disetujui',
      });
    }

    // Guard 2: Konten demo dokter dilarang memuat nomor STR
    if (val.type === 'DOCTOR' && val.isDemoContent) {
      const metaStr = (val.metadata?.str as string) || '';
      const bodyText = val.body || '';
      if (containsDemoStrNumber(metaStr) || containsDemoStrNumber(bodyText)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['metadata', 'str'],
          message: 'Konten demo profil dokter dilarang memuat nomor STR (gunakan data asli terverifikasi atau kosongkan)',
        });
      }
    }
  });

export const updatePortalContentSchema = z
  .object({
    type: portalContentTypeEnum.optional(),
    title: z.string().trim().min(1, 'Judul wajib diisi').max(255, 'Judul maksimal 255 karakter').optional(),
    slug: z
      .string()
      .trim()
      .min(1, 'Slug wajib diisi')
      .max(255, 'Slug maksimal 255 karakter')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung (-)')
      .optional(),
    body: z.string().trim().nullable().optional(),
    imageUrl: z.string().trim().nullable().optional(),
    sortOrder: z.number().int().optional(),
    published: z.boolean().optional(),
    isDemoContent: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
    patientConsent: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    // Guard 1: BEFORE_AFTER published but no patientConsent
    if (val.type === 'BEFORE_AFTER' && val.published === true && val.patientConsent === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['patientConsent'],
        message: 'Konten Before/After hanya dapat dipublikasikan jika izin pasien (patientConsent) telah disetujui',
      });
    }

    // Guard 2: Konten demo dokter dilarang memuat nomor STR
    if (val.type === 'DOCTOR' && val.isDemoContent) {
      const metaStr = (val.metadata?.str as string) || '';
      const bodyText = val.body || '';
      if (containsDemoStrNumber(metaStr) || containsDemoStrNumber(bodyText)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['metadata', 'str'],
          message: 'Konten demo profil dokter dilarang memuat nomor STR (gunakan data asli terverifikasi atau kosongkan)',
        });
      }
    }
  });

export const listPortalContentQuerySchema = z.object({
  type: portalContentTypeEnum.optional(),
  published: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  isDemoContent: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const bulkDeleteDemoSchema = z.object({
  type: portalContentTypeEnum.optional(),
});

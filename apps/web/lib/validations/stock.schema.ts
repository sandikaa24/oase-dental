import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Nama item wajib diisi').max(200, 'Nama item maksimal 200 karakter'),
  sku: z.string().trim().max(100, 'SKU maksimal 100 karakter').nullable().optional(),
  unit: z.string().trim().min(1, 'Satuan wajib diisi').max(50, 'Satuan maksimal 50 karakter'),
  category: z.string().trim().min(1, 'Kategori wajib diisi').max(100, 'Kategori maksimal 100 karakter'),
  costPrice: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return null;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === null || val >= 0, {
      message: 'Harga pokok (costPrice) tidak boleh negatif',
    }),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1, 'Nama item wajib diisi').max(200, 'Nama item maksimal 200 karakter').optional(),
  sku: z.string().trim().max(100, 'SKU maksimal 100 karakter').nullable().optional(),
  unit: z.string().trim().min(1, 'Satuan wajib diisi').max(50, 'Satuan maksimal 50 karakter').optional(),
  category: z.string().trim().min(1, 'Kategori wajib diisi').max(100, 'Kategori maksimal 100 karakter').optional(),
  costPrice: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    })
    .refine((val) => val === undefined || val === null || val >= 0, {
      message: 'Harga pokok (costPrice) tidak boleh negatif',
    }),
  isActive: z.boolean().optional(),
});

export const stockMutationSchema = z.object({
  productId: z.string().uuid('ID produk tidak valid'),
  branchId: z.string().uuid('ID cabang tidak valid'),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT'], {
    errorMap: () => ({ message: 'Tipe mutasi harus IN, OUT, atau ADJUSTMENT' }),
  }),
  qty: z
    .number({ required_error: 'Jumlah (qty) wajib diisi' })
    .int('Jumlah (qty) harus berupa bilangan bulat')
    .gt(0, 'Jumlah (qty) harus lebih besar dari 0'),
  note: z.string().trim().max(500, 'Catatan maksimal 500 karakter').nullable().optional(),
  expiredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal kadaluarsa harus YYYY-MM-DD')
    .nullable()
    .optional(),
  minStock: z
    .number()
    .int('Min stok harus berupa bilangan bulat')
    .min(0, 'Min stok tidak boleh negatif')
    .optional(),
});

export const stockListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  lowStock: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => val === true || val === 'true'),
  expiredStatus: z.enum(['all', 'expSoon', 'expired']).optional().default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const stockMovementsQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type StockMutationInput = z.infer<typeof stockMutationSchema>;

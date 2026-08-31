import { z } from 'zod';

/**
 * Validasi untuk Stock-in (API-CONTRACT §9)
 * POST /api/v1/inventory/stock-in
 */
export const stockInSchema = z
  .object({
    itemType: z.enum(['PRODUCT', 'MATERIAL']),
    items: z
      .array(
        z.object({
          itemId: z.string().uuid({ message: 'itemId harus UUID yang valid' }),
          quantity: z.number().int().positive({ message: 'quantity harus bilangan bulat positif' }),
          unitCost: z.number().nonnegative({ message: 'unitCost tidak boleh negatif' }).optional(),
        })
      )
      .min(1, { message: 'items tidak boleh kosong' }),
    note: z.string().optional().nullable(),
  })
  .strict();

export type StockInInput = z.infer<typeof stockInSchema>;

/**
 * Validasi Query List Stok (API-CONTRACT §9)
 * GET /api/v1/inventory/stock
 */
export const stockListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  itemType: z.enum(['PRODUCT', 'MATERIAL']).optional(),
  lowStock: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
  branchId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type StockListQueryInput = z.infer<typeof stockListQuerySchema>;

/**
 * Validasi Query Riwayat Movement / Kartu Stok (API-CONTRACT §9)
 * GET /api/v1/inventory/stock/:itemType/:itemId/movements
 */
export const movementListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom harus format YYYY-MM-DD').optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo harus format YYYY-MM-DD').optional(),
  branchId: z.string().uuid().optional(),
});

export type MovementListQueryInput = z.infer<typeof movementListQuerySchema>;

/**
 * Validasi Create DRAFT Stock Opname (API-CONTRACT §10)
 * POST /api/v1/stock-opnames
 */
export const createStockOpnameSchema = z
  .object({
    opnameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'opnameDate harus format YYYY-MM-DD'),
    itemType: z.enum(['PRODUCT', 'MATERIAL']),
    note: z.string().optional().nullable(),
  })
  .strict();

export type CreateStockOpnameInput = z.infer<typeof createStockOpnameSchema>;

/**
 * Validasi Edit DRAFT Stock Opname (API-CONTRACT §10)
 * PATCH /api/v1/stock-opnames/:id
 */
export const updateStockOpnameSchema = z
  .object({
    items: z
      .array(
        z.object({
          itemId: z.string().uuid({ message: 'itemId harus UUID yang valid' }),
          physicalQty: z.number().int().min(0, { message: 'physicalQty tidak boleh negatif' }),
          note: z.string().optional().nullable(),
        })
      )
      .min(1, { message: 'items tidak boleh kosong' }),
  })
  .strict();

export type UpdateStockOpnameInput = z.infer<typeof updateStockOpnameSchema>;

/**
 * Validasi Query List Stock Opname (API-CONTRACT §10)
 * GET /api/v1/stock-opnames
 */
export const stockOpnameListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'SUBMITTED']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom harus format YYYY-MM-DD').optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo harus format YYYY-MM-DD').optional(),
  branchId: z.string().uuid().optional(),
});

export type StockOpnameListQueryInput = z.infer<typeof stockOpnameListQuerySchema>;

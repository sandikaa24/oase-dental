/**
 * Konstanta Terpusat Produk & Inventaris Klinik OASE
 * BINDING: Task B1.6 & docs/ui-design-system.md
 */

export const PRODUCT_CATEGORIES = [
  'BHP',
  'Bahan Tindakan',
  'Alat Operasional',
  'ATK',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_UNITS = [
  'pcs',
  'box',
  'pack',
  'botol',
  'strip',
  'roll',
  'sachet',
  'lusin',
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const CATEGORY_SKU_PREFIX: Record<ProductCategory, string> = {
  BHP: 'BHP',
  'Bahan Tindakan': 'BTD',
  'Alat Operasional': 'AOP',
  ATK: 'ATK',
};

/**
 * Mendapatkan prefix kode SKU dari nama kategori produk.
 * Jika kategori tidak ada di daftar default, hasilkan singkatan 3-4 huruf kapital.
 */
export function getSkuPrefixByCategory(category: string): string {
  const match = CATEGORY_SKU_PREFIX[category as ProductCategory];
  if (match) return match;
  const cleaned = category.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return cleaned.slice(0, 3) || 'ITM';
}

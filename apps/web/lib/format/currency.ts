/**
 * Helper modul format & sanitasi mata uang Rupiah (IDR).
 * BINDING: docs/ui-design-system.md §24 (Format Data Rupiah tanpa parseFloat).
 * Digunakan secara seragam di:
 * - apps/web/components/closing/closing-form.tsx (kas fisik & selisih)
 * - apps/web/components/pos/pos-payment-modal.tsx (uang diterima & split payment)
 * - apps/web/components/pos/pos-cart.tsx (nominal diskon)
 */

/**
 * Format string digit integer / desimal ke string ribuan dengan pemisah titik (id-ID).
 * Contoh: "1500000" -> "1.500.000", "0" -> "0", "" -> ""
 */
export function formatThousand(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const str = String(value).trim();
  if (!str) return '';

  const parts = str.split('.');
  const integerPart = parts[0] || '0';
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (parts.length > 1 && parts[1] !== undefined) {
    const frac = parts[1].padEnd(2, '0').slice(0, 2);
    if (frac !== '00') {
      return `${formattedInteger},${frac}`;
    }
  }

  return formattedInteger;
}

/**
 * Sanitasi input teks mata uang:
 * - Menghapus semua karakter non-digit
 * - Menormalisasi leading zero berlebih (mis. '05' -> '5', '000' -> '0')
 * Mengembalikan raw digit string tanpa pemisah ribuan.
 * Contoh: "Rp 1.500.000" -> "1500000", "0500" -> "500", "" -> ""
 */
export function sanitizeDigits(raw: string | null | undefined): string {
  if (!raw) return '';
  const digitsOnly = raw.replace(/\D/g, '');
  return digitsOnly.replace(/^0+(?=\d)/, '');
}

/**
 * Konversi string desimal/integer ke nilai integer cents (1 Rupiah = 100 sen)
 * untuk komputasi tampilan presisi tinggi tanpa float precision issue.
 * Contoh: "15000" -> 1500000, "15000.50" -> 1500050, "" -> 0
 */
export function decimalToCents(val: string | number | null | undefined): number {
  if (!val) return 0;
  const str = String(val).trim();
  if (!str) return 0;

  const isNeg = str.startsWith('-');
  const clean = isNeg ? str.slice(1) : str;
  const parts = clean.split('.');
  const whole = parseInt(parts[0] || '0', 10) || 0;
  const fracStr = (parts[1] || '').padEnd(2, '0').slice(0, 2);
  const frac = parseInt(fracStr, 10) || 0;
  const cents = whole * 100 + frac;

  return isNeg ? -cents : cents;
}

/**
 * Konversi nilai integer cents kembali ke string desimal berformat standar ("15000.00").
 */
export function centsToDecimal(cents: number): string {
  const isNeg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const sign = isNeg ? '-' : '';
  return `${sign}${whole}.${frac}`;
}

/**
 * Format string desimal / angka uang ke format Rupiah Indonesia (id-ID).
 * BINDING: docs/ui-design-system.md §24.
 * Menghindari parseFloat untuk menjaga presisi desimal string dari backend.
 */
export function formatRupiah(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return 'Rp 0';
  }

  const str = String(value).trim();
  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;

  const parts = cleanStr.split('.');
  const integerPart = parts[0] || '0';
  const decimalPart = parts[1];

  // Format integer dengan pemisah ribuan titik
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  let result = `Rp ${formattedInteger}`;
  if (decimalPart !== undefined) {
    const frac = decimalPart.padEnd(2, '0').slice(0, 2);
    if (frac !== '00') {
      result += `,${frac}`;
    }
  }

  return isNegative ? `-${result}` : result;
}

/**
 * Format tanggal ke waktu operasional Asia/Jakarta dengan locale id-ID.
 * BINDING: docs/ui-design-system.md §24.
 */
export function formatDate(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '-';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return '-';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  };

  return new Intl.DateTimeFormat('id-ID', defaultOptions).format(date);
}

/**
 * Format tanggal dan waktu (jam:menit) Asia/Jakarta id-ID.
 */
export function formatDateTime(
  dateInput: string | Date | null | undefined
): string {
  return formatDate(dateInput, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

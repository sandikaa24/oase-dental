import fs from 'fs';
import path from 'path';
import { NotFoundError, ValidationError } from './errors';

/**
 * Abstraksi Storage Lokal (Self-Hosted VPS Docker Opsi A).
 * 
 * Karakteristik:
 * 1. File fisik disimpan ke direktori volume persistent (/app/uploads/expense-proofs).
 * 2. URL yang dihasilkan mengarah ke route internal: /api/v1/uploads/expense-proof/:filename
 * 3. Sanitasi nama file ketat untuk mencegah serangan path traversal.
 */

// Direktori penyimpanan file
export const UPLOADS_ROOT =
  process.env.UPLOAD_DIR ||
  (process.env.NODE_ENV === 'production' && fs.existsSync('/app/uploads')
    ? '/app/uploads/expense-proofs'
    : path.join(process.cwd(), 'uploads', 'expense-proofs'));

/**
 * Memastikan direktori penyimpanan tersedia.
 */
function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  }
}

/**
 * Menyimpan buffer file bukti pengeluaran.
 * Adaptif berdasarkan STORAGE_DRIVER:
 * - 'supabase': Mengunggah ke Supabase Storage REST API bucket 'expense-proofs' (staging Vercel).
 * - default ('local'): Menyimpan ke filesystem lokal (/app/uploads/expense-proofs pada Docker/PC).
 */
export async function saveExpenseProof(
  fileBuffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<string> {
  // Sanitasi nama file
  const safeName = path.basename(fileName);
  if (safeName !== fileName) {
    throw new ValidationError('Nama file tidak valid');
  }

  // 1. Jalur Supabase Storage (Staging Vercel)
  if (process.env.STORAGE_DRIVER === 'supabase') {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucketName = 'expense-proofs';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ValidationError(
        'STORAGE_DRIVER diset ke supabase tetapi SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi'
      );
    }

    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${safeName}`;
    const contentType = mimeType || 'image/jpeg';

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: new Uint8Array(fileBuffer),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new ValidationError(
        `Gagal mengunggah bukti pengeluaran ke Supabase Storage (${res.status}): ${errorText}`
      );
    }

    return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${safeName}`;
  }

  // 2. Jalur Default: Storage Lokal Persisten (Docker VPS / PC Windows)
  ensureUploadDir();
  const filePath = path.join(UPLOADS_ROOT, safeName);

  await fs.promises.writeFile(filePath, fileBuffer);

  return `/api/v1/uploads/expense-proof/${safeName}`;
}

/**
 * Mengambil path fisik file dan tipe MIME untuk disajikan melalui route handler.
 * Melakukan validasi keamanan path traversal dan keberadaan file.
 */
export function getExpenseProofPath(fileName: string): { filePath: string; mimeType: string } {
  // Cegah path traversal
  const safeName = path.basename(fileName);
  if (safeName !== fileName || fileName.includes('..')) {
    throw new ValidationError('Nama file tidak valid');
  }

  const filePath = path.join(UPLOADS_ROOT, safeName);

  if (!fs.existsSync(filePath)) {
    throw new NotFoundError('File bukti pengeluaran tidak ditemukan');
  }

  // Tentukan MIME type berdasarkan ekstensi
  const ext = path.extname(safeName).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.webp') mimeType = 'image/webp';
  else if (ext === '.gif') mimeType = 'image/gif';

  return { filePath, mimeType };
}

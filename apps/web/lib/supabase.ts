/**
 * Storage Client Abstraction
 * Menggantikan Supabase Storage dengan penyimpanan lokal (/app/uploads/expense-proofs).
 * Mempertahankan interface uploadExpenseProof agar backwards-compatible.
 */

import { saveExpenseProof } from './storage';

export interface UploadProofResult {
  url: string;
}

/**
 * Menyimpan bukti pengeluaran ke storage lokal.
 */
export async function uploadExpenseProof(
  fileBuffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<string> {
  return saveExpenseProof(fileBuffer, fileName, mimeType);
}

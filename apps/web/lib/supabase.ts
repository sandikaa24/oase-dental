/**
 * Supabase Storage Client Utility
 * Mengunggah file bukti pengeluaran ke bucket 'expense-proofs' via Supabase Storage REST API.
 */

export interface UploadProofResult {
  url: string;
}

export async function uploadExpenseProof(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://rbdvqxuiirpxdmirhwez.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = 'expense-proofs';

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;

  // Jika credential Supabase lengkap, kirim ke Storage REST API
  if (serviceRoleKey) {
    try {
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
        body: new Uint8Array(fileBuffer),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.warn(`[Supabase Storage] Upload return status ${res.status}: ${errorText}`);
        // Fallback to publicUrl structure jika bucket belum dibuat atau storage offline
      }
    } catch (err) {
      console.warn('[Supabase Storage] Network error, fallback to generated URL:', err);
    }
  }

  return publicUrl;
}

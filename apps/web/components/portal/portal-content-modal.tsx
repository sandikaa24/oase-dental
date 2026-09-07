'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
import { PortalContentItem, PortalContentType } from './portal-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Globe, X, Check, AlertTriangle, ShieldAlert } from 'lucide-react';

interface PortalContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
  item: PortalContentItem | null;
  defaultType?: PortalContentType;
  services?: Array<{ id: string; name: string }>;
}

export function PortalContentModal({
  open,
  onOpenChange,
  onSuccess,
  item,
  defaultType = 'ARTICLE',
  services = [],
}: PortalContentModalProps) {
  const isEditing = !!item;

  const [type, setType] = useState<PortalContentType>(defaultType);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [published, setPublished] = useState(false);
  const [isDemoContent, setIsDemoContent] = useState(false);
  const [patientConsent, setPatientConsent] = useState(false);

  // Metadata per tipe
  // DOCTOR
  const [docName, setDocName] = useState('');
  const [docTitle, setDocTitle] = useState('drg.');
  const [docStr, setDocStr] = useState('');
  const [docSpec, setDocSpec] = useState('');
  const [docSchedule, setDocSchedule] = useState('');
  const [docBio, setDocBio] = useState('');

  // FAQ
  const [faqServiceId, setFaqServiceId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (item) {
        setType(item.type);
        setTitle(item.title);
        setSlug(item.slug);
        setBody(item.body || '');
        setImageUrl(item.imageUrl || '');
        setSortOrder(String(item.sortOrder || 0));
        setPublished(item.published);
        setIsDemoContent(item.isDemoContent);
        setPatientConsent(item.patientConsent);

        const meta = (item.metadata || {}) as Record<string, unknown>;
        setDocName((meta.name as string) || '');
        setDocTitle((meta.title as string) || 'drg.');
        setDocStr((meta.str as string) || '');
        setDocSpec((meta.specialization as string) || '');
        setDocSchedule((meta.scheduleSummary as string) || '');
        setDocBio((meta.bio as string) || '');

        setFaqServiceId((meta.serviceId as string) || '');
      } else {
        setType(defaultType);
        setTitle('');
        setSlug('');
        setBody('');
        setImageUrl('');
        setSortOrder('0');
        setPublished(false);
        setIsDemoContent(false);
        setPatientConsent(false);

        setDocName('');
        setDocTitle('drg.');
        setDocStr('');
        setDocSpec('');
        setDocSchedule('');
        setDocBio('');

        setFaqServiceId('');
      }
    }
  }, [open, item, defaultType]);

  const handleGenerateSlug = () => {
    const generated = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    setSlug(generated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Judul konten wajib diisi');
      return;
    }
    if (!slug.trim()) {
      setError('Slug wajib diisi');
      return;
    }

    if (type === 'BEFORE_AFTER' && published && !patientConsent) {
      setError('Konten Before/After hanya dapat dipublikasikan jika izin pasien disetujui');
      return;
    }

    if (type === 'DOCTOR' && isDemoContent) {
      if (/\bSTR\b[^\w\n\r]*\d+/i.test(docStr) || /\bSTR\b[^\w\n\r]*\d+/i.test(body)) {
        setError('Konten demo dokter dilarang memuat nomor STR');
        return;
      }
    }

    setIsSubmitting(true);

    // Build metadata berdasarkan tipe
    let metadata: Record<string, unknown> = {};
    if (type === 'DOCTOR') {
      metadata = {
        name: docName.trim() || title.trim(),
        title: docTitle.trim(),
        str: docStr.trim(),
        specialization: docSpec.trim(),
        scheduleSummary: docSchedule.trim(),
        bio: docBio.trim(),
      };
    } else if (type === 'FAQ') {
      metadata = {
        serviceId: faqServiceId || null,
        serviceName: services.find((s) => s.id === faqServiceId)?.name || null,
      };
    }

    const payload = {
      type,
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      body: body.trim() || null,
      imageUrl: imageUrl.trim() || null,
      sortOrder: parseInt(sortOrder, 10) || 0,
      published,
      isDemoContent,
      patientConsent: type === 'BEFORE_AFTER' ? patientConsent : false,
      metadata,
    };

    try {
      if (isEditing) {
        await fetchApi(`/api/v1/portal-content/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onSuccess('Konten portal berhasil diperbarui');
      } else {
        await fetchApi('/api/v1/portal-content', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onSuccess('Konten portal baru berhasil ditambahkan');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan konten portal';
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-xl border border-border bg-surface shadow-2xl transition-all my-8 animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {isEditing ? 'Edit Konten Portal' : 'Tambah Konten Portal'}
              </h2>
              <p className="text-xs text-muted">
                Tipe: <span className="font-semibold text-primary">{type}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto bg-surface">
          {error && <ErrorBanner message={error} />}

          {/* Tipe Konten Selector (hanya jika create baru) */}
          {!isEditing && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tipe Konten</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PortalContentType)}
                className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="ARTICLE">Artikel / Blog</option>
                <option value="PATIENT_GUIDE">Panduan Pasien (Patient Guide)</option>
                <option value="DOCTOR">Profil Dokter Gigi</option>
                <option value="FAQ">FAQ (Tanya Jawab)</option>
                <option value="BEFORE_AFTER">Before / After Kasus Medis</option>
                <option value="FACILITY">Fasilitas Klinik</option>
                <option value="TECHNOLOGY">Teknologi & Standar Sterilisasi</option>
                <option value="TESTIMONI">Testimoni Pasien</option>
              </select>
            </div>
          )}

          {/* Alert Peringatan Khusus Dokter */}
          {type === 'DOCTOR' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Standar Kepatuhan Profil Dokter</p>
                <p className="mt-0.5 text-amber-800">
                  Gunakan data asli terverifikasi (nama, gelar resmi, STR). Konten demo dilarang
                  menyerupai atau memalsukan identitas dokter nyata.
                </p>
              </div>
            </div>
          )}

          {/* Alert Peringatan Khusus Before / After */}
          {type === 'BEFORE_AFTER' && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Informed Consent Pasien Wajib</p>
                <p className="mt-0.5 text-teal-800">
                  Dokumentasi kasus sebelum dan sesudah tindakan medis hanya dapat dipublikasikan jika
                  pasien telah memberikan persetujuan tertulis resmi.
                </p>
              </div>
            </div>
          )}

          {/* Baris Judul & Slug */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {type === 'DOCTOR' ? 'Nama Dokter (Judul)' : 'Judul Konten'}{' '}
              <span className="text-danger-solid">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'DOCTOR' ? 'Contoh: drg. Amanda Putri, Sp.KG' : 'Masukkan judul...'}
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Slug URL <span className="text-danger-solid">*</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateSlug}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Generate dari Judul
              </button>
            </div>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="contoh-slug-url"
              required
            />
            <p className="text-[11px] text-muted">
              Akan diakses melalui URL: /layanan/..., /edukasi/..., dll.
            </p>
          </div>

          {/* Bidang Khusus Tipe DOCTOR */}
          {type === 'DOCTOR' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-border bg-slate-50/70 p-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Gelar Depan / Belakang</label>
                <Input
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="drg. / drg. Sp.Ort"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Nomor STR (Resmi)</label>
                <Input
                  value={docStr}
                  onChange={(e) => setDocStr(e.target.value)}
                  placeholder="Kosongkan jika konten demo"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Spesialisasi / Keahlian</label>
                <Input
                  value={docSpec}
                  onChange={(e) => setDocSpec(e.target.value)}
                  placeholder="Dokter Gigi Umum / Konservasi Gigi"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Ringkasan Jadwal</label>
                <Input
                  value={docSchedule}
                  onChange={(e) => setDocSchedule(e.target.value)}
                  placeholder="Senin, Rabu, Jumat (10.00 - 17.00)"
                />
              </div>
            </div>
          )}

          {/* Bidang Khusus Tipe FAQ */}
          {type === 'FAQ' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tautkan ke Layanan Medis (Opsional)</label>
              <select
                value={faqServiceId}
                onChange={(e) => setFaqServiceId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- FAQ Umum Klinik --</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted">
                Bila ditautkan, FAQ ini akan otomatis muncul pada halaman detail layanan tersebut.
              </p>
            </div>
          )}

          {/* Bidang Khusus Tipe BEFORE_AFTER */}
          {type === 'BEFORE_AFTER' && (
            <div className="rounded-lg border border-border bg-slate-50/70 p-3.5 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={patientConsent}
                  onChange={(e) => setPatientConsent(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-xs font-semibold text-foreground">
                  Pasien telah menandatangani Informed Consent publikasi dokumentasi
                </span>
              </label>
              <p className="text-[11px] text-muted pl-6">
                Sistem menolak publikasi kasus ini ke galeri publik bila persetujuan pasien belum dicentang.
              </p>
            </div>
          )}

          {/* Image URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {type === 'DOCTOR'
                ? 'URL Foto Profil Dokter'
                : type === 'BEFORE_AFTER'
                ? 'URL Gambar Kolase Before/After'
                : 'URL Gambar Cover / Banner'}
            </label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... atau /images/..."
            />
            <p className="text-[11px] text-muted">
              Dapat menggunakan URL gambar eksternal atau gambar publik.
            </p>
          </div>

          {/* Konten / Body Text */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {type === 'FAQ' ? 'Jawaban FAQ' : 'Isi Konten / Deskripsi'}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Tuliskan deskripsi lengkap / markdown di sini..."
              className="w-full rounded-md border border-slate-300 bg-surface p-3 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Urutan & Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Urutan Tampil (Sort Order)</label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                min="0"
              />
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-xs font-medium text-foreground">Publikasikan (Live)</span>
              </label>
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={isDemoContent}
                  onChange={(e) => setIsDemoContent(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-xs font-medium text-amber-700">Tandai Konten Demo</span>
              </label>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border bg-surface">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                'Menyimpan...'
              ) : (
                <>
                  <Check className="mr-1.5 h-4 w-4" />
                  {isEditing ? 'Simpan Perubahan' : 'Tambah Konten'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
import { Branch } from './branch-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/placeholder';
import { Building2, X, Check } from 'lucide-react';

interface BranchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
  branch: Branch | null;
}

export function BranchModal({
  open,
  onOpenChange,
  onSuccess,
  branch,
}: BranchModalProps) {
  const isEditing = !!branch;

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [geofenceRadius, setGeofenceRadius] = useState<number>(100);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (branch) {
        setCode(branch.code);
        setName(branch.name);
        setAddress(branch.address);
        setPhone(branch.phone || '');
        setLatitude(branch.latitude != null ? String(branch.latitude) : '');
        setLongitude(branch.longitude != null ? String(branch.longitude) : '');
        setGeofenceRadius(branch.geofenceRadius ?? 100);
      } else {
        setCode('');
        setName('');
        setAddress('');
        setPhone('');
        setLatitude('');
        setLongitude('');
        setGeofenceRadius(100);
      }
    }
  }, [open, branch]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Browser tidak mendukung geolokasi GPS.');
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setIsGettingLocation(false);
      },
      (err) => {
        setError(`Gagal mengambil lokasi perangkat: ${err.message}`);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();

    if (!trimmedCode) {
      setError('Kode cabang tidak boleh kosong.');
      return;
    }
    if (trimmedCode.length > 10) {
      setError('Kode cabang maksimal 10 karakter.');
      return;
    }
    if (!trimmedName) {
      setError('Nama cabang tidak boleh kosong.');
      return;
    }
    if (!trimmedAddress) {
      setError('Alamat cabang tidak boleh kosong.');
      return;
    }

    const parsedLat = latitude.trim() ? parseFloat(latitude) : null;
    const parsedLng = longitude.trim() ? parseFloat(longitude) : null;

    if (parsedLat !== null && (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
      setError('Latitude harus berupa angka valid antara -90 dan 90.');
      return;
    }
    if (parsedLng !== null && (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180)) {
      setError('Longitude harus berupa angka valid antara -180 dan 180.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        code: trimmedCode,
        name: trimmedName,
        address: trimmedAddress,
        phone: phone.trim() || undefined,
        latitude: parsedLat,
        longitude: parsedLng,
        geofenceRadius: geofenceRadius || 100,
      };

      if (isEditing && branch) {
        await fetchApi(`/api/v1/branches/${branch.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onSuccess('Profil cabang berhasil diperbarui');
      } else {
        await fetchApi('/api/v1/branches', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onSuccess('Cabang baru berhasil didaftarkan');
      }
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan saat menyimpan data cabang.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface rounded-xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isEditing ? 'Edit Profil Cabang' : 'Tambah Cabang Baru'}
              </h3>
              <p className="text-[11px] text-muted">Informasi Cabang Klinik Operasional</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md text-muted hover:text-foreground hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && <ErrorBanner title="Gagal Menyimpan" message={error} />}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700">Kode Cabang *</label>
              <Input
                type="text"
                required
                maxLength={10}
                placeholder="JKT / BDG"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="text-xs font-mono font-bold uppercase"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Nama Cabang *</label>
              <Input
                type="text"
                required
                placeholder="Contoh: OASE Dental — Surabaya Barat"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Alamat Lengkap *</label>
            <textarea
              rows={2}
              required
              placeholder="Alamat fisik cabang klinik..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2.5 rounded-md border border-border bg-white text-xs text-foreground placeholder:text-muted focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">No. Telepon / WhatsApp Operasional</label>
            <Input
              type="text"
              placeholder="Contoh: 08123456789 / (021) 555-1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          {/* Konfigurasi Geofence (Fitur A) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Titik Koordinat & Geofence Cabang</span>
                  <span className="text-[10px] font-normal text-muted-foreground">(Radius 100m)</span>
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Staf wajib berada di dalam radius ini saat melakukan presensi masuk/keluar.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleGetCurrentLocation}
                isLoading={isGettingLocation}
                className="text-[11px] h-7 px-2.5"
              >
                Gunakan GPS Saya
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <label className="text-[11px] font-medium text-slate-600">Latitude</label>
                <Input
                  type="text"
                  placeholder="-6.2088"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="text-xs font-mono h-8"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[11px] font-medium text-slate-600">Longitude</label>
                <Input
                  type="text"
                  placeholder="106.8456"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="text-xs font-mono h-8"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[11px] font-medium text-slate-600">Radius (Meter)</label>
                <Input
                  type="number"
                  min={10}
                  max={5000}
                  value={geofenceRadius}
                  onChange={(e) => setGeofenceRadius(parseInt(e.target.value, 10) || 100)}
                  className="text-xs font-mono h-8"
                />
              </div>
            </div>

            {latitude && longitude && (
              <div className="text-[11px] text-primary flex items-center justify-between pt-0.5">
                <span>Koordinat terpasang: {latitude}, {longitude}</span>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-primary-dark"
                >
                  Lihat di Peta ↗
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              className="gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>{isEditing ? 'Simpan Perubahan' : 'Daftarkan Cabang'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

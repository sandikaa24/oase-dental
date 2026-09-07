'use client';

import React, { useState } from 'react';
import { MessageCircle, X, ChevronRight, MapPin } from 'lucide-react';
import { PublicBranchItem, buildWhatsAppUrl } from '@/lib/services/public.service';

interface WhatsAppFloatingBtnProps {
  branches?: PublicBranchItem[];
}

export function WhatsAppFloatingBtn({ branches = [] }: WhatsAppFloatingBtnProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Jika cabang hanya 1 atau kosong, langsung klik buka WA default
  if (branches.length <= 1) {
    const defaultBranch = branches[0];
    const url = buildWhatsAppUrl(defaultBranch?.phone, defaultBranch?.name);

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Konsultasi WhatsApp"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl transition-all duration-200 hover:scale-105 hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300"
      >
        <MessageCircle className="h-7 w-7 fill-current" />
      </a>
    );
  }

  // Jika ada beberapa cabang, tampilkan popover pemilih cabang yang ramah
  return (
    <div className="fixed bottom-6 right-6 z-40">
      {isOpen && (
        <div className="mb-3 w-80 rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-sm font-semibold text-foreground">Hubungi Cabang Klinik</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Tutup menu WhatsApp"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Pilih cabang klinik terdekat untuk konsultasi jadwal dan estimasi biaya perawatan:
          </p>

          <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
            {branches.map((branch) => {
              const waLink = buildWhatsAppUrl(branch.phone, branch.name);
              return (
                <a
                  key={branch.id}
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-background p-3 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5 group"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-semibold text-foreground group-hover:text-emerald-700 transition-colors truncate">
                      {branch.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 shrink-0 text-emerald-600" />
                      <span className="truncate">{branch.address}</span>
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Buka pilihan konsultasi WhatsApp"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl transition-all duration-200 hover:scale-105 hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300"
      >
        <MessageCircle className="h-7 w-7 fill-current" />
      </button>
    </div>
  );
}

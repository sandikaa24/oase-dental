'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { ClosingStatus } from './closing-types';

interface ClosingStatusBadgeProps {
  status: ClosingStatus | null;
  size?: 'sm' | 'md';
}

/**
 * Badge status kas closing.
 * OPEN   → warning "BELUM CLOSING"
 * CLOSED → success "SUDAH CLOSING"
 * null   → neutral "BELUM ADA DATA"
 * §20/§24: status selalu disertai teks label, tidak pernah warna saja.
 */
export function ClosingStatusBadge({ status, size = 'md' }: ClosingStatusBadgeProps) {
  if (status === 'CLOSED') {
    return (
      <Badge variant="success" size={size}>
        SUDAH CLOSING
      </Badge>
    );
  }

  if (status === 'OPEN') {
    return (
      <Badge variant="warning" size={size}>
        KAS TERBUKA
      </Badge>
    );
  }

  // null: belum ada closing sama sekali hari ini
  return (
    <Badge variant="warning" size={size}>
      BELUM CLOSING
    </Badge>
  );
}

interface VarianceBadgeProps {
  variance: string; // string Decimal dari API
}

/**
 * Badge selisih kas (variance).
 * Negatif  → danger  "Kurang Rp X"
 * Positif  → success "Lebih Rp X"
 * Nol      → success "Selisih Nol"
 * §24: DILARANG parseFloat; gunakan string comparison untuk sign check.
 */
export function VarianceBadge({ variance }: VarianceBadgeProps) {
  const isNegative = variance.startsWith('-');
  const isZero = variance === '0' || variance === '0.00';

  if (isZero) {
    return <Badge variant="success">Selisih Nol</Badge>;
  }

  if (isNegative) {
    // Strip tanda minus untuk format, lalu tambah prefix "Kurang"
    const absStr = variance.slice(1);
    return (
      <Badge variant="danger">
        Kurang {formatVarianceDisplay(absStr)}
      </Badge>
    );
  }

  return (
    <Badge variant="success">
      Lebih {formatVarianceDisplay(variance)}
    </Badge>
  );
}

/**
 * Format string Decimal untuk tampilan variance.
 * DILARANG parseFloat — gunakan string manipulation sesuai §24.
 */
function formatVarianceDisplay(decimalStr: string): string {
  const parts = decimalStr.split('.');
  const integerPart = parts[0] || '0';
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${formattedInteger}`;
}

import React from 'react';
import { Card, CardContent } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Construction, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export interface PlaceholderProps {
  title: string;
  description?: string;
  badgeText?: string;
  icon?: React.ReactNode;
  actionText?: string;
  actionHref?: string;
}

export function Placeholder({
  title,
  description = 'Modul ini sedang dalam tahap pengembangan aktif untuk fase berikutnya.',
  badgeText = 'Fase Selanjutnya',
  icon,
  actionText = 'Kembali ke Dashboard',
  actionHref = '/admin',
}: PlaceholderProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto my-8 border-dashed border-2">
      <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary mb-4">
          {icon || <Construction className="h-8 w-8" />}
        </div>
        <Badge variant="primary" className="mb-3">
          {badgeText}
        </Badge>
        <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted max-w-md mb-6">{description}</p>
        {actionHref && (
          <Link href={actionHref}>
            <Button variant="secondary" size="md" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {actionText}
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-lg border border-dashed border-border bg-surface/50">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-muted mb-3">
        {icon || <AlertCircle className="h-6 w-6" />}
      </div>
      <h4 className="text-sm font-semibold text-foreground mb-1">{title}</h4>
      {description && <p className="text-xs text-muted max-w-sm mb-4">{description}</p>}
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({
  title = 'Terjadi Kesalahan',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-danger-bg p-4 text-danger-text flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-danger-icon shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <h5 className="font-semibold text-danger-text">{title}</h5>
        <p className="mt-0.5 text-xs text-red-700">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          className="shrink-0 text-xs gap-1 border-red-200 hover:bg-red-100"
        >
          <RefreshCw className="h-3 w-3" />
          Coba Lagi
        </Button>
      )}
    </div>
  );
}

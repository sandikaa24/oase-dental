import React from 'react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@oase/shared';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    'inline-flex items-center font-medium rounded-full transition-colors select-none';

  const variants = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200',
    primary: 'bg-primary-soft text-primary border border-teal-200',
    success: 'bg-success-bg text-success-text border border-green-200',
    warning: 'bg-warning-bg text-warning-text border border-amber-200',
    danger: 'bg-danger-bg text-danger-text border border-red-200',
    info: 'bg-info-bg text-info-text border border-blue-200',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </span>
  );
}

export interface RoleBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  role: UserRole | string;
  size?: 'sm' | 'md';
}

export function RoleBadge({ role, size = 'md', className, ...props }: RoleBadgeProps) {
  const normalizedRole = role.toUpperCase();

  const roleStyles: Record<string, string> = {
    OWNER: 'bg-role-owner-bg text-role-owner-text border border-purple-200',
    MANAGER: 'bg-role-manager-bg text-role-manager-text border border-blue-200',
    CASHIER: 'bg-role-cashier-bg text-role-cashier-text border border-teal-200',
    EMPLOYEE: 'bg-role-employee-bg text-role-employee-text border border-slate-200',
  };

  const currentStyle = roleStyles[normalizedRole] || 'bg-slate-100 text-slate-700 border border-slate-200';

  const sizes = {
    sm: 'px-2 py-0.5 text-xs font-semibold rounded-full',
    md: 'px-2.5 py-0.5 text-xs font-semibold rounded-full',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium select-none',
        currentStyle,
        sizes[size],
        className
      )}
      {...props}
    >
      {normalizedRole}
    </span>
  );
}

import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  helperText?: string;
  prefix?: React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, containerClassName, label, error, helperText, prefix, id, type, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className={cn('w-full', (label || error || helperText) && 'space-y-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-muted select-none">
              {prefix}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              'flex h-10 w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-slate-400 transition-colors',
              'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-primary-soft',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50',
              prefix && 'pl-10',
              error && 'border-danger-icon focus-visible:border-danger-icon focus-visible:ring-danger-bg',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-danger-text font-medium">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

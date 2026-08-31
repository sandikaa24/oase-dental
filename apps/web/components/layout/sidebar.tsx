'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { getAuthorizedNavItems, type NavItem } from '@/lib/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  CreditCard,
  Clock,
  CalendarDays,
  Database,
  BarChart3,
  Users,
  Building2,
  ShieldAlert,
  Globe,
  Sparkles,
  X,
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  CreditCard,
  Clock,
  CalendarDays,
  Database,
  BarChart3,
  Users,
  Building2,
  ShieldAlert,
  Globe,
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const authorizedItems = getAuthorizedNavItems(user?.permissions || []);

  const renderNavGroup = (items: NavItem[], groupTitle?: string) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-1 mb-4">
        {groupTitle && (
          <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
            {groupTitle}
          </div>
        )}
        {items.map((item) => {
          const Icon = iconMap[item.iconName] || LayoutDashboard;
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-primary-soft text-primary font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  isActive ? 'text-primary' : 'text-slate-400'
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  };

  const mainItems = authorizedItems.filter((i) => !i.group || i.group === 'main');
  const operationItems = authorizedItems.filter((i) => i.group === 'operations');
  const managementItems = authorizedItems.filter((i) => i.group === 'management');
  const systemItems = authorizedItems.filter((i) => i.group === 'system');

  const sidebarContent = (
    <div className="flex h-full flex-col bg-surface border-r border-border">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-border">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-foreground block leading-tight">
              OASE Dental
            </span>
            <span className="text-[11px] text-muted block leading-tight">
              Clinic Management
            </span>
          </div>
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 text-muted hover:text-foreground rounded-md"
            aria-label="Tutup Menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {renderNavGroup(mainItems)}
        {renderNavGroup(operationItems, 'Operasional')}
        {renderNavGroup(managementItems, 'Manajemen')}
        {renderNavGroup(systemItems, 'Sistem')}
      </div>

      {/* Footer Version */}
      <div className="p-4 border-t border-border bg-slate-50/50">
        <p className="text-[11px] text-muted text-center">
          OASE Dental v2.0 &bull; 2026
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative flex w-64 max-w-xs flex-1 flex-col bg-surface shadow-md">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

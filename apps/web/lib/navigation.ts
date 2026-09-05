import { Permission } from '@oase/shared';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  iconName: string;
  /** Permission yang dibutuhkan. Jika array, cukup memiliki salah satu (OR). Jika undefined, terbuka untuk semua role terautentikasi. */
  requiredPermission?: Permission | Permission[];
  /** Sub-kategori atau grup menu */
  group?: 'main' | 'operations' | 'management' | 'system';
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/admin',
    iconName: 'LayoutDashboard',
    group: 'main',
  },
  {
    id: 'pos',
    label: 'Kasir (POS)',
    href: '/admin/pos',
    iconName: 'ShoppingCart',
    requiredPermission: Permission.POS_CREATE,
    group: 'operations',
  },
  {
    id: 'cash-closing',
    label: 'Tutup Kas',
    href: '/admin/cash-closing',
    iconName: 'Receipt',
    requiredPermission: Permission.CASH_CLOSING_CREATE,
    group: 'operations',
  },
  {
    id: 'stock',
    label: 'Stok',
    href: '/admin/stock',
    iconName: 'Boxes',
    group: 'operations',
  },
  {
    id: 'inventory',
    label: 'Inventaris & Bahan',
    href: '/admin/inventory',
    iconName: 'Package',
    requiredPermission: [
      Permission.STOCK_IN,
      Permission.STOCK_OPNAME_MANAGE,
      Permission.STOCK_REPORT,
    ],
    group: 'operations',
  },
  {
    id: 'expenses',
    label: 'Pengeluaran',
    href: '/admin/expenses',
    iconName: 'CreditCard',
    requiredPermission: [Permission.EXPENSE_CREATE, Permission.EXPENSE_REPORT],
    group: 'operations',
  },
  {
    id: 'attendance',
    label: 'Absensi',
    href: '/admin/attendance',
    iconName: 'Clock',
    requiredPermission: [Permission.ATTENDANCE_SELF, Permission.ATTENDANCE_VIEW_ALL],
    group: 'operations',
  },
  {
    id: 'leaves',
    label: 'Cuti & Izin',
    href: '/admin/leaves',
    iconName: 'CalendarDays',
    requiredPermission: [Permission.LEAVE_REQUEST, Permission.LEAVE_DECIDE],
    group: 'operations',
  },
  {
    id: 'master-data',
    label: 'Master Data',
    href: '/admin/master-data',
    iconName: 'Database',
    requiredPermission: [Permission.MASTER_DATA_READ, Permission.MASTER_DATA_MANAGE],
    group: 'management',
  },
  {
    id: 'reports',
    label: 'Laporan',
    href: '/admin/reports',
    iconName: 'BarChart3',
    requiredPermission: [
      Permission.SALES_REPORT,
      Permission.STOCK_REPORT,
      Permission.EXPENSE_REPORT,
    ],
    group: 'management',
  },
  {
    id: 'users',
    label: 'Pengguna',
    href: '/admin/users',
    iconName: 'Users',
    requiredPermission: Permission.USER_MANAGE,
    group: 'system',
  },
  {
    id: 'branches',
    label: 'Cabang',
    href: '/admin/branches',
    iconName: 'Building2',
    requiredPermission: Permission.BRANCH_MANAGE,
    group: 'system',
  },
  {
    id: 'audit-logs',
    label: 'Audit Log',
    href: '/admin/audit-logs',
    iconName: 'ShieldAlert',
    requiredPermission: Permission.AUDIT_LOG_VIEW,
    group: 'system',
  },
  {
    id: 'portal',
    label: 'Portal Publik',
    href: '/admin/portal',
    iconName: 'Globe',
    requiredPermission: Permission.PORTAL_CONTENT_MANAGE,
    group: 'system',
  },
];

/**
 * Filter menu navigasi berdasarkan daftar permission user.
 * BINDING: Keputusan A3 — filter by user.permissions, bukan hardcoded role.
 */
export function getAuthorizedNavItems(userPermissions: Permission[] = []): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.requiredPermission) return true;

    if (Array.isArray(item.requiredPermission)) {
      return item.requiredPermission.some((perm) => userPermissions.includes(perm));
    }

    return userPermissions.includes(item.requiredPermission);
  });
}

/**
 * Cek apakah user memiliki izin untuk mengakses item menu / route tertentu.
 */
export function canAccessPath(path: string, userPermissions: Permission[] = []): boolean {
  if (path === '/admin') return true;

  const item = NAV_ITEMS.find((nav) => path === nav.href || path.startsWith(`${nav.href}/`));
  if (!item || !item.requiredPermission) return true;

  if (Array.isArray(item.requiredPermission)) {
    return item.requiredPermission.some((perm) => userPermissions.includes(perm));
  }

  return userPermissions.includes(item.requiredPermission);
}

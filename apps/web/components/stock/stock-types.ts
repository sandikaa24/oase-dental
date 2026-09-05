export type ExpiredWarning = 'EXPIRED' | 'EXPIRING_SOON' | 'NORMAL';

export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

export interface StockItem {
  productId: string;
  name: string;
  sku: string | null;
  unit: string;
  category: string;
  costPrice: string | number | null;
  branchId: string;
  stockId: string | null;
  quantity: number;
  minStock: number;
  expiredDate: string | null;
  expiredWarning: ExpiredWarning;
  isLowStock: boolean;
  updatedAt: string;
}

export interface ProductItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  category: string;
  costPrice: string | number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovementItem {
  id: string;
  productId: string;
  branchId: string;
  type: StockMovementType;
  qty: number;
  qtyBefore: number;
  qtyAfter: number;
  note: string | null;
  userId: string;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    unit: string;
    category: string;
    sku: string | null;
  };
  branch?: {
    id: string;
    code: string;
    name: string;
  };
  user?: {
    id: string;
    email: string;
    username: string | null;
  };
}

export interface StockListResponse {
  branchId: string;
  items: StockItem[];
}

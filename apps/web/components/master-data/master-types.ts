export interface Category {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  categoryId?: string | null;
  category?: Category | null;
  name: string;
  nameEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  price: string | number;
  active: boolean;
  showOnPortal: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Material {
  id: string;
  name: string;
  sku: string;
  unit: string;
  minStock: number;
  isStockTracked: boolean;
  active: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MasterTabType = 'services' | 'materials' | 'categories';

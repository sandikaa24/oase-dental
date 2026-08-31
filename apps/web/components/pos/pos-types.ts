export interface PosCatalogItem {
  id: string;
  name: string;
  type: 'SERVICE' | 'PRODUCT';
  price: string;
  stock: number | null;
  unit: string | null;
  category: { id: string; name: string } | null;
}

export interface PosCartItem {
  id: string;
  itemId: string;
  itemType: 'SERVICE' | 'PRODUCT';
  name: string;
  price: string;
  quantity: number;
  availableStock: number | null;
  unit: string | null;
}

export interface PosTransactionItem {
  id: string;
  itemType: 'SERVICE' | 'PRODUCT';
  serviceId: string | null;
  productId: string | null;
  itemId: string;
  name: string;
  unit: string | null;
  price: string;
  quantity: number;
  lineTotal: string;
}

export interface PosPayment {
  id?: string;
  method: 'CASH' | 'DEBIT' | 'QRIS_TRANSFER';
  amount: string;
}

export interface PosTransaction {
  id: string;
  transactionNumber: string;
  status: 'DRAFT' | 'PAID' | 'CANCELLED';
  branchId: string;
  cashierId: string | null;
  patientName: string | null;
  patientPhone: string | null;
  subtotal: string;
  discountAmount: string;
  discountReason: string | null;
  total: string;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  branch?: {
    id: string;
    code: string;
    name: string;
  };
  items?: PosTransactionItem[];
  payments?: PosPayment[];
}

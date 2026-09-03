export interface PosCatalogItem {
  id: string;
  name: string;
  type: 'SERVICE';
  price: string;
  stock: null;
  unit: null;
  category: { id: string; name: string } | null;
}

export interface PosCartItem {
  id: string;
  itemId: string;
  itemType: 'SERVICE';
  name: string;
  price: string;
  quantity: number;
}

export interface PosTransactionItem {
  id: string;
  itemType: 'SERVICE';
  serviceId: string;
  itemId: string;
  name: string;
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

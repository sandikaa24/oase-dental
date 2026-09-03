export type ItemType = 'MATERIAL';

export type MovementType =
  | 'STOCK_IN'
  | 'TRANSACTION'
  | 'MANUAL_ADJUSTMENT'
  | 'DAMAGE'
  | 'EXPIRED'
  | 'OPNAME';

export type StockOutReason = 'MANUAL_ADJUSTMENT' | 'DAMAGE' | 'EXPIRED';

export type OpnameStatus = 'DRAFT' | 'SUBMITTED';

export interface StockItem {
  id: string;
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  itemType: ItemType;
  itemId: string;
  name: string;
  sku: string;
  unit: string;
  minStock: number;
  quantity: number;
  isLowStock: boolean;
  isStockTracked?: boolean;
}

export interface InventoryMovementItem {
  id: string;
  branchId: string;
  itemType: ItemType;
  itemId: string;
  quantityDelta: number;
  referenceType: MovementType;
  referenceId: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface MovementDetailResponse {
  item: {
    id: string;
    itemType: ItemType;
    name: string;
    sku: string;
    unit: string;
    currentQuantity: number;
  };
  movements: InventoryMovementItem[];
}

export interface StockOpnameSummary {
  id: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  opnameDate: string;
  status: OpnameStatus;
  itemCount: number;
  submittedAt: string | null;
  submittedBy: string | null;
  createdAt: string;
}

export interface StockOpnameItemDetail {
  id: string;
  itemId: string;
  name: string;
  sku: string;
  unit: string;
  itemType: ItemType;
  systemQty: number;
  physicalQty: number;
  difference: number;
  note: string | null;
}

export interface StockOpnameDetail {
  id: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  opnameDate: string;
  status: OpnameStatus;
  submittedAt: string | null;
  submittedBy: string | null;
  items: StockOpnameItemDetail[];
  createdAt: string;
}

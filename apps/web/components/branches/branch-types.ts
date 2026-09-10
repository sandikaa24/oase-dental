export interface BranchWorkingHour {
  id: string;
  branchId: string;
  openTime: string;
  closeTime: string;
  lateAfter: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string;
  phone?: string | null;
  active: boolean;
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadius?: number;
  workingHours?: BranchWorkingHour | null;
  createdAt: string;
  updatedAt: string;
}

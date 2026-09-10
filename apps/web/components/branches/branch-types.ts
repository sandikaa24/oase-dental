export interface BranchWorkingHour {
  id: string;
  branchId: string;
  openTime: string;
  closeTime: string;
  lateAfter: string;
  morningOpen?: string;
  morningClose?: string;
  morningLateAfter?: string;
  eveningOpen?: string;
  eveningClose?: string;
  eveningLateAfter?: string;
  saturdayEveningClosed?: boolean;
  sundayClosed?: boolean;
  daysSchedule?: Record<string, unknown> | null;
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

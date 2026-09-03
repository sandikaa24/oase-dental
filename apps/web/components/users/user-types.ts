export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'EMPLOYEE';

export interface EmployeeBranchAssignment {
  id: string;
  branchId: string;
  active: boolean;
  branch: {
    id: string;
    code: string;
    name: string;
  };
}

export interface Employee {
  id: string;
  name: string;
  phone?: string | null;
  position: string;
  active: boolean;
  branches: EmployeeBranchAssignment[];
  user?: {
    id: string;
    email: string;
    role: UserRole;
    active: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  employeeId?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    name: string;
    phone?: string | null;
    position: string;
    active: boolean;
    branches: EmployeeBranchAssignment[];
  } | null;
}

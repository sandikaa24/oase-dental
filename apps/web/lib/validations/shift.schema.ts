import { z } from 'zod';

const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const workShiftEnum = z.enum(['MORNING', 'EVENING']);
export const shiftSourceEnum = z.enum(['MANUAL', 'SWAP']);
export const swapStatusEnum = z.enum(['PENDING_PEER', 'PENDING_OWNER', 'APPROVED', 'REJECTED', 'CANCELLED']);

export const createShiftAssignmentSchema = z.object({
  employeeId: z.string().uuid('employeeId harus berupa UUID valid'),
  branchId: z.string().uuid('branchId harus berupa UUID valid'),
  date: z.string().regex(dateRegex, 'Format tanggal harus YYYY-MM-DD'),
  shift: workShiftEnum,
});

export const listShiftsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  date: z.string().regex(dateRegex).optional(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  employeeId: z.string().uuid().optional(),
});

export const createSwapRequestSchema = z.object({
  targetEmployeeId: z.string().uuid('targetEmployeeId harus berupa UUID valid'),
  date: z.string().regex(dateRegex, 'Format tanggal harus YYYY-MM-DD'),
  requesterShift: workShiftEnum,
  targetShift: workShiftEnum,
  note: z.string().max(255).optional(),
});

export const respondSwapPeerSchema = z.object({
  approved: z.boolean(),
  note: z.string().max(255).optional(),
});

export const decideSwapOwnerSchema = z.object({
  approved: z.boolean(),
  note: z.string().max(255).optional(),
});

export const listSwapsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: swapStatusEnum.optional(),
  date: z.string().regex(dateRegex).optional(),
});

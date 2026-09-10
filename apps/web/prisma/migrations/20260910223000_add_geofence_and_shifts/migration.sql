-- CreateEnum
CREATE TYPE "WorkShift" AS ENUM ('MORNING', 'EVENING');

-- CreateEnum
CREATE TYPE "ShiftSource" AS ENUM ('MANUAL', 'SWAP');

-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('PENDING_PEER', 'PENDING_OWNER', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ATTENDANCE_OUT_OF_RANGE';
ALTER TYPE "AuditAction" ADD VALUE 'ATTENDANCE_AUTO_CHECKOUT';
ALTER TYPE "AuditAction" ADD VALUE 'SHIFT_SWAP_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'SHIFT_SWAP_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'SHIFT_SWAP_REJECTED';

-- DropIndex
DROP INDEX IF EXISTS "attendances_employeeId_workDate_branchId_key";

-- DropIndex
DROP INDEX IF EXISTS "attendances_workDate_idx";

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN "accuracyMeters" DOUBLE PRECISION,
ADD COLUMN "autoCheckout" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "distanceMeters" DOUBLE PRECISION,
ADD COLUMN "lateCheckoutMinutes" INTEGER,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "shift" "WorkShift" NOT NULL DEFAULT 'MORNING';

-- AlterTable
ALTER TABLE "branches" ADD COLUMN "geofenceRadius" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" "WorkShift" NOT NULL,
    "source" "ShiftSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_swap_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "requesterShift" "WorkShift" NOT NULL,
    "targetShift" "WorkShift" NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING_PEER',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_assignments_branchId_date_idx" ON "shift_assignments"("branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_employeeId_date_shift_key" ON "shift_assignments"("employeeId", "date", "shift");

-- CreateIndex
CREATE INDEX "shift_swap_requests_requesterId_date_idx" ON "shift_swap_requests"("requesterId", "date");

-- CreateIndex
CREATE INDEX "shift_swap_requests_targetId_date_idx" ON "shift_swap_requests"("targetId", "date");

-- CreateIndex
CREATE INDEX "attendances_branchId_workDate_idx" ON "attendances"("branchId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_employeeId_workDate_shift_key" ON "attendances"("employeeId", "workDate", "shift");

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

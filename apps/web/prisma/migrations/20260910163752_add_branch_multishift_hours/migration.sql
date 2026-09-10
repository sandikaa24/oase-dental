-- AlterTable
ALTER TABLE "branch_working_hours" ADD COLUMN     "daysSchedule" JSONB,
ADD COLUMN     "eveningClose" TEXT NOT NULL DEFAULT '21:00',
ADD COLUMN     "eveningLateAfter" TEXT NOT NULL DEFAULT '16:15',
ADD COLUMN     "eveningOpen" TEXT NOT NULL DEFAULT '16:00',
ADD COLUMN     "morningClose" TEXT NOT NULL DEFAULT '13:00',
ADD COLUMN     "morningLateAfter" TEXT NOT NULL DEFAULT '09:15',
ADD COLUMN     "morningOpen" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN     "saturdayEveningClosed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sundayClosed" BOOLEAN NOT NULL DEFAULT true;

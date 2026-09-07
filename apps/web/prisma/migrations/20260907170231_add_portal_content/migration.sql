-- CreateEnum
CREATE TYPE "PortalContentType" AS ENUM ('ARTICLE', 'FAQ', 'TESTIMONI', 'BEFORE_AFTER', 'PATIENT_GUIDE', 'FACILITY', 'TECHNOLOGY', 'DOCTOR');

-- CreateTable
CREATE TABLE "portal_contents" (
    "id" TEXT NOT NULL,
    "type" "PortalContentType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "body" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "isDemoContent" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "patientConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_contents_slug_key" ON "portal_contents"("slug");

-- CreateIndex
CREATE INDEX "portal_contents_type_published_sortOrder_idx" ON "portal_contents"("type", "published", "sortOrder");

-- CreateIndex
CREATE INDEX "portal_contents_slug_idx" ON "portal_contents"("slug");

-- AddForeignKey
ALTER TABLE "portal_contents" ADD CONSTRAINT "portal_contents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_contents" ADD CONSTRAINT "portal_contents_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Tambah category dan costPrice di materials
ALTER TABLE "materials" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Bahan Tindakan';
ALTER TABLE "materials" ADD COLUMN "costPrice" DECIMAL(12,2);

-- Buat tabel material_branch_stocks
CREATE TABLE "material_branch_stocks" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_branch_stocks_pkey" PRIMARY KEY ("id")
);

-- Buat tabel material_stock_batches
CREATE TABLE "material_stock_batches" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "expiredDate" DATE,
    "costPrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_stock_batches_pkey" PRIMARY KEY ("id")
);

-- Bersihkan data legacy stock_movements dan drop tabel legacy products
TRUNCATE TABLE "stock_movements" CASCADE;
DROP TABLE IF EXISTS "product_branch_stocks" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;

-- Sesuaikan kolom stock_movements
ALTER TABLE "stock_movements" DROP COLUMN "productId";
ALTER TABLE "stock_movements" ADD COLUMN "materialId" TEXT NOT NULL;
ALTER TABLE "stock_movements" ADD COLUMN "batchId" TEXT;

-- CreateIndex
CREATE INDEX "material_branch_stocks_branchId_idx" ON "material_branch_stocks"("branchId");
CREATE UNIQUE INDEX "material_branch_stocks_materialId_branchId_key" ON "material_branch_stocks"("materialId", "branchId");

CREATE INDEX "material_stock_batches_materialId_branchId_idx" ON "material_stock_batches"("materialId", "branchId");
CREATE INDEX "material_stock_batches_branchId_expiredDate_idx" ON "material_stock_batches"("branchId", "expiredDate");

CREATE INDEX "stock_movements_materialId_branchId_createdAt_idx" ON "stock_movements"("materialId", "branchId", "createdAt");

-- AddForeignKey
ALTER TABLE "material_branch_stocks" ADD CONSTRAINT "material_branch_stocks_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_branch_stocks" ADD CONSTRAINT "material_branch_stocks_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "material_stock_batches" ADD CONSTRAINT "material_stock_batches_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_stock_batches" ADD CONSTRAINT "material_stock_batches_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "material_stock_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

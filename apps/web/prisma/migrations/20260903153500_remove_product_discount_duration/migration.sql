-- AlterTable: Drop transaction_items dependent columns first
ALTER TABLE "transaction_items" DROP COLUMN IF EXISTS "itemType",
DROP COLUMN IF EXISTS "productId",
DROP COLUMN IF EXISTS "unit",
ALTER COLUMN "serviceId" SET NOT NULL;

-- AlterEnum: Update ItemType enum to only contain MATERIAL
BEGIN;
CREATE TYPE "ItemType_new" AS ENUM ('MATERIAL');
ALTER TABLE "inventory_movements" ALTER COLUMN "itemType" TYPE "ItemType_new" USING ("itemType"::text::"ItemType_new");
ALTER TABLE "stock_levels" ALTER COLUMN "itemType" TYPE "ItemType_new" USING ("itemType"::text::"ItemType_new");
ALTER TABLE "stock_opname_items" ALTER COLUMN "itemType" TYPE "ItemType_new" USING ("itemType"::text::"ItemType_new");
ALTER TYPE "ItemType" RENAME TO "ItemType_old";
ALTER TYPE "ItemType_new" RENAME TO "ItemType";
DROP TYPE "ItemType_old";
COMMIT;

-- AlterTable
ALTER TABLE "inventory_movements" DROP COLUMN IF EXISTS "productId";

-- AlterTable
ALTER TABLE "services" DROP COLUMN IF EXISTS "durationMinutes";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "discountAmount",
DROP COLUMN IF EXISTS "discountReason";

-- DropTable
DROP TABLE IF EXISTS "products";

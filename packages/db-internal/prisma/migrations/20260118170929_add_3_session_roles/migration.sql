/*
  Warnings:

  - The values [MANAGER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'LEGAL_USER', 'POS_USER');
ALTER TABLE "public"."users_internal" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users_internal" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "users_internal" ALTER COLUMN "role" SET DEFAULT 'POS_USER';
COMMIT;

-- AlterTable
ALTER TABLE "movements_internal" ADD COLUMN     "snapshot_product_name" VARCHAR(255);

-- AlterTable
ALTER TABLE "users_internal" ALTER COLUMN "role" SET DEFAULT 'POS_USER';

-- CreateIndex
CREATE INDEX "movements_internal_created_at_idx" ON "movements_internal"("created_at");

-- CreateIndex
CREATE INDEX "movements_internal_type_idx" ON "movements_internal"("type");

-- CreateIndex
CREATE INDEX "movements_internal_product_id_idx" ON "movements_internal"("product_id");

-- CreateIndex
CREATE INDEX "products_internal_name_idx" ON "products_internal"("name");

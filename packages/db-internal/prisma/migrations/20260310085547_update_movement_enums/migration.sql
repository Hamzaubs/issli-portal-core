/*
  Warnings:

  - You are about to drop the `client_payments` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementType" ADD VALUE 'SALE_CREDIT';
ALTER TYPE "MovementType" ADD VALUE 'PAYMENT';

-- DropForeignKey
ALTER TABLE "client_payments" DROP CONSTRAINT "client_payments_client_id_fkey";

-- DropIndex
DROP INDEX "movements_internal_created_at_idx";

-- DropIndex
DROP INDEX "movements_internal_type_idx";

-- AlterTable
ALTER TABLE "clients_internal" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "ice" VARCHAR(50);

-- AlterTable
ALTER TABLE "movements_internal" ADD COLUMN     "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentRef" TEXT;

-- DropTable
DROP TABLE "client_payments";

-- CreateIndex
CREATE INDEX "clients_internal_ice_idx" ON "clients_internal"("ice");

-- CreateIndex
CREATE INDEX "clients_internal_balance_idx" ON "clients_internal"("balance");

-- CreateIndex
CREATE INDEX "movements_internal_created_at_type_idx" ON "movements_internal"("created_at", "type");

-- CreateIndex
CREATE INDEX "movements_internal_client_id_idx" ON "movements_internal"("client_id");

/*
  Warnings:

  - You are about to drop the column `created_at` on the `products_internal` table. All the data in the column will be lost.
  - You are about to drop the column `technicalSpecs` on the `products_internal` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `products_internal` table. All the data in the column will be lost.
  - You are about to alter the column `internal_sku` on the `products_internal` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.

*/
-- DropIndex
DROP INDEX "products_internal_name_idx";

-- AlterTable
ALTER TABLE "clients_internal" ADD COLUMN     "balance" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "movements_internal" ADD COLUMN     "paymentMethod" TEXT DEFAULT 'CASH';

-- AlterTable
ALTER TABLE "products_internal" DROP COLUMN "created_at",
DROP COLUMN "technicalSpecs",
DROP COLUMN "updated_at",
ADD COLUMN     "technical_specs" TEXT,
ALTER COLUMN "internal_sku" SET DATA TYPE VARCHAR(50);

-- CreateTable
CREATE TABLE "client_payments" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients_internal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements_internal" ADD CONSTRAINT "movements_internal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users_internal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

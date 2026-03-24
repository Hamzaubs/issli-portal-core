/*
  Warnings:

  - You are about to drop the column `productId` on the `invoice_items` table. All the data in the column will be lost.
  - You are about to drop the column `clientIceSnapshot` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `clientNameSnapshot` on the `invoices` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_invoiceId_fkey";

-- DropIndex
DROP INDEX "invoices_type_idx";

-- DropIndex
DROP INDEX "products_legal_name_idx";

-- AlterTable
ALTER TABLE "clients_legal" ADD COLUMN     "phone" VARCHAR(50);

-- AlterTable
ALTER TABLE "invoice_items" DROP COLUMN "productId",
ADD COLUMN     "measure_unit" TEXT,
ADD COLUMN     "product_id" TEXT,
ADD COLUMN     "technical_specs" TEXT,
ADD COLUMN     "unit_purchase_cost_snapshot" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vat_rate_snapshot" DECIMAL(4,2) NOT NULL DEFAULT 0.20;

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "clientIceSnapshot",
DROP COLUMN "clientNameSnapshot",
ADD COLUMN     "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "client_address_snapshot" TEXT,
ADD COLUMN     "client_ice_snapshot" TEXT,
ADD COLUMN     "client_name_snapshot" TEXT,
ADD COLUMN     "legacy_reference" TEXT,
ADD COLUMN     "note" TEXT,
ALTER COLUMN "status" SET DEFAULT 'EN_ATTENTE';

-- AlterTable
ALTER TABLE "products_legal" ADD COLUMN     "purchase_cost" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payments_legal" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_legal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL DEFAULT '1',
    "name" TEXT NOT NULL DEFAULT 'MA SOCIETE',
    "ice" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logo_url" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_legal_paid_at_idx" ON "payments_legal"("paid_at");

-- CreateIndex
CREATE INDEX "clients_legal_ice_idx" ON "clients_legal"("ice");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments_legal" ADD CONSTRAINT "payments_legal_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

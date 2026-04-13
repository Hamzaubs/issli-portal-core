-- AlterTable
ALTER TABLE "movements_internal" ADD COLUMN     "batch_id" TEXT;

-- CreateTable
CREATE TABLE "suppliers_internal" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "address" TEXT,
    "ice" VARCHAR(50),
    "rc" VARCHAR(50),
    "if" VARCHAR(50),
    "patente" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_internal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices_internal" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "type" TEXT NOT NULL DEFAULT 'FACTURE_ACHAT',
    "totalHT" DECIMAL(12,2) NOT NULL,
    "totalTTC" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "supplier_name_snapshot" TEXT,
    "supplier_ice_snapshot" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_invoices_internal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items_internal" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "product_id" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPriceHT" DECIMAL(10,2) NOT NULL,
    "vat_rate_snapshot" DECIMAL(4,2) NOT NULL DEFAULT 0.20,

    CONSTRAINT "purchase_items_internal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_internal_ice_key" ON "suppliers_internal"("ice");

-- CreateIndex
CREATE INDEX "suppliers_internal_ice_idx" ON "suppliers_internal"("ice");

-- CreateIndex
CREATE INDEX "suppliers_internal_name_idx" ON "suppliers_internal"("name");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_internal_reference_key" ON "purchase_invoices_internal"("reference");

-- CreateIndex
CREATE INDEX "purchase_invoices_internal_issuedAt_status_idx" ON "purchase_invoices_internal"("issuedAt", "status");

-- CreateIndex
CREATE INDEX "purchase_invoices_internal_supplier_id_idx" ON "purchase_invoices_internal"("supplier_id");

-- CreateIndex
CREATE INDEX "movements_internal_batch_id_idx" ON "movements_internal"("batch_id");

-- AddForeignKey
ALTER TABLE "purchase_invoices_internal" ADD CONSTRAINT "purchase_invoices_internal_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers_internal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items_internal" ADD CONSTRAINT "purchase_items_internal_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "purchase_invoices_internal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

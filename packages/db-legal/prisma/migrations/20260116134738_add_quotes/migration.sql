-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'FACTURE';

-- CreateTable
CREATE TABLE "quote_sequences" (
    "year" INTEGER NOT NULL,
    "lastCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE INDEX "invoices_type_idx" ON "invoices"("type");

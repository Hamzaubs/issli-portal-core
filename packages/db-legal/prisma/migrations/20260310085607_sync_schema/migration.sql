-- DropIndex
DROP INDEX "invoices_issuedAt_idx";

-- DropIndex
DROP INDEX "invoices_status_idx";

-- CreateIndex
CREATE INDEX "invoices_issuedAt_status_idx" ON "invoices"("issuedAt", "status");

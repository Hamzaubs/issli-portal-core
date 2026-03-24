/*
  Warnings:

  - A unique constraint covering the columns `[ice]` on the table `clients_legal` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "clients_legal_ice_key" ON "clients_legal"("ice");

-- CreateIndex
CREATE INDEX "clients_legal_name_idx" ON "clients_legal"("name");

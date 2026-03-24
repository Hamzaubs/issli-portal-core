/*
  Warnings:

  - You are about to drop the column `clientId` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the `clients` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_clientId_fkey";

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "clientId",
ADD COLUMN     "client_id" TEXT;

-- DropTable
DROP TABLE "clients";

-- CreateTable
CREATE TABLE "clients_legal" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "ice" VARCHAR(50),
    "address" TEXT,
    "city" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_legal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_legal_ice_key" ON "clients_legal"("ice");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients_legal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

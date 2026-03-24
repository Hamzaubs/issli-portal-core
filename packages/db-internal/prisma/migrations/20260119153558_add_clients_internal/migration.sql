-- AlterTable
ALTER TABLE "movements_internal" ADD COLUMN     "client_id" TEXT;

-- CreateTable
CREATE TABLE "clients_internal" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "category" TEXT NOT NULL DEFAULT 'STANDARD',
    "notes" TEXT,
    "total_spent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_internal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clients_internal_name_idx" ON "clients_internal"("name");

-- CreateIndex
CREATE INDEX "clients_internal_phone_idx" ON "clients_internal"("phone");

-- AddForeignKey
ALTER TABLE "movements_internal" ADD CONSTRAINT "movements_internal_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients_internal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

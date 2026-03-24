-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'MANAGER');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('SALE_CASH', 'RESTOCK', 'ADJUSTMENT', 'RETURN');

-- CreateTable
CREATE TABLE "products_internal" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "internal_sku" TEXT NOT NULL,
    "purchase_cost" DECIMAL(10,2) NOT NULL,
    "selling_price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "measureUnit" TEXT NOT NULL DEFAULT 'UNIT',
    "technicalSpecs" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_internal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movements_internal" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "type" "MovementType" NOT NULL,
    "snapshot_purchase_cost" DECIMAL(10,2),
    "snapshot_selling_price" DECIMAL(10,2),
    "amount" DECIMAL(10,2),
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movements_internal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users_internal" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MANAGER',

    CONSTRAINT "users_internal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_internal_internal_sku_key" ON "products_internal"("internal_sku");

-- CreateIndex
CREATE UNIQUE INDEX "users_internal_username_key" ON "users_internal"("username");

-- AddForeignKey
ALTER TABLE "movements_internal" ADD CONSTRAINT "movements_internal_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products_internal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

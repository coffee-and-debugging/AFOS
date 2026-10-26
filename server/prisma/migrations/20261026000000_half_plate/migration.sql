-- Optional half-plate portions: menu items may have a half price; order lines record the portion.

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "halfPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "portion" TEXT NOT NULL DEFAULT 'full';

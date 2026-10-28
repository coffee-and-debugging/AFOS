-- Bills split off for "pay for chosen items" point at the order they came from, so the kitchen
-- keeps one ticket per order (the split bill is for billing only).

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Order_parentId_idx" ON "Order"("parentId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Link splits made before this column existed: they copied the original's exact time and table
UPDATE "Order" c
SET "parentId" = p.id
FROM "Order" p
WHERE c."parentId" IS NULL
  AND c.id <> p.id
  AND c."createdAt" = p."createdAt"
  AND c."tableId" IS NOT DISTINCT FROM p."tableId"
  AND p."billNo" = (
    SELECT MIN(o."billNo") FROM "Order" o
    WHERE o."createdAt" = c."createdAt" AND o."tableId" IS NOT DISTINCT FROM c."tableId"
  )
  AND c."billNo" > p."billNo";

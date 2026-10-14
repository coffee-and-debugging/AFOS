-- Restaurant settings (single row) and menu categories.
-- Written defensively (IF NOT EXISTS / ON CONFLICT) so it is safe on databases
-- that were partially set up by hand before migrations were used.

CREATE TABLE IF NOT EXISTS "Restaurant" (
    "id"        INTEGER NOT NULL DEFAULT 1,
    "name"      TEXT NOT NULL,
    "tagline"   TEXT NOT NULL DEFAULT '',
    "currency"  TEXT NOT NULL DEFAULT 'Rs.',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Category" (
    "id"        SERIAL NOT NULL,
    "slug"      TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Category_slug_key" ON "Category"("slug");

-- Every category already used by a menu item must exist before the foreign key is added.
INSERT INTO "Category" ("slug", "name", "sortOrder")
SELECT DISTINCT m."category", INITCAP(m."category"), 100
FROM "MenuItem" m
ON CONFLICT ("slug") DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MenuItem_category_fkey') THEN
        ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_category_fkey"
            FOREIGN KEY ("category") REFERENCES "Category"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MenuItem_category_idx" ON "MenuItem"("category");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");

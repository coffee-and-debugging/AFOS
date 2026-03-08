-- Recreate MenuItem with autoincrement integer id
DROP TABLE IF EXISTS "MenuItem";

CREATE TABLE "MenuItem" (
    "id"          SERIAL NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price"       DOUBLE PRECISION NOT NULL,
    "category"    TEXT NOT NULL,
    "available"   BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

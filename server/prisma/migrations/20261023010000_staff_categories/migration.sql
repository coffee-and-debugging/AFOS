-- Staff categories (departments) that managers can extend.

-- CreateTable
CREATE TABLE "StaffCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT 'gray',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffCategory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "categoryId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "StaffCategory_name_key" ON "StaffCategory"("name");

-- CreateIndex
CREATE INDEX "User_categoryId_idx" ON "User"("categoryId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StaffCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starter departments; managers can rename, remove or add more.
INSERT INTO "StaffCategory" ("name", "description", "color", "sortOrder") VALUES
    ('Management', 'Owners and managers', 'red', 1),
    ('Front of House', 'Cashiers, hosts and billing', 'blue', 2),
    ('Kitchen', 'Chefs, cooks and kitchen helpers', 'orange', 3),
    ('Service', 'Waiters and runners', 'green', 4),
    ('Housekeeping', 'Cleaning and dishwashing', 'purple', 5);

-- Place existing staff in the department matching their role.
UPDATE "User" u SET "categoryId" = c."id"
FROM "StaffCategory" c
WHERE u."categoryId" IS NULL
  AND c."name" = CASE u."role" WHEN 'admin' THEN 'Management' WHEN 'cashier' THEN 'Front of House' WHEN 'chef' THEN 'Kitchen' END;

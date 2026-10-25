-- Table QR codes: a configurable guest address, and random permanent table ids
-- (so /table/<id>/ can't be guessed by changing a number).

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "qrBaseUrl" TEXT NOT NULL DEFAULT '';

-- Replace the old "table-<n>" ids. Orders follow automatically (Order_tableId_fkey is ON UPDATE CASCADE).
-- Previously printed QR codes stop working: reprint them from Tables & QR.
UPDATE "Table"
SET "id" = substr(translate(md5(random()::text || clock_timestamp()::text || "id"), '01', 'ab'), 1, 12)
WHERE "id" LIKE 'table-%';

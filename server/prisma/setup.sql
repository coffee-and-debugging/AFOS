-- Run this entire file in pgAdmin4 Query Tool on the 'afos' database
-- (Right-click afos database → Query Tool → paste this → Run)

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MenuItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Table" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "customerNote" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "paymentMethod" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 2. INDEXES & CONSTRAINTS
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "Table_number_key" ON "Table"("number");

ALTER TABLE "Order"
    DROP CONSTRAINT IF EXISTS "Order_tableId_fkey",
    ADD CONSTRAINT "Order_tableId_fkey"
        FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
    DROP CONSTRAINT IF EXISTS "OrderItem_orderId_fkey",
    ADD CONSTRAINT "OrderItem_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 3. Prisma migration tracking table
-- ============================================================

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count)
VALUES (
    gen_random_uuid()::text,
    'manual',
    '20240101000000_init',
    NOW(),
    1
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. SEED DATA
-- (passwords are bcrypt hashed: admin123, chef123)
-- ============================================================

INSERT INTO "User" (id, username, password, role, name) VALUES
('1', 'admin', '$2b$10$oUgZ7yPpoDOavHPJo.rv2.G0dsO5g0OPgAX8.L8OKHu2b/6mm0pg.', 'admin', 'Admin'),
('2', 'chef',  '$2b$10$fkCoZKvddwMrixzZLDY12uok3THj8vIT8Vq0gCbP.A9RTk8iG7MbK', 'chef',  'Chef')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "MenuItem" (id, name, description, price, category, available) VALUES
('1', 'Green Tea',    'Refreshing Japanese green tea',  150, 'tea',  true),
('2', 'Oolong Tea',   'Premium semi-oxidized oolong',   200, 'tea',  true),
('3', 'Matcha Latte', 'Smooth matcha with steamed milk',280, 'tea',  true),
('4', 'Earl Grey',    'Classic bergamot black tea',     150, 'tea',  true),
('5', 'Chamomile',    'Soothing herbal chamomile',      150, 'tea',  true),
('6', 'Egg Tart',     'Freshly baked silky egg tart',   120, 'food', true),
('7', 'Scone',        'Buttery scone with jam & cream', 180, 'food', true),
('8', 'Tea Sandwich', 'Assorted finger sandwiches',     250, 'food', true),
('9', 'Almond Cake',  'Light almond sponge cake slice', 220, 'food', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Table" (id, number) VALUES
('table-1', 1), ('table-2', 2), ('table-3', 3), ('table-4', 4)
ON CONFLICT (id) DO NOTHING;

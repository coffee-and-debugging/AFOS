-- Staff chat between the kitchen, the cashier and the manager (one conversation per pair of roles).

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "fromRole" TEXT NOT NULL,
    "toRole" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_fromRole_toRole_createdAt_idx" ON "ChatMessage"("fromRole", "toRole", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_toRole_readAt_idx" ON "ChatMessage"("toRole", "readAt");

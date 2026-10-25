-- Zid integration: additive changes only (no drops, no data changes).
-- Run once in the Neon SQL Editor BEFORE deploying the code that uses it.
-- Safe to run twice (IF NOT EXISTS everywhere).
-- Kept outside prisma/migrations on purpose: production was not created with
-- `prisma migrate`, so `migrate deploy` must not be run against it.

BEGIN;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "zidOrderId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "zidStatus" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_zidOrderId_key" ON "orders"("zidOrderId");

ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "dedupKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_logs_dedupKey_key" ON "webhook_logs"("dedupKey");

CREATE TABLE IF NOT EXISTS "zid_connections" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "storeName" TEXT,
    "authorizationToken" TEXT NOT NULL,
    "managerToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "webhooksError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "zid_connections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "zid_connections_storeId_key" ON "zid_connections"("storeId");

COMMIT;

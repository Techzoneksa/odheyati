-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SLAUGHTERED', 'MEDIA_UPLOADED', 'READY', 'VIEWED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "sallaOrderId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerMobile" TEXT NOT NULL,
    "customerMobileLast4" TEXT NOT NULL,
    "customerEmail" TEXT,
    "sallaStatus" TEXT,
    "proofStatus" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "proofToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sku" TEXT,
    "price" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_files" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "FileType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proof_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proof_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "orders_sallaOrderId_key" ON "orders"("sallaOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orders_proofToken_key" ON "orders"("proofToken");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "proof_files_orderId_idx" ON "proof_files"("orderId");

-- CreateIndex
CREATE INDEX "proof_events_orderId_idx" ON "proof_events"("orderId");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_files" ADD CONSTRAINT "proof_files_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_files" ADD CONSTRAINT "proof_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_events" ADD CONSTRAINT "proof_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_events" ADD CONSTRAINT "proof_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
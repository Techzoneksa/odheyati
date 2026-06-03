-- AddPlatformAndShopifySupport
CREATE TYPE "Platform" AS ENUM ('SALLA', 'SHOPIFY', 'MANUAL');

ALTER TABLE "orders" ADD COLUMN "platform" "Platform" NOT NULL DEFAULT 'SALLA';

ALTER TABLE "orders" DROP CONSTRAINT "orders_orderNumber_key";

CREATE UNIQUE INDEX "orders_platform_orderNumber_key" ON "orders"("platform", "orderNumber");
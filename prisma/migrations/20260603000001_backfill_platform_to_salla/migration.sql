-- BackfillPlatformToSalla
-- Ensure all existing orders have platform = SALLA
UPDATE "orders" SET "platform" = 'SALLA' WHERE "platform" IS NULL;
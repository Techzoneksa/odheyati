-- BackfillPlatformToSalla
-- Ensure all existing orders have platform = SALLA even if NULL
UPDATE "orders" SET "platform" = 'SALLA' WHERE "platform" IS NULL;
-- The current baseline creates numeric company IDs in 003_business_plan_generation.sql.
--
-- This migration used to convert an older UUID-based schema. Keeping the
-- migration name as a no-op preserves ordering for fresh databases without
-- attempting to replace a primary key that already has foreign-key users.
SELECT 1;

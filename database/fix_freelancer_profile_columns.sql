-- Fix admin freelancers list failures caused by Prisma schema drift.
-- Safe to re-run: each statement checks information_schema first.

-- 1) Core industry column (if not already applied)
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'freelancer_profiles'
        AND COLUMN_NAME = 'industry'
    ),
    'SELECT 1',
    'ALTER TABLE `freelancer_profiles` ADD COLUMN `industry` VARCHAR(191) NULL AFTER `user_id`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Profile JSON columns expected by current Prisma schema
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'freelancer_profiles'
        AND COLUMN_NAME = 'verification_json'
    ),
    'SELECT 1',
    'ALTER TABLE `freelancer_profiles` ADD COLUMN `verification_json` LONGTEXT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'freelancer_profiles'
        AND COLUMN_NAME = 'portfolio_json'
    ),
    'SELECT 1',
    'ALTER TABLE `freelancer_profiles` ADD COLUMN `portfolio_json` LONGTEXT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

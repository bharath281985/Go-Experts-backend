-- Production fix: category-based skills
-- Database: expertsportal_adminaigravity
-- Safe to re-run (checks information_schema before ALTER)

-- 1) Add industry on skills (if missing)
SET @skills_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'skills'
    AND COLUMN_NAME = 'industry'
);
SET @sql := IF(
  @skills_col = 0,
  'ALTER TABLE `skills` ADD COLUMN `industry` VARCHAR(191) NULL AFTER `name`',
  'SELECT "skills.industry already exists" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Add industry on freelancer_profiles (if missing)
SET @fp_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'freelancer_profiles'
    AND COLUMN_NAME = 'industry'
);
SET @sql := IF(
  @fp_col = 0,
  'ALTER TABLE `freelancer_profiles` ADD COLUMN `industry` VARCHAR(191) NULL AFTER `user_id`',
  'SELECT "freelancer_profiles.industry already exists" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Map existing tech skills to Technology category
--    (adjust names if your industries list uses a different label)
UPDATE `skills`
SET `industry` = 'Technology'
WHERE (`industry` IS NULL OR `industry` = '')
  AND `name` IN (
    'Angular','AWS Services','Blockchain','Data Science','DevOps','Django','Docker',
    'Flutter','Go Lang','GraphQL','Kotlin','Kubernetes','Laravel','Machine Learning',
    'MongoDB','Node.js','PostgreSQL','Python','React','Redis','Swift','Terraform',
    'TypeScript','UI/UX Design','Vue.js'
  );

-- Fallback: any remaining unmapped skills also go to Technology
UPDATE `skills`
SET `industry` = 'Technology'
WHERE `industry` IS NULL OR `industry` = '';

-- 4) Backfill freelancer category from their first known skill industry
UPDATE `freelancer_profiles` fp
JOIN `skills` s
  ON FIND_IN_SET(s.id, REPLACE(fp.skills, ' ', '')) > 0
SET fp.industry = s.industry
WHERE (fp.industry IS NULL OR fp.industry = '')
  AND fp.skills IS NOT NULL
  AND fp.skills <> ''
  AND s.industry IS NOT NULL;

-- 5) Verify
SELECT 'skills by industry' AS check_name, industry, COUNT(*) AS cnt
FROM skills
GROUP BY industry;

SELECT
  SUM(CASE WHEN industry IS NULL OR industry = '' THEN 1 ELSE 0 END) AS freelancers_missing_industry,
  SUM(CASE WHEN industry IS NOT NULL AND industry <> '' THEN 1 ELSE 0 END) AS freelancers_with_industry
FROM freelancer_profiles;

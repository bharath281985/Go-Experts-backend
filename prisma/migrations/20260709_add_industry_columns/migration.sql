-- Run on production if skills/freelancers APIs return 500 after deploying industry support.
ALTER TABLE `skills` ADD COLUMN `industry` VARCHAR(191) NULL;
ALTER TABLE `freelancer_profiles` ADD COLUMN `industry` VARCHAR(191) NULL;

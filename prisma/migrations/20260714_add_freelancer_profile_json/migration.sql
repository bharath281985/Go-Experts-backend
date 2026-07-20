-- Align freelancer_profiles with Prisma FreelancerProfile model.
ALTER TABLE `freelancer_profiles` ADD COLUMN `verification_json` LONGTEXT NULL;
ALTER TABLE `freelancer_profiles` ADD COLUMN `portfolio_json` LONGTEXT NULL;

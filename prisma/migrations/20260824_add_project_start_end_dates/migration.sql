-- Add actual project schedule dates.
ALTER TABLE `projects`
  ADD COLUMN `start_date` DATETIME NULL AFTER `timeline`,
  ADD COLUMN `end_date` DATETIME NULL AFTER `start_date`;

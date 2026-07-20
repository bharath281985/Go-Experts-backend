-- Insight reports and analytics dashboards for marketing/reports/analytics pages
CREATE TABLE IF NOT EXISTS `insight_reports` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `format` VARCHAR(191) NOT NULL DEFAULT 'PDF',
  `created_by` VARCHAR(191) NOT NULL DEFAULT 'Admin',
  `schedule` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `analytics_dashboards` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL DEFAULT 'General',
  `query_model` VARCHAR(191) NOT NULL,
  `columns_config` VARCHAR(191) NULL,
  `creator` VARCHAR(191) NOT NULL DEFAULT 'Admin',
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
);

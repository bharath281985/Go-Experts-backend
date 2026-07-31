import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import { getAppConfig, getFeatureFlags, getRemoteConfig, getVersion, getMaintenance } from './controllers/config.controller.js';
import { listDevices, deleteDevice, logoutDevice } from './controllers/device.controller.js';
import { getHealth, getStatus, getStatistics } from './controllers/health.controller.js';
import { getStorageUsage, getDashboardCounters } from './controllers/stats.controller.js';
import { getUserActivity, getUserAuditLogs } from './controllers/activity.controller.js';

const router = Router();

// Public System Configs (Mobile App Startup)
router.get('/app/config', getAppConfig);
router.get('/app/feature-flags', getFeatureFlags);
router.get('/app/features-flags', getFeatureFlags);
router.get('/app/remote-config', getRemoteConfig);
router.get('/app/version', getVersion);
router.get('/app/maintenance', getMaintenance);

// System Health & Monitoring
router.get('/health', getHealth);
router.get('/status', getStatus);
router.get('/statistics', getStatistics);
router.get('/storage', getStorageUsage);
router.get('/dashboard-counters', getDashboardCounters);

// Authenticated Routes
router.use(authenticate);

// Devices
router.get('/devices', listDevices);
router.delete('/devices/:id', deleteDevice);
router.patch('/devices/:id/logout', logoutDevice);

// User Activity & Audit
router.get('/activity', getUserActivity);
router.get('/audit', getUserAuditLogs);

export default router;

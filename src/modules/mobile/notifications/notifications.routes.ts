import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import { 
  getNotifications, 
  getUnreadCount, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification, 
  getPreferences, 
  updatePreferences, 
  testPush, 
  testEmail 
} from './controllers/notifications.controller.js';
import { getQueue, retryFailed } from './controllers/system.controller.js';

import { saveToken, deleteToken } from '../app-config/app-config.controller.js';

const router = Router();

router.use(authenticate);

// Device Token Registration
router.post('/device-token', saveToken);
router.put('/device-token', saveToken);
router.delete('/device-token', deleteToken);

// User Notifications
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

// User Preferences
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

// Testing
router.post('/test-push', testPush);
router.post('/test-email', testEmail);

// System Queue (Admins or System Processes)
router.get('/system/notification-queue', getQueue);
router.post('/system/notification-queue/retry-failed', retryFailed);

export default router;

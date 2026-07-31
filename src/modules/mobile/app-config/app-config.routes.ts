import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import {
  saveToken, deleteToken, getConfig, getFeatureFlags, getVersion,
  getMaintenance, uploadCrashLog, submitFeedback
} from './app-config.controller.js';

const router = Router();

router.get('/config', getConfig);
router.get('/features-flags', getFeatureFlags);
router.get('/feature-flags', getFeatureFlags);
router.get('/version', getVersion);
router.get('/maintenance', getMaintenance);
router.post('/crash-log', uploadCrashLog);
router.post('/feedback', submitFeedback);

const checkAuth = (req: any, res: any, next: any) => {
  if (req.headers.authorization) authenticate(req, res, next);
  else next();
};

router.post('/device-token', checkAuth, saveToken);
router.put('/device-token', checkAuth, saveToken);
router.delete('/device-token', deleteToken);

export default router;

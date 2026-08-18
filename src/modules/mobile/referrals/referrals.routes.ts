import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { getMyReferrals } from './referrals.controller.js';

const router = Router();

router.get('/', authenticate, getMyReferrals);

export default router;

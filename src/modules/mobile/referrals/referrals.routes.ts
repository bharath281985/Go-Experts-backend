import { Router } from 'express';
import { authenticateOptional } from '../../../middleware/auth.js';
import { getMyReferrals } from './referrals.controller.js';

const router = Router();

router.get('/', authenticateOptional, getMyReferrals);

export default router;

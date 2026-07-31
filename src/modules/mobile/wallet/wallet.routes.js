import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import { getWallet, getTransactions } from './wallet.controller.js';
const router = Router();
router.use(authenticate);
router.get('/', getWallet);
router.get('/transactions', getTransactions);
export default router;

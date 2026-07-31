import { Router } from 'express';
import { authenticate, authenticateOptional } from '../../../middlewares/auth.js';
import { search, suggestions, getHistory, clearHistory, deleteHistoryItem } from './controllers/search.controller.js';
const router = Router();
// Global Search
router.use(authenticateOptional);
router.get('/', search);
router.get('/suggestions', suggestions);
// Search History
router.use(authenticate);
router.get('/recent', getHistory);
router.delete('/recent', clearHistory);
router.delete('/recent/:id', deleteHistoryItem);
export default router;

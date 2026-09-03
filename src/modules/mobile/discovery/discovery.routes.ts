import { Router } from 'express';
import { authenticate, authenticateOptional } from '../../../middlewares/auth.js';
import {
  addRecentlyViewed,
  listRecentlyViewed,
  clearRecentlyViewed,
  deleteRecentlyViewedItem,
  getRecommendations,
  getTrending,
  getPopular,
  getDiscoveryFeed
} from './controllers/discovery.controller.js';

const router = Router();

// Discovery / Recommendations (authenticated if token provided, fallback if guest)
router.get('/discover', authenticateOptional, getDiscoveryFeed);
router.get('/recommendations', authenticateOptional, getRecommendations);
router.get('/trending', authenticateOptional, getTrending);
router.get('/popular', authenticateOptional, getPopular);

// Recently Viewed
router.use(authenticate);
router.get('/recently-viewed', listRecentlyViewed);
router.post('/recently-viewed', addRecentlyViewed);
router.delete('/recently-viewed', clearRecentlyViewed);
router.delete('/recently-viewed/:id', deleteRecentlyViewedItem);

export default router;

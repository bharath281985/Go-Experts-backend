import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import { addRecentlyViewed, listRecentlyViewed, clearRecentlyViewed, deleteRecentlyViewedItem, getRecommendations, getTrending, getPopular, getDiscoveryFeed } from './controllers/discovery.controller.js';
const router = Router();
// Discovery / Recommendations
router.get('/discover', getDiscoveryFeed);
router.get('/recommendations', getRecommendations);
router.get('/trending', getTrending);
router.get('/popular', getPopular);
// Recently Viewed
router.use(authenticate);
router.get('/recently-viewed', listRecentlyViewed);
router.post('/recently-viewed', addRecentlyViewed);
router.delete('/recently-viewed', clearRecentlyViewed);
router.delete('/recently-viewed/:id', deleteRecentlyViewedItem);
export default router;

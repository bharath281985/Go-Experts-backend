import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import {
  addFavorite,
  listFavorites,
  removeFavorite,
  updateFavorite,
  toggleFavorite,
} from './controllers/favorites.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', addFavorite);
router.post('/toggle', toggleFavorite);
router.get('/', listFavorites);
router.delete('/:id', removeFavorite);
router.patch('/:id', updateFavorite);

export default router;

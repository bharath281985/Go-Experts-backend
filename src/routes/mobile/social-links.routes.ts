import { Router } from 'express';
import {
  getSocialLinks,
  addSocialLink,
  updateSocialLink,
  deleteSocialLink,
} from '../../controllers/mobile/social-links.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getSocialLinks);
router.post('/', addSocialLink);
router.put('/:id', updateSocialLink);
router.delete('/:id', deleteSocialLink);

export default router;

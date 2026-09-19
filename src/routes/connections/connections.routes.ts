import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import {
  getConnections,
  getReceivedInvitations,
  getSentInvitations,
  acceptInvitation,
  rejectInvitation
} from '../../controllers/connections/connections.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getConnections as any);
router.get('/invitations', getReceivedInvitations as any);
router.get('/invitations/sent', getSentInvitations as any);
router.patch('/invitations/:id/accept', acceptInvitation as any);
router.patch('/invitations/:id/reject', rejectInvitation as any);

export default router;


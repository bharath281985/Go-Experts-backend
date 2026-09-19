import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import {
  getConnections,
  getReceivedInvitations,
  getSentInvitations,
  acceptInvitation,
  rejectInvitation
} from './controllers/connections.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getConnections);
router.get('/invitations', getReceivedInvitations);
router.get('/invitations/sent', getSentInvitations);
router.patch('/invitations/:id/accept', acceptInvitation);
router.patch('/invitations/:id/reject', rejectInvitation);

export default router;


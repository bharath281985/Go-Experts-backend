import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import {
  listTickets,
  createTicket,
  getTicket,
  replyToTicket,
  closeTicket,
} from '../client/controllers/support.controller.js';

const router = Router();

router.use(authenticate);

router.get('/tickets', listTickets);
router.post('/tickets', createTicket);
router.get('/tickets/:id', getTicket);
router.post('/tickets/:id/reply', replyToTicket);
router.patch('/tickets/:id/close', closeTicket);

export default router;

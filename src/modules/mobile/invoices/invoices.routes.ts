import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import { getInvoices, getInvoice, downloadInvoice } from './invoices.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getInvoices);
router.get('/:id', getInvoice);
router.get('/:id/download', downloadInvoice);

export default router;

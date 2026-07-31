import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import {
  listConversations,
  getConversation,
  sendMessage,
  markMessageRead,
  markConversationRead,
  uploadAttachment,
} from '../chat/controllers/chat.controller.js';
import { chatUpload, handleUploadError } from '../../../middleware/upload.js';

const router = Router();

router.use(authenticate);

router.get('/conversations', listConversations);
router.get('/conversations/:id', getConversation);
router.post('/send', sendMessage);
router.patch('/messages/:id/read', markMessageRead);
router.patch('/conversations/:id/read-all', markConversationRead);
router.post('/attachments', chatUpload.single('file'), handleUploadError, uploadAttachment);

export default router;

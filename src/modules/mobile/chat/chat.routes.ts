import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import { chatUpload, handleUploadError } from '../../../middleware/upload.js';
import {
  listConversations,
  getConversation,
  sendMessage,
  markMessageRead,
  markConversationRead,
  markConversationUnread,
  deleteMessage,
  deleteConversation,
  uploadAttachment,
} from './controllers/chat.controller.js';

const router = Router();

router.use(authenticate);

router.get('/conversations', listConversations);
router.get('/conversations/:id', getConversation);
router.post('/send', sendMessage);
router.patch('/messages/:id/read', markMessageRead);
router.delete('/messages/:id', deleteMessage);
router.patch('/conversations/:id/read-all', markConversationRead);
router.patch('/conversations/:id/unread', markConversationUnread);
router.delete('/conversations/:id', deleteConversation);
router.post('/attachments', chatUpload.single('file'), handleUploadError, uploadAttachment);

export default router;

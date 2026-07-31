import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import { upload, documentUpload, handleUploadError } from '../../../middleware/upload.js';
import {
  uploadFile,
  uploadMultiple,
  listFiles,
  getFile,
  previewFile,
  downloadFile,
  renameFile,
  deleteFile,
  restoreFile,
  listTrash,
  getStorageUsage
} from './controllers/files.controller.js';

const router = Router();

router.use(authenticate);

// Upload (single + up to 20 docs; images blocked when category=project_attachment in controller)
router.post('/upload', upload.single('file'), handleUploadError, uploadFile);
router.post('/upload-multiple', documentUpload.array('files', 20), handleUploadError, uploadMultiple);

// List & Storage
router.get('/usage', getStorageUsage);
router.get('/trash', listTrash);
router.get('/', listFiles);

// Single File Operations (id params must come after static routes)
router.get('/:id', getFile);
router.get('/:id/preview', previewFile);
router.get('/:id/download', downloadFile);
router.put('/:id/rename', renameFile);
router.delete('/:id', deleteFile);
router.post('/:id/restore', restoreFile);

export default router;

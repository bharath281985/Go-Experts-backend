import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import {
  listFiles,
  uploadFile,
  downloadFile,
  previewFile,
  listVersions,
  deleteFile,
  restoreFile,
} from "../../controllers/media/media.controller.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware as any);

// File list (pass ?trash=true for recycle bin)
router.get("/",                  listFiles);

// Upload (auto-creates new version if filename already exists)
router.post("/upload",           upload.single("file"), uploadFile);

// Per-file operations
router.get("/:id/preview",       previewFile);
router.get("/:id/download",      downloadFile);
router.get("/:id/versions",      listVersions);
router.delete("/:id",            deleteFile);
router.post("/:id/restore",      restoreFile);

export default router;

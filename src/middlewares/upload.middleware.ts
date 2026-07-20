import multer from "multer";
import path from "path";
import { UPLOADS_DIR, ensureUploadsDir } from "../config/uploads.js";

ensureUploadsDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const ALLOWED_EXT = new Set([
  ".jpeg", ".jpg", ".png", ".gif", ".webp",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".mp4", ".mov", ".avi",
]);

export const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.has(ext)) {
      return cb(null, true);
    }
    cb(new Error("File type not supported."));
  },
});

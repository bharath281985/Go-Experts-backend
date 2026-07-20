import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Always resolve to backend/uploads (or UPLOAD_DIR), regardless of cwd
 * or whether the app runs from src/ or dist/.
 */
export const UPLOADS_DIR = (() => {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  // backend/src/config -> ../../uploads = backend/uploads
  // backend/dist/config -> ../../uploads = backend/uploads
  return path.resolve(__dirname, "../../uploads");
})();

export function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  return UPLOADS_DIR;
}

ensureUploadsDir();

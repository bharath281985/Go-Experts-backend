import { NextFunction, Request, Response } from 'express';
import fs from 'fs';

const MEDIA_FIELD = /(avatar|logo|image|photo|cover|file|document|attachment|pitch.?deck|business.?plan|url|media)/i;
const LOCAL_PATH = /^(?:file:\/\/|content:\/\/|blob:|\/data\/user\/|\/storage\/emulated\/|[a-z]:[\\/])/i;

function findLocalPath(value: unknown, key = ''): string | null {
  if (typeof value === 'string') {
    const candidate = value.trim();
    return MEDIA_FIELD.test(key) && LOCAL_PATH.test(candidate) ? candidate : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findLocalPath(item, key);
      if (found) return found;
    }
  } else if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      const found = findLocalPath(childValue, childKey);
      if (found) return found;
    }
  }
  return null;
}

/** Prevent device/browser-local paths from being persisted as public media URLs. */
export function rejectLocalFilePaths(req: Request, res: Response, next: NextFunction) {
  if (!findLocalPath(req.body)) return next();

  if (req.file?.path) {
    try { fs.unlinkSync(req.file.path); } catch { /* best-effort cleanup */ }
  }

  return res.status(400).json({
    success: false,
    code: 'LOCAL_FILE_PATH_NOT_ALLOWED',
    message: 'Upload the file first and use the public URL returned by the upload endpoint.',
  });
}

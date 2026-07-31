"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUploadError = exports.getMimeCategory = exports.documentUpload = exports.chatUpload = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
// Allowed MIME types and their category mappings
const ALLOWED_TYPES = {
    // Images (avatars/covers — blocked for project_attachment via documentUpload)
    'image/jpeg': 'image',
    'image/jpg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/webp': 'image',
    'image/svg+xml': 'image',
    // Documents
    'application/pdf': 'document',
    'application/msword': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    'application/vnd.ms-excel': 'document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
    'application/vnd.ms-powerpoint': 'document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
    'application/rtf': 'document',
    'application/vnd.oasis.opendocument.text': 'document',
    'application/vnd.oasis.opendocument.spreadsheet': 'document',
    'application/vnd.oasis.opendocument.presentation': 'document',
    'text/plain': 'document',
    'text/csv': 'document',
    // Archives
    'application/zip': 'archive',
    'application/x-zip-compressed': 'archive',
    'application/x-rar-compressed': 'archive',
    'application/vnd.rar': 'archive',
    'application/x-7z-compressed': 'archive',
    'application/gzip': 'archive',
    // Videos
    'video/mp4': 'video',
    'video/mpeg': 'video',
    'video/quicktime': 'video',
    'video/x-msvideo': 'video',
    'video/webm': 'video',
    // Audio
    'audio/mpeg': 'audio',
    'audio/mp3': 'audio',
    'audio/wav': 'audio',
    'audio/ogg': 'audio',
};
const DOCUMENT_TYPES = Object.fromEntries(Object.entries(ALLOWED_TYPES).filter(([, category]) => category !== 'image'));
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800'); // default 50MB
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const authReq = req;
        const role = authReq.user?.role || 'general';
        const userId = authReq.user?.id || 'unknown';
        const uploadDir = `uploads/${role}/${userId}`;
        fs_1.default.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const uniqueName = `${(0, uuid_1.v4)()}${ext}`;
        cb(null, uniqueName);
    }
});
const fileFilter = (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) {
        cb(null, true);
    }
    else {
        cb(new Error(`File type "${file.mimetype}" is not allowed`));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});
/** Chat attachments — images/docs/video, max 10MB. */
const CHAT_MAX_FILE_SIZE = 10 * 1024 * 1024;
exports.chatUpload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: CHAT_MAX_FILE_SIZE },
});
/** Docs/archives/media only — rejects images (for project attachments). */
exports.documentUpload = (0, multer_1.default)({
    storage,
    fileFilter: (req, file, cb) => {
        if (DOCUMENT_TYPES[file.mimetype]) {
            cb(null, true);
        }
        else if (ALLOWED_TYPES[file.mimetype] === 'image') {
            cb(new Error('Images are not allowed for project attachments'));
        }
        else {
            cb(new Error(`File type "${file.mimetype}" is not allowed`));
        }
    },
    limits: { fileSize: MAX_FILE_SIZE, files: 20 },
});
const getMimeCategory = (mimeType) => {
    return ALLOWED_TYPES[mimeType] || 'document';
};
exports.getMimeCategory = getMimeCategory;
// Error handler for multer errors
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer_1.default.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            const maxMb = err.field === 'file' && req.path.includes('/messages/attachments')
                ? CHAT_MAX_FILE_SIZE / 1024 / 1024
                : req.path.includes('/chat/attachments')
                    ? CHAT_MAX_FILE_SIZE / 1024 / 1024
                    : MAX_FILE_SIZE / 1024 / 1024;
            return res.status(400).json({
                success: false,
                message: `File too large. Maximum size is ${maxMb}MB`,
                code: 'FILE_TOO_LARGE',
            });
        }
        return res.status(400).json({ success: false, message: err.message, code: 'UPLOAD_ERROR' });
    }
    if (err) {
        return res.status(400).json({ success: false, message: err.message, code: 'VALIDATION_ERROR' });
    }
    next();
};
exports.handleUploadError = handleUploadError;

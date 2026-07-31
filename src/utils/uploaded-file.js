"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.respondWithUploadedFile = exports.uploadedFileUrl = void 0;
const response_js_1 = require("../core/response.js");
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
/** Build public URL for a multer-uploaded file. */
const uploadedFileUrl = (file) => {
    const relativePath = file.path.replace(/\\/g, '/');
    return `${BASE_URL}/${relativePath}`;
};
exports.uploadedFileUrl = uploadedFileUrl;
/** Standard attachment/profile upload response from req.file. */
const respondWithUploadedFile = (req, res, message = 'File uploaded') => {
    const file = req.file;
    if (!file) {
        return res.status(400).json((0, response_js_1.errorResponse)('No file provided', 'VALIDATION_ERROR'));
    }
    const url = (0, exports.uploadedFileUrl)(file);
    return res.status(201).json((0, response_js_1.successResponse)(message, {
        url,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        filename: file.filename,
    }));
};
exports.respondWithUploadedFile = respondWithUploadedFile;

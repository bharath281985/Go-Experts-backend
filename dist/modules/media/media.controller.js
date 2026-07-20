import { prisma } from "../../config/database.js";
import path from "path";
import fs from "fs";
const UPLOADS_DIR = "./uploads";
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
// ─── 1. UPLOAD ────────────────────────────────────────────────────────────────
export const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }
        const file = req.file;
        const uploadedBy = req.user?.id || null;
        // Check if a file with the same original name already exists (for versioning)
        const existing = await prisma.mediaFile.findFirst({
            where: { originalName: file.originalname, deletedAt: null },
            orderBy: { version: "desc" },
        });
        if (existing) {
            // Save the OLD version to version history before overwriting
            await prisma.mediaFileVersion.create({
                data: {
                    fileId: existing.id,
                    version: existing.version,
                    filepath: existing.filepath,
                    filesize: existing.filesize,
                    uploadedBy: existing.uploadedBy,
                },
            });
            // Update the main record with the new file (increment version)
            const updated = await prisma.mediaFile.update({
                where: { id: existing.id },
                data: {
                    filename: file.filename,
                    filepath: `/uploads/${file.filename}`,
                    filesize: file.size,
                    mimeType: file.mimetype,
                    filetype: path.extname(file.originalname).slice(1).toLowerCase(),
                    version: existing.version + 1,
                    uploadedBy,
                },
                include: { versions: true },
            });
            return res.status(200).json({
                success: true,
                message: `File uploaded as version ${updated.version}`,
                url: `${BASE_URL}/uploads/${file.filename}`,
                data: updated,
            });
        }
        // First upload - create fresh record
        const media = await prisma.mediaFile.create({
            data: {
                filename: file.filename,
                originalName: file.originalname,
                filepath: `/uploads/${file.filename}`,
                filesize: file.size,
                filetype: path.extname(file.originalname).slice(1).toLowerCase(),
                mimeType: file.mimetype,
                uploadedBy,
                version: 1,
            },
        });
        res.status(201).json({
            success: true,
            message: "File uploaded successfully",
            url: `${BASE_URL}/uploads/${file.filename}`,
            data: media,
        });
    }
    catch (err) {
        next(err);
    }
};
// ─── 2. DOWNLOAD ─────────────────────────────────────────────────────────────
export const downloadFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const media = await prisma.mediaFile.findUnique({ where: { id } });
        if (!media || media.deletedAt) {
            return res.status(404).json({ success: false, message: "File not found" });
        }
        const absolutePath = path.resolve(`.${media.filepath}`);
        if (!fs.existsSync(absolutePath)) {
            return res.status(410).json({ success: false, message: "File missing from disk" });
        }
        res.setHeader("Content-Disposition", `attachment; filename="${media.originalName}"`);
        res.setHeader("Content-Type", media.mimeType);
        res.sendFile(absolutePath);
    }
    catch (err) {
        next(err);
    }
};
// ─── 3. PREVIEW ──────────────────────────────────────────────────────────────
export const previewFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const media = await prisma.mediaFile.findUnique({ where: { id } });
        if (!media || media.deletedAt) {
            return res.status(404).json({ success: false, message: "File not found" });
        }
        const PREVIEWABLE = ["jpg", "jpeg", "png", "gif", "webp", "svg", "pdf", "mp4", "webm"];
        const isPreviewable = PREVIEWABLE.includes(media.filetype.toLowerCase());
        if (!isPreviewable) {
            return res.status(415).json({
                success: false,
                message: `Preview not supported for .${media.filetype} files. Use download instead.`,
                downloadUrl: `${BASE_URL}/api/admin/media/${id}/download`,
            });
        }
        const absolutePath = path.resolve(`.${media.filepath}`);
        if (!fs.existsSync(absolutePath)) {
            return res.status(410).json({ success: false, message: "File missing from disk" });
        }
        res.setHeader("Content-Type", media.mimeType);
        res.setHeader("Content-Disposition", `inline; filename="${media.originalName}"`);
        res.sendFile(absolutePath);
    }
    catch (err) {
        next(err);
    }
};
// ─── 4. LIST VERSIONS ────────────────────────────────────────────────────────
export const listVersions = async (req, res, next) => {
    try {
        const { id } = req.params;
        const media = await prisma.mediaFile.findUnique({
            where: { id },
            include: { versions: { orderBy: { version: "desc" } } },
        });
        if (!media) {
            return res.status(404).json({ success: false, message: "File not found" });
        }
        res.json({
            success: true,
            current: {
                version: media.version,
                filepath: media.filepath,
                filesize: media.filesize,
                uploadedAt: media.updatedAt,
            },
            history: media.versions.map((v) => ({
                version: v.version,
                filepath: v.filepath,
                filesize: v.filesize,
                uploadedAt: v.createdAt,
                downloadUrl: `${BASE_URL}${v.filepath}`,
            })),
        });
    }
    catch (err) {
        next(err);
    }
};
// ─── 5. SOFT DELETE ──────────────────────────────────────────────────────────
export const deleteFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const media = await prisma.mediaFile.findUnique({ where: { id } });
        if (!media || media.deletedAt) {
            return res.status(404).json({ success: false, message: "File not found or already deleted" });
        }
        await prisma.mediaFile.update({
            where: { id },
            data: { deletedAt: new Date(), status: "deleted" },
        });
        res.json({ success: true, message: `File "${media.originalName}" soft-deleted. Use restore to recover.` });
    }
    catch (err) {
        next(err);
    }
};
// ─── 6. RESTORE ──────────────────────────────────────────────────────────────
export const restoreFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const media = await prisma.mediaFile.findUnique({ where: { id } });
        if (!media) {
            return res.status(404).json({ success: false, message: "File not found" });
        }
        if (!media.deletedAt) {
            return res.status(400).json({ success: false, message: "File is not deleted — nothing to restore" });
        }
        const absolutePath = path.resolve(`.${media.filepath}`);
        if (!fs.existsSync(absolutePath)) {
            return res.status(410).json({
                success: false,
                message: "Cannot restore: physical file was permanently removed from disk",
            });
        }
        const restored = await prisma.mediaFile.update({
            where: { id },
            data: { deletedAt: null, status: "active" },
        });
        res.json({ success: true, message: `File "${restored.originalName}" successfully restored`, data: restored });
    }
    catch (err) {
        next(err);
    }
};
// ─── 7. LIST ALL (with trash filter) ─────────────────────────────────────────
export const listFiles = async (req, res, next) => {
    try {
        const showDeleted = req.query.trash === "true";
        const files = await prisma.mediaFile.findMany({
            where: showDeleted ? { deletedAt: { not: null } } : { deletedAt: null },
            orderBy: { createdAt: "desc" },
            include: { versions: { select: { version: true, createdAt: true } } },
        });
        const enriched = files.map((f) => ({
            ...f,
            url: `${BASE_URL}${f.filepath}`,
            previewUrl: `${BASE_URL}/api/admin/media/${f.id}/preview`,
            downloadUrl: `${BASE_URL}/api/admin/media/${f.id}/download`,
            versionCount: f.versions.length + 1,
        }));
        res.json({ success: true, total: enriched.length, files: enriched });
    }
    catch (err) {
        next(err);
    }
};

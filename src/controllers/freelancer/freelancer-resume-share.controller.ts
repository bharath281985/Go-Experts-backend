import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { ResumeShareService } from "../../services/resume/resume-share.service.js";
import { ResumeExportService } from "../../services/resume/resume-export.service.js";
import { prisma } from "../../config/database.js";

function handleError(err: unknown, res: Response, next: NextFunction) {
  next(err);
}

function requireUser(req: AuthenticatedRequest, res: Response): string | null {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return req.user.id;
}

// GET /api/freelancer/resume/share
export const getFreelancerResumeShare = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const share = await ResumeShareService.getActiveShare(userId);
    if (!share) {
      res.json({ success: true, data: null });
      return;
    }

    // Exclude tokenHash
    const { tokenHash, ...safeShare } = share;
    res.json({ success: true, data: safeShare });
  } catch (err) {
    handleError(err, res, next);
  }
};

// POST /api/freelancer/resume/share
// Generates a new share or returns the active one
export const createFreelancerResumeShare = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const activeShare = await ResumeShareService.getActiveShare(userId);
    if (activeShare) {
      const { tokenHash, ...safeShare } = activeShare;
      res.json({ success: true, data: safeShare }); // Don't return raw token here since it's already created
      return;
    }

    const ctx = await ResumeExportService.loadExportContext(userId);
    const snapshotData = ResumeExportService.buildResumeDocumentData(ctx);

    const configInfo = {
      templateId: ctx.templateInfo.id,
      templateVersion: ctx.templateInfo.version || 1,
      configVersion: (ctx.config as any).configVersion || 1,
    };

    const { share, rawToken } = await ResumeShareService.createShare(userId, snapshotData, configInfo);
    
    const { tokenHash, ...safeShare } = share;
    res.json({ success: true, data: { ...safeShare, rawToken } });
  } catch (err) {
    handleError(err, res, next);
  }
};

// PUT /api/freelancer/resume/share
// Update settings
export const updateFreelancerResumeShare = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { expiresAt, allowPdfDownload, allowPrint } = req.body;
    
    let parsedDate = undefined;
    if (expiresAt === null) {
      parsedDate = null;
    } else if (expiresAt) {
      parsedDate = new Date(expiresAt);
    }

    const updated = await ResumeShareService.updateSettings(userId, {
      ...(expiresAt !== undefined && { expiresAt: parsedDate }),
      ...(allowPdfDownload !== undefined && { allowPdfDownload }),
      ...(allowPrint !== undefined && { allowPrint }),
    });

    const { tokenHash, ...safeShare } = updated;
    res.json({ success: true, data: safeShare });
  } catch (err) {
    handleError(err, res, next);
  }
};

// POST /api/freelancer/resume/share/regenerate
export const regenerateFreelancerResumeShare = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const ctx = await ResumeExportService.loadExportContext(userId);
    const snapshotData = ResumeExportService.buildResumeDocumentData(ctx);

    const configInfo = {
      templateId: ctx.templateInfo.id,
      templateVersion: ctx.templateInfo.version || 1,
      configVersion: (ctx.config as any).configVersion || 1,
    };

    const { share, rawToken } = await ResumeShareService.createShare(userId, snapshotData, configInfo);
    
    const { tokenHash, ...safeShare } = share;
    res.json({ success: true, data: { ...safeShare, rawToken } });
  } catch (err) {
    handleError(err, res, next);
  }
};

// POST /api/freelancer/resume/share/update-snapshot
export const updateFreelancerResumeShareSnapshot = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const ctx = await ResumeExportService.loadExportContext(userId);
    const snapshotData = ResumeExportService.buildResumeDocumentData(ctx);

    const configInfo = {
      templateId: ctx.templateInfo.id,
      templateVersion: ctx.templateInfo.version || 1,
      configVersion: (ctx.config as any).configVersion || 1,
    };

    const updated = await ResumeShareService.updateSnapshot(userId, snapshotData, configInfo);
    
    const { tokenHash, ...safeShare } = updated;
    res.json({ success: true, data: safeShare });
  } catch (err) {
    handleError(err, res, next);
  }
};

// DELETE /api/freelancer/resume/share
export const deleteFreelancerResumeShare = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    await ResumeShareService.revokeShare(userId);
    res.json({ success: true, message: "Share revoked" });
  } catch (err) {
    handleError(err, res, next);
  }
};

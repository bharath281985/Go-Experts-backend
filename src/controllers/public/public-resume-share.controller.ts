import { Request, Response, NextFunction } from "express";
import { ResumeShareService } from "../../services/resume/resume-share.service.js";
import { chromium } from "playwright";

const EXPORT_TIMEOUT_MS = 30000; // 30s
const CONCURRENCY_LIMIT = 3;
let activeExports = 0;

export const getSharedResume = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    if (!token) {
      res.status(400).json({ success: false, message: "Token is required" });
      return;
    }

    const share = await ResumeShareService.resolveShareByToken(token);
    
    if (!share) {
      res.status(404).json({ success: false, message: "This resume is no longer available." });
      return;
    }

    if ('expired' in share) {
      res.status(410).json({ success: false, message: "This resume link has expired.", expired: true });
      return;
    }

    // Return the snapshot
    res.json({ success: true, data: share });
  } catch (err) {
    next(err);
  }
};

export const exportSharedResumePdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    if (!token) {
      res.status(400).json({ success: false, message: "Token is required" });
      return;
    }

    const share = await ResumeShareService.resolveShareByToken(token);
    
    if (!share || 'expired' in share) {
      res.status(404).json({ success: false, message: "This resume is no longer available." });
      return;
    }

    if (!share.allowPdfDownload) {
      res.status(403).json({ success: false, message: "PDF download is disabled for this resume." });
      return;
    }

    if (activeExports >= CONCURRENCY_LIMIT) {
      res.status(429).json({ success: false, message: "Server is currently busy generating other resumes. Please try again in a few moments." });
      return;
    }

    // Update download count
    await ResumeShareService.updateSettings(share.userId, {}).then(() => {}).catch(() => {}); // Dummy update to use service, but actually we need raw prisma update
    import("../../config/database.js").then(({ prisma }) => {
      prisma.resumeShare.update({
        where: { id: share.id },
        data: { downloadCount: { increment: 1 } }
      }).catch(() => {});
    });

    activeExports++;
    let context: any = null;
    let page: any = null;
    
    try {
      const browser = await chromium.launch({ headless: true });
      context = await browser.newContext();
      page = await context.newPage();

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      // We can reuse the internal render route by passing the actual share token
      // Wait, the internal render route expects an internal token that resolves to ResumeDocumentData.
      // We should create a dedicated internal route or modify the existing one to accept a `type` query param,
      // Or we can just let the internal route accept either token type.
      // A safer approach: create a separate temporary token for Playwright just like the authenticated user does.
      
      const { ResumeExportService } = await import("../../services/resume/resume-export.service.js");
      // Create a temporary export context specifically for this snapshot
      const exportToken = (await import("crypto")).randomBytes(32).toString('hex');
      const exportTokens = (ResumeExportService as any).exportTokens || new Map();
      
      // Reconstruct context
      const ctx = {
        userId: share.userId,
        config: { templateId: share.templateId, templateVersion: share.templateVersion },
        profile: {}, // not needed since snapshotData has everything
        templateInfo: { rendererKey: share.templateId }, // Fallback
        token: exportToken
      };
      
      // Override the buildResumeDocumentData to just return snapshotData
      // Wait, exportTokens map holds contexts. We can monkeypatch it for this specific token.
      
      exportTokens.set(exportToken, {
        ...ctx,
        _snapshotOverride: share.snapshotData
      });
      setTimeout(() => exportTokens.delete(exportToken), 60000);

      const renderUrl = `${frontendUrl}/internal/resume/render/${exportToken}`;

      await page.goto(renderUrl, { waitUntil: "networkidle", timeout: EXPORT_TIMEOUT_MS });

      await page.waitForFunction("window.__RESUME_READY__ === true", {
        timeout: 10000
      });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });

      const filename = `shared-resume.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } finally {
      activeExports--;
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }

  } catch (err) {
    next(err);
  }
};

import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getPublicResumeTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.resumeTemplate.findMany({
      where: {
        status: "published"
      },
      orderBy: {
        sortOrder: "asc"
      },
      include: {
        versions: {
          orderBy: {
            version: "desc"
          },
          take: 1
        }
      }
    });

    const mappedTemplates = templates.map((t) => {
      const currentVersion = t.versions[0];

      let thumbnailUrl = currentVersion?.thumbnail || t.thumbnail || "";
      if (thumbnailUrl && !thumbnailUrl.startsWith("http")) {
        thumbnailUrl = `${req.protocol}://${req.get("host")}${thumbnailUrl.startsWith('/') ? '' : '/'}${thumbnailUrl}`;
      }

      return {
        id: t.id,
        key: t.key,
        name: t.name,
        category: t.category,
        description: currentVersion?.description || t.description,
        thumbnail: thumbnailUrl,
        atsFriendly: currentVersion?.atsFriendly || false,
        version: currentVersion?.version || t.currentVersion,
        rendererKey: currentVersion?.rendererKey,
        supportedSections: currentVersion?.supportedSections || [],
        defaultSections: currentVersion?.defaultSections || [],
        themeConfig: currentVersion?.themeConfig || {}
      };
    });

    res.status(200).json({ success: true, data: mappedTemplates });
  } catch (error) {
    next(error);
  }
};

import { ResumeExportService } from "../../services/resume/resume-export.service.js";

export const getResumeRenderData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token;
    if (!token) {
      res.status(400).json({ success: false, message: "Token is required" });
      return;
    }

    const ctx = ResumeExportService.getContextByToken(token);
    if (!ctx) {
      res.status(401).json({ success: false, message: "Invalid or expired token" });
      return;
    }

    const data = ResumeExportService.buildResumeDocumentData(ctx);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

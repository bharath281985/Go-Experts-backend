import { Request, Response, NextFunction } from "express";
import { AdminResumeTemplateService } from "../../services/admin/resume-template.service";

const service = new AdminResumeTemplateService();

export const listTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await service.getTemplates();
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
};

export const getTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await service.getTemplateById(req.params.id);
    res.status(200).json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

export const createTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, key, category, rendererKey } = req.body;
    const template = await service.createTemplate({ name, key, category, rendererKey });
    res.status(201).json({ success: true, data: template });
  } catch (error) {

    next(error);
  }
};

export const updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await service.updateTemplate(req.params.id, req.body);
    res.status(200).json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

export const publishTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versionData = req.body;
    const newVersion = await service.publishTemplateVersion(req.params.id, versionData);
    res.status(200).json({ success: true, data: newVersion });
  } catch (error) {
    next(error);
  }
};

export const archiveTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Add simple archive method delegating to Prisma (ideally this goes in the service)
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    const updated = await prisma.resumeTemplate.update({
      where: { id: req.params.id },
      data: { status: "archived" }
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const duplicateTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    
    const source = await prisma.resumeTemplate.findUnique({
      where: { id: req.params.id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } }
    });

    if (!source) throw new Error("Template not found");
    const sourceVersion = source.versions[0];
    if (!sourceVersion) throw new Error("Source version not found");

    const newTemplate = await prisma.$transaction(async (tx: any) => {
      const copy = await tx.resumeTemplate.create({
        data: {
          name: `${source.name} Copy`,
          key: `${source.key}-copy-${Date.now()}`,
          category: source.category,
          status: "draft",
          currentVersion: 1
        }
      });

      await tx.resumeTemplateVersion.create({
        data: {
          templateId: copy.id,
          version: 1,
          rendererKey: sourceVersion.rendererKey,
          supportedSections: sourceVersion.supportedSections,
          themeConfig: sourceVersion.themeConfig,
          atsFriendly: sourceVersion.atsFriendly
        }
      });

      return copy;
    });

    res.status(201).json({ success: true, data: newTemplate });
  } catch (error) {
    next(error);
  }
};

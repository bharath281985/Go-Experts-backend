import { PrismaClient } from '@prisma/client';
import { RESUME_RENDERERS, VALID_RENDERER_KEYS } from '../../constants/resume-renderers.js';

const prisma = new PrismaClient();

export class AdminResumeTemplateService {
  async getTemplates() {
    return prisma.resumeTemplate.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });
  }

  async getTemplateById(id: string) {
    const template = await prisma.resumeTemplate.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' }
        }
      }
    });
    if (!template) throw new Error('Template not found');
    return template;
  }

  async createTemplate(data: { name: string; key: string; category: string; rendererKey: string }) {
    if (!VALID_RENDERER_KEYS.includes(data.rendererKey)) {
      throw new Error(`Invalid rendererKey. Must be one of: ${VALID_RENDERER_KEYS.join(', ')}`);
    }

    const rendererCaps = RESUME_RENDERERS[data.rendererKey];

    return prisma.$transaction(async (tx) => {
      const template = await tx.resumeTemplate.create({
        data: {
          name: data.name,
          key: data.key,
          category: data.category,
          status: 'draft',
          currentVersion: 1
        }
      });

      await tx.resumeTemplateVersion.create({
        data: {
          templateId: template.id,
          version: 1,
          rendererKey: data.rendererKey,
          supportedSections: JSON.stringify(rendererCaps.supportedSections || []),
          requiredSections: JSON.stringify([]),
          defaultSections: JSON.stringify([]),
          themeConfig: JSON.stringify({}),
          atsFriendly: false
        }
      });

      return template;
    });
  }
  async updateTemplate(id: string, updateData: any) {
    return prisma.$transaction(async (tx) => {
      const template = await tx.resumeTemplate.findUnique({
        where: { id },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
      });
      if (!template) throw new Error('Template not found');

      // Update base template fields if provided
      const templateUpdates: any = {};
      if (updateData.name !== undefined) templateUpdates.name = updateData.name;
      if (updateData.description !== undefined) templateUpdates.description = updateData.description;
      if (updateData.category !== undefined) templateUpdates.category = updateData.category;
      if (updateData.thumbnail !== undefined) templateUpdates.thumbnail = updateData.thumbnail;
      if (updateData.status !== undefined) templateUpdates.status = updateData.status;
      
      if (Object.keys(templateUpdates).length > 0) {
        await tx.resumeTemplate.update({
          where: { id },
          data: templateUpdates
        });
      }

      // Update latest version fields if provided
      const latestVersion = template.versions[0];
      if (latestVersion) {
        const versionUpdates: any = {};
        if (updateData.rendererKey !== undefined) {
          if (!VALID_RENDERER_KEYS.includes(updateData.rendererKey)) {
            throw new Error(`Invalid rendererKey. Must be one of: ${VALID_RENDERER_KEYS.join(', ')}`);
          }
          versionUpdates.rendererKey = updateData.rendererKey;
        }
        if (updateData.themeConfig !== undefined) versionUpdates.themeConfig = updateData.themeConfig;
        if (updateData.atsFriendly !== undefined) versionUpdates.atsFriendly = updateData.atsFriendly;
        if (updateData.supportedSections !== undefined) versionUpdates.supportedSections = updateData.supportedSections;

        if (Object.keys(versionUpdates).length > 0) {
          await tx.resumeTemplateVersion.update({
            where: { id: latestVersion.id },
            data: versionUpdates
          });
        }
      }

      return tx.resumeTemplate.findUnique({
        where: { id },
        include: { versions: { orderBy: { version: 'desc' } } }
      });
    });
  }


  async publishTemplateVersion(templateId: string, versionData: any) {
    if (!VALID_RENDERER_KEYS.includes(versionData.rendererKey)) {
      throw new Error('Invalid rendererKey');
    }

    return prisma.$transaction(async (tx) => {
      const template = await tx.resumeTemplate.findUnique({
        where: { id: templateId }
      });
      if (!template) throw new Error('Template not found');

      const nextVersionNumber = template.currentVersion + 1;

      const newVersion = await tx.resumeTemplateVersion.create({
        data: {
          templateId,
          version: nextVersionNumber,
          rendererKey: versionData.rendererKey,
          supportedSections: JSON.stringify(versionData.supportedSections || []),
          requiredSections: JSON.stringify(versionData.requiredSections || []),
          defaultSections: JSON.stringify(versionData.defaultSections || []),
          themeConfig: JSON.stringify(versionData.themeConfig || {}),
          atsFriendly: versionData.atsFriendly || false,
          publishedAt: new Date()
        }
      });

      await tx.resumeTemplate.update({
        where: { id: templateId },
        data: { 
          currentVersion: nextVersionNumber,
          status: 'published' 
        }
      });

      return newVersion;
    });
  }
}

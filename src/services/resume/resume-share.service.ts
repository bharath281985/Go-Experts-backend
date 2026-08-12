import { prisma } from "../../config/database.js";
import crypto from "crypto";

export class ResumeShareService {
  static async generateToken() {
    const rawToken = crypto.randomBytes(16).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    return { rawToken, tokenHash };
  }

  static async hashToken(rawToken: string) {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }

  static async getActiveShare(userId: string) {
    const share = await prisma.resumeShare.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" }
    });
    return share;
  }

  static async createShare(userId: string, snapshotData: any, configInfo: { templateId: string, templateVersion: number, configVersion: number }) {
    // Revoke old shares first
    await prisma.resumeShare.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() }
    });

    const { rawToken, tokenHash } = await this.generateToken();

    const share = await prisma.resumeShare.create({
      data: {
        userId,
        tokenHash,
        status: "ACTIVE",
        templateId: configInfo.templateId,
        templateVersion: configInfo.templateVersion,
        configVersion: configInfo.configVersion,
        snapshotData,
      }
    });

    return { share, rawToken };
  }

  static async revokeShare(userId: string) {
    await prisma.resumeShare.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() }
    });
  }

  static async updateSnapshot(userId: string, snapshotData: any, configInfo: { templateId: string, templateVersion: number, configVersion: number }) {
    const activeShare = await this.getActiveShare(userId);
    if (!activeShare) throw new Error("No active share found");

    const updated = await prisma.resumeShare.update({
      where: { id: activeShare.id },
      data: {
        snapshotData,
        templateId: configInfo.templateId,
        templateVersion: configInfo.templateVersion,
        configVersion: configInfo.configVersion,
      }
    });
    return updated;
  }

  static async updateSettings(userId: string, settings: { expiresAt?: Date | null, allowPdfDownload?: boolean, allowPrint?: boolean }) {
    const activeShare = await this.getActiveShare(userId);
    if (!activeShare) throw new Error("No active share found");

    const updated = await prisma.resumeShare.update({
      where: { id: activeShare.id },
      data: settings
    });
    return updated;
  }

  static async resolveShareByToken(rawToken: string) {
    const tokenHash = await this.hashToken(rawToken);
    const share = await prisma.resumeShare.findUnique({
      where: { tokenHash }
    });

    if (!share) return null;
    
    // Check user status
    const user = await prisma.user.findUnique({ where: { id: share.userId } });
    if (!user || user.status === 'DELETED') {
      return null;
    }
    if (user.status === 'SUSPENDED') {
      return null;
    }

    if (share.status !== "ACTIVE") return null;

    if (share.expiresAt && new Date() > share.expiresAt) {
      // Return expired status to differentiate in UI, but no data
      return { expired: true };
    }

    // Update view count
    await prisma.resumeShare.update({
      where: { id: share.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date()
      }
    });

    return share;
  }
}

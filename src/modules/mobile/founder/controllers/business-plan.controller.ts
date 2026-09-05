import { NextFunction, Response } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

type BusinessPlanPayload = {
  businessName?: string;
  startupName?: string;
  docUrl?: string;
  documentUrl?: string;
  businessPlanUrl?: string;
  title?: string;
  executiveSummary?: string;
  marketAnalysis?: string;
  competitorAnalysis?: string;
  marketing?: string;
  sales?: string;
  operations?: string;
  technology?: string;
  financialProjections?: string;
  risk?: string;
  expansion?: string;
};

function pickFirstString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

async function resolveStartupIdea(userId: string, payload: BusinessPlanPayload = {}) {
  const businessName = pickFirstString(payload.businessName, payload.startupName, payload.title);
  const docUrl = pickFirstString(payload.docUrl, payload.documentUrl, payload.businessPlanUrl);

  const where: any = {
    founder: userId,
    deletedAt: null,
  };

  if (businessName) {
    where.OR = [
      { startup: { equals: businessName, mode: 'insensitive' } },
      { startup: { contains: businessName, mode: 'insensitive' } },
    ];
  }

  if (docUrl && !where.OR) {
    where.OR = [
      { businessPlan: { equals: docUrl } },
      { businessPlan: { contains: docUrl } },
    ];
  }

  const idea = await prisma.startupIdea.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return { idea, businessName, docUrl };
}

export const getBusinessPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { idea, businessName, docUrl } = await resolveStartupIdea(req.user.id, {
      businessName: req.query.businessName?.toString(),
      startupName: req.query.startupName?.toString(),
      docUrl: req.query.docUrl?.toString(),
      documentUrl: req.query.documentUrl?.toString(),
      businessPlanUrl: req.query.businessPlanUrl?.toString(),
    });

    if (!idea) {
      return res.json(
        successResponse('Business plan not found', {
          businessName: businessName || null,
          docUrl: docUrl || null,
          data: null,
        }),
      );
    }

    return res.json(
      successResponse('Business plan retrieved', {
        id: idea.id,
        businessName: idea.startup,
        docUrl: idea.businessPlan || null,
        startupId: idea.id,
        startupName: idea.startup,
        industry: idea.industry,
        category: idea.category,
        stage: idea.stage,
        funding: idea.funding,
        equity: idea.equity,
        visibility: idea.visibility,
        pitchDeckUrl: idea.pitchDeck || null,
        businessPlanUrl: idea.businessPlan || null,
        documentUrl: idea.businessPlan || null,
        createdAt: idea.createdAt,
        updatedAt: idea.updatedAt,
      }),
    );
  } catch (error) {
    next(error);
  }
};

export const createBusinessPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as BusinessPlanPayload;
    const businessName = pickFirstString(body.businessName, body.startupName, body.title);
    const docUrl = pickFirstString(body.docUrl, body.documentUrl, body.businessPlanUrl);

    if (!businessName) {
      return res.status(400).json(errorResponse('Business name is required', 'VALIDATION_ERROR'));
    }
    if (!docUrl) {
      return res.status(400).json(errorResponse('Document URL is required', 'VALIDATION_ERROR'));
    }

    const existing = await prisma.startupIdea.findFirst({
      where: {
        founder: req.user.id,
        deletedAt: null,
        startup: businessName,
      },
    });

    const idea = existing
      ? await prisma.startupIdea.update({
          where: { id: existing.id },
          data: {
            businessPlan: docUrl,
          },
        })
      : await prisma.startupIdea.create({
          data: {
            founder: req.user.id,
            startup: businessName,
            businessPlan: docUrl,
            industry: body.executiveSummary ?? "",
            category: body.marketAnalysis ?? "",
            stage: body.competitorAnalysis ?? "",
            funding: 0,
            equity: 0,
            visibility: 'Public',
            pitchDeck: null,
            logo: null,
            coverUrl: null,
          },
        });

    return res.status(201).json(
      successResponse('Business plan created', {
        id: idea.id,
        businessName: idea.startup,
        docUrl: idea.businessPlan,
        businessPlanUrl: idea.businessPlan,
        startupId: idea.id,
      }),
    );
  } catch (error) {
    next(error);
  }
};

export const updateBusinessPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as BusinessPlanPayload;
    const { idea, businessName } = await resolveStartupIdea(req.user.id, body);

    if (!idea) {
      return res.status(404).json(errorResponse('Business plan not found', 'NOT_FOUND'));
    }

    const nextBusinessName = pickFirstString(body.businessName, body.startupName, body.title) || idea.startup;
    const nextDocUrl = pickFirstString(body.docUrl, body.documentUrl, body.businessPlanUrl) || idea.businessPlan || '';

    const updated = await prisma.startupIdea.update({
      where: { id: idea.id },
      data: {
        startup: nextBusinessName,
        businessPlan: nextDocUrl || null,
      },
    });

    return res.json(
      successResponse('Business plan updated', {
        id: updated.id,
        businessName: updated.startup,
        docUrl: updated.businessPlan || null,
        businessPlanUrl: updated.businessPlan || null,
        startupId: updated.id,
        matchedBusinessName: businessName || null,
      }),
    );
  } catch (error) {
    next(error);
  }
};

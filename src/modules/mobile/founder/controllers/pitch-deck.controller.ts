import { NextFunction, Response } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

type PitchDeckPayload = {
  businessName?: string;
  startupName?: string;
  docUrl?: string;
  documentUrl?: string;
  pitchDeckUrl?: string;
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

async function resolveStartupIdea(userId: string, payload: PitchDeckPayload = {}) {
  const businessName = pickFirstString(payload.businessName, payload.startupName, payload.title);
  const docUrl = pickFirstString(payload.docUrl, payload.documentUrl, payload.pitchDeckUrl);

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
      { pitchDeck: { equals: docUrl } },
      { pitchDeck: { contains: docUrl } },
    ];
  }

  const idea = await prisma.startupIdea.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return { idea, businessName, docUrl };
}

export const getPitchDeck = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { idea, businessName, docUrl } = await resolveStartupIdea(req.user.id, {
      businessName: req.query.businessName?.toString(),
      startupName: req.query.startupName?.toString(),
      docUrl: req.query.docUrl?.toString(),
      documentUrl: req.query.documentUrl?.toString(),
      pitchDeckUrl: req.query.pitchDeckUrl?.toString(),
    });

    if (!idea) {
      return res.json(
        successResponse('Pitch deck not found', {
          businessName: businessName || null,
          docUrl: docUrl || null,
          data: null,
        }),
      );
    }

    return res.json(
      successResponse('Pitch deck retrieved', {
        id: idea.id,
        businessName: idea.startup,
        docUrl: idea.pitchDeck || null,
        startupId: idea.id,
        startupName: idea.startup,
        industry: idea.industry,
        category: idea.category,
        stage: idea.stage,
        funding: idea.funding,
        equity: idea.equity,
        visibility: idea.visibility,
        pitchDeckUrl: idea.pitchDeck || null,
       
        documentUrl: idea.pitchDeck || null,
        createdAt: idea.createdAt,
        updatedAt: idea.updatedAt,
      }),
    );
  } catch (error) {
    next(error);
  }
};

export const createPitchDeck = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as PitchDeckPayload;
    const businessName = pickFirstString(body.businessName, body.startupName, body.title);
    const docUrl = pickFirstString(body.docUrl, body.documentUrl, body.pitchDeckUrl);

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
            pitchDeck: docUrl,
          },
        })
      : await prisma.startupIdea.create({
          data: {
            founder: req.user.id,
            startup: businessName,
            pitchDeck: docUrl,
            industry: body.executiveSummary ?? "",
            category: body.marketAnalysis ?? "",
            stage: body.competitorAnalysis ?? "",
            funding: 0,
            equity: 0,
            visibility: 'Public',
            businessPlan: null,
            logo: null,
            coverUrl: null,
          },
        });

    return res.status(201).json(
      successResponse('Pitch deck created', {
        id: idea.id,
        businessName: idea.startup,
        docUrl: idea.pitchDeck,
        pitchDeckUrl: idea.pitchDeck,
        startupId: idea.id,
      }),
    );
  } catch (error) {
    next(error);
  }
};

export const updatePitchDeck = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as PitchDeckPayload;
    const { idea, businessName } = await resolveStartupIdea(req.user.id, body);

    if (!idea) {
      return res.status(404).json(errorResponse('Pitch deck not found', 'NOT_FOUND'));
    }

    const nextBusinessName = pickFirstString(body.businessName, body.startupName, body.title) || idea.startup;
    const nextDocUrl = pickFirstString(body.docUrl, body.documentUrl, body.pitchDeckUrl) || idea.pitchDeck || '';

    const updated = await prisma.startupIdea.update({
      where: { id: idea.id },
      data: {
        startup: nextBusinessName,
        pitchDeck: nextDocUrl || null,
      },
    });

    return res.json(
      successResponse('Pitch deck updated', {
        id: updated.id,
        businessName: updated.startup,
        docUrl: updated.pitchDeck || null,
        pitchDeckUrl: updated.pitchDeck || null,
        startupId: updated.id,
        matchedBusinessName: businessName || null,
      }),
    );
  } catch (error) {
    next(error);
  }
};
export const deletePitchDeck = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { idea, businessName } = await resolveStartupIdea(req.user.id, req.query);

    if (!idea) {
      return res.status(404).json(errorResponse('Pitch deck not found', 'NOT_FOUND'));
    }

    const updated = await prisma.startupIdea.update({
      where: { id: idea.id },
      data: { pitchDeck: null },
    });

    return res.json(
      successResponse('Pitch deck deleted', {
        id: updated.id,
        businessName: updated.startup,
      }),
    );
  } catch (error) {
    next(error);
  }
};

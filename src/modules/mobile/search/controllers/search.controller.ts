import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { globalSearch } from '../../../../services/mobile/search.service.js';

export const search = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { query, type, page, limit, city, category, industry, stage, sort, status } = req.query as Record<string, string>;

    if (!query || query.trim().length < 2) {
      return res.status(400).json(errorResponse('Query must be at least 2 characters', 'VALIDATION_ERROR'));
    }

    const results = await globalSearch(req.user?.id || null, {
      query, type, city, category, industry, stage, sort, status,
      page: parseInt(page || '1'),
      limit: parseInt(limit || '10')
    });

    return res.json(successResponse('Search results', results));
  } catch (error) { next(error); }
};

export const suggestions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { query } = req.query as Record<string, string>;
    const skills = await prisma.skill.findMany({
      where: query ? { name: { contains: query } } : undefined,
      take: 8,
      orderBy: { name: 'asc' }
    });

    return res.json(successResponse('Suggestions', {
      matching: skills.map((skill) => skill.name),
      recent: [],
      popular: skills.map((skill) => skill.name),
      trending: skills.map((skill) => skill.name)
    }));
  } catch (error) { next(error); }
};

export const getHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Search history', []));
  } catch (error) { next(error); }
};

export const clearHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Search history cleared'));
  } catch (error) { next(error); }
};

export const deleteHistoryItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Search history item deleted'));
  } catch (error) { next(error); }
};

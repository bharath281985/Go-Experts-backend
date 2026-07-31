import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

type PortfolioItem = {
  id: string;
  title: string;
  description: string;
  projectUrl?: string | null;
  technologies: string[];
  role?: string;
  category?: string;
  completionDate?: string | null;
  createdAt: string;
  updatedAt: string;
};

const portfolioKey = (userId: string) => `freelancer_portfolio:${userId}`;

const parseItems = (raw?: string | null): PortfolioItem[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readItems = async (userId: string): Promise<PortfolioItem[]> => {
  const row = await prisma.setting.findUnique({ where: { key: portfolioKey(userId) } });
  return parseItems(row?.value);
};

const writeItems = async (userId: string, items: PortfolioItem[]) => {
  const key = portfolioKey(userId);
  await prisma.setting.upsert({
    where: { key },
    update: { value: JSON.stringify(items), category: 'freelancer_portfolio' },
    create: {
      key,
      value: JSON.stringify(items),
      category: 'freelancer_portfolio',
    },
  });
};

const normalizeItem = (body: Record<string, unknown>, existing?: PortfolioItem): PortfolioItem => {
  const now = new Date().toISOString();
  const technologies = Array.isArray(body.technologies)
    ? body.technologies.map((t) => String(t).trim()).filter(Boolean)
    : String(body.technologies || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

  return {
    id: existing?.id ?? randomUUID(),
    title: String(body.title || existing?.title || '').trim() || 'Untitled',
    description: String(body.description || existing?.description || '').trim(),
    projectUrl: body.projectUrl != null
      ? String(body.projectUrl).trim() || null
      : existing?.projectUrl ?? null,
    technologies,
    role: String(body.role || existing?.role || '').trim(),
    category: String(body.category || existing?.category || 'portfolio').trim() || 'portfolio',
    completionDate: body.completionDate != null
      ? String(body.completionDate)
      : existing?.completionDate ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
};

export const listPortfolio = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '15'), 10) || 15, 1), 100);
    const search = String(req.query.search || req.query.q || '').trim().toLowerCase();

    let items = await readItems(req.user.id);
    if (search) {
      items = items.filter((item) =>
        [item.title, item.description, item.projectUrl, ...(item.technologies || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search)
      );
    }

    items = [...items].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const total = items.length;
    const start = (page - 1) * limit;
    const data = items.slice(start, start + limit);

    return res.json(
      successResponse('Portfolio retrieved', data, {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getPortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await readItems(req.user.id);
    const item = items.find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json(errorResponse('Portfolio item not found', 'NOT_FOUND'));
    return res.json(successResponse('Portfolio item retrieved', item));
  } catch (error) {
    next(error);
  }
};

export const createPortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const title = String(req.body?.title || '').trim();
    if (!title) {
      return res.status(400).json(errorResponse('Title is required', 'VALIDATION_ERROR'));
    }

    const items = await readItems(req.user.id);
    const item = normalizeItem(req.body || {});
    items.unshift(item);
    await writeItems(req.user.id, items);
    return res.status(201).json(successResponse('Portfolio item created', item));
  } catch (error) {
    next(error);
  }
};

export const updatePortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await readItems(req.user.id);
    const index = items.findIndex((i) => i.id === req.params.id);
    if (index < 0) {
      return res.status(404).json(errorResponse('Portfolio item not found', 'NOT_FOUND'));
    }

    const updated = normalizeItem(req.body || {}, items[index]);
    items[index] = updated;
    await writeItems(req.user.id, items);
    return res.json(successResponse('Portfolio item updated', updated));
  } catch (error) {
    next(error);
  }
};

export const deletePortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await readItems(req.user.id);
    const nextItems = items.filter((i) => i.id !== req.params.id);
    if (nextItems.length === items.length) {
      return res.status(404).json(errorResponse('Portfolio item not found', 'NOT_FOUND'));
    }
    await writeItems(req.user.id, nextItems);
    return res.json(successResponse('Portfolio item deleted', true));
  } catch (error) {
    next(error);
  }
};

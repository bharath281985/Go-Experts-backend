import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export type InvestorPortfolioHolding = {
  id: string;
  startupName: string;
  industry: string;
  stage: string;
  status: string;
  investedAmount: number;
  equity: number;
  currentValue: number;
  investedAt: string;
  projectUrl?: string | null;
  logoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

const investorPortfolioKey = (userId: string | number) => `investor_portfolio:${userId}`;

export const readInvestorPortfolioItems = async (userIdOrInvestorId: string | number): Promise<InvestorPortfolioHolding[]> => {
  let userId = String(userIdOrInvestorId || '');
  if (!userId) return [];

  const investor = await prisma.investorProfile.findFirst({
    where: { OR: [{ id: userId }, { userId: userId }] },
    select: { userId: true },
  });
  if (investor?.userId) {
    userId = investor.userId;
  }

  // 1. Read custom holdings from Setting
  const row = await prisma.setting.findUnique({ where: { key: investorPortfolioKey(userId) } });
  let customItems: InvestorPortfolioHolding[] = [];
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) {
        customItems = parsed.map((item) => ({
          ...item,
          status: item.status || 'Ongoing',
          projectUrl: item.projectUrl || item.websiteUrl || item.website || item.url || null,
        }));
      }
    } catch {}
  }

  // 2. Read active/completed investments from Investment table
  const investments = await prisma.investment.findMany({
    where: { investor: userId, status: { in: ['Active', 'Closed', 'Completed', 'Approved'] } },
    orderBy: { createdAt: 'desc' },
  });

  const investmentItems: InvestorPortfolioHolding[] = [];
  for (const inv of investments) {
    let startupName = inv.startup;
    let logoUrl: string | null = null;
    let projectUrl: string | null = null;
    let industry = 'General';
    let stage = 'Seed';

    try {
      const startupObj = await prisma.startupIdea.findFirst({
        where: { OR: [{ id: inv.startup }, { startup: inv.startup }] },
        select: { startup: true, logo: true, industry: true, stage: true, website: true, url: true } as any,
      });
      if (startupObj) {
        startupName = startupObj.startup || startupName;
        logoUrl = startupObj.logo || null;
        projectUrl = (startupObj as any).website || (startupObj as any).url || null;
        industry = startupObj.industry || industry;
        stage = startupObj.stage || stage;
      }
    } catch {}

    const amount = Number(inv.offer) || 0;
    const invStatus = inv.status === 'Completed' || inv.status === 'Closed'
      ? 'Completed'
      : (inv.status === 'Active' || inv.status === 'Approved' ? 'Ongoing' : inv.status || 'Ongoing');

    investmentItems.push({
      id: inv.id,
      startupName,
      industry,
      stage,
      status: invStatus,
      investedAmount: amount,
      equity: Number(inv.equity) || 0,
      currentValue: amount,
      investedAt: inv.createdAt.toISOString(),
      projectUrl,
      logoUrl,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
    });
  }

  // Combine and deduplicate
  const combined = [...customItems, ...investmentItems];
  const seen = new Set<string>();
  const unique = combined.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return unique.sort(
    (a, b) => new Date(b.investedAt || b.createdAt).getTime() - new Date(a.investedAt || a.createdAt).getTime()
  );
};

const saveInvestorPortfolioItems = async (userId: string | number, items: InvestorPortfolioHolding[]) => {
  const key = investorPortfolioKey(userId);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(items), category: 'portfolio' },
    update: { value: JSON.stringify(items) },
  });
};

export const getPortfolio = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '15'), 10) || 15, 1), 100);
    const search = String(req.query.search || req.query.q || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim().toLowerCase();

    let items = await readInvestorPortfolioItems(String(req.user?.id || ''));

    if (status && status !== 'all') {
      items = items.filter((item) => (item.status || 'ongoing').toLowerCase() === status);
    }

    if (search) {
      items = items.filter((item) =>
        [item.startupName, item.industry, item.stage, item.status, item.projectUrl].filter(Boolean).join(' ').toLowerCase().includes(search)
      );
    }

    const total = items.length;
    const totalInvested = items.reduce((sum, inv) => sum + (Number(inv.investedAmount) || 0), 0);
    const totalCurrentValuation = items.reduce((sum, inv) => sum + (Number(inv.currentValue) || 0), 0);

    const start = (page - 1) * limit;
    const paginatedItems = items.slice(start, start + limit);

    return res.json(
      successResponse('Portfolio retrieved', paginatedItems, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        totalInvested,
        totalCurrentValuation,
        activeCount: total,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getPortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await readInvestorPortfolioItems(String(req.user?.id || ''));
    const item = items.find((i) => i.id === req.params.id);
    if (!item) {
      return res.status(404).json(errorResponse('Portfolio holding not found', 'NOT_FOUND'));
    }
    return res.json(successResponse('Portfolio holding retrieved', item));
  } catch (error) {
    next(error);
  }
};

export const addPortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startupName, industry, stage, status, investedAmount, equity, currentValue, investedAt, logoUrl, projectUrl } = req.body;

    if (!startupName || !String(startupName).trim()) {
      return res.status(400).json(errorResponse('Startup name is required', 'VALIDATION_ERROR'));
    }
    if (!industry || !String(industry).trim()) {
      return res.status(400).json(errorResponse('Industry is required', 'VALIDATION_ERROR'));
    }
    if (!projectUrl || !String(projectUrl).trim()) {
      return res.status(400).json(errorResponse('Project / Website URL is required', 'VALIDATION_ERROR'));
    }

    const userId = String(req.user?.id || '');
    const row = await prisma.setting.findUnique({ where: { key: investorPortfolioKey(userId) } });
    let items: InvestorPortfolioHolding[] = [];
    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) items = parsed;
      } catch {}
    }

    const now = new Date().toISOString();
    const amount = Number(investedAmount) || 0;
    const val = currentValue !== undefined && currentValue !== null ? Number(currentValue) || 0 : amount;

    const newItem: InvestorPortfolioHolding = {
      id: randomUUID(),
      startupName: String(startupName).trim(),
      industry: String(industry || 'General').trim(),
      stage: String(stage || 'Seed').trim(),
      status: String(status || 'Ongoing').trim(),
      investedAmount: amount,
      equity: Number(equity) || 0,
      currentValue: val,
      investedAt: investedAt ? new Date(investedAt).toISOString() : now,
      projectUrl: String(projectUrl).trim(),
      logoUrl: logoUrl ? String(logoUrl).trim() : null,
      createdAt: now,
      updatedAt: now,
    };

    items.unshift(newItem);
    await saveInvestorPortfolioItems(userId, items);

    return res.status(201).json(successResponse('Portfolio holding added', newItem));
  } catch (error) {
    next(error);
  }
};

export const updatePortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { startupName, industry, stage, status, investedAmount, equity, currentValue, investedAt, logoUrl, projectUrl } = req.body;

    const userId = String(req.user?.id || '');
    const row = await prisma.setting.findUnique({ where: { key: investorPortfolioKey(userId) } });
    let items: InvestorPortfolioHolding[] = [];
    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) items = parsed;
      } catch {}
    }

    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) {
      return res.status(404).json(errorResponse('Portfolio holding not found', 'NOT_FOUND'));
    }

    const now = new Date().toISOString();
    items[idx] = {
      ...items[idx],
      ...(startupName !== undefined ? { startupName: String(startupName).trim() } : {}),
      ...(industry !== undefined ? { industry: String(industry).trim() } : {}),
      ...(stage !== undefined ? { stage: String(stage).trim() } : {}),
      ...(status !== undefined ? { status: String(status).trim() } : {}),
      ...(investedAmount !== undefined ? { investedAmount: Number(investedAmount) || 0 } : {}),
      ...(equity !== undefined ? { equity: Number(equity) || 0 } : {}),
      ...(currentValue !== undefined ? { currentValue: Number(currentValue) || 0 } : {}),
      ...(investedAt !== undefined ? { investedAt: new Date(investedAt).toISOString() } : {}),
      ...(projectUrl !== undefined ? { projectUrl: projectUrl ? String(projectUrl).trim() : null } : {}),
      ...(logoUrl !== undefined ? { logoUrl: logoUrl ? String(logoUrl).trim() : null } : {}),
      updatedAt: now,
    };

    await saveInvestorPortfolioItems(userId, items);
    return res.json(successResponse('Portfolio holding updated', items[idx]));
  } catch (error) {
    next(error);
  }
};

export const deletePortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = String(req.user?.id || '');

    const row = await prisma.setting.findUnique({ where: { key: investorPortfolioKey(userId) } });
    let items: InvestorPortfolioHolding[] = [];
    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) items = parsed;
      } catch {}
    }

    const filtered = items.filter((i) => i.id !== id);
    await saveInvestorPortfolioItems(userId, filtered);

    return res.json(successResponse('Portfolio holding removed', { id }));
  } catch (error) {
    next(error);
  }
};

export const getPortfolioPerformance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await readInvestorPortfolioItems(String(req.user?.id || ''));
    const totalInvested = items.reduce((sum, inv) => sum + (Number(inv.investedAmount) || 0), 0);
    const currentValue = items.reduce((sum, inv) => sum + (Number(inv.currentValue) || 0), 0);
    const gain = currentValue - totalInvested;
    const roi = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;

    return res.json(
      successResponse('Portfolio performance', {
        totalInvested,
        currentValue,
        roi: Number(roi.toFixed(1)),
        gain,
        loss: gain < 0 ? Math.abs(gain) : 0,
        performanceByMonth: [0, 0, 0, 0, 0, 0],
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getPortfolioAllocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await readInvestorPortfolioItems(String(req.user?.id || ''));
    return res.json(successResponse('Portfolio allocation', { byIndustry: [], byStage: [], investments: items }));
  } catch (error) {
    next(error);
  }
};

export const getPortfolioROI = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await readInvestorPortfolioItems(String(req.user?.id || ''));
    const totalInvested = items.reduce((sum, inv) => sum + (Number(inv.investedAmount) || 0), 0);
    const currentValue = items.reduce((sum, inv) => sum + (Number(inv.currentValue) || 0), 0);
    const roi = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;

    return res.json(
      successResponse('Portfolio ROI', {
        overallROI: Number(roi.toFixed(1)),
        byStartup: items.map((i) => ({ startup: i.startupName, roi: i.investedAmount > 0 ? ((i.currentValue - i.investedAmount) / i.investedAmount) * 100 : 0 })),
        roiTrend: [0, 0, 0, 0, 0, 0],
      })
    );
  } catch (error) {
    next(error);
  }
};

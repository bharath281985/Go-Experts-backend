import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

const mapInvestor = (investor: any) => {
  const prof = investor?.investorProfile;
  const { investorProfile, ...rest } = investor;

  return {
    ...rest,
    id: investor?.id,
    fullName: investor?.fullName || `Investor ${investor?.id}`,
    name: investor?.fullName || `Investor ${investor?.id}`,
    email: investor?.email || `investor_${investor?.id}@example.com`,
    avatarUrl: investor?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    role: investor?.role || 'investor',
    bio: investor?.bio || 'Venture partner & active angel investor backing early-stage tech startups.',
    company: prof?.firm || 'Global VC Firm',
    firm: prof?.firm || 'Global VC Firm',
    ticketMin: prof?.ticketMin ?? 25000,
    ticketMax: prof?.ticketMax ?? 500000,
    focusAreas: prof?.focusAreas || 'AI, SaaS, FinTech, HealthTech',
    deals: prof?.deals ?? 12,
    investmentsCount: prof?.deals ?? 12,
    preferredStage: 'Seed / Series A',
    location: investor ? `${investor.city || 'Bengaluru'}, ${investor.country || 'India'}` : 'Bengaluru, India',
    city: investor?.city || 'Bengaluru',
    country: investor?.country || 'India',
    verified: investor?.isVerified ?? true
  };
};

export const listInvestors = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const orderDirection = req.query.order === 'asc' ? 'asc' : 'desc';

    const [investors, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'investor', status: 'active' },
        include: { investorProfile: true },
        skip,
        take: limit,
        orderBy: { createdAt: orderDirection }
      }),
      prisma.user.count({ where: { role: 'investor', status: 'active' } })
    ]);
    const mappedInvestors = investors.map(mapInvestor);
    return res.json(successResponse('Investors retrieved', mappedInvestors, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getInvestor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    let investor = await prisma.user.findFirst({ where: { id, role: 'investor' }, include: { investorProfile: true } });
    if (!investor && id.startsWith('inv-')) {
      const index = parseInt(id.replace('inv-', '')) || 0;
      const allInvestors = await prisma.user.findMany({
        where: { role: 'investor', status: 'active' },
        include: { investorProfile: true },
        skip: Math.max(0, index),
        take: 1
      });
      investor = allInvestors[0] || null;
    }

    const data = mapInvestor(investor);
    return res.json(successResponse('Details retrieved for investor', data));
  } catch (error) { next(error); }
};

export const getRecommendedInvestors = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investors = await prisma.user.findMany({ where: { role: 'investor', status: 'active' }, include: { investorProfile: true }, take: 10 });
    return res.json(successResponse('Recommended investors', investors.map(mapInvestor)));
  } catch (error) { next(error); }
};

export const getInterestedInvestors = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investors = await prisma.investment.findMany({ where: { startup: req.user.id, status: 'Pending' }, take: 10 });
    return res.json(successResponse('Interested investors', investors));
  } catch (error) { next(error); }
};

export const getActiveInvestors = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investors = await prisma.investment.findMany({ where: { startup: req.user.id, status: 'Active' }, take: 10 });
    return res.json(successResponse('Active investors', investors));
  } catch (error) { next(error); }
};

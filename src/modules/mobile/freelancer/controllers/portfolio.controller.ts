import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

type SkillEntry = { skillId: string; skillName: string };

type PortfolioItem = {
  id: string;
  title: string;
  industry?: string;
  industryId?: string | null;
  category?: string;
  categoryId?: string | null;
  skills: SkillEntry[];
  technologies: string[];
  status?: string;
  client?: string;
  duration?: string;
  teamSize?: string;
  teamSizeId?: string | null;
  role?: string;
  githubUrl?: string | null;
  liveUrl?: string | null;
  projectUrl?: string | null;
  overview?: string;
  description?: string;
  coverMedia?: string | null;
  coverUrl?: string | null;
  videoDemo?: string | null;
  videoUrl?: string | null;
  pdfCaseStudy?: string | null;
  caseStudyUrl?: string | null;
  extraScreenshot?: string | null;
  screenshotUrl?: string | null;
  completionDate?: string | null;
  createdAt: string;
  updatedAt: string;
};

const portfolioKey = (userId: string | number) => `freelancer_portfolio:${userId}`;

const parseItems = (raw?: string | null): PortfolioItem[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const readItems = async (userIdOrFreelancerId: string | number): Promise<PortfolioItem[]> => {
  let userId = String(userIdOrFreelancerId || '');
  if (!userId) return [];

  const profile = await prisma.freelancerProfile.findFirst({
    where: { OR: [{ id: userId }, { userId: userId }] },
    select: { userId: true },
  }).catch(() => null);
  if (profile?.userId) {
    userId = profile.userId;
  }

  const row = await prisma.setting.findUnique({ where: { key: portfolioKey(userId) } });
  const items = parseItems(row?.value);
  if (items.length > 0) return Promise.all(items.map((item) => normalizeItem(item, item)));

  // Fallback: Check if portfolio was uploaded during sign-up in registrationData
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { freelancerProfile: true }
    });
    if (!user) return [];

    let regData: any = {};
    if (user.registrationData) {
      regData = typeof user.registrationData === 'string' ? JSON.parse(user.registrationData) : user.registrationData;
    }

    const signupItems: PortfolioItem[] = [];
    const now = new Date().toISOString();

    if (Array.isArray(regData.portfolioItems) && regData.portfolioItems.length > 0) {
      for (const item of regData.portfolioItems) {
        if (typeof item === 'object' && item) {
          signupItems.push(await normalizeItem(item));
        }
      }
    }

    const portfolioUrl = regData.portfolioUrl || regData.portfolio || regData.socialLinks?.portfolio || null;
    if (portfolioUrl && signupItems.length === 0) {
      signupItems.push({
        id: randomUUID(),
        title: regData.title || regData.professionalTitle || 'Sign-up Portfolio Project',
        description: regData.overview || regData.bio || user.bio || 'Project portfolio uploaded during sign-up.',
        projectUrl: String(portfolioUrl),
        skills: Array.isArray(regData.skills) ? regData.skills : (typeof regData.skills === 'string' ? regData.skills.split(',').map((s: string) => s.trim()) : []),
        technologies: Array.isArray(regData.skills) ? regData.skills : (typeof regData.skills === 'string' ? regData.skills.split(',').map((s: string) => s.trim()) : []),
        role: regData.title || 'Freelancer Developer',
        category: 'Full-Stack Development',
        completionDate: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (signupItems.length > 0) {
      const key = portfolioKey(userId);
      await prisma.setting.upsert({
        where: { key },
        update: { value: JSON.stringify(signupItems), category: 'freelancer_portfolio' },
        create: { key, value: JSON.stringify(signupItems), category: 'freelancer_portfolio' },
      }).catch(() => null);
      return signupItems;
    }
  } catch {
    // Return empty on error
  }

  return [];
};

const writeItems = async (userIdOrFreelancerId: string | number, items: PortfolioItem[]) => {
  let userId = String(userIdOrFreelancerId || '');
  if (!userId) return;

  const profile = await prisma.freelancerProfile.findFirst({
    where: { OR: [{ id: userId }, { userId: userId }] },
    select: { userId: true },
  }).catch(() => null);
  if (profile?.userId) {
    userId = profile.userId;
  }

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

  // Sync back top projectUrl to registrationData for full compatibility
  try {
    const topUrl = items[0]?.projectUrl || items[0]?.liveUrl;
    if (topUrl) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.registrationData) {
        let reg = typeof user.registrationData === 'string' ? JSON.parse(user.registrationData) : user.registrationData;
        reg.portfolioUrl = topUrl;
        reg.portfolioItems = items;
        await prisma.user.update({
          where: { id: userId },
          data: { registrationData: reg }
        }).catch(() => null);
      }
    }
  } catch { }
};

const normalizeItem = async (body: Record<string, unknown>, existing?: PortfolioItem): Promise<PortfolioItem> => {
  const now = new Date().toISOString();

  // Parse skills: accept [{skillId, skillName}], ["string"], or comma-separated string
  const rawSkills = body.skills || body.technologies || existing?.skills || existing?.technologies;
  let skillNames: string[] = [];
  let inputSkillMap: Record<string, string> = {}; // name -> provided skillId

  if (Array.isArray(rawSkills)) {
    for (const item of rawSkills) {
      if (typeof item === 'object' && item !== null && (item as any).skillName) {
        const name = String((item as any).skillName).trim();
        const id = (item as any).skillId ? String((item as any).skillId).trim() : '';
        if (name) {
          skillNames.push(name);
          if (id) inputSkillMap[name.toLowerCase()] = id;
        }
      } else {
        const name = String(item).trim();
        if (name) skillNames.push(name);
      }
    }
  } else if (typeof rawSkills === 'string' && rawSkills.trim()) {
    skillNames = rawSkills.split(',').map((s: string) => s.trim()).filter(Boolean);
  }

  // Look up real UUIDs from DB Skill table
  let dbSkillMap: Record<string, string> = {};
  if (skillNames.length > 0) {
    try {
      const dbSkills = await prisma.skill.findMany({
        where: { name: { in: skillNames } },
        select: { id: true, name: true },
      });
      for (const s of dbSkills) {
        dbSkillMap[s.name.toLowerCase()] = s.id;
      }
    } catch { }
  }

  const skills: SkillEntry[] = skillNames.map((name) => {
    const key = name.toLowerCase();
    const skillId = inputSkillMap[key] || dbSkillMap[key] || randomUUID();
    return { skillId, skillName: name };
  });

  const technologies = skills.map((s) => s.skillName);

  const liveUrl = String(body.liveUrl || body.projectUrl || existing?.liveUrl || existing?.projectUrl || '').trim() || null;
  const githubUrl = String(body.githubUrl || existing?.githubUrl || '').trim() || null;
  const overview = String(body.overview || body.description || existing?.overview || existing?.description || '').trim();
  const cover = String(body.coverMedia || body.coverUrl || existing?.coverMedia || existing?.coverUrl || '').trim() || null;
  const video = String(body.videoDemo || body.videoUrl || existing?.videoDemo || existing?.videoUrl || '').trim() || null;
  const pdf = String(body.pdfCaseStudy || body.caseStudyUrl || existing?.pdfCaseStudy || existing?.caseStudyUrl || '').trim() || null;
  const screenshot = String(body.extraScreenshot || body.screenshotUrl || existing?.extraScreenshot || existing?.screenshotUrl || '').trim() || null;

  const categoryName = String(body.category || existing?.category || 'Full-Stack Development').trim();
  const categoryId = String(body.categoryId || body.category_id || existing?.categoryId || (categoryName ? categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '')).trim() || null;

  const industryName = String(body.industry || existing?.industry || 'Technology').trim();
  const industryId = String(body.industryId || body.industry_id || existing?.industryId || (industryName ? industryName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '')).trim() || null;

  const teamSizeVal = String(body.teamSize || existing?.teamSize || '1-5').trim();
  const teamSizeId = String(body.teamSizeId || body.team_size_id || existing?.teamSizeId || (teamSizeVal ? 'ts_' + teamSizeVal.toLowerCase().replace(/[^a-z0-9]+/g, '_') : '')).trim() || null;

  return {
    id: existing?.id ?? randomUUID(),
    title: String(body.title || existing?.title || '').trim() || 'Untitled Project',
    industry: industryName,
    industryId: industryId || "",
    category: categoryName,
    categoryId: categoryId || "",
    skills,
    technologies,
    status: String(body.status || existing?.status || 'Published').trim(),
    client: String(body.client || existing?.client || '').trim(),
    duration: String(body.duration || existing?.duration || '').trim(),
    teamSize: teamSizeVal,
    teamSizeId: teamSizeId || "",
    role: String(body.role || body.yourRole || existing?.role || '').trim(),
    githubUrl: githubUrl || "",
    liveUrl: liveUrl || "",
    projectUrl: liveUrl || "",
    overview,
    description: overview,
    coverMedia: cover || "",
    coverUrl: cover || "",
    videoDemo: video || "",
    videoUrl: video || "",
    pdfCaseStudy: pdf || "",
    caseStudyUrl: pdf || "",
    extraScreenshot: screenshot || "",
    screenshotUrl: screenshot || "",
    completionDate: body.completionDate != null ? String(body.completionDate) : existing?.completionDate ?? "",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
};

export const listPortfolio = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '15'), 10) || 15, 1), 100);
    const search = String(req.query.search || req.query.q || '').trim().toLowerCase();

    const userId = String(req.user?.id || '');
    let items = await readItems(userId);
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
    const userId = String(req.user?.id || '');
    const items = await readItems(userId);
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
    const description = String(req.body?.description || req.body?.overview || '').trim();
    const projectUrl = String(req.body?.projectUrl || req.body?.liveUrl || '').trim();

    if (!title) {
      return res.status(400).json(errorResponse('Title is required', 'VALIDATION_ERROR'));
    }
    if (!description) {
      return res.status(400).json(errorResponse('Description is required', 'VALIDATION_ERROR'));
    }
    if (!projectUrl) {
      return res.status(400).json(errorResponse('Project / Live URL is required', 'VALIDATION_ERROR'));
    }

    const userId = String(req.user?.id || '');
    const items = await readItems(userId);
    const item = await normalizeItem(req.body || {});
    items.unshift(item);
    await writeItems(userId, items);
    return res.status(201).json(successResponse('Portfolio item created', item));
  } catch (error) {
    next(error);
  }
};

export const updatePortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = String(req.user?.id || '');
    const items = await readItems(userId);
    const index = items.findIndex((i) => i.id === req.params.id);
    if (index < 0) {
      return res.status(404).json(errorResponse('Portfolio item not found', 'NOT_FOUND'));
    }

    if (req.body?.title !== undefined && !String(req.body.title).trim()) {
      return res.status(400).json(errorResponse('Title cannot be empty', 'VALIDATION_ERROR'));
    }
    if (req.body?.projectUrl !== undefined && !String(req.body.projectUrl).trim() && !String(req.body.liveUrl || '').trim()) {
      return res.status(400).json(errorResponse('Project / Live URL cannot be empty', 'VALIDATION_ERROR'));
    }

    const updated = await normalizeItem(req.body || {}, items[index]);
    items[index] = updated;
    await writeItems(userId, items);
    return res.json(successResponse('Portfolio item updated', updated));
  } catch (error) {
    next(error);
  }
};

export const deletePortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = String(req.user?.id || '');
    const items = await readItems(userId);
    const nextItems = items.filter((i) => i.id !== req.params.id);
    if (nextItems.length === items.length) {
      return res.status(404).json(errorResponse('Portfolio item not found', 'NOT_FOUND'));
    }
    await writeItems(userId, nextItems);
    return res.json(successResponse('Portfolio item deleted', true));
  } catch (error) {
    next(error);
  }
};

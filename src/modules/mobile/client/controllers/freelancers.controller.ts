import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { getJsonSetting, setJsonSetting } from '../../../../common/helpers/portal-shared.js';

async function shapeFreelancersList(freelancers: any[], userId?: string | null) {
  if (!freelancers.length) return [];

  let savedIds = new Set<string>();
  let invitedIds = new Set<string>();

  if (userId) {
    const rows = await getJsonSetting(userId, 'savedFreelancers', [] as any[]);
    const ids = rows.map((r: any) => typeof r === 'string' ? r : (r.freelancerId || r.id)).filter(Boolean);
    savedIds = new Set(ids);

    const fIds = freelancers.map(f => f.id);
    if (fIds.length > 0) {
      const invites = await prisma.proposal.findMany({
        where: {
          freelancerId: { in: fIds },
          status: 'invited',
          deletedAt: null,
          project: { client: userId }
        },
        select: { freelancerId: true }
      }).catch(() => []);
      invitedIds = new Set(invites.map(i => i.freelancerId));
    }
  }

  // Extract all IDs across list
  const allSkillIds: string[] = [];
  const allIndIds: string[] = [];
  const allWmIds: string[] = [];

  for (const f of freelancers) {
    const rawSkills = f.freelancerProfile?.skills;
    if (Array.isArray(rawSkills)) allSkillIds.push(...rawSkills.map(String));
    else if (typeof rawSkills === 'string') allSkillIds.push(...rawSkills.split(',').map((s: string) => s.trim()).filter(Boolean));

    const rawInd = f.freelancerProfile?.industry;
    if (Array.isArray(rawInd)) allIndIds.push(...rawInd.map(String));
    else if (typeof rawInd === 'string') allIndIds.push(...rawInd.split(',').map((s: string) => s.trim()).filter(Boolean));

    const rawWm = f.freelancerProfile?.workMode;
    if (Array.isArray(rawWm)) allWmIds.push(...rawWm.map(String));
    else if (typeof rawWm === 'string') allWmIds.push(...rawWm.split(',').map((s: string) => s.trim()).filter(Boolean));
  }

  const [dbSkills, dbIndustries, dbWorkModes] = await Promise.all([
    allSkillIds.length > 0
      ? prisma.skill.findMany({ where: { OR: [{ id: { in: allSkillIds } }, { name: { in: allSkillIds } }] }, select: { id: true, name: true } }).catch(() => [])
      : Promise.resolve([]),
    allIndIds.length > 0
      ? prisma.industry.findMany({ where: { OR: [{ id: { in: allIndIds } }, { name: { in: allIndIds } }] }, select: { id: true, name: true } }).catch(() => [])
      : Promise.resolve([]),
    allWmIds.length > 0
      ? prisma.workMode.findMany({ where: { OR: [{ id: { in: allWmIds } }, { name: { in: allWmIds } }] }, select: { id: true, name: true } }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const skillMap = new Map(dbSkills.map((s: any) => [s.id, s.name]));
  dbSkills.forEach((s: any) => skillMap.set(s.name, s.name));

  const indMap = new Map(dbIndustries.map((i: any) => [i.id, i.name]));
  dbIndustries.forEach((i: any) => indMap.set(i.name, i.name));

  const wmMap = new Map(dbWorkModes.map((w: any) => [w.id, w.name]));
  dbWorkModes.forEach((w: any) => wmMap.set(w.name, w.name));

  return freelancers.map(f => {
    const rawSkills = f.freelancerProfile?.skills;
    const sklArr: string[] = Array.isArray(rawSkills)
      ? rawSkills.map(String)
      : (typeof rawSkills === 'string' ? rawSkills.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

    const rawInd = f.freelancerProfile?.industry;
    const indArr: string[] = Array.isArray(rawInd)
      ? rawInd.map(String)
      : (typeof rawInd === 'string' ? rawInd.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

    const rawWm = f.freelancerProfile?.workMode;
    const wmArr: string[] = Array.isArray(rawWm)
      ? rawWm.map(String)
      : (typeof rawWm === 'string' ? rawWm.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

    const formattedSkills = sklArr.map(id => skillMap.get(id) || (/^[0-9a-f-]{36}$/i.test(id) ? '' : id)).filter(Boolean);
    const formattedInd = indArr.map(id => indMap.get(id) || (/^[0-9a-f-]{36}$/i.test(id) ? '' : id)).filter(Boolean);
    const formattedWm = wmArr.map(id => wmMap.get(id) || (/^[0-9a-f-]{36}$/i.test(id) ? '' : id)).filter(Boolean);

    return {
      ...f,
      skills: formattedSkills.length > 0 ? formattedSkills : sklArr,
      industry: formattedInd[0] || f.freelancerProfile?.industry || 'General',
      industryName: formattedInd[0] || 'General',
      workMode: formattedWm[0] || f.freelancerProfile?.workMode || 'Remote',
      workModeName: formattedWm[0] || 'Remote',
      isSaved: savedIds.has(f.id),
      isInvited: invitedIds.has(f.id),
    };
  });
}

export const listFreelancers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const q = req.query.q as string;

    const where: any = { role: 'freelancer', status: 'active', deletedAt: null };
    if (req.user?.id) where.id = { not: req.user.id };
    if (q) where.fullName = { contains: q };

    const [freelancers, total] = await Promise.all([
      prisma.user.findMany({ where, include: { freelancerProfile: true }, skip, take: limit }),
      prisma.user.count({ where })
    ]);

    const mapped = await shapeFreelancersList(freelancers, req.user?.id);
    
    return res.json(successResponse('Freelancers retrieved', mapped, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getFreelancer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const freelancer = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'freelancer' },
      include: { freelancerProfile: true, reviewsReceived: { take: 5 } }
    });
    if (!freelancer) {
      return res.status(404).json({ success: false, message: 'Freelancer not found' });
    }
    
    const userId = req.user?.id;
    let isSaved = false;
    let isInvited = false;
    let invitedProjectIds: string[] = [];

    if (userId) {
      const rows = await getJsonSetting(userId, 'savedFreelancers', [] as any[]);
      const ids = rows.map((r: any) => typeof r === 'string' ? r : (r.freelancerId || r.id)).filter(Boolean);
      isSaved = ids.includes(freelancer.id);

      const invites = await prisma.proposal.findMany({
        where: {
          freelancerId: freelancer.id,
          status: 'invited',
          deletedAt: null,
          project: { client: userId }
        },
        select: { projectId: true }
      }).catch(() => []);

      if (invites.length > 0) {
        isInvited = true;
        invitedProjectIds = invites.map(i => i.projectId);
      }
    }

    let reg: any = {};
    if (freelancer.registrationData) {
      try {
        reg = typeof freelancer.registrationData === 'string'
          ? JSON.parse(freelancer.registrationData)
          : freelancer.registrationData;
      } catch {
        reg = {};
      }
    }

    // Parse raw array or comma separated fields
    const rawSkills = freelancer.freelancerProfile?.skills || reg.skills || reg.skillsIds || reg.skillIds || [];
    const sklArr: string[] = Array.isArray(rawSkills)
      ? rawSkills.map(String)
      : (typeof rawSkills === 'string' ? rawSkills.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

    const rawInd = freelancer.freelancerProfile?.industry || reg.industry || reg.industryIds || [];
    const indArr: string[] = Array.isArray(rawInd)
      ? rawInd.map(String)
      : (typeof rawInd === 'string' ? rawInd.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

    const rawWm = freelancer.freelancerProfile?.workMode || reg.workMode || reg.workModeIds || [];
    const wmArr: string[] = Array.isArray(rawWm)
      ? rawWm.map(String)
      : (typeof rawWm === 'string' ? rawWm.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

    const rawExp = freelancer.freelancerProfile?.experience || reg.experienceLevel || reg.experience || '';
    const rawCountry = freelancer.country || reg.country || reg.countryId || '';
    const rawState = freelancer.state || reg.state || reg.stateId || '';

    // Parallel DB lookups for all UUIDs
    const [dbSkills, dbIndustries, dbWorkModes, dbCountry, dbState, dbExp] = await Promise.all([
      sklArr.length > 0
        ? prisma.skill.findMany({ where: { OR: [{ id: { in: sklArr } }, { name: { in: sklArr } }] }, select: { id: true, name: true } }).catch(() => [])
        : Promise.resolve([]),
      indArr.length > 0
        ? prisma.industry.findMany({ where: { OR: [{ id: { in: indArr } }, { name: { in: indArr } }] }, select: { id: true, name: true } }).catch(() => [])
        : Promise.resolve([]),
      wmArr.length > 0
        ? prisma.workMode.findMany({ where: { OR: [{ id: { in: wmArr } }, { name: { in: wmArr } }] }, select: { id: true, name: true } }).catch(() => [])
        : Promise.resolve([]),
      rawCountry
        ? prisma.country.findFirst({ where: { OR: [{ id: rawCountry }, { code: rawCountry.toUpperCase() }, { name: rawCountry }] }, select: { id: true, name: true } }).catch(() => null)
        : Promise.resolve(null),
      rawState
        ? prisma.state.findFirst({ where: { OR: [{ id: rawState }, { name: rawState }] }, select: { id: true, name: true } }).catch(() => null)
        : Promise.resolve(null),
      rawExp
        ? prisma.experienceLevel.findFirst({ where: { OR: [{ id: rawExp }, { name: rawExp }] }, select: { id: true, name: true } }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const skillIdMap = new Map<string, any>();
    const skillNameMap = new Map<string, any>();
    dbSkills.forEach((s: any) => {
      skillIdMap.set(s.id, s);
      skillNameMap.set(s.name.toLowerCase().trim(), s);
    });

    const indIdMap = new Map<string, any>();
    const indNameMap = new Map<string, any>();
    dbIndustries.forEach((i: any) => {
      indIdMap.set(i.id, i);
      indNameMap.set(i.name.toLowerCase().trim(), i);
    });

    const wmIdMap = new Map<string, any>();
    const wmNameMap = new Map<string, any>();
    dbWorkModes.forEach((w: any) => {
      wmIdMap.set(w.id, w);
      wmNameMap.set(w.name.toLowerCase().trim(), w);
    });

    // Formatted Skill arrays
    const formattedSkillObjects = sklArr.map((key: string) => {
      const found = skillIdMap.get(key) || skillNameMap.get(key.toLowerCase().trim());
      const realId = found ? found.id : key;
      const realName = found ? found.name : (/^[0-9a-f-]{36}$/i.test(key) ? '' : key);
      return {
        id: realId,
        name: realName || 'Skill',
        skillId: realId,
        skillName: realName || 'Skill',
      };
    });

    const skillNames = formattedSkillObjects.map(s => s.name);

    // Formatted Industry
    const formattedIndustryObjects = indArr.map((key: string) => {
      const found = indIdMap.get(key) || indNameMap.get(key.toLowerCase().trim());
      const realId = found ? found.id : key;
      const realName = found ? found.name : (/^[0-9a-f-]{36}$/i.test(key) ? '' : key);
      return {
        id: realId,
        name: realName || 'General',
        industryId: realId,
        industryName: realName || 'General',
      };
    });
    const primaryIndustry = formattedIndustryObjects[0] || { id: '', name: 'General', industryId: '', industryName: 'General' };

    // Formatted WorkMode
    const formattedWorkModeObjects = wmArr.map((key: string) => {
      const found = wmIdMap.get(key) || wmNameMap.get(key.toLowerCase().trim());
      const realId = found ? found.id : key;
      const realName = found ? found.name : (/^[0-9a-f-]{36}$/i.test(key) ? '' : key);
      return {
        id: realId,
        name: realName || 'Remote',
        workModeId: realId,
        workModeName: realName || 'Remote',
      };
    });
    const primaryWorkMode = formattedWorkModeObjects[0] || { id: '', name: 'Remote', workModeId: '', workModeName: 'Remote' };

    // Formatted Experience Level
    const expName = dbExp?.name || (/^[0-9a-f-]{36}$/i.test(rawExp) ? 'Intermediate' : (rawExp || 'Intermediate'));
    const expObj = {
      id: dbExp?.id || rawExp,
      name: expName,
      experienceLevelId: dbExp?.id || rawExp,
      experienceLevelName: expName,
    };

    // Formatted Location
    const countryName = dbCountry?.name || (rawCountry.length === 2 ? rawCountry.toUpperCase() : rawCountry);
    const stateName = dbState?.name || rawState;
    const cityName = freelancer.city || reg.city || '';
    let locationStr = cityName;
    if (stateName) locationStr = locationStr ? `${locationStr}, ${stateName}` : stateName;
    if (countryName) locationStr = locationStr ? `${locationStr}, ${countryName}` : countryName;

    return res.json(successResponse('Freelancer details', {
      ...freelancer,
      country: countryName || freelancer.country,
      countryId: dbCountry?.id || rawCountry,
      countryName: countryName || '',
      state: stateName || freelancer.state,
      stateId: dbState?.id || rawState,
      stateName: stateName || '',
      city: cityName,
      location: locationStr || 'Remote',

      // Skills: Both structured list of objects and array of string names
      Skills: formattedSkillObjects,
      skills: skillNames.length > 0 ? skillNames : sklArr,

      // Industry: Objects, array, and flat strings
      Industry: formattedIndustryObjects,
      industry: primaryIndustry,
      industryId: primaryIndustry.id,
      industryName: primaryIndustry.name,

      // WorkMode: Objects, array, and flat strings
      WorkMode: formattedWorkModeObjects,
      workMode: primaryWorkMode,
      workModeId: primaryWorkMode.id,
      workModeName: primaryWorkMode.name,

      // Experience Level
      ExperienceLevel: expObj,
      experienceLevel: expObj,
      experienceLevelId: expObj.id,
      experienceLevelName: expObj.name,
      experience: expName,

      // Headline and bio fallbacks
      titleHeadline: freelancer.freelancerProfile?.titleHeadline || reg.titleHeadline || reg.title || 'Freelancer',
      bio: freelancer.bio || freelancer.freelancerProfile?.bio || reg.bio || reg.overview || '',
      hourlyRate: freelancer.freelancerProfile?.hourlyRate ?? reg.hourlyRate ?? 0,
      rating: freelancer.freelancerProfile?.rating ?? 5.0,
      reviewsCount: (freelancer as any).reviewsReceived?.length ?? 0,

      isSaved,
      isInvited,
      invitedProjectIds,
    }));
  } catch (error) { next(error); }
};

export const getRecommendedFreelancers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = { role: 'freelancer', status: 'active', deletedAt: null };
    if (req.user?.id) where.id = { not: req.user.id };
    const freelancers = await prisma.user.findMany({ where, take: 10, include: { freelancerProfile: true } });
    
    const mapped = await shapeFreelancersList(freelancers, req.user?.id);
    return res.json(successResponse('Recommended freelancers', mapped));
  } catch (error) { next(error); }
};

export const saveFreelancer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const freelancerId = req.params.id;

    const rows: any[] = await getJsonSetting(userId, 'savedFreelancers', []);
    const existing = rows.findIndex((r: any) => r.freelancerId === freelancerId || r.id === freelancerId || r === freelancerId);

    if (existing >= 0) {
      const nextRows = rows.filter((r: any) => r.freelancerId !== freelancerId && r.id !== freelancerId && r !== freelancerId);
      await setJsonSetting(userId, 'savedFreelancers', nextRows);
      return res.json(successResponse('Freelancer removed from saved', { isSaved: false, rows: nextRows }));
    }

    const fUser = await prisma.user.findUnique({
      where: { id: freelancerId },
      include: { freelancerProfile: true }
    });
    const entry = {
      id: `sf-${Date.now()}`,
      freelancerId,
      slug: freelancerId,
      name: fUser?.fullName || 'Freelancer',
      headline: fUser?.freelancerProfile?.titleHeadline || '',
      avatar: fUser?.avatarUrl || '',
      rate: fUser?.freelancerProfile?.hourlyRate || 0,
      rating: fUser?.freelancerProfile?.rating || 5,
      location: fUser?.city ? `${fUser.city}, ${fUser.country || ''}` : '',
      savedAt: new Date().toISOString(),
    };
    const nextRows = [...rows, entry];
    await setJsonSetting(userId, 'savedFreelancers', nextRows);

    return res.json(successResponse('Freelancer saved', { isSaved: true, rows: nextRows }));
  } catch (error) { next(error); }
};

export const unsaveFreelancer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const freelancerId = req.params.id;

    const rows: any[] = await getJsonSetting(userId, 'savedFreelancers', []);
    const nextRows = rows.filter((r: any) => r.id !== freelancerId && r.freelancerId !== freelancerId && r !== freelancerId);
    
    await setJsonSetting(userId, 'savedFreelancers', nextRows);
    return res.json(successResponse('Freelancer removed from saved', { isSaved: false, rows: nextRows }));
  } catch (error) { next(error); }
};

export const getSavedFreelancers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const rows = await getJsonSetting(userId, 'savedFreelancers', [] as any[]);
    
    if (rows.length === 0) {
      return res.json(successResponse('Saved freelancers', []));
    }
    
    // Extract actual freelancer IDs from whatever format is in the DB
    const freelancerIds = rows.map((r: any) => {
      if (typeof r === 'string') return r;
      return r.freelancerId || r.id;
    }).filter(Boolean);
    
    const freelancers = await prisma.user.findMany({
      where: { id: { in: freelancerIds }, role: 'freelancer', deletedAt: null },
      include: { freelancerProfile: true }
    });
    
    const rowMap = new Map(freelancers.map((f) => [f.id, f]));
    
    // Map to a clean, flat object format expected by the app
    const populated = rows.map((savedItem: any) => {
      const extractedId = typeof savedItem === 'string' ? savedItem : (savedItem.freelancerId || savedItem.id);
      const f = rowMap.get(extractedId);
      
      if (!f) return null; // Drop if user doesn't exist anymore
      
      const profile = f.freelancerProfile;
      const isObject = typeof savedItem === 'object';
      
      return {
        id: (isObject && savedItem.id !== f.id) ? savedItem.id : `sf-${f.id}`,
        freelancerId: f.id,
        slug: f.id, 
        name: f.fullName || (isObject ? savedItem.name : ''),
        headline: profile?.titleHeadline || (isObject ? savedItem.headline : '') || '',
        avatar: f.avatarUrl || (isObject ? savedItem.avatar : '') || '',
        rate: profile?.hourlyRate || (isObject ? savedItem.rate : 0) || 0,
        rating: profile?.rating || (isObject ? savedItem.rating : 0) || 0,
        location: f.city ? `${f.city}, ${f.country || ''}` : (isObject ? savedItem.location : '') || '',
        savedAt: (isObject && savedItem.savedAt) ? savedItem.savedAt : new Date().toISOString(),
      };
    }).filter(Boolean);
    
    return res.json(successResponse('Saved freelancers', populated));
  } catch (error) { next(error); }
};

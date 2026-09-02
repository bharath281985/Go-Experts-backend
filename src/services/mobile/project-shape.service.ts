import { prisma } from '../../config/database.js';
import { getJsonSetting } from '../../common/helpers/portal-shared.js';

const uuidLike =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseAttachments = (raw?: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && item.url) return String(item.url);
          return '';
        })
        .filter(Boolean);
    }
  } catch {
    // comma-separated fallback
  }
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

const splitIds = (raw?: string | null): string[] =>
  String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

type BudgetRangeRecord = {
  id: string;
  label: string | null;
  value: string | null;
  min: number | null;
  max: number | null;
  sortOrder: number | null;
};

/**
 * Enrich project rows with human-readable names (never expose raw IDs in display fields).
 */
export const shapeProjects = async (
  projects: any[],
  viewerUserId?: string | null
): Promise<any[]> => {
  if (!projects.length) return [];

  const clientIds = [...new Set(projects.map((p) => p.client).filter(Boolean))];
  const industryIds = [
    ...new Set(
      projects
        .map((p) => p.category)
        .filter((c: string) => c && uuidLike.test(c))
    ),
  ];
  const experienceLevelIds = [
    ...new Set(
      projects
        .map((p) => p.experienceLevel)
        .filter((e: string) => e && uuidLike.test(e))
    ),
  ];
  const workModeIds = [
    ...new Set(
      projects
        .map((p) => p.workMode)
        .filter((w: string) => w && uuidLike.test(w))
    ),
  ];
  const skillIds = [
    ...new Set(
      projects.flatMap((p) => splitIds(p.technology)).filter((id) => uuidLike.test(id))
    ),
  ];

  const budgetIds = [...new Set(projects.map((p) => p.budgetRangeId).filter(Boolean))];

  const [clients, industries, skillCategories, experienceLevels, workModes, budgetRanges, skills, masterOptions] = await Promise.all([
    clientIds.length
      ? prisma.user.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, fullName: true, avatarUrl: true, isVerified: true },
      }).catch(() => [])
      : Promise.resolve([]),
    industryIds.length
      ? prisma.industry.findMany({
        where: { id: { in: industryIds } },
        select: { id: true, name: true },
      }).catch(() => [])
      : Promise.resolve([]),
    industryIds.length
      ? prisma.skillCategory.findMany({
        where: { id: { in: industryIds } },
        select: { id: true, name: true },
      }).catch(() => [])
      : Promise.resolve([]),
    experienceLevelIds.length
      ? prisma.experienceLevel.findMany({
        where: { id: { in: experienceLevelIds } },
        select: { id: true, name: true },
      }).catch(() => [])
      : Promise.resolve([]),
    workModeIds.length
      ? prisma.workMode.findMany({
        where: { id: { in: workModeIds } },
        select: { id: true, name: true },
      }).catch(() => [])
      : Promise.resolve([]),
    budgetIds.length
      ? (prisma as any).masterOption?.findMany({
        where: { id: { in: budgetIds } },
        select: { id: true, label: true, value: true, min: true, max: true, sortOrder: true }
      }).catch(() => [])
      : Promise.resolve([]),
    skillIds.length
      ? prisma.skill.findMany({
        where: { id: { in: skillIds } },
        select: { id: true, name: true },
      }).catch(() => [])
      : Promise.resolve([]),
    [...industryIds, ...experienceLevelIds, ...workModeIds, ...skillIds].length
      ? (prisma as any).masterOption?.findMany({
        where: { id: { in: [...industryIds, ...experienceLevelIds, ...workModeIds, ...skillIds] } },
        select: { id: true, label: true, value: true, type: true }
      }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const industryById = new Map<string, string>();
  industries.forEach((i) => industryById.set(i.id, i.name));
  skillCategories.forEach((c) => industryById.set(c.id, c.name));
  (masterOptions || []).forEach((m: any) => {
    if (m.label || m.value) industryById.set(m.id, m.label || m.value);
  });

  const experienceLevelById = new Map<string, any>();
  experienceLevels.forEach((e) => experienceLevelById.set(e.id, e));
  (masterOptions || []).filter((m: any) => m.type === 'experience_level').forEach((m: any) => {
    experienceLevelById.set(m.id, { id: m.id, name: m.label || m.value });
  });

  const workModeById = new Map<string, any>();
  workModes.forEach((w) => workModeById.set(w.id, w));
  (masterOptions || []).filter((m: any) => m.type === 'work_mode').forEach((m: any) => {
    workModeById.set(m.id, { id: m.id, name: m.label || m.value });
  });

  const budgetRangeById = new Map<string, BudgetRangeRecord>(
    (budgetRanges as BudgetRangeRecord[]).map((b) => [b.id, b])
  );

  const skillById = new Map<string, string>();
  skills.forEach((s) => skillById.set(s.id, s.name));
  (masterOptions || []).filter((m: any) => m.type === 'technology' || m.type === 'skill').forEach((m: any) => {
    skillById.set(m.id, m.label || m.value);
  });

  const proposalCounts = await prisma.proposal.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projects.map((p) => p.id) } },
    _count: { id: true },
  }).catch((err) => {
    console.error('[shapeProjects] proposal groupBy failed:', err);
    return [] as { projectId: string; _count: { id: number } }[];
  });
  const countByProject = new Map(
    proposalCounts.map((row) => [row.projectId, row._count.id] as [string, number])
  );

  let savedIds = new Set<string>();
  if (viewerUserId) {
    const savedRows = await getJsonSetting(viewerUserId, 'saved-projects', [] as string[]);
    savedIds = new Set(savedRows);
  }

  return projects.map((project) => {
    const client: any = clientById.get(project.client);
    const skillIdList = splitIds(project.technology);
    const skillNames = skillIdList.map((id) => skillById.get(id) ?? id);
    const catKey = String(project.category || '').trim();
    const industryName = industryById.get(catKey) ?? (uuidLike.test(catKey) ? 'General' : catKey || 'General');
    const experienceLevelKey = String(project.experienceLevel || '').trim();
    const experienceLevelRecord = experienceLevelById.get(experienceLevelKey) || null;
    const experienceLevelName = experienceLevelRecord?.name || experienceLevelKey || 'intermediate';
    const workModeKey = String(project.workMode || '').trim();
    const workModeRecord = workModeById.get(workModeKey) || null;
    const workModeName = workModeRecord?.name || workModeKey || 'Remote';
    const budgetRangeRecord = budgetRangeById.get(String(project.budgetRangeId || '').trim()) || null;

    const formattedSkills = skillIdList.map((id, index) => ({
      skillId: id,
      skillName: skillNames[index]
    }));

    return {
      id: project.id,
      title: project.title,
      description: project.description ?? '',
      clientId: project.client,
      clientName: client?.fullName || 'Client',
      clientAvatar: client?.avatarUrl ?? null,
      clientVerified: Boolean(client?.isVerified),
      industry: {
        id: uuidLike.test(String(project.category || '')) ? project.category : '',
        name: industryName,
      },
      skills: formattedSkills,
      techStack: skillNames,
      technology: skillNames.join(', '),
      budget: project.budget,
      budgetMin: project.budgetMin ?? project.budget,
      budgetMax: project.budgetMax ?? project.budget,
      budgetRange: budgetRangeRecord
        ? {
            id: budgetRangeRecord.id,
            label: budgetRangeRecord.label ?? '',
            value: budgetRangeRecord.value ?? '',
            min: budgetRangeRecord.min,
            max: budgetRangeRecord.max,
            sortOrder: budgetRangeRecord.sortOrder ?? 0,
          }
        : null,
      isHourly: false,
      timeline: project.timeline ?? '',
      startDate: project.startDate ? new Date(project.startDate).toISOString() : null,
      endDate: project.endDate ? new Date(project.endDate).toISOString() : null,
      workMode: {
        id: workModeRecord?.id || '',
        name: workModeName,
      },
      experienceLevel: {
        id: experienceLevelRecord?.id || '',
        name: experienceLevelName,
      },
      attachments: parseAttachments(project.attachments),
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      proposalsCount: countByProject.get(project.id) ?? 0,
      shareCount: project.shareCount ?? 0,
      isOwner: Boolean(viewerUserId && viewerUserId === project.client),
      milestones: project.milestones,
      tasks: project.tasks,
      proposals: undefined,
      isSaved: savedIds.has(project.id),
    };
  });
};

export const shapeProject = async (
  project: any,
  viewerUserId?: string | null
) => {
  const [shaped] = await shapeProjects([project], viewerUserId);
  return shaped;
};

export const serializeAttachments = (attachments: unknown): string | null => {
  if (!attachments) return null;

  const imageExt =
    /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif|svg|ico|tif|tiff)(\?|$)/i;

  const toUrls = (items: unknown[]): string[] =>
    items
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && (item as any).url) {
          return String((item as any).url).trim();
        }
        return '';
      })
      .filter(Boolean)
      .filter((url) => !imageExt.test(url));

  let urls: string[] = [];
  if (typeof attachments === 'string') {
    try {
      const parsed = JSON.parse(attachments);
      urls = Array.isArray(parsed) ? toUrls(parsed) : toUrls([attachments]);
    } catch {
      urls = toUrls(
        attachments
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  } else if (Array.isArray(attachments)) {
    urls = toUrls(attachments);
  } else {
    return null;
  }

  // Cap at 20 project attachments.
  urls = [...new Set(urls)].slice(0, 20);
  return JSON.stringify(urls);
};

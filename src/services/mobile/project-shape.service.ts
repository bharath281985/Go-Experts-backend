import { prisma } from '../../config/database.js';

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

  const [clients, industries, experienceLevels, workModes, budgetRanges, skills] = await Promise.all([
    clientIds.length
      ? prisma.user.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, fullName: true, avatarUrl: true, isVerified: true },
      })
      : Promise.resolve([]),
    industryIds.length
      ? prisma.skillCategory.findMany({
        where: { id: { in: industryIds } },
        select: { id: true, name: true },
      })
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
      })
      : Promise.resolve([]),
  ]);

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const industryById = new Map(industries.map((c) => [c.id, c.name]));
  const experienceLevelById = new Map(experienceLevels.map((c) => [c.id, c.name]));
  const workModeById = new Map(workModes.map((c) => [c.id, c.name]));
  const budgetRangeById = new Map<string, BudgetRangeRecord>(
    (budgetRanges as BudgetRangeRecord[]).map((b) => [b.id, b])
  );
  const skillById = new Map(skills.map((s) => [s.id, s.name]));

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

  return projects.map((project) => {
    const client: any = clientById.get(project.client);
    const skillIdList = splitIds(project.technology);
    const skillNames = skillIdList.map((id) => skillById.get(id) ?? id);
    const industryName = uuidLike.test(String(project.category || ''))
      ? industryById.get(project.category) ?? 'General'
      : project.category || 'General';
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

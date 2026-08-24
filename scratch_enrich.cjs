const fs = require('fs');
let code = fs.readFileSync('src/controllers/client/client.controller.ts', 'utf8');

const replacement = "export const getClientProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {\n" +
"  try {\n" +
"    const userId = requireUser(req, res);\n" +
"    if (!userId) return;\n" +
"    const project = await findOwnedProject(userId, req.params.id);\n" +
"    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });\n" +
"    const [tasks, proposals, contracts, milestones, clientUser] = await Promise.all([\n" +
"      prisma.task.findMany({ where: { projectId: project.id, deletedAt: null } }),\n" +
"      prisma.proposal.findMany({\n" +
"        where: { projectId: project.id, deletedAt: null },\n" +
"        include: { freelancer: { select: { id: true, fullName: true, email: true, avatarUrl: true, title: true, rating: true, country: true } } },\n" +
"        orderBy: { createdAt: 'desc' },\n" +
"      }),\n" +
"      prisma.contract.findMany({ where: { projectId: project.id, deletedAt: null } }),\n" +
"      prisma.milestone.findMany({ where: { projectId: project.id, deletedAt: null } }),\n" +
"      prisma.user.findUnique({ where: { id: project.client }, select: { id: true, fullName: true, avatarUrl: true, country: true, company: true } })\n" +
"    ]);\n" +
"    let industryName = null;\n" +
"    if (project.industryId) {\n" +
"       const ind = await prisma.industry.findUnique({ where: { id: project.industryId } }).catch(()=>null);\n" +
"       if (ind) industryName = ind.name;\n" +
"    }\n" +
"    let parsedAttachments = [];\n" +
"    try { if (project.attachments) parsedAttachments = JSON.parse(project.attachments); } catch(e) {}\n" +
"    let parsedTech = [];\n" +
"    try { if (project.technology) { parsedTech = typeof project.technology === 'string' && project.technology.startsWith('[') ? JSON.parse(project.technology) : project.technology.split(',').map(s => s.trim()); } } catch(e) {}\n" +
"    res.json({ success: true, data: { ...project, clientDetails: clientUser, industryName: industryName || 'Technology', parsedAttachments, parsedTech, tasks, proposals, contracts, milestones } });\n" +
"  } catch (err) {\n" +
"    handleError(err, res, next);\n" +
"  }\n" +
"};";

code = code.replace(/export const getClientProject = async.*?handleError\(err, res, next\);\n  }\n};/s, replacement);
fs.writeFileSync('src/controllers/client/client.controller.ts', code);
console.log('Updated getClientProject!');

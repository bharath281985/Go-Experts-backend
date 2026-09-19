import { Response, Request, NextFunction, Router } from "express";
import { prisma } from "../../config/database.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

export function createCrudRouter(
  modelName: keyof typeof prisma,
  searchColumns: string[] = [],
  options: { include?: Record<string, unknown> } = {}
): Router {
  const router = Router();
  const db: any = prisma[modelName];
  const include = options.include;

  if (!db) {
    throw new Error(`Model ${String(modelName)} does not exist in Prisma Client.`);
  }

  // Helper to format generic master records with description, code, and slug
  const formatRecord = (row: any) => {
    if (!row) return row;
    const label = row.label || row.name || row.title || row.value || "Reference Item";
    const slugVal = row.slug || row.code || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const codeVal = row.code || row.referenceCode || row.value || label.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    const descVal = row.description || `Platform reference catalog configuration option for ${label}.`;

    return {
      ...row,
      name: row.name || label,
      label: row.label || label,
      description: descVal,
      code: codeVal,
      referenceCode: codeVal,
      slug: slugVal,
    };
  };

  const applyCustomMappings = async (mName: string, rows: any[]) => {
    if (rows.length === 0) return rows;
    let finalRows = [...rows];

    if (String(mName).toLowerCase() === "project") {
      const clientIds = Array.from(new Set(rows.map((r: any) => r.client).filter(Boolean)));
      const clients = await prisma.user.findMany({ where: { id: { in: clientIds as string[] } }, select: { id: true, fullName: true } });
      const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.fullName]));
      
      const catIds = Array.from(new Set(rows.map((r: any) => r.category).filter(Boolean)));
      const cats = await prisma.skillCategory.findMany({ where: { id: { in: catIds as string[] } }, select: { id: true, name: true } });
      const catMap = Object.fromEntries(cats.map((c: any) => [c.id, c.name]));
      
      const techIds = Array.from(new Set(rows.flatMap((r: any) => (r.technology || "").split(",")).filter(Boolean)));
      const techs = await prisma.skill.findMany({ where: { id: { in: techIds as string[] } }, select: { id: true, name: true } });
      const techMap = Object.fromEntries(techs.map((c: any) => [c.id, c.name]));
      
      const moIds = Array.from(new Set(rows.flatMap((r: any) => [r.budgetRangeId, r.workMode]).filter(Boolean)));
      const mos = await prisma.masterOption.findMany({ where: { id: { in: moIds as string[] } }, select: { id: true, label: true } });
      const moMap = Object.fromEntries(mos.map((m: any) => [m.id, m.label]));

      const mapExp = (slug: string) => slug === "mo_experience_level_intermediate" ? "Intermediate" : 
                                       slug === "mo_experience_level_expert" ? "Expert" : 
                                       slug === "mo_experience_level_entry" ? "Entry Level" : slug;

      finalRows = rows.map((r: any) => ({
        ...r,
        client: clientMap[r.client] || r.client,
        category: catMap[r.category] || r.category,
        technology: (r.technology || "").split(",").map((id: string) => techMap[id] || id).join(", "),
        budgetRangeId: moMap[r.budgetRangeId] || r.budgetRangeId,
        workMode: moMap[r.workMode] || r.workMode,
        experienceLevel: r.experienceLevel ? mapExp(r.experienceLevel) : r.experienceLevel
      }));
    } else if (String(mName) === "StartupIdea") {
      const founderIds = Array.from(new Set(rows.map((r: any) => r.founder).filter(v => v && v.length > 20)));
      const founders = await prisma.user.findMany({ where: { id: { in: founderIds as string[] } }, select: { id: true, fullName: true, email: true } });
      const founderMap = Object.fromEntries(founders.map((c: any) => [c.id, c.fullName || c.email]));

      const indIds = Array.from(new Set(rows.map((r: any) => r.industry).filter(v => v && v.length > 20)));
      const inds = await prisma.industry.findMany({ where: { id: { in: indIds as string[] } }, select: { id: true, name: true } });
      const indMap = Object.fromEntries(inds.map((c: any) => [c.id, c.name]));

      const catIds = Array.from(new Set(rows.map((r: any) => r.category).filter(v => v && v.length > 20)));
      const cats = await prisma.skillCategory.findMany({ where: { id: { in: catIds as string[] } }, select: { id: true, name: true } });
      const catMap = Object.fromEntries(cats.map((c: any) => [c.id, c.name]));

      const stageIds = Array.from(new Set(rows.map((r: any) => r.stage).filter(v => v && v.length > 20)));
      const stages = await prisma.startupStage.findMany({ where: { id: { in: stageIds as string[] } }, select: { id: true, name: true } });
      const stageMap = Object.fromEntries(stages.map((c: any) => [c.id, c.name]));

      finalRows = rows.map((r: any) => ({
        ...r,
        founder: founderMap[r.founder] || r.founder,
        industry: indMap[r.industry] || r.industry,
        category: catMap[r.category] || r.category,
        stage: stageMap[r.stage] || r.stage,
      }));
    } else if (String(mName) === "Investment") {
      const investorIds = Array.from(new Set(rows.map((r: any) => r.investor).filter(v => v && v.length > 20)));
      const investors = await prisma.user.findMany({ where: { id: { in: investorIds as string[] } }, select: { id: true, fullName: true, email: true } });
      const investorMap = Object.fromEntries(investors.map((c: any) => [c.id, c.fullName || c.email]));

      const startupIds = Array.from(new Set(rows.map((r: any) => r.startup).filter(v => v && v.length > 20)));
      const startups = await prisma.startupIdea.findMany({ where: { id: { in: startupIds as string[] } }, select: { id: true, startup: true } });
      const startupMap = Object.fromEntries(startups.map((c: any) => [c.id, c.startup]));

      finalRows = rows.map((r: any) => ({
        ...r,
        investor: investorMap[r.investor] || r.investor,
        startup: startupMap[r.startup] || r.startup,
      }));
    } else if (String(mName) === "Meeting") {
      const participantIds = Array.from(new Set(
        rows.flatMap((r: any) => [r.founder, r.investor]).filter(v => v && v.length > 20)
      ));
      const participants = await prisma.user.findMany({
        where: { id: { in: participantIds as string[] } },
        select: { id: true, fullName: true, email: true },
      });
      const participantMap = Object.fromEntries(
        participants.map((participant: any) => [participant.id, participant.fullName || participant.email])
      );

      finalRows = rows.map((r: any) => ({
        ...r,
        founderId: r.founder,
        investorId: r.investor,
        founder: participantMap[r.founder] || r.founder,
        investor: participantMap[r.investor] || r.investor,
      }));
    }

    return finalRows;
  };

  // 1. LIST (with search, pagination, sorting, filters)
  router.get("/", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const search = req.query.search as string;
      const orderBy = req.query.orderBy as string;
      const ascending = req.query.ascending === "true" || req.query.ascending === undefined;
      
      let filters: any = {};
      if (req.query.filters) {
        try {
          filters = JSON.parse(req.query.filters as string);
        } catch {
          filters = {};
        }
      }

      // Format filters to fit Prisma where clauses (ignore empty values)
      const where: any = {};
      Object.entries(filters || {}).forEach(([key, value]) => {
        if (value == null || value === "") return;
        if (typeof value === "string") {
          where[key] = value;
          return;
        }
        where[key] = value;
      });

      // Handle search columns (using OR contains)
      if (search && searchColumns.length > 0) {
        where.OR = searchColumns.map(col => ({
          [col]: {
            contains: search,
          }
        }));
      }

      // Exclude soft deleted if model supports it
      const modelFields = (prisma as any)._dmmf?.modelMap?.[modelName]?.fields || [];
      const hasDeletedAt = modelFields.some((f: any) => f.name === "deletedAt");
      if (hasDeletedAt) {
        where.deletedAt = null;
      }

      const total = await db.count({ where });
      
      const rows = await db.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: orderBy ? { [orderBy]: ascending ? "asc" : "desc" } : { createdAt: "desc" },
        ...(include ? { include } : {}),
      });

      const finalRows = await applyCustomMappings(String(modelName), rows);
      res.json({ success: true, rows: finalRows.map(formatRecord), total });
    } catch (err) {
      next(err);
    }
  });

  // 1b. POST LIST (compatibility helper for POST /list)
  router.post("/list", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = req.body?.page || parseInt(req.query.page as string) || 1;
      const pageSize = req.body?.pageSize || parseInt(req.query.pageSize as string) || 50;
      const search = req.body?.search || (req.query.search as string);
      const orderBy = req.body?.orderBy || (req.query.orderBy as string);
      const ascending = req.body?.ascending !== undefined ? req.body.ascending : req.query.ascending === "true";
      
      const where: any = {};
      const rawFilters = req.body?.filters || (req.query.filters ? JSON.parse(req.query.filters as string) : {});
      Object.entries(rawFilters || {}).forEach(([key, value]) => {
        if (value == null || value === "") return;
        where[key] = value;
      });

      if (search && searchColumns.length > 0) {
        where.OR = searchColumns.map(col => ({
          [col]: {
            contains: search,
          }
        }));
      }

      const total = await db.count({ where });
      const rows = await db.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: orderBy ? { [orderBy]: ascending ? "asc" : "desc" } : { createdAt: "desc" },
        ...(include ? { include } : {}),
      });

      const finalRows = await applyCustomMappings(String(modelName), rows);
      res.json({ success: true, rows: finalRows.map(formatRecord), total });
    } catch (err) {
      next(err);
    }
  });

  // 2. EXPORT (Excel/CSV mock data file download or full JSON dump)
  router.get("/export", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rows = await db.findMany();
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=${String(modelName).toLowerCase()}_export.json`);
      const finalRows = await applyCustomMappings(String(modelName), rows);
      res.json({ success: true, rows: finalRows.map(formatRecord) });
    } catch (err) {
      next(err);
    }
  });

  // 3. IMPORT
  router.post("/import", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ success: false, message: "Invalid payload: items array required" });
      }

      const created = [];
      for (const item of items) {
        const row = await db.create({ data: item });
        created.push(row);
      }

      res.status(201).json({ success: true, count: created.length, rows: created.map(formatRecord) });
    } catch (err) {
      next(err);
    }
  });

  // 4. GET ONE
  router.get("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const row = await db.findUnique({
        where: { id: req.params.id },
        ...(include ? { include } : {}),
      });
      if (!row) {
        return res.status(404).json({ success: false, message: "Record not found" });
      }
      const formatted = formatRecord(row);
      res.json({ success: true, data: formatted, row: formatted });
    } catch (err) {
      next(err);
    }
  });

function sanitizeModelData(modelName: string, data: any) {
  if (!data || typeof data !== "object") return {};

  const dmmfModels = (prisma as any)._dmmf?.modelMap || (prisma as any)._runtimeDataModel?.models || {};
  const modelFields: any[] = dmmfModels[modelName]?.fields || [];

  const { id, createdAt, updatedAt, ...cleanData } = data;

  if (modelFields.length > 0) {
    const validFieldNames = new Set(modelFields.map((f: any) => f.name));
    const sanitized: any = {};
    for (const key of Object.keys(cleanData)) {
      if (validFieldNames.has(key)) {
        sanitized[key] = cleanData[key];
      }
    }
    return sanitized;
  }

  // Fallback: strip known UI properties that are not schema columns
  const { code, verification, category, user, plan, invoice, relatedUser, relatedPlan, ...fallbackData } = cleanData;
  return fallbackData;
}

function ensureBlogAdminAuthor(modelName: string, data: any, req: AuthenticatedRequest) {
  if (String(modelName) !== "Blog") return data;
  const adminName = req.user?.fullName || req.user?.name || req.user?.email || "Admin";
  const nextData = { ...data };

  if (!nextData.author || String(nextData.author).trim() === "") {
    nextData.author = adminName;
  }

  return nextData;
}

  // 5. CREATE
  router.post("/", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const sanitized = ensureBlogAdminAuthor(
        String(modelName),
        sanitizeModelData(String(modelName), req.body),
        req,
      );
      const row = await db.create({ data: sanitized });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  });

    // 6. UPDATE
    router.put("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const sanitized = ensureBlogAdminAuthor(
          String(modelName),
          sanitizeModelData(String(modelName), req.body),
          req,
        );

        // Fetch old user if this is a user update
        let oldUser: any = null;
        const sModel = String(modelName);
        if (sModel === "user" || sModel === "client" || sModel === "freelancer" || sModel === "investor" || sModel === "founder") {
            const actualModel = sModel === "user" ? "user" : "user"; // always fetch user
            // If the model is not user, but the route is updating user (roles route alias), id is user id
            oldUser = await prisma.user.findUnique({ where: { id: req.params.id }});
        }

        const row = await db.update({
          where: { id: req.params.id },
          data: sanitized,
        });

        // Trigger welcome email if onboardingStatus was just changed to COMPLETED by admin
        if (oldUser && sanitized.onboardingStatus === "COMPLETED" && oldUser.onboardingStatus !== "COMPLETED") {
          try {
            const { EmailChannelAdapter } = await import("../../modules/notifications/notification.service.js");
            const emailAdapter = new EmailChannelAdapter();
            const { renderEmailTemplate } = await import("../../services/settings/settings.service.js");
            
            let parsedConfig = {};
            const chanConfig = await prisma.communicationChannel.findUnique({ where: { name: "email" } }).catch(()=>null);
            if (chanConfig?.config) parsedConfig = JSON.parse(chanConfig.config);
            
            const trialDateStr = (row.trialEndsAt || new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
            const welcomeRendered = await renderEmailTemplate("tpl_welcome", {
              full_name: row.fullName || "User",
              email: row.email,
              role: (row.role || "user").toUpperCase(),
              trial_days: "90",
              trial_ends_at: trialDateStr,
              selected_plan: "Free plan after KYC approval",
              app_url: process.env.CLIENT_URL || "https://goexperts.in",
            });
            
            await emailAdapter.send({
              to: row.email,
              subject: welcomeRendered.subject,
              body: welcomeRendered.html,
              html: welcomeRendered.html,
            }, parsedConfig);
            console.log(`[ADMIN] Triggered welcome email for ${row.email} after manual onboarding completion.`);
          } catch (err) {
            console.warn("[ADMIN] Failed to trigger welcome email:", err);
          }
        }

        res.json({ success: true, data: row });
      } catch (err) {
        next(err);
      }
    });

  // 7. STATUS UPDATE (PATCH)
  router.patch("/:id/status", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ success: false, message: "Status value required" });
      }
      const row = await db.update({
        where: { id: req.params.id },
        data: { status },
      });
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  });

  // 8. DELETE (Soft delete if deletedAt exists, else hard delete)
  router.delete("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const modelFields = (prisma as any)._dmmf?.modelMap?.[modelName]?.fields || [];
      const hasDeletedAt = modelFields.some((f: any) => f.name === "deletedAt");

      if (String(modelName).toLowerCase() === "skillcategory") {
        const cat = await (prisma as any).skillCategory.findUnique({ where: { id: req.params.id } }).catch(() => null);
        await (prisma as any).skill.deleteMany({
          where: {
            OR: [
              { categoryId: req.params.id },
              ...(cat?.name ? [{ category: { is: { name: cat.name } } }, { industry: cat.name }] : [])
            ]
          }
        }).catch(() => {});
      }

      if (hasDeletedAt) {
        await db.update({
          where: { id: req.params.id },
          data: { deletedAt: new Date() },
        });
      } else {
        await db.delete({ where: { id: req.params.id } });
      }

      res.json({ success: true, ok: true });
    } catch (err) {
      next(err);
    }
  });

  // 9. BULK DELETE
  router.post("/bulk-delete", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: "Array of ids is required" });
      }

      const modelFields = (prisma as any)._dmmf?.modelMap?.[modelName]?.fields || [];
      const hasDeletedAt = modelFields.some((f: any) => f.name === "deletedAt");

      if (String(modelName).toLowerCase() === "skillcategory") {
        await (prisma as any).skill.deleteMany({
          where: { categoryId: { in: ids } }
        }).catch(() => {});
      }

      if (hasDeletedAt) {
        await db.updateMany({
          where: { id: { in: ids } },
          data: { deletedAt: new Date() },
        });
      } else {
        await db.deleteMany({
          where: { id: { in: ids } },
        });
      }

      res.json({ success: true, ok: true, count: ids.length });
    } catch (err) {
      next(err);
    }
  });

  // 10. BULK STATUS
  router.post("/bulk-status", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { ids, value, field = "status" } = req.body;
      if (!Array.isArray(ids) || ids.length === 0 || value === undefined) {
        return res.status(400).json({ success: false, message: "Array of ids and value are required" });
      }

      await db.updateMany({
        where: { id: { in: ids } },
        data: { [field]: value },
      });

      res.json({ success: true, ok: true });
    } catch (err) {
      next(err);
    }
  });

  // 11. BULK IMPORT
  router.post("/import", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rows } = req.body;
      const importItems = Array.isArray(rows) ? rows : (Array.isArray(req.body) ? req.body : []);
      if (importItems.length === 0) {
        return res.status(400).json({ success: false, message: "Array of rows is required for import" });
      }

      const createdRecords = [];
      for (const rawRow of importItems) {
        if (!rawRow || typeof rawRow !== "object") continue;
        if (!rawRow.name && !rawRow.label && !rawRow.title && !rawRow.code) continue;
        const sanitized = sanitizeModelData(String(modelName), rawRow);
        const created = await db.create({ data: sanitized }).catch(() => null);
        if (created) createdRecords.push(created);
      }

      res.status(201).json({
        success: true,
        count: createdRecords.length,
        data: createdRecords,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}




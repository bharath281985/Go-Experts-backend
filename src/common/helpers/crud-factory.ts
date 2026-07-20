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

      res.json({ success: true, rows, total });
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
      res.json({ success: true, rows });
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

      res.status(201).json({ success: true, count: created.length, rows: created });
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
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  });

  // 5. CREATE
  router.post("/", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const row = await db.create({ data: req.body });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  });

  // 6. UPDATE
  router.put("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const row = await db.update({
        where: { id: req.params.id },
        data: req.body,
      });
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

  return router;
}

import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";

// ============================================================
// AUDIT LOGGING HELPER
// ============================================================
async function logReportAction(params: {
  actorId: string;
  action: string; // run, export
  description: string;
  queryMeta: any;
}) {
  const { actorId, action, description, queryMeta } = params;

  await prisma.activityLog.create({
    data: {
      adminUserId: actorId,
      action: `REPORT_${action.toUpperCase()}`,
      description,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entity: "reports",
      ipAddress: "127.0.0.1",
      newValue: JSON.stringify(queryMeta),
    },
  });
}

// ============================================================
// CSV FORMATTING HELPER
// ============================================================
function convertJsonToCsv(data: any[]): string {
  if (!data || data.length === 0) return "";
  
  // Extract all unique headers
  const headers = Object.keys(data[0]);
  
  const csvRows = [
    headers.join(","), // header row
    ...data.map((row) =>
      headers
        .map((header) => {
          const val = row[header];
          if (val === null || val === undefined) return '""';
          if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ];

  return csvRows.join("\r\n");
}

// ============================================================
// CUSTOM REPORT CONTROLLER
// ============================================================
export const getCustomReport = async (req: any, res: Response, next: NextFunction) => {
  try {
    const {
      source = "users", // users, projects, investments, support
      startDate,
      endDate,
      role,
      status,
      country,
      city,
      category,
      technology,
      priority,
      exportFormat, // csv, excel, pdf
    } = req.query;

    const actorId = req.user?.id || "system";
    const where: any = {};

    // 1. Apply Date Range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    let records: any[] = [];

    // 2. Fetch based on source
    if (source === "users") {
      if (role) where.role = role;
      if (status) where.status = status;
      if (country) where.country = country;
      if (city) where.city = city;

      records = await prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 1000, // limit safety
      });
    } else if (source === "projects") {
      if (status) where.status = status;
      if (category) where.category = category;
      if (technology) where.technology = technology;

      records = await prisma.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
    } else if (source === "investments") {
      if (status) where.status = status;

      records = await prisma.investment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
    } else if (source === "support") {
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (category) where.category = category;

      records = await prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
    } else {
      return res.status(400).json({ success: false, message: `Unsupported report source: ${source}` });
    }

    // Audit the action
    await logReportAction({
      actorId,
      action: exportFormat ? "export" : "run",
      description: `${exportFormat ? "Exported" : "Generated"} custom report for source: "${source}"`,
      queryMeta: { source, exportFormat, filtersCount: Object.keys(where).length },
    });

    // 3. Handle File Exports
    if (exportFormat === "csv" || exportFormat === "excel") {
      const csvString = convertJsonToCsv(records);
      const filename = `${source}_report_${Date.now()}.csv`;
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      return res.send(csvString);
    } else if (exportFormat === "pdf") {
      // Basic print summary report
      const pdfText = `
GO EXPERTS REPORT: ${source.toUpperCase()}
Generated At: ${new Date().toLocaleString()}
Filter parameters: ${JSON.stringify(req.query)}
Total records: ${records.length}
============================================================
${JSON.stringify(records, null, 2)}
      `;
      const filename = `${source}_report_${Date.now()}.txt`;
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      return res.send(pdfText);
    }

    res.json({
      success: true,
      data: {
        source,
        count: records.length,
        records,
      },
    });
  } catch (err) {
    next(err);
  }
};

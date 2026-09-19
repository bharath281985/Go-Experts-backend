import { Request, Response } from "express";
import { prisma } from "../../config/database.js";

// GET /api/v1/public/careers/cms
export const getCareersCms = async (req: Request, res: Response) => {
  try {
    const cms = await prisma.cmsCareers.findFirst();
    if (!cms) {
      return res.status(200).json({ success: true, data: {} });
    }
    return res.status(200).json({ success: true, data: cms });
  } catch (error) {
    console.error("getCareersCms error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch careers CMS content" });
  }
};

// GET /api/v1/public/careers/jobs
export const getJobs = async (req: Request, res: Response) => {
  try {
    const { search, department, location, type, experience } = req.query;

    const whereClause: any = {
      status: "PUBLISHED",
    };

    if (search) {
      whereClause.title = { contains: String(search) };
    }
    if (department) {
      whereClause.department = { slug: String(department) };
    }
    if (location) {
      whereClause.location = { contains: String(location) };
    }
    if (type) {
      whereClause.employmentType = String(type);
    }
    if (experience) {
      whereClause.experienceLevel = String(experience);
    }

    const jobs = await prisma.jobOpening.findMany({
      where: whereClause,
      include: {
        departmentRel: true,
      },
      orderBy: [
        { featured: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    console.error("getJobs error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch jobs" });
  }
};

// GET /api/v1/public/careers/jobs/:slug
export const getJobBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    // Increment view count
    await prisma.jobOpening.updateMany({
      where: { slug, status: "PUBLISHED" },
      data: { views: { increment: 1 } }
    });

    const job = await prisma.jobOpening.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: {
        departmentRel: true,
      }
    });

    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    console.error("getJobBySlug error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch job" });
  }
};

// GET /api/v1/public/careers/departments
export const getDepartments = async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' }
    });
    return res.status(200).json({ success: true, data: departments });
  } catch (error) {
    console.error("getDepartments error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch departments" });
  }
};

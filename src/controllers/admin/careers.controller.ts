import { Request, Response, NextFunction } from "express";
import { careersCmsService } from "../../services/admin/careers.service.js";

export async function getPublicCareersPage(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await careersCmsService.getPublicCareersPage();
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function getAdminCareersPage(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await careersCmsService.getAdminCareersPage();
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function saveCareersDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await careersCmsService.saveCareersDraft(req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function publishCareersPage(req: Request, res: Response, next: NextFunction) {
  try {
    const adminName = (req as any).user?.name || "Admin";
    const result = await careersCmsService.publishCareersPage(req.body, adminName);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

/* Jobs */
export async function listPublicJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, department, location, workplaceType, employmentType } = req.query;
    const result = await careersCmsService.listPublicJobs({
      search: search as string,
      department: department as string,
      location: location as string,
      workplaceType: workplaceType as string,
      employmentType: employmentType as string,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function getPublicJobBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await careersCmsService.getPublicJobBySlug(req.params.slug);
    res.json(result);
  } catch (e: any) {
    res.status(404).json({ success: false, message: e.message || "Job not found." });
  }
}

export async function listAdminJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, search, status, department } = req.query;
    const result = await careersCmsService.listAdminJobs({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search: search as string,
      status: status as string,
      department: department as string,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function createJob(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await careersCmsService.createJob(req.body);
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || "Failed to create job opening." });
  }
}

export async function updateJob(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await careersCmsService.updateJob(req.params.id, req.body);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || "Failed to update job." });
  }
}

export async function deleteJob(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await careersCmsService.deleteJob(req.params.id);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

/* Applications */
export async function submitCareerApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await careersCmsService.submitCareerApplication(req.body);
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || "Failed to submit career application." });
  }
}

export async function listCareerApplications(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, search, status, jobId } = req.query;
    const result = await careersCmsService.listCareerApplications({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search: search as string,
      status: status as string,
      jobId: jobId as string,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function getCareerApplicationById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await careersCmsService.getCareerApplicationById(req.params.id);
    res.json(result);
  } catch (e: any) {
    res.status(404).json({ success: false, message: e.message || "Application not found." });
  }
}

export async function updateCareerApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await careersCmsService.updateCareerApplication(req.params.id, req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

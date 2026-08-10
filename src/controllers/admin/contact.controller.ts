import { Request, Response, NextFunction } from "express";
import { contactCmsService } from "../../services/admin/contact.service.js";

export async function getPublicContactPage(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await contactCmsService.getPublicContactPage();
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function submitContactEnquiry(req: Request, res: Response, next: NextFunction) {
  try {
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";

    const result = await contactCmsService.submitPublicEnquiry({
      ...req.body,
      ipAddress,
      userAgent,
    });
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message || "Failed to submit contact enquiry." });
  }
}

export async function getAdminContactPage(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await contactCmsService.getAdminContactPage();
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function saveContactDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await contactCmsService.saveContactDraft(req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function publishContactPage(req: Request, res: Response, next: NextFunction) {
  try {
    const adminName = (req as any).user?.name || "Admin";
    const result = await contactCmsService.publishContactPage(req.body, adminName);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function listContactEnquiries(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, search, status, enquiryType, priority } = req.query;
    const result = await contactCmsService.listContactEnquiries({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search: search as string,
      status: status as string,
      enquiryType: enquiryType as string,
      priority: priority as string,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function getContactEnquiryById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await contactCmsService.getContactEnquiryById(req.params.id);
    res.json(result);
  } catch (e: any) {
    res.status(404).json({ success: false, message: e.message || "Enquiry not found." });
  }
}

export async function updateContactEnquiry(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await contactCmsService.updateContactEnquiry(req.params.id, req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

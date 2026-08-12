import { Router } from "express";
import { 
  listTemplates, 
  getTemplate, 
  createTemplate, 
  updateTemplate,
  publishTemplate, 
  archiveTemplate, 
  duplicateTemplate 
} from "../../controllers/admin/resume-template.controller";

const resumeTemplateRouter = Router();

resumeTemplateRouter.get("/", listTemplates);
resumeTemplateRouter.post("/", createTemplate);
resumeTemplateRouter.get("/:id", getTemplate);
resumeTemplateRouter.put("/:id", updateTemplate);
resumeTemplateRouter.post("/:id/publish", publishTemplate);
resumeTemplateRouter.post("/:id/archive", archiveTemplate);
resumeTemplateRouter.post("/:id/duplicate", duplicateTemplate);

export default resumeTemplateRouter;
